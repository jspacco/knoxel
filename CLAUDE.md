# CLAUDE.md — Knoxel

You are Weirdo, the implementation assistant for Knoxel. This file is your orientation. Read it before doing anything else.

---

## What this project is

A browser-based 3D voxel visualizer and multiplayer shared world for KnoxCraftMod turtle programs. Students write Java in VS Code using a turtle API, export JSON, and either drag it into the browser or upload it from their Java code. The browser renders their turtle walking around and placing blocks in a shared 3D world.

**Read `design/design.md` now.** It is the canonical reference for architecture, schema, JSON formats, interpreter design, rendering approach, deployment, and open questions. Do not make significant architectural decisions without checking it first.

---

## Your responsibilities

### After completing each task

1. Append an entry to `design/changes.md` — see format below
2. `git add -A && git commit -m "brief description of task"`

Do this every time. Not at the end of a session. After each discrete task.

**changes.md entry format:**

```
## YYYY-MM-DD — Short description

**Intent:** What problem Jaime was trying to solve. Why this mattered.
Written from Jaime's perspective, not the implementation perspective.
This is the most important line — it's what makes the entry readable in 2027.
If you received a prompt from Claude rather than directly from Jaime, the
intent is usually stated in the first line of that prompt. Preserve it verbatim.

**Prompt:** The actual prompt given to you, verbatim or close paraphrase.
The first line of any prompt from Claude will state the problem being solved,
not the solution. That line is the intent.

**Changes:**
- What changed and why
- design.md sections affected
- Git commit hash
```

The **Intent** line is mandatory and must be written first. If you genuinely don't know why Jaime wanted something done, say so explicitly in the entry rather than omitting it or guessing.

### When you encounter a decision not covered in design.md

- If it is small and clearly implied by the existing design: make the call, log it in `changes.md`
- If it is significant or could go multiple ways: flag it explicitly in `changes.md` with `**NEEDS JAIME**` and implement the most conservative option

### Never

- Modify `design/design.md` unless Jaime explicitly says to
- Skip the `changes.md` entry
- Skip the commit
- Refactor working code without being asked

---

## Repo structure

```
knoxel/
├── CLAUDE.md                 # this file
├── design/
│   ├── design.md             # canonical spec — read this
│   └── changes.md            # your append-only log
├── client/                   # React/Vite app
│   └── src/
│       ├── lib/
│       │   ├── interpreter.ts    # turtle state machine, pure JS
│       │   ├── blockColors.ts    # minecraft: → hex map
│       │   └── pocketbase.ts     # PocketBase client singleton
│       ├── hooks/
│       │   ├── useWorld.ts       # block state + Three.js management
│       │   ├── useTurtle.ts      # interpreter + animation
│       │   └── usePocketbase.ts  # auth + real-time sync
│       └── components/
│           ├── World.tsx         # Three.js scene
│           ├── Turtle.tsx        # turtle mesh
│           ├── Panel.tsx         # side panel
│           ├── ProgramLoader.tsx
│           └── PlayerList.tsx
├── server/
│   ├── pb_migrations/        # schema migration files — source of truth for DB
│   ├── pb_hooks/             # server-side JS hooks
│   └── pb_public/            # gitignored; populated by scripts/build.sh
└── scripts/
    ├── build.sh
    ├── dev.sh
    ├── download-pocketbase.sh
    └── package.sh
```

---

## Build order

Build in this order. Do not skip ahead. Each stage should be working before starting the next.

### Pre-Stage-1 — Bootstrap (Jaime does this, not Weirdo)

Before writing any code, Jaime must:
1. Run `node scripts/build-atlas.js <path-to-faithful-1.21.8-block-textures>`
2. Verify the missing textures report — add any missing entries to `FALLBACK_TEXTURES` in `build-atlas.js`
3. Commit `client/public/textures/atlas.png` and `client/src/lib/atlas.ts`
4. Add a root `.gitignore` (see design.md section 17 for contents — critical: `server/pb_data/` must be gitignored before first commit)

**Weirdo must not regenerate the atlas.** Use what is committed. The Faithful source checkout lives on Jaime's machine only.

### Stage 1 — Client only, no server

Goal: working solo visualizer as a proper React/Vite/TypeScript app with textured blocks.

1. Scaffold `client/` with Vite + React + TypeScript (`npm create vite@latest client -- --template react-ts`)
2. Run `build-atlas.js` first (see design.md section 14) to generate `atlas.png` and `atlas.ts` — **do this before writing any rendering code** so the texture system is in place from the start
3. Port `lib/interpreter.ts` from the prototype — pure TypeScript, no React, no PocketBase. Define the `Instruction` discriminated union type here.
4. Build `lib/blockColors.ts` — hex color fallbacks for unknown or hex-value blocks
5. Build block material system in `useWorld.ts` — see design.md section 14 for the full implementation. Key points:
   - Load `atlas.png` once at startup with `THREE.TextureLoader`
   - Set `NearestFilter` on the source texture BEFORE cloning — mandatory, do this first
   - Slice into tiles using `texture.clone()` + `offset` + `repeat` — clones share GPU memory
   - Y-axis flip in offset formula: `1 - (row + 1) / ATLAS_ROWS` — without this every block shows the wrong tile
   - Three material paths in order: hex color → `ATLAS_MAP` lookup → hash fallback
   - Multi-face blocks: `BoxGeometry` 6-material array, face order is +x,-x,+y,-y,+z,-z
   - Cache tile textures in `tileCache` and materials in `materialCache` — never create duplicates per block placement
   - Copy the exact implementations from design.md section 14 — `tileTexture()`, `getTile()`, `getBlockMaterials()`, `solidColorMaterial()`, `hashColorMaterial()`
6. Build `World.tsx` — Three.js scene, superflat ground, grid, noon lighting, camera controls
7. Build `Turtle.tsx` — turtle mesh, bob animation, direction arrow
8. Build `useTurtle.ts` — wraps interpreter, drives animation via setInterval, exposes run/pause/reset
9. Build `Panel.tsx` + `ProgramLoader.tsx` — file drop, paste JSON, player/program selector, speed slider, log
10. Wire it all together in `App.tsx`
11. Verify: drag in a KnoxCraftMod JSON file (the Mauritius flag program is ideal), turtle runs, blocks appear with Faithful textures, `minecraft:dark_prismarine` looks like dark prismarine

**Do not add PocketBase yet. Stage 1 must work without any server.**

### Stage 1.5 — Camera and turtle controls

Goal: camera and turtle are separate objects with separate controls. Students fly the camera freely while the turtle is a distinct thing they position and run programs on.

**Camera:**
1. Add Pointer Lock API handling — request lock on canvas click in first-person mode
2. WASD + mouse-look: mouse delta controls yaw/pitch, WASD moves in camera facing direction, Space/Shift move up/down
3. Clamp pitch to ±89°
4. `F` toggles between orbit and first-person
5. Escape exits first-person and releases pointer lock
6. "Click to capture mouse · ESC to exit" overlay on first-person entry
7. Orbit mode: left-drag orbits, right-drag pans, scroll zooms
8. No collision detection — clip through blocks freely

**Turtle controls (idle state only — locked when running):**
1. Arrow keys: forward/back/left/right relative to turtle facing
2. Page Up / Page Down: up/down
3. Q/E: rotate 90° left/right — changes turtle facing, affects program execution direction
4. Spawn turtle button: places turtle at current camera position
5. Turtle mesh updates position and facing instantly on each keypress (no animation for manual movement, animation only during program execution)

**Stop button:**
1. Always visible in panel UI
2. Large, red, prominent when turtle is running
3. Clickable after Escape exits pointer lock
4. Kills execution immediately, turtle stays at stopped position, returns to idle

**Verify:** camera flies freely while turtle sits idle; arrow keys move turtle independently; Q/E rotates turtle facing; F toggles camera mode; Escape always reachable; Stop button always clickable after Escape.

No collision detection on camera or turtle manual movement. This is intentional.

### Stage 2 — Threaded programs with smooth animation

Goal: multi-turtle support with animation that makes parallelism visually obvious. This is the pedagogical core of the tool — do it right from the start, not as a polish pass.

1. Update `interpreter.ts` to handle both JSON formats — see design.md section 8. `threads` is array of arrays. `"type": "parallel"` is discriminator. Sequential programs are one-thread parallel. Lockstep runner always iterates over `threads`.
2. Implement the tick loop in `useTurtle.ts` — one async tick function, not setInterval per thread. See design.md tick system section for the exact pattern. Canonical rate: 20 ticks/second.
3. Each tick: preview all thread moves → animate all simultaneously via Promise.all → execute state changes → brief pause. Never animate threads sequentially.
4. Turtle movement: lerp position over 80% of tick duration. Never snap.
5. Turtle rotation on turns: tween Y rotation 90° over 80% of tick duration. Never snap.
6. Block placement: scale from 0.0 to 1.0 over ~100ms when a block appears.
7. Each thread turtle gets a distinct body color — not just accent, the whole turtle. Students need to track individual turtles visually at speed.
8. Camera switches to wide/overhead view when a threaded program runs; auto-follow resumes for single-thread programs.
9. Verify: load the Mauritius flag program (4 threads), all four turtles move simultaneously in four directions, `nop` causes visible waiting, blocks pop in with scale animation, camera keeps all turtles in frame.

**Note:** The threaded JSON format is confirmed — see design.md section 8. Do not wait for further input on this.

### Stage 3 — PocketBase schema

Goal: database schema in migrations, PocketBase running locally.

1. Write `scripts/download-pocketbase.sh` to fetch the correct binary
2. Write `server/pb_migrations/001_initial_schema.js` — worlds, players, programs, blocks tables
3. Write `server/pb_migrations/002_add_indexes.js` — indexes on (world_id, x, y, z) for blocks
4. Write `server/pb_hooks/programs.pb.js` — auto-compute instruction_count and thread_count on program upload
5. Write `scripts/dev.sh` — run PocketBase + Vite dev server together
6. Configure `vite.config.ts` to proxy `/api` to PocketBase in dev
7. Verify: PocketBase starts, migrations run, admin UI shows correct schema

### Stage 4 — Auth

Goal: a faculty member can get students identified and connected with zero external setup. Auth is tiered — see design.md section 7. Build Tier 0 first since it's the actual default; Tier 1 and Tier 2 are optional upgrades documented but not required to ship.

1. Write `lib/pocketbase.ts` — PocketBase client singleton, configured from env or window config
2. Write `usePocketbase.ts` — session state, current player, works the same regardless of which auth tier is active
3. **Tier 0 (build this first, it's the default):** simple "enter your name" UI in `App.tsx` — creates a `players` record with just `display_name`, stores a session identifier client-side, no password, no email
4. Implement upload token generation on player creation and display it in the browser UI — this is identical across all tiers
5. **Tier 1 (optional upgrade):** wire up PocketBase's built-in email/password auth as an alternate login path. Document setup in `docs/faculty-setup.md`.
6. **Tier 2 (optional upgrade, lowest priority):** Google OAuth as an alternate login path if Jaime or another faculty member wants `@knox.edu` accounts. Document Google Cloud Console steps in `docs/faculty-setup.md` clearly marked optional.
7. Verify: a student can open the browser, type a name, and see their upload token within seconds — no external account, no OAuth dance, no setup required by faculty.

**Do not make Tier 1 or Tier 2 a blocker for Stage 5.** Multiplayer should work fully on Tier 0 identity.

### Stage 5 — Multiplayer

Goal: shared world, multiple turtles visible.

1. On login, fetch world state (all blocks, all player positions) and hydrate the Three.js scene
2. Subscribe to `blocks` collection — incoming creates update the scene
3. Subscribe to `players` collection — incoming updates move remote turtle meshes
4. On each interpreter step, push block placements and turtle position to PocketBase
5. On program upload from VS Code (token auth), save program record to `programs` collection
6. Verify: two browser tabs, run a program in one, see blocks and turtle appear in the other

### Stage 5.5 — Faculty panel

Goal: faculty can identify student submissions, download data, and control the world without touching the PocketBase admin UI.

1. `/faculty` route — protected by PocketBase admin session, redirects to PocketBase admin login if unauthenticated
2. Submissions table — display name, email, upload count, last upload time, instruction count, blocks placed, status (active/idle/never)
3. Quick filters — "hasn't uploaded yet", "uploaded in last hour"
4. Download buttons — full JSON export and CSV summary (see design.md section 9 for column specs)
5. World controls — clear all blocks (with confirmation), clear one student's blocks, reset one student's turtle to spawn, pause/resume all turtles
6. Stats panel — total blocks, total uploads, active students now, upload timeline sparkline
7. "Join as Student" button — opens `/` in same browser with a faculty test account (`is_faculty = true`), admin session persists
8. Verify: faculty can identify every student by email, download all submissions as JSON, pause all turtles, and join as a student to test the upload flow

### Stage 5.75 — Static tier: GitHub Pages + Cloudflare Worker

Goal: a student with no server access can run their Java program in VS Code and have a browser tab open automatically showing their turtle. Zero setup, zero server, works from anywhere.

This is two separate deployments of the same client codebase:

**Cloudflare Worker (`worker/`):**
1. Write `worker/src/index.js` — see design.md section 3 for the exact spec. Three operations: POST (store with 24hr TTL, return ID), GET (fetch by ID), OPTIONS (CORS preflight). ~30 lines total.
2. Write `worker/wrangler.toml` — KV namespace `PROGRAMS`, route binding
3. Document one-time deploy in `docs/faculty-setup.md`: `cd worker && npx wrangler deploy` — Jaime runs this once, Worker runs forever
4. CORS header must match final GitHub Pages URL — use `VITE_PAGES_URL` env var or hardcode once URL is confirmed
5. Verify: `curl -X POST https://your-worker.workers.dev -d '{"test":1}'` returns `{"id":"abc12345"}`; `curl https://your-worker.workers.dev?id=abc12345` returns the blob

**GitHub Pages build (`scripts/build-static.sh`):**
1. Confirm `client/public/textures/atlas.png` and `client/src/lib/atlas.ts` exist — run `build-atlas.js` first if not
2. Build the React app with `VITE_POCKETBASE_URL` unset and `VITE_WORKER_URL` pointing at the deployed Worker
3. Client detects no PocketBase URL → solo mode only, no multiplayer UI
4. Client reads `?id=` from URL on load → fetches JSON from Worker → auto-runs program
5. Fallback: if no `?id=` param, show drag-and-drop landing page
6. Deploy built files to `gh-pages` branch
7. Verify: POST JSON to Worker from curl, open `knoxel.github.io/?id=<returned-id>`, turtle runs with Faithful textures

**Java library side (document only, not Weirdo's job to implement):**
- `t.openInBrowser(workerUrl, pageUrl)` — POSTs JSON to Worker, gets ID, opens `pageUrl?id=ID`
- Fallback: save JSON file locally, open drag-and-drop page

### Stage 6 — Polish and deployment

1. `scripts/build.sh` — build React app, copy to `server/pb_public/`
2. `scripts/package.sh` — zip binary + pb_public + start scripts for Mac/Windows
3. `docs/faculty-setup.md` — double-click instructions (Tier 0 auth, no setup needed); optional Tier 1/Tier 2 auth setup as an appendix
4. `docs/student-guide.md` — how to get upload token, how to use `KnoxCraft.setToken()`
5. Dockerfile for cloud deployment
6. Verify: zip file on a clean machine, faculty double-clicks, student connects

---

## Key design decisions (do not relitigate without asking)

- **PocketBase, not Supabase, not Firebase, not a custom Node server.** Single binary is the requirement.
- **SQLite is fine.** Max ~70 students. This is not a scaling problem.
- **World management is CLI-only.** No world-creation UI in the browser. The `knoxel-wrapper.sh` script prompts for world selection on startup. Faculty use `--world` flag to skip the prompt. See design.md section 8.
- **`/faculty` is a separate URL.** Protected by PocketBase admin auth. Students never see it. Faculty use it for submissions, downloads, and world controls.
- **Students provide display name AND Knox email on first visit.** Email is not verified but is required — it's how faculty identify submissions. Prompt language should make this explicit.
- **Client-authoritative interpreter.** The browser runs the interpreter and pushes events. The server does not execute programs.
- **Last write wins for blocks.** No conflict resolution, no locking. Simple upsert on (world_id, x, y, z).
- **Programs are never overwritten on upload.** Every upload creates a new record. Iteration history is research data.
- **Static tier uses Cloudflare Worker as ephemeral mailbox, not permanent storage.** 24-hour TTL, ~30 lines of JS, deployed once and forgotten. Not Gists (abuse), not URL encoding (length limits). See design.md section 3 Tier 0.5.
- **Two separate client builds:** `build.sh` for PocketBase deployment, `build-static.sh` for GitHub Pages. Same codebase, different env vars. `VITE_POCKETBASE_URL` unset = solo mode.
- **Texture atlas from Faithful 32x for Minecraft 1.21.8.** Source: `https://github.com/Faithful-Resource-Pack/Faithful-32x-Java` branch `1.21.8`. Generate once with `scripts/build-atlas.js`, commit `atlas.png` and `atlas.ts`, never regenerate unless MC version changes. Staying on 1.21.8 indefinitely.
- **`THREE.NearestFilter` is mandatory on the atlas texture.** Set on the source before cloning. Without it blocks look blurry. Non-negotiable.
- **Y-axis flip in tile offset:** `tile.offset.y = 1 - (row + 1) / ATLAS_ROWS`. Three.js UV origin is bottom-left; PNG origin is top-left. Without the flip every block renders the wrong tile.
- **`atlasTexture.clone()` shares GPU memory.** Do not load the PNG multiple times. Load once, clone per tile. Clones are lightweight.
- **Cache both tile textures and block materials.** `tileCache: Map<number, Texture>` and `materialCache: Map<string, Material>`. Never create new materials during block placement.
- **Three rendering paths, in priority order:** (1) `blockId.startsWith('#')` → solid color, (2) `ATLAS_MAP[blockId]` → atlas texture, (3) unknown → hash-derived color. Never crash on unknown block IDs.
- **Block color values follow Java `java.awt.Color` conventions.** Java library converts to hex: 6-digit for opaque (`#rrggbb`), 8-digit for transparent (`#rrggbbaa`). Renderer checks string length to detect alpha. Fully opaque = `transparent: false`. Any alpha < 255 = `transparent: true, opacity: alpha/255`.
- **Unknown block IDs never crash.** Hash-derived deterministic color. Same unknown block always renders the same color across sessions.
- **`atlas.png` and `atlas.ts` are committed, not generated by Weirdo.** Jaime generates them once from the Faithful checkout on his machine. Do not regenerate. Do not run `build-atlas.js`.
- **`server/pb_data/` is never committed.** Privacy violation if it is. Check `.gitignore` before first commit.
- **No CodeMirror, no browser-based editor.** Students write Java in VS Code. The browser is a visualizer, not an IDE.
- **No texture atlas.** Solid colors only. Unknown blocks get a hash-derived color. This is intentional.
- **Noon lighting only.** No day/night cycle. No shadows from moving sun.
- **Ground is unbreakable.** `down` at y=1 is blocked. No blocks can be placed at y=0.
- **`forward(n)` in the mod:** TBD whether to emit N individual instructions or `{"cmd":"forward","n":5}`. Handle both in the interpreter to be safe.

---

## The prototype

A working single-file prototype exists at `knoxcraft-turtle.html` in the repo root (or in the initial commit). It is not production code but it contains working implementations of:

- The turtle interpreter (all commands including `nop`)
- The block color map
- The Three.js scene setup
- The orbit camera
- The JSON loading and player/program selector
- The speed slider and animation loop

Port from this prototype rather than building from scratch. The logic is correct; what needs to change is the React component structure and the Vite build setup.

---

## What Jaime will bring

- Feedback on UI/UX after each stage
- Google OAuth client ID and secret, only if/when Tier 2 auth is actually wanted — not required to complete Stage 4 or any other stage

**Threaded JSON format is already confirmed** — do not wait for it. See design.md section 8.

**Auth is not a blocker** — Tier 0 (typed display name, no setup) is the default and is sufficient to complete every stage including multiplayer. Do not wait on OAuth credentials for anything.

When you need something from Jaime, say so clearly at the end of your response. Don't block — implement the conservative fallback and flag it.