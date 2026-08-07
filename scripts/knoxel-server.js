#!/usr/bin/env node
/**
 * knoxel-server.js
 *
 * Wrapper around the PocketBase binary that handles:
 *   1. Starting PocketBase
 *   2. Waiting for it to be ready
 *   3. World selection / creation via CLI prompt
 *   4. Setting is_active=true on the selected world in the database
 *
 * Usage:
 *   node scripts/knoxel-server.js
 *   node scripts/knoxel-server.js --world "CS102 Week 4"
 *   node scripts/knoxel-server.js --new "CS102 Week 7"
 *
 * The active world is tracked via is_active=true on the worlds collection.
 * Client queries: /api/collections/worlds/records?filter=(is_active=true)&perPage=1
 */

const { spawn, execSync } = require('child_process')
const http     = require('http')
const https    = require('https')
const fs       = require('fs')
const path     = require('path')
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

async function hasSuperuser() {
  try {
    const res = await httpPost(
      `${PB_URL}/api/collections/_superusers/auth-with-password`,
      { identity: 'check@check.com', password: 'checkcheck' }
    )
    return res.status === 400  // 400 = wrong credentials = superuser exists
  } catch {
    return false
  }
}

async function getAdminToken() {
  const email    = process.env.PB_ADMIN_EMAIL
  const password = process.env.PB_ADMIN_PASSWORD
  if (!email || !password) return null
  try {
    const res = await httpPost(
      `${PB_URL}/api/collections/_superusers/auth-with-password`,
      { identity: email, password }
    )
    if (res.status === 200) return JSON.parse(res.body).token
    console.error('Admin auth failed — check PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD in .env')
  } catch (e) {
    console.error('Admin auth error:', e.message)
  }
  return null
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
  const pb = spawn(PB_BINARY, ['serve', '--http=127.0.0.1:8090'], {
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

  if (!(await hasSuperuser())) {
    console.log('─────────────────────────────────────────')
    console.log('First run: create a superuser account')
    console.log(`\n  ${PB_URL}/_/\n`)
    openBrowser(`${PB_URL}/_/`)
    console.log('─────────────────────────────────────────\n')
    await prompt('Press enter when your superuser account is created: ')
  }

  const token = await getAdminToken()
  if (!token) {
    console.warn('Warning: no admin credentials in .env')
    console.warn('Add PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD to your .env file.\n')
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

  // VITE_POCKETBASE_URL must be set or the client falls back to solo mode —
  // no server, no login screen, no display-name/email prompt (see
  // client/src/lib/pocketbase.ts POCKETBASE_ENABLED). Spawning the dev
  // server here ourselves, instead of just printing instructions, means
  // there's no way to forget to set it in a second terminal.
  console.log('Starting client dev server...')
  client = spawn('npm', ['run', 'dev'], {
    cwd: CLIENT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VITE_POCKETBASE_URL: '/' },
  })
  client.stdout.on('data', data => console.log(`[client] ${data.toString().trim()}`))
  client.stderr.on('data', data => console.error(`[client] ${data.toString().trim()}`))
  client.on('exit', code => { if (code) { console.error(`Client dev server exited: ${code}`); pb.kill(); process.exit(code) } })

  const ip = getLocalIP()
  console.log('\n─────────────────────────────────────────')
  console.log(`  World:  ${world.name}`)
  console.log(`  Auth:   ${world.auth_mode} mode`)
  console.log(`  API:    http://127.0.0.1:8090`)
  if (ip) console.log(`  LAN:    http://${ip}:8090`)
  console.log('\nOpen http://127.0.0.1:5173 in your browser.')
  console.log('─────────────────────────────────────────')
  console.log('Press Ctrl+C to stop.\n')
  await new Promise(() => {})
}

main().catch(e => { console.error(e); process.exit(1) })