#!/usr/bin/env node
/**
 * knoxel-server.js
 *
 * Wrapper around the PocketBase binary that handles:
 *   1. Starting PocketBase
 *   2. Waiting for it to be ready
 *   3. Provisioning a superuser session (non-interactive — see BOOTSTRAP_EMAIL)
 *   4. World selection / creation via CLI prompt
 *   5. Setting is_active=true on the selected world in the database
 *   6. Serving everything from one URL if server/pb_public exists (a real
 *      distributable), or also starting the Vite dev server if not (a dev
 *      checkout — see scripts/build.sh)
 *
 * Usage:
 *   node scripts/knoxel-server.js
 *   node scripts/knoxel-server.js --world "CS102 Week 4"
 *   node scripts/knoxel-server.js --new "CS102 Week 7"
 *
 * The active world is tracked via is_active=true on the worlds collection.
 * Client queries: /api/collections/worlds/records?filter=(is_active=true)&perPage=1
 */

const { spawn, execSync, execFileSync } = require('child_process')
const http     = require('http')
const https    = require('https')
const fs       = require('fs')
const path     = require('path')
const crypto   = require('crypto')
const readline = require('readline')

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const POCKETBASE_DIR    = path.join(__dirname, '..', 'server')
const CLIENT_DIR        = path.join(__dirname, '..', 'client')
const PB_BINARY         = path.join(POCKETBASE_DIR, 'pocketbase')
const PB_URL            = 'http://127.0.0.1:8090'
const HEALTH_TIMEOUT_MS = 30_000
const HEALTH_POLL_MS    = 500

// Load .env from project root (shell env takes priority)
const envFile = path.join(__dirname, '..', '.env')
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq === -1) return
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload  = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
    const parsed   = new URL(url)
    const client   = parsed.protocol === 'https:' ? https : http
    const options  = {
      hostname: parsed.hostname,
      port:     parsed.port,
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }
    const req = client.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

const httpGet   = (url, headers)       => request('GET',   url, null, headers)
const httpPost  = (url, body, headers) => request('POST',  url, body, headers)
const httpPatch = (url, body, headers) => request('PATCH', url, body, headers)
const auth      = token => token ? { Authorization: `Bearer ${token}` } : {}

// ─────────────────────────────────────────────────────────────────────────────
// POCKETBASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function waitForPocketBase() {
  const start = Date.now()
  process.stdout.write('Waiting for PocketBase')
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      await httpGet(`${PB_URL}/api/health`)
      console.log(' ready.\n')
      return
    } catch {
      process.stdout.write('.')
      await sleep(HEALTH_POLL_MS)
    }
  }
  throw new Error(`PocketBase did not start within ${HEALTH_TIMEOUT_MS / 1000}s`)
}

async function authAsAdmin(email, password) {
  try {
    const res = await httpPost(
      `${PB_URL}/api/collections/_superusers/auth-with-password`,
      { identity: email, password }
    )
    if (res.status === 200) return JSON.parse(res.body).token
    return null
  } catch {
    return null
  }
}

// Fixed, unlisted account this wrapper uses to manage worlds via the REST
// API. worlds.createRule/updateRule require a superuser session (see
// pb_migrations/003).
//
// An earlier version of this file tried to *detect* whether a superuser
// already existed (POST bogus credentials, treat HTTP 400 as "one exists")
// and, if not, opened a browser to /_/ for the operator to create one by
// hand. That heuristic is wrong: PocketBase returns the same 400 for "wrong
// password" and "no such account", so it always reported true, and the
// browser-creation step never ran on an actual first install. It also
// assumed a local browser exists at all, which fails outright on a
// headless Tier 3 cloud box.
//
// `pocketbase superuser upsert` is PocketBase's own documented mechanism
// for provisioning a superuser non-interactively and is idempotent, so
// there's nothing to detect — just (re)create this one account with a
// freshly generated password every run and use it as our session. It
// operates directly on the SQLite file (no HTTP involved), so it works
// whether or not the `serve` process has already reached "ready".
const BOOTSTRAP_EMAIL = 'knoxel-bootstrap@knoxel.local'

function generatePassword() {
  return crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)
}

async function ensureAdminToken() {
  // An operator-provided superuser (e.g. to log into /_/ under a known
  // identity for manual DB poking) is honored if present and valid;
  // otherwise fall back to the self-managed bootstrap account.
  const envEmail    = process.env.PB_ADMIN_EMAIL
  const envPassword = process.env.PB_ADMIN_PASSWORD
  if (envEmail && envPassword) {
    const token = await authAsAdmin(envEmail, envPassword)
    if (token) return token
    console.warn('PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD in .env did not authenticate — falling back to the built-in admin account.\n')
  }

  const password = generatePassword()
  execFileSync(PB_BINARY, ['superuser', 'upsert', BOOTSTRAP_EMAIL, password], {
    cwd: POCKETBASE_DIR,
    stdio: 'ignore',
  })
  const token = await authAsAdmin(BOOTSTRAP_EMAIL, password)
  if (!token) {
    throw new Error('Bootstrap superuser did not authenticate immediately after being created.')
  }
  return token
}

async function fetchWorlds(token) {
  const res = await httpGet(
    `${PB_URL}/api/collections/worlds/records?sort=created_at&perPage=50`,
    auth(token)
  )
  if (res.status !== 200) {
    throw new Error(`fetchWorlds failed (${res.status}): ${res.body}`)
  }
  return JSON.parse(res.body).items || []
}

async function createWorld(name, authMode, token) {
  const res = await httpPost(
    `${PB_URL}/api/collections/worlds/records`,
    { name, auth_mode: authMode || 'open', is_active: false },
    auth(token)
  )
  if (res.status !== 200) {
    throw new Error(`createWorld failed (${res.status}): ${res.body}`)
  }
  return JSON.parse(res.body)
}

async function setActiveWorld(world, allWorlds, token) {
  for (const w of allWorlds) {
    if (w.id !== world.id) {
      await httpPatch(
        `${PB_URL}/api/collections/worlds/records/${w.id}`,
        { is_active: false },
        auth(token)
      )
    }
  }
  const res = await httpPatch(
    `${PB_URL}/api/collections/worlds/records/${world.id}`,
    { is_active: true },
    auth(token)
  )
  if (res.status !== 200) {
    throw new Error(`setActiveWorld failed (${res.status}): ${res.body}`)
  }
  return JSON.parse(res.body)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
}

async function promptNewWorld(token) {
  const name     = await prompt('World name [whole-new-world]: ') || 'whole-new-world'
  const answer   = await prompt('Auth mode — (1) open, no passwords [default] or (2) accounts: ')
  const authMode = answer === '2' ? 'accounts' : 'open'
  const world    = await createWorld(name, authMode, token)
  console.log(`\nWorld "${world.name}" created (${authMode} mode).`)
  return world
}

function openBrowser(url) {
  try {
    const p = process.platform
    if (p === 'darwin')     execSync(`open "${url}"`)
    else if (p === 'win32') execSync(`start "" "${url}"`)
    else                    execSync(`xdg-open "${url}"`)
  } catch { /* best-effort */ }
}

function getLocalIP() {
  try {
    const nets = require('os').networkInterfaces()
    for (const ifaces of Object.values(nets))
      for (const iface of ifaces)
        if (iface.family === 'IPv4' && !iface.internal) return iface.address
  } catch { }
  return null
}

function printBanner() {
  console.log('\n╔═══════════════════════════════╗')
  console.log('║         K N O X E L           ║')
  console.log('╚═══════════════════════════════╝\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD SELECTION
// ─────────────────────────────────────────────────────────────────────────────

async function selectWorld(token) {
  const args = process.argv.slice(2)

  // --world "name": use existing world by name
  const worldIdx = args.indexOf('--world')
  if (worldIdx !== -1 && args[worldIdx + 1]) {
    const name   = args[worldIdx + 1]
    const worlds = await fetchWorlds(token)
    const match  = worlds.find(w => w.name === name)
    if (!match) {
      console.error(`No world named "${name}". Available: ${worlds.map(w => w.name).join(', ') || '(none)'}`)
      process.exit(1)
    }
    return { world: match, allWorlds: worlds }
  }

  // --new "name": create a new world immediately
  const newIdx = args.indexOf('--new')
  if (newIdx !== -1 && args[newIdx + 1]) {
    const worlds = await fetchWorlds(token)
    const world  = await createWorld(args[newIdx + 1], 'open', token)
    console.log(`World "${world.name}" created (open mode).`)
    return { world, allWorlds: [...worlds, world] }
  }

  // Interactive
  const worlds = await fetchWorlds(token)

  if (worlds.length === 0) {
    console.log('No existing worlds found.\n')
    const world = await promptNewWorld(token)
    return { world, allWorlds: [world] }
  }

  if (worlds.length === 1) {
    const w = worlds[0]
    console.log(`  [1] ${w.name}  (${w.created_at.slice(0, 10)}, ${w.auth_mode} mode)\n`)
    const answer = await prompt(`Press enter to use "${w.name}", or type 'new': `)
    if (answer.toLowerCase() === 'new') {
      const world = await promptNewWorld(token)
      return { world, allWorlds: [...worlds, world] }
    }
    return { world: w, allWorlds: worlds }
  }

  console.log('Existing worlds:\n')
  worlds.forEach((w, i) => {
    const def = i === 0 ? '  ← default' : ''
    console.log(`  [${i + 1}] ${w.name}  (${w.created_at.slice(0, 10)}, ${w.auth_mode} mode)${def}`)
  })
  console.log()

  const answer = await prompt(`Select world [1], or type 'new': `)

  if (answer.toLowerCase() === 'new') {
    const world = await promptNewWorld(token)
    return { world, allWorlds: [...worlds, world] }
  }

  const idx    = parseInt(answer) - 1
  const chosen = (!isNaN(idx) && idx >= 0 && idx < worlds.length) ? worlds[idx] : worlds[0]
  return { world: chosen, allWorlds: worlds }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  printBanner()

  if (!fs.existsSync(PB_BINARY)) {
    console.error(`PocketBase binary not found at: ${PB_BINARY}`)
    console.error('Run: node scripts/download-pocketbase.js')
    process.exit(1)
  }

  console.log('Starting PocketBase...')
  // Bind all interfaces, not just loopback — Tier 2's whole point is other
  // students on the same network connecting in. See design.md section 3.
  const pb = spawn(PB_BINARY, ['serve', '--http=0.0.0.0:8090'], {
    cwd: POCKETBASE_DIR, stdio: ['ignore', 'pipe', 'pipe'],
  })

  pb.stdout.on('data', data => {
    const line = data.toString().trim()
    if (line.includes('Server started') || /error/i.test(line)) console.log(`[pb] ${line}`)
  })
  pb.stderr.on('data', data => {
    const line = data.toString().trim()
    if (/error/i.test(line)) console.error(`[pb] ${line}`)
  })
  pb.on('exit', code => { if (code) { console.error(`PocketBase exited: ${code}`); process.exit(code) } })

  let client = null
  const killAll = () => { pb.kill(); if (client) client.kill() }
  process.on('SIGINT',  () => { killAll(); process.exit(0) })
  process.on('SIGTERM', () => { killAll(); process.exit(0) })

  await waitForPocketBase()

  let token
  try {
    token = await ensureAdminToken()
  } catch (e) {
    console.error(`Could not set up an admin session: ${e.message}`)
    killAll(); process.exit(1)
  }

  let world, allWorlds
  try {
    ;({ world, allWorlds } = await selectWorld(token))
  } catch (e) {
    console.error(`World selection failed: ${e.message}`)
    console.error(`Check that the worlds collection exists: ${PB_URL}/_/`)
    killAll(); process.exit(1)
  }

  try {
    await setActiveWorld(world, allWorlds, token)
  } catch (e) {
    console.warn(`Warning: could not set active world: ${e.message}`)
    console.warn('Client will fall back to most-recently-created world.')
  }

  const ip = getLocalIP()
  const isBuilt = fs.existsSync(path.join(POCKETBASE_DIR, 'pb_public'))

  if (isBuilt) {
    // server/pb_public exists — this is a built/packaged distributable.
    // PocketBase serves the built client from the same origin as the API,
    // so there is exactly one process and one URL. See design.md section 4.
    console.log('\n─────────────────────────────────────────')
    console.log(`  World:  ${world.name}`)
    console.log(`  Auth:   ${world.auth_mode} mode`)
    console.log(`\n  Open:   http://127.0.0.1:8090`)
    if (ip) console.log(`  LAN:    http://${ip}:8090`)
    console.log('─────────────────────────────────────────')
    console.log('Press Ctrl+C to stop.\n')
    openBrowser('http://127.0.0.1:8090')
  } else {
    // No build present — a dev checkout, not a packaged distributable.
    // Fall back to also running the Vite dev server so this still works for
    // local iteration without requiring scripts/build.sh first.
    console.log('No server/pb_public found — this looks like a dev checkout.')
    console.log('Starting the Vite dev server too. Run scripts/build.sh first to serve everything from one URL, as a real distributable would.\n')

    // VITE_POCKETBASE_URL must be set or the client falls back to solo mode
    // (see client/src/lib/pocketbase.ts POCKETBASE_ENABLED).
    client = spawn('npm', ['run', 'dev'], {
      cwd: CLIENT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_POCKETBASE_URL: '/' },
    })
    client.stdout.on('data', data => console.log(`[client] ${data.toString().trim()}`))
    client.stderr.on('data', data => console.error(`[client] ${data.toString().trim()}`))
    client.on('exit', code => { if (code) { console.error(`Client dev server exited: ${code}`); pb.kill(); process.exit(code) } })

    console.log('─────────────────────────────────────────')
    console.log(`  World:  ${world.name}`)
    console.log(`  Auth:   ${world.auth_mode} mode`)
    console.log(`  API:    http://127.0.0.1:8090`)
    if (ip) console.log(`  LAN:    http://${ip}:8090`)
    console.log('\nOpen http://127.0.0.1:5173 in your browser.')
    console.log('─────────────────────────────────────────')
    console.log('Press Ctrl+C to stop.\n')
  }

  await new Promise(() => {})
}

main().catch(e => { console.error(e); process.exit(1) })