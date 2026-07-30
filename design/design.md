# Knoxel — Design Document

**Author:** Jaime Spacco  
**Status:** Active  
**Last updated:** July 2026

This document is the canonical design reference for Knoxel — a browser-based 3D voxel visualizer and multiplayer shared world for KnoxCraftMod turtle programs. It captures architecture decisions, schema, protocols, and deployment strategy. It should be amended rarely and deliberately. For ongoing changes, see `changes.md`.

---

## 1. Why This Exists

KnoxCraftMod is a Minecraft Forge mod that lets students write Java turtle programs against a simple API. The turtle records a list of instructions, serializes to JSON, and POSTs to a server. The Minecraft server then executes the program visually.

The Minecraft server works but has friction: students need a Minecraft license, faculty need to run a modded server, and the installation process for Forge is non-trivial. A browser-based visualizer removes all of that while preserving the pedagogical core — students still write Java in VS Code, still use the same turtle API, still produce the same JSON.

Knoxel is not a Minecraft replacement. It is a visualizer and shared world that accepts the same JSON KnoxCraftMod already produces.

---

## 2. Goals

- **Accessibility.** Students without Minecraft licenses can participate. Works on any device with a browser.
- **Multiplayer.** Students see each other's turtles running in a shared world. Parallelism is visible.
- **Faculty deployable.** A colleague can run a local server by double-clicking one file. No Node.js, no JVM, no cloud account required.
- **Research instrumented.** Programs saved server-side with timestamps and identity. Enables analysis of iteration count, instruction complexity, submission timing.
- **Mod compatible.** The existing KnoxCraftMod Java API and JSON format are unchanged. Students who have Minecraft can still use the mod. The browser tool is an additional path, not a replacement.

---

## 3. Deployment Tiers

There are three deployment tiers. All share the same React client codebase. The client detects which tier it's running in from environment variables set at build time.

### Tier 1 — Static GitHub Pages + Cloudflare Worker

**URL:** `knoxel.github.io` (or `jspacco.github.io/knoxel`)  
**Backend:** Cloudflare Worker (ephemeral mailbox, not a server)  
**Auth:** none  
**Multiplayer:** no — solo only  

Students run their Java program in VS Code. The Java library POSTs the JSON to a Cloudflare Worker, gets back a short ID, and opens the browser automatically:

```
https://knoxel.github.io/?id=xk7r9m
```

The browser fetches the JSON from the Worker and runs the program locally. The Worker stores JSON for 24 hours then deletes it automatically. No server to run, no binary to distribute, no login required.

The static build is deployed to GitHub Pages via `scripts/build-static.sh`. The Cloudflare Worker is deployed once via `npx wrangler deploy` and never touched again. See `worker/` in the repo.

**Cloudflare Worker spec** (`worker/src/index.js`, ~30 lines):

Three operations only:

`POST /` — Java library sends program JSON as request body. Worker generates a random 8-character ID, stores the JSON in Cloudflare KV with a 24-hour TTL, returns `{"id": "xk7r9m2p"}`.

`GET /?id=xk7r9m2p` — browser fetches stored JSON by ID. Returns the JSON body or 404 if expired.

`OPTIONS /` — CORS preflight. Required because `knoxel.github.io` and `workers.dev` are different origins.

CORS headers on all responses: `Access-Control-Allow-Origin: https://knoxel.github.io`.

KV namespace: `PROGRAMS`. TTL: 86400 seconds (24 hours). IDs are `crypto.randomUUID().slice(0, 8)` — short enough to fit in a URL, random enough to avoid collisions at classroom scale.

The Worker has no auth, no rate limiting, no logging of content. Anyone who guesses an ID can fetch that program JSON — acceptable for a classroom tool where program content is not sensitive.

**Fallback:** if the POST fails or a student is offline, the Java library saves a JSON file locally and opens the browser to the drag-and-drop landing page.

**Use case:** students without Minecraft, anyone without access to a PocketBase server, quick demos, the default accessible path.

### Tier 2 — Local binary (PocketBase on faculty laptop)

**URL:** `http://faculty-laptop-ip:8090`  
**Backend:** PocketBase binary, SQLite  
**Auth:** display name + Knox email (Tier 0), optional email/password (Tier 1)  
**Multiplayer:** yes — all students on the same network  

Faculty double-click the binary. A CLI prompt asks for a world name (or `--world` flag skips the prompt). Students connect from the same network. World state persists in SQLite on the faculty laptop. At end of week, faculty have a SQLite file with all student programs for analysis.

```bash
./knoxel serve                    # prompts for world selection
./knoxel serve --world "CS102 Week 4"   # skips prompt
```

**Use case:** classroom use, lab sections, in-person demos.

### Tier 3 — Cloud binary (PocketBase on a server)

**URL:** `https://knoxel.knox.edu` or similar  
**Backend:** same PocketBase binary, deployed to Railway/Fly.io/$5 VPS  
**Auth:** same as Tier 2  
**Multiplayer:** yes — students connect from anywhere  

Same binary as Tier 2, different deployment target. Students connect from home, dorms, anywhere. Persistent across the assignment week.

```dockerfile
FROM alpine
COPY pocketbase /app/
COPY pb_public /app/pb_public/
WORKDIR /app
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
```

**Use case:** week-long assignments, remote students, persistent world across class sessions.

### Solo/multiplayer detection

The client reads `VITE_POCKETBASE_URL` at build time. If unset, the client runs in solo mode (Tier 1). If set, it connects to PocketBase (Tier 2 or 3). The Cloudflare Worker URL is read from `VITE_WORKER_URL`. Two build scripts handle this:

```bash
scripts/build.sh         # PocketBase deployment (Tier 2/3)
scripts/build-static.sh  # GitHub Pages (Tier 1, no PocketBase URL)
```

---

## 4. Tech Stack

### Client
- **React + TypeScript + Vite** — component architecture, hot reload during development
- **Three.js** — 3D rendering, WebGL
- **PocketBase JS SDK** — auth, REST, real-time subscriptions
- Built to `client/dist/`, copied to `server/pb_public/` for production

**React/Three.js boundary rule:** Three.js lives entirely inside `useWorld.ts` and never touches React's render cycle. React manages the panel UI only. The canvas is a single `<canvas ref>` that React renders once and never updates. This is non-negotiable — mixing React re-renders with the Three.js scene causes bugs that are hard to track down.

**TypeScript discipline:** All instruction types, turtle state, PocketBase record shapes, and interpreter interfaces must be explicitly typed. The `Instruction` type should be a discriminated union so switch statements are exhaustive.

### Server
- **PocketBase** — single Go binary, SQLite, REST API, real-time subscriptions over WebSocket, tiered auth (none → basic email/password → optional Google OAuth, see section 7)
- Schema defined in `server/pb_migrations/` as JS migration files
- Optional server-side hooks in `server/pb_hooks/`
- Serves static files from `server/pb_public/` at `/`

### No separate backend process
PocketBase serves both the API and the built React app. In production there is one process and one port.

---

## 5. Repository Structure

```
knoxel/
├── CLAUDE.md                      # Weirdo's orientation doc
├── README.md
├── .gitignore
│
├── design/
│   ├── design.md                  # this file
│   └── changes.md                 # append-only change log
│
├── client/                        # React/Vite/TypeScript app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── World.tsx          # Three.js scene, camera, ground
│   │   │   ├── Turtle.tsx         # turtle mesh + animation
│   │   │   ├── Panel.tsx          # side panel UI
│   │   │   ├── ProgramLoader.tsx  # file drop, paste, server programs
│   │   │   └── PlayerList.tsx     # connected players + turtle status
│   │   ├── hooks/
│   │   │   ├── useWorld.ts        # block state, Three.js block management
│   │   │   ├── useTurtle.ts       # interpreter, animation, threading
│   │   │   └── usePocketbase.ts   # auth, real-time sync
│   │   └── lib/
│   │       ├── interpreter.ts     # turtle state machine (pure TS, no React)
│   │       ├── atlas.ts           # AUTO-GENERATED block → atlas index map
│   │       ├── blockColors.ts     # hex color fallbacks for unknown blocks
│   │       └── pocketbase.ts      # PocketBase client singleton
│   ├── public/
│   │   └── textures/
│   │       └── atlas.png          # AUTO-GENERATED 1024×1024 texture atlas
│   ├── index.html
│   ├── vite.config.ts             # proxies /api to PocketBase in dev
│   └── package.json
│
├── server/
│   ├── pb_migrations/             # schema as versioned migration files
│   │   ├── 001_initial_schema.js
│   │   └── 002_add_indexes.js
│   ├── pb_hooks/                  # optional server-side JS
│   │   └── programs.pb.js         # auto-compute instruction_count on upload
│   └── pb_public/                 # gitignored; populated by build.sh
│
├── worker/                            # Cloudflare Worker (static tier delivery)
│   ├── src/
│   │   └── index.js               # ~30 lines, ephemeral program storage
│   └── wrangler.toml              # Cloudflare deploy config
│
├── scripts/
│   ├── build-atlas.js             # generate atlas.png + atlas.ts from Faithful textures
│   ├── package.json               # scripts/ dependencies (sharp for image processing)
│   ├── build.sh                   # vite build → copy to server/pb_public
│   ├── build-static.sh            # vite build for GitHub Pages (no PocketBase URL)
│   ├── dev.sh                     # run vite dev server + pocketbase together
│   ├── download-pocketbase.sh     # fetch correct binary for current platform
│   └── package.sh                 # zip binaries for distribution
│
└── docs/
    ├── faculty-setup.md
    └── student-guide.md
```

---

## 6. Database Schema

### `worlds`
| field | type | notes |
|---|---|---|
| id | string (PB auto) | |
| name | string | e.g. "CS 102 Spring 2026 Week 4" |
| created_at | datetime | PB auto |

One world per course instance. No reset unless something goes wrong. World accumulates all student work over the assignment week.

### `players`
| field | type | notes |
|---|---|---|
| id | string (PB auto) | |
| display_name | string | student's chosen name, shown on turtle nameplate in world |
| email | string, required | prompted as Knox email on first visit — not verified but collected for faculty identification |
| upload_token | string | generated on player creation, used for VS Code uploads |
| is_faculty | bool | true for faculty test accounts; grants access to /faculty panel |
| world_id | relation → worlds | |
| turtle_x | int | current turtle position |
| turtle_y | int | |
| turtle_z | int | |
| turtle_facing | string | north / south / east / west |
| last_seen | datetime | updated on heartbeat |

`email` is the authoritative identity field for grading and research — it's what faculty use to identify submissions in the panel. `display_name` is cosmetic (turtle nameplate). Students could enter a fake email; that's a them problem. No verification is performed.

Faculty can create a player record with `is_faculty = true` to access both the student UI and the `/faculty` panel simultaneously.

### `programs`
| field | type | notes |
|---|---|---|
| id | string (PB auto) | |
| player_id | relation → players | |
| world_id | relation → worlds | |
| program_name | string | e.g. "flag", "spiral" |
| json_content | json | full instruction payload |
| instruction_count | int | denormalized, computed server-side on upload |
| thread_count | int | 1 for single-turtle, N for threaded programs |
| submitted_at | datetime | PB auto |

Multiple uploads per student per program name are preserved (not overwritten). This is intentional — iteration count is research data.

### `blocks`
| field | type | notes |
|---|---|---|
| id | string (PB auto) | |
| world_id | relation → worlds | |
| player_id | relation → players | who placed it |
| x | int | |
| y | int | |
| z | int | |
| block_id | string | "minecraft:dark_prismarine" or "#ff6b6b" |
| placed_at | datetime | PB auto |

Unique constraint on `(world_id, x, y, z)`. Last write wins via upsert. Blocks are never deleted except on explicit world reset.

---

## 7. Authentication and Identity

Auth is tiered. The default tier requires zero setup from faculty. Stronger tiers are opt-in upgrades, never a requirement to get the tool running.

**Why this matters:** a faculty member downloading the local-binary distribution must be able to double-click it and have students connected within minutes. Requiring Google Cloud Console setup (OAuth client ID, redirect URIs, consent screen) before a single student can log in defeats the entire "simple enough that colleagues will actually use it" goal. Google SSO was the original plan but it's a hard dependency only Jaime would bother configuring — everyone else just won't use the tool.

### Tier 0 — No auth (default)

Student opens the browser and is prompted for two fields:
- **Display name** — shown on their turtle nameplate in the world, can be anything
- **Knox email** — prompted explicitly as "your school email address (@knox.edu)"; used by faculty to identify submissions; not verified

No password, no OAuth, no external service. A `players` record is created, a session ID stored in the browser. Zero setup cost for faculty.

Students could enter a fake email. That's acceptable — the token is the upload auth mechanism, not the email. But if a student submits with a fake email and can't be identified in the faculty panel, that's a them problem. The prompt language should make the purpose clear: "Enter your Knox email so your instructor can identify your submissions." 

### Tier 1 — PocketBase basic auth (recommended upgrade)

PocketBase has built-in email/password auth with zero external dependencies — no Google Cloud Console, no OAuth app registration. Faculty create student accounts (or let students self-register) directly through PocketBase's admin UI or a simple sign-up form. Takes about the same effort as setting up any other small web app login. This is the auth tier worth defaulting to in `docs/faculty-setup.md` as "if you want real accounts."

### Tier 2 — Google OAuth (optional, for whoever wants it)

PocketBase supports Google OAuth as one of several configurable providers. If Knox IT wants `@knox.edu` accounts wired in, or a faculty member is comfortable with Google Cloud Console, this is available — but it's documented as an optional enhancement in `docs/faculty-setup.md`, not a setup requirement. The schema and upload token flow work identically regardless of which auth tier is active; OAuth just changes how `players.email` / `players.display_name` gets populated.

### VS Code upload token (same across all tiers)

Students write Java in VS Code and call `turtle.upload(url)`. The upload needs to be tied to the student's identity without requiring them to open a browser mid-coding-session. This flow is identical regardless of auth tier — the token is just opaque, generated server-side once a player record exists (whether that record came from a typed display name, basic auth, or OAuth).

**Flow:**
1. Student opens the browser visualizer and gets identified somehow (Tier 0/1/2, whichever the faculty member configured)
2. Browser displays a personal upload token tied to their player record
3. Student copies the token into their Java code once at the start of the assignment
4. `turtle.upload()` sends the token as a header; server resolves it to a player record

```java
KnoxCraft.setServer("http://knoxel.knox.edu");
KnoxCraft.setToken("abc123xyz");  // copied from browser, set once
turtle.upload();
```

The token is scoped to a world and expires after the assignment period. Faculty generate/reset tokens when they create a world.

### Solo mode (Tier 1 deployment, client-only)

No auth, no server at all. Student loads JSON from file or paste. Nothing is sent anywhere. Identity is irrelevant. Not to be confused with the auth tiers above — this is the no-server deployment tier described in section 3.

---

## 8. World Management

### CLI-first world creation

World management is handled at the command line when starting the server. Faculty are running a binary and are comfortable with a terminal. There is no world-creation UI in the browser.

```bash
# First run — no worlds exist, prompted automatically
./knoxel serve
> No worlds found.
> Enter a world name: CS102 Week 4
> World created. Students connect at: http://192.168.1.42:8090
> Starting server...

# Subsequent runs — pick from list
./knoxel serve
> Worlds:
>   1. CS102 Week 4 (created 2026-09-08, 23 students, 847 blocks)
>   2. CS102 Week 7 (created 2026-10-13, 19 students, 1203 blocks)
> Select world (1-2) or enter a name to create new: 1
> Serving CS102 Week 4 at http://192.168.1.42:8090

# Pass world name as argument to skip the prompt entirely
./knoxel serve --world "CS102 Week 4"
```

`scripts/start.command` (Mac) and `scripts/start.bat` (Windows) just run `./knoxel serve` — the terminal handles world selection. No separate UI needed.

**Implementation note:** PocketBase doesn't have a startup hook for this. The CLI prompt is a small wrapper script (Node.js, ~80 lines) around the PocketBase binary. The wrapper starts PocketBase, waits for it to be ready, queries the `worlds` collection via the REST API, presents the world selection prompt, creates a world record if needed, then sets an environment variable the client reads to know which world is active.

`scripts/knoxel-server.js` is the actual entry point in the distribution zip — not the raw PocketBase binary. `start.command` (Mac) and `start.bat` (Windows) run this script.

**Exact prompt behavior:**

```
# No worlds exist:
Knoxel
──────────────────────────
No existing worlds found.
World name [CS102 Week 4]: _
(enter = use the suggested default, or type a name)

# One world exists:
Knoxel
──────────────────────────
  [1] CS102 Week 4   (created 2026-09-08, 23 players, 847 blocks)

Press enter to use CS102 Week 4, or type 'new' to create one: _

# Multiple worlds exist:
Knoxel
──────────────────────────
  [1] CS102 Week 4   (created 2026-09-08, 23 players, 847 blocks)  ← default
  [2] CS102 Week 7   (created 2026-10-13, 19 players, 1203 blocks)

Select world [1], or type 'new' to create one: _
```

Enter always selects the default shown in brackets. `new` prompts for a world name and creates a new record. World order is creation order, oldest first. Default is always [1] (oldest world) — this is intentional, since faculty typically return to the same world across sessions.

---

## 9. Faculty Panel

Separate URL: `/faculty`. Protected by PocketBase admin session — redirects to PocketBase admin login if not authenticated. Students never see this. Faculty never accidentally land in the student UI from here.

### Faculty as student

Faculty need to test the full student experience — upload token flow, turtle controls, program execution — without losing their admin session. The faculty panel includes a "Join as Student" button that opens the student UI (`/`) in the same browser with a test player account flagged `is_faculty = true`. Faculty can switch back to `/faculty` at any time without logging out. This is how faculty verify the tool works before assigning it.

### Submissions view

Table of all students in the current world:

| Column | Notes |
|---|---|
| Display name | as entered |
| Email | Knox email as entered — faculty's primary identification tool |
| Programs uploaded | total upload count across all program names |
| Last upload | timestamp of most recent upload |
| Instruction count | instruction count of most recent upload |
| Blocks placed | total blocks placed in the world |
| Status | active (last_seen < 5 min), idle, never connected |

Sortable by any column. Filterable by name/email. "Who hasn't uploaded yet" and "who uploaded in the last hour" are the two most useful views during a class session — surface these as quick filter buttons.

### Download

**Full JSON export:** one file, all uploads for the world. Each entry includes player display name, email, program name, upload timestamp, instruction count, thread count, and full instruction list. This is the research artifact.

**CSV summary:** one row per student, columns: display name, email, program count, final instruction count, thread count, first upload time, last upload time, blocks placed. For non-JSON analysis in Excel/R/Python.

### World controls

| Control | Behavior |
|---|---|
| Clear all blocks | removes all blocks from world, requires confirmation dialog |
| Clear student's blocks | removes one student's blocks, select from dropdown |
| Reset student's turtle | moves one student's turtle back to spawn |
| Pause all turtles | stops all running programs simultaneously — useful for live demos |
| Resume all turtles | resumes after pause |

### Stats panel

- Total blocks placed in world
- Total programs uploaded
- Active students right now (last_seen within 5 minutes)
- Upload timeline: sparkline chart of submissions over time — useful for seeing last-minute rushes

---

## 10. JSON Program Format

KnoxCraftMod emits JSON with the structure `playerName → programName → payload`. There are two payload formats depending on whether the program uses threads.

### Single-turtle format

```json
{
  "lucky_creeper": {
    "flag": {
      "instructions": [
        { "cmd": "forward" },
        { "cmd": "setBlock", "blk": "minecraft:dark_prismarine" },
        { "cmd": "forward" },
        { "cmd": "setBlock", "blk": "minecraft:dark_prismarine" },
        { "cmd": "right" },
        { "cmd": "forward" }
      ]
    }
  }
}
```

### Threaded format

Confirmed from actual KnoxCraftMod output (Mauritius flag program, 4 threads):

```json
{
  "lucky_creeper": {
    "pflag": {
      "description": "Mauritius in parallel!",
      "type": "parallel",
      "threads": [
        [
          { "cmd": "nop" },
          { "cmd": "forward" },
          { "cmd": "setBlock", "blk": "minecraft:red_wool" }
        ],
        [
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "nop" },
          { "cmd": "forward" },
          { "cmd": "setBlock", "blk": "minecraft:blue_wool" }
        ],
        [
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "nop" },
          { "cmd": "forward" },
          { "cmd": "setBlock", "blk": "minecraft:yellow_wool" }
        ],
        [
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "right" },
          { "cmd": "forward" },
          { "cmd": "setBlock", "blk": "minecraft:green_wool" }
        ]
      ]
    }
  }
}
```

Key observations:
- `"type": "parallel"` is the discriminator field
- `threads` is an **array of arrays** — each thread is a bare instruction array, not an object with an `instructions` key
- Threads do NOT need to be the same length — threads that finish early stop while others continue
- `nop` is used for synchronization: each thread burns a different number of turns + nops to arrive at a different facing direction at the same tick, then all turtles begin drawing simultaneously
- The `description` field is optional metadata, ignore during execution

Single-turtle programs have no `type` field and use `instructions` directly (see single-turtle format above). The discriminator logic:

```javascript
function parseProgram(payload) {
  if (payload.type === 'parallel') {
    // threads is array of arrays
    return { mode: 'parallel', threads: payload.threads }
  } else {
    // treat as degenerate single-thread case
    return { mode: 'parallel', threads: [payload.instructions] }
  }
}
```

Sequential programs are treated as a degenerate case of parallel (one thread). The interpreter always runs the lockstep multi-turtle loop; it just has one element for sequential programs. This simplifies the interpreter significantly.

### Command reference

#### Version 1 commands (all still valid)

| cmd | params | description |
|---|---|---|
| `forward` | — | move one block in facing direction |
| `back` | — | move one block opposite facing direction |
| `left` | — | turn 90° left (counterclockwise) |
| `right` | — | turn 90° right (clockwise) |
| `up` | — | move one block up |
| `down` | — | move one block down (blocked at y=1) |
| `setBlock` | `blk` (string) | place block at current position, do not move |
| `nop` | — | do nothing for one tick (used for thread synchronization) |

#### Version 2 additions

**Movement with n** — move n steps in one instruction. The `n` parameter is preserved in JSON (not pre-expanded) so research tooling retains semantic information.

| cmd | params | description |
|---|---|---|
| `forward` | `n` (int) | move n blocks in facing direction |
| `back` | `n` (int) | move n blocks opposite facing direction |
| `up` | `n` (int) | move n blocks up |
| `down` | `n` (int) | move n blocks down (blocked at y=1) |

**Line drawing commands** — place n blocks in the given direction. All six directions supported. Turtle facing does not change for horizontal commands. Vertical commands change turtle y position.

| cmd | params | description |
|---|---|---|
| `setBlockForward` | `n`, `blk` | place n blocks in facing direction, end on last |
| `setBlockBack` | `n`, `blk` | place n blocks opposite facing direction, end on last |
| `setBlockUp` | `n`, `blk` | place n blocks upward, end on last |
| `setBlockDown` | `n`, `blk` | place n blocks downward, end on last |
| `setBlockLeft` | `n`, `blk` | place n blocks to the left of facing, end on last |
| `setBlockRight` | `n`, `blk` | place n blocks to the right of facing, end on last |

#### setBlock semantics — place-then-move

**The fundamental rule: place block at current position first, then move. End on the last block placed.**

`setBlockForward(n)` = n placements, n-1 moves:
```
place at current → move → place → move → place → ... → place (end here)
```

`setBlockForward(1)` = place at current position, no movement. Identical to `setBlock`.

**Why this avoids off-by-one errors:** drawing a square of side n uses the same n for all four sides and returns to the starting position:

```java
// 4-block square, no off-by-one
turtle.setBlockForward(4)   // places at 0,1,2,3 — ends at 3
turtle.turnRight()
turtle.setBlockForward(4)   // places at 3 and 3 steps east — ends at far corner  
turtle.turnRight()
turtle.setBlockForward(4)   // south side
turtle.turnRight()
turtle.setBlockForward(4)   // west side — last block lands back at origin
// turtle is back at start, corners placed twice (last-write-wins, no problem)
```

Left/right directions are always relative to the turtle's current facing, not absolute world coordinates.

#### Version 2 JSON format

```json
{ "cmd": "setBlockForward", "n": 4, "blk": "minecraft:stone" }
{ "cmd": "setBlockUp",      "n": 3, "blk": "minecraft:dark_prismarine" }
{ "cmd": "setBlockDown",    "n": 3, "blk": "minecraft:red_wool" }
{ "cmd": "setBlockBack",    "n": 2, "blk": "minecraft:gold_block" }
{ "cmd": "setBlockLeft",    "n": 5, "blk": "minecraft:blue_wool" }
{ "cmd": "setBlockRight",   "n": 5, "blk": "minecraft:yellow_wool" }
{ "cmd": "forward",         "n": 10 }
{ "cmd": "up",              "n": 5  }
```

The interpreter expands these at runtime. The `n` parameter is never pre-expanded into individual instructions in the JSON — this preserves semantic information for research tooling (was this a loop or a shorthand call?).

#### Block color values

Block IDs are `minecraft:` namespaced strings, hex color strings, or `java.awt.Color`-derived values. The Java turtle library converts all color types to strings before serialization:

| Java source | JSON value | Renderer behavior |
|---|---|---|
| `BlockType.DARK_PRISMARINE` | `"minecraft:dark_prismarine"` | Faithful texture from atlas |
| `Color.RED` | `"#ff0000"` | Solid red material |
| `new Color(189, 45, 33)` | `"#bd2d21"` | Solid color material |
| `new Color(0, 0, 255, 128)` | `"#0000ff80"` | Semi-transparent blue (alpha=128/255) |
| Unknown block ID | `"minecraft:unknown_block"` | Hash-derived color, never crash |

**Alpha channel:** `java.awt.Color` supports a 4-argument constructor `new Color(r, g, b, alpha)` where alpha 0=transparent, 255=opaque. When alpha < 255, the Java library emits an 8-digit hex string (`#rrggbbaa`). The renderer detects 8-digit hex and sets `transparent: true, opacity: alpha/255` on the material. Fully opaque colors use 6-digit hex.

**Hash fallback:** unknown block IDs (not in `ATLAS_MAP`, not starting with `#`) get a deterministic color derived from a hash of the string. This means the same unknown block always renders the same color across sessions, and programs never crash on unrecognized blocks.

---

## 11. Interpreter Design

### Single-turtle interpreter

Pure JS state machine, no React dependencies. Lives in `lib/interpreter.js`.

```javascript
const state = {
  x: 0, y: 1, z: 0,
  facing: 'north',   // north | south | east | west
  pc: 0,
  instructions: [],
  done: false,
}
```

One step per call to `step(state)`. The calling code (React hook or setInterval) controls timing.

### Tick system

A tick is one step of the lockstep scheduler. Every tick, every active thread advances exactly one instruction. This is what makes parallelism visible — all turtles move simultaneously rather than sequentially.

**Canonical tick rate: 20 ticks/second.** This matches Minecraft's tick rate exactly, which means students coming from the mod have the same intuition about timing. The speed slider adjusts this rate but 20 ticks/second is the default and the reference rate.

**One interval, all threads. This is non-negotiable.**

```typescript
const TICK_MS = 1000 / 20  // 50ms per tick at default rate

async function runTick() {
  // Phase 1: animate all turtles simultaneously (~80% of tick = 40ms)
  const moves = threads
    .filter(t => !t.done)
    .map(t => previewNextInstruction(t))

  await Promise.all(moves.map(m => animateMove(m, TICK_MS * 0.8)))

  // Phase 2: execute state changes (place blocks, update positions)
  for (const thread of threads) {
    if (!thread.done) step(thread)
  }

  // Phase 3: brief pause so placed blocks register visually (~20% of tick = 10ms)
  await sleep(TICK_MS * 0.2)
}
```

Why not one interval per thread: JS intervals drift. Two intervals at the same rate will slowly desync, making the parallelism invisible. One interval driving all threads is the only correct implementation.

`nop` is a consumed tick — a thread that hits `nop` animates nothing and advances no position that tick while others continue. Threads that finish early set `done = true` and are skipped; remaining threads continue unaffected. There is no requirement that threads have equal length.

**Animation spec — this is the whole point, do it right from the start:**

- **Turtle movement:** lerp position from current to next over 80% of tick duration. All turtles move simultaneously. Never snap position.
- **Turtle rotation on turns:** tween Y rotation 90° over 80% of tick duration. Never snap rotation. A smooth turn reads as deliberate; a snap reads as a bug.
- **Block placement:** when a block appears, scale from 0.0 to 1.0 over ~100ms. Blocks feel placed rather than materialized. This detail matters more than it sounds.
- **Thread turtle colors:** each thread gets a distinct body color, not just an accent. When four turtles move in four directions simultaneously the eye must be able to track them individually. Color is the only reliable mechanism at speed.
- **Camera during parallel runs:** auto-follow is meaningless when 4 turtles go in 4 directions. Switch to a fixed overhead or wide-angle view that keeps all active turtles in frame when a threaded program runs. Single-turtle programs still auto-follow.

**Speed slider behavior:**
- Default: 20 ticks/second (Minecraft rate)
- Range: 1–20 ticks/second with full smooth animation
- Above 20 ticks/second (if slider allows): collapse animation, switch to instant block placement. Queuing more animations than the renderer can handle produces worse results than just skipping them.
- Animation duration always scales proportionally to tick duration — at 10 ticks/second, move tweens take 80ms; at 20 ticks/second they take 40ms.

### Multi-turtle (threaded) interpreter

Each thread gets its own state object. A single interval drives all turtles forward one instruction per tick — lockstep scheduling. This matches Minecraft's tick-based scheduling model and makes `nop` meaningful: a turtle that `nop`s waits one tick while others advance.

```javascript
function stepAllTurtles(turtles) {
  for (const turtle of turtles) {
    if (!turtle.done) step(turtle);
  }
}

setInterval(() => stepAllTurtles(activeTurtles), 1000 / stepsPerSecond);
```

All turtles in a threaded program spawn at the same origin. They are visually distinct meshes with different accent colors. The arrow indicator on each turtle shows its current facing direction.

### Speed control

Steps per second is user-controlled via a slider (1–100). Changing speed reschedules the interval without losing position.

---

## 12. Rendering

### Scene

- Three.js WebGL renderer
- Superflat world: large green plane, grid overlay
- Noon lighting: strong directional light from above, ambient fill
- Sky blue background with distance fog
- No world generation, no mobs, no liquids, no breakable ground

### Blocks

- `THREE.BoxGeometry(1,1,1)` per block, one per placed block in the world
- Three material resolution paths (in priority order):
  1. `blockId.startsWith('#')` → solid color or transparent material from hex value
  2. `ATLAS_MAP[blockId]` → atlas-based textured material, `NearestFilter` required
  3. fallback → hash-derived solid color, never crash
- Multi-face blocks (grass, logs, etc.): `BoxGeometry` with 6-material array (top/side/bottom)
- Transparency: 8-digit hex (`#rrggbbaa`) → `transparent: true, opacity: aa/255`
- Material cache keyed by block ID to minimize GPU objects — same block ID always reuses same material
- See section 14 for full texture atlas details

### Turtle mesh

- Simple geometric turtle: body, head, shell, directional eye
- Subtle bob animation on main render loop
- Yellow arrow indicator on ground showing facing direction
- Each thread turtle gets a distinct accent color
- Name tag above turtle (player display name)

### Camera

- Orbit camera (mouse drag), pan (right-click drag), zoom (scroll)
- Auto-follows active turtle by default
- Manual interaction disables auto-follow until reset
- Camera state preserved when new blocks are placed

---

## 13. Camera, Turtle Controls, and Interaction

### Camera and turtle are separate objects

The camera is the student's viewpoint — always free, always movable, independent of the turtle. The turtle is a separate object in the world with its own position and facing. Students fly their camera to watch the turtle run from any angle, including flying inside a structure while the turtle builds it.

### Camera modes

Two modes, toggle with `F`.

**Orbit mode (default):** mouse-drag to orbit, right-drag to pan, scroll to zoom. Good for overview, watching builds from outside. Auto-follows the active turtle when a program is running; manual interaction disables auto-follow.

**First-person mode:** Pointer Lock API captures the mouse. WASD moves in camera facing direction. Mouse look controls yaw/pitch. Space/Shift move up/down. No gravity, no collision — students fly freely through blocks. This is intentional; they need to fly inside structures.

- `F` toggles between modes
- `Escape` exits first-person and releases pointer lock (browser standard behavior)
- Show "Click to capture mouse · ESC to exit" overlay on first-person entry
- Pointer Lock requires a user gesture (click) to initiate
- Clamp pitch to ±89° to prevent upside-down flip
- No collision detection — clipping through blocks is fine

**Pointer lock and UI interaction are mutually exclusive.** When pointer lock is active (first-person), mouse clicks go to the 3D view. When pointer lock is released (Escape or orbit mode), clicks work normally on the panel UI. Students must always be able to hit Escape to reach the Stop button — they should never feel trapped unable to stop a runaway turtle.

### Turtle states

The turtle has three states:

**Idle** — turtle is not running. Student can move and rotate it freely, select a program, click Run.

**Running** — turtle is executing a program. Movement controls are locked. Stop button is prominent and always clickable (requires Escape first if in pointer lock). Turtle animates step by step.

**Done** — program finished. Turtle stays at final position. Returns to idle. Student can reposition and run again, or select a different program.

### Turtle controls (idle state only)

Turtle controls use arrow keys and Page Up/Down — separate from WASD camera controls so both can be active simultaneously without conflicts.

| Action | Key |
|---|---|
| Move forward (turtle facing) | Arrow Up |
| Move back | Arrow Down |
| Move left (strafe) | Arrow Left |
| Move right (strafe) | Arrow Right |
| Move up | Page Up |
| Move down | Page Down |
| Rotate 90° left | Q |
| Rotate 90° right | E |

Turtle facing controls both the rotation of the turtle mesh and the direction `forward` instructions will execute. Rotating before running a program determines the orientation of the entire build — students use this to avoid overwriting each other's work by positioning and facing the turtle toward empty space.

### Camera controls (always active)

| Action | Key/Mouse |
|---|---|
| Move forward/back/left/right | WASD |
| Move up | Space |
| Move down | Shift |
| Look around (first-person) | Mouse |
| Orbit (orbit mode) | Left-drag |
| Pan (orbit mode) | Right-drag |
| Zoom | Scroll wheel |
| Toggle first-person/orbit | F |
| Exit first-person | Escape |
| Interact with UI | Click (when not in pointer lock) |

### Stop button

Always visible in the panel UI. When the turtle is running, clicking Stop (or pressing Escape to exit pointer lock first, then clicking Stop) kills execution immediately. Turtle stays at its current position. Returns to idle state. Student can reposition and try again.

The Stop button should be visually prominent — large, red, impossible to miss — when the turtle is running. Students will need it the moment they realize their program is wrong.

### Program list

Displayed in the panel. Live-updating via PocketBase real-time subscription on the `programs` collection — when a student uploads from VS Code, the new program appears in the browser immediately without a manual refresh. Programs are sorted by upload time, most recent first. Each entry shows program name, upload time, and instruction count. Click to select, then click Run to execute from the turtle's current position and facing.

The JSON contains no embedded position or facing information — it is purely a list of relative instructions. Where the student parks the turtle before clicking Run determines where the build appears in the world. This is how students avoid colliding with each other's work.

### Student flow — multiplayer (PocketBase server)

1. Open browser to the server URL, type display name and Knox email, click Join.
2. Copy upload token from the browser UI — paste it into Java code once.
3. In VS Code: write Java turtle program, set server URL and token, run it. JSON POSTs to PocketBase.
4. Back in browser: new program appears in program list automatically (real-time subscription).
5. Fly camera to an empty area of the world.
6. Spawn turtle (button in UI) — turtle appears at camera position.
7. Use arrow keys to position and face the turtle toward empty space.
8. Select program from list, click Run.
9. Fly camera around to watch. Hit Stop if something goes wrong.
10. Iterate: fix Java in VS Code, re-run, new program appears in list, move turtle to fresh spot, Run again.

### Student flow — static tier (GitHub Pages)

1. In VS Code: write Java turtle program, call `turtle.openInBrowser("https://knoxel.github.io")`.
2. Java program runs locally, POSTs JSON to Cloudflare Worker, gets a short ID back.
3. Browser opens automatically to `https://knoxel.github.io/?id=xk7r9m`.
4. Browser fetches JSON from Worker, auto-runs the program immediately — no login, no token, no drag-and-drop.
5. Student watches turtle run. Can pause, reset, re-run from the UI.
6. No multiplayer — solo visualization only. Other students' turtles are not visible.
7. Fallback: if POST fails, Java library saves a JSON file locally and opens `knoxel.github.io` — student drags the file into the browser drop zone.

**Landing page behavior:**
- `?id=` present → fetch from Worker → auto-run program immediately
- `?id=` absent → show drag-and-drop zone and paste-JSON option
- Worker returns 404 (expired after 24h) → show friendly error: "This link has expired. Ask your instructor to re-run your program, or drag your JSON file here."

**No login, no email, no token** — the static tier is completely anonymous. Identity only matters in the multiplayer tier.

---

## 14. Block Rendering — Textures and Colors

### Two rendering paths

Knoxel supports two block rendering modes. Both can appear in the same world simultaneously.

**Textured blocks** — `minecraft:` namespaced block IDs use the Faithful 32x texture atlas. The block looks like Minecraft.

**Hex color blocks** — any value starting with `#` (e.g. `#ff6b6b`) renders as a flat solid color with no texture. Students who don't care about Minecraft aesthetics can use arbitrary colors. This is also the path for programmatic color assignment.

```typescript
function getMaterial(blockId: string): THREE.Material {
  if (blockId.startsWith('#')) {
    return solidColorMaterial(parseInt(blockId.slice(1), 16))
  }
  const faces = ATLAS_MAP[blockId]
  if (faces !== undefined) {
    return atlasMaterial(faces)
  }
  // Unknown block ID: hash to a deterministic color
  return solidColorMaterial(hashColor(blockId))
}
```

Three code paths, clean separation. Unknown blocks never crash — they get a hash-derived color so students always see something.

### Texture atlas

All block textures are packed into a single 1024×1024 PNG atlas (`client/public/textures/atlas.png`). This means one GPU texture, one material, one draw call for the entire world regardless of how many different block types are visible. Critical for render performance.

**Source:** Faithful 32x for Minecraft Java Edition 1.21.8  
**Repository:** `https://github.com/Faithful-Resource-Pack/Faithful-32x-Java` branch `1.21.8`  
**License:** Faithful License — non-commercial use with attribution. Credit in README and `docs/faculty-setup.md`.  
**Block textures:** `assets/minecraft/textures/block/` — individual 32×32 PNG per block face  

The atlas is **generated once and committed**. It does not need to be regenerated unless you update the target Minecraft version. The generator is `scripts/build-atlas.js`.

### Atlas structure

```
1024×1024 PNG
32 columns × 32 rows = 1024 slots
Each slot: 32×32 pixels (one block texture)
```

UV coordinates are computed from index at runtime:
```typescript
const col = index % ATLAS_COLS          // 0–31
const row = Math.floor(index / ATLAS_COLS)  // 0–31
const u = col / ATLAS_COLS              // 0.0–0.96875
const v = row / ATLAS_COLS
```

### atlas.ts — the block map

`client/src/lib/atlas.ts` is auto-generated by `build-atlas.js`. It maps every allowed block ID to an atlas index (or top/side/bottom indices for multi-face blocks):

```typescript
export type BlockFaces = number | { top: number; side: number; bottom: number }

export const ATLAS_MAP: Record<string, BlockFaces> = {
  'minecraft:stone':       0,
  'minecraft:grass_block': { top: 1, side: 2, bottom: 3 },
  'minecraft:dark_prismarine': 47,
  // ... ~300 blocks
}
```

Single index = same texture on all 6 faces. Object = different texture per face group.

### Multi-face blocks

~65 blocks have different textures on top, side, and bottom faces (logs, grass block, sandstone, furnaces, etc.). These are listed in `MULTI_FACE_BLOCKS` inside `build-atlas.js`. Three.js `BoxGeometry` supports an array of 6 materials natively — one per face — so this requires no custom shader.

### Generating the atlas

```bash
# One-time setup
cd scripts && npm install

# Run (point at the Faithful block textures folder)
node scripts/build-atlas.js ~/path/to/Faithful-32x-1.21.8/assets/minecraft/textures/block

# Outputs:
#   client/public/textures/atlas.png   (commit this)
#   client/src/lib/atlas.ts            (commit this)
```

### Block allow list

Not all Minecraft blocks make sense as voxels. `build-atlas.js` contains an explicit `ALLOW_LIST` of ~300 blocks that can be placed by turtles in Knoxel. Excluded: torches, flowers, saplings, rails, ladders, doors, beds, banners, signs, pressure plates, buttons, and other non-solid or non-cubic blocks.

Stairs and slabs render as full 1×1×1 cubes in Knoxel — their shape is ignored, only the texture is used. Students who use `STONE_STAIRS` get a stone-stairs-textured cube. Acceptable.

Skulls and heads render as full cubes with the head texture — recognizable and slightly amusing.

Animated blocks (sea lantern, magma, fire) use the first frame of the animation only in v1. Animation support is a v2 consideration.

### Updating to a new Minecraft version

When updating the mod target (currently 1.21.8):
1. `git checkout <new-version>` in the Faithful repo
2. Re-run `build-atlas.js` pointing at new textures
3. Add any new blocks to `ALLOW_LIST` in `build-atlas.js`
4. Commit `atlas.png` and `atlas.ts`

This is a once-a-year task if MC version is updated at all. Jaime's current decision: stay on 1.21.8 indefinitely.

### Texture slicing — one load, many tiles

The atlas is loaded once (one HTTP request, one GPU upload), then sliced in memory into individual `THREE.Texture` objects using Three.js `offset` and `repeat`. `atlasTexture.clone()` shares the underlying GPU texture — it does not re-upload image data. Each clone just has different UV settings. ~300 tile objects, all pointing at the same GPU memory. Cheap.

```typescript
// Load once at startup
const atlasTexture = await new THREE.TextureLoader().loadAsync('/textures/atlas.png')

// NearestFilter MUST be set on the source before any clones are made
atlasTexture.magFilter = THREE.NearestFilter
atlasTexture.minFilter = THREE.NearestFilter

function tileTexture(index: number): THREE.Texture {
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)

  const tile = atlasTexture.clone()
  tile.needsUpdate = true

  // offset: bottom-left corner of this tile in UV space
  // NOTE: Three.js UV origin is bottom-left; PNG origin is top-left.
  // Row 0 in the image (top) = v offset of (1 - 1/ATLAS_ROWS) in Three.js.
  // Without this flip, every block renders the wrong tile.
  tile.offset.set(
    col / ATLAS_COLS,
    1 - (row + 1) / ATLAS_ROWS
  )

  // repeat: fraction of the atlas this tile covers
  tile.repeat.set(1 / ATLAS_COLS, 1 / ATLAS_ROWS)

  return tile
}
```

Pre-slice all needed tiles at startup and cache them — do not create new tile textures per block placement:

```typescript
const tileCache = new Map<number, THREE.Texture>()

function getTile(index: number): THREE.Texture {
  if (!tileCache.has(index)) {
    tileCache.set(index, tileTexture(index))
  }
  return tileCache.get(index)!
}
```

### Material resolution

Three rendering paths, checked in this order:

```typescript
function getBlockMaterials(blockId: string): THREE.Material | THREE.Material[] {
  // Path 1: hex color (6-digit opaque or 8-digit with alpha)
  if (blockId.startsWith('#')) {
    return solidColorMaterial(blockId)
  }

  const faces = ATLAS_MAP[blockId]

  // Path 2: known block — atlas texture
  if (faces !== undefined) {
    if (typeof faces === 'number') {
      // same tile all 6 faces
      return new THREE.MeshLambertMaterial({ map: getTile(faces) })
    }
    // multi-face: BoxGeometry face order is +x,-x,+y,-y,+z,-z
    return [
      new THREE.MeshLambertMaterial({ map: getTile(faces.side) }),    // +x right
      new THREE.MeshLambertMaterial({ map: getTile(faces.side) }),    // -x left
      new THREE.MeshLambertMaterial({ map: getTile(faces.top) }),     // +y top
      new THREE.MeshLambertMaterial({ map: getTile(faces.bottom) }),  // -y bottom
      new THREE.MeshLambertMaterial({ map: getTile(faces.side) }),    // +z front
      new THREE.MeshLambertMaterial({ map: getTile(faces.side) }),    // -z back
    ]
  }

  // Path 3: unknown block — hash-derived deterministic color, never crash
  return hashColorMaterial(blockId)
}
```

### Alpha transparency

8-digit hex strings (`#rrggbbaa`) indicate transparency. Parse the alpha byte and set material accordingly:

```typescript
function solidColorMaterial(hex: string): THREE.MeshLambertMaterial {
  const isTransparent = hex.length === 9  // # + 8 digits
  const color = parseInt(hex.slice(1, 7), 16)
  const alpha = isTransparent ? parseInt(hex.slice(7, 9), 16) / 255 : 1.0
  return new THREE.MeshLambertMaterial({
    color,
    transparent: isTransparent,
    opacity: alpha,
  })
}
```

### Hash color fallback

Unknown block IDs get a deterministic color so the same unknown block always renders the same color across sessions:

```typescript
function hashColorMaterial(blockId: string): THREE.MeshLambertMaterial {
  let hash = 0
  for (let i = 0; i < blockId.length; i++) {
    hash = blockId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = Math.abs(hash) % 0xffffff
  return new THREE.MeshLambertMaterial({ color })
}
```

### NearestFilter — mandatory

```typescript
// Set on the source atlas before ANY clones are made
atlasTexture.magFilter = THREE.NearestFilter
atlasTexture.minFilter = THREE.NearestFilter
```

`NearestFilter` is mandatory. Without it, 32×32 textures blur on block faces and look terrible. Setting it on a clone after the fact is unreliable — always set on the source first. This one detail is the difference between "looks like Minecraft" and "looks like a smeared mess."

### Material cache

Cache materials keyed by block ID to avoid creating duplicate materials for the same block type:

```typescript
const materialCache = new Map<string, THREE.Material | THREE.Material[]>()

function getCachedMaterials(blockId: string) {
  if (!materialCache.has(blockId)) {
    materialCache.set(blockId, getBlockMaterials(blockId))
  }
  return materialCache.get(blockId)!
}
```

---

## 15. Multiplayer Protocol

No custom WebSocket protocol. PocketBase real-time subscriptions handle broadcast.

### Block placement

```javascript
// Client places a block
await pb.collection('blocks').create({ world_id, player_id, x, y, z, block_id })

// All other clients receive via subscription
pb.collection('blocks').subscribe('*', (e) => {
  if (e.action === 'create') placeBlock(e.record)
})
```

### Turtle position

Turtle position is updated in the `players` record as the interpreter runs. Other clients subscribe and move the corresponding turtle mesh.

```javascript
// Update own turtle position
await pb.collection('players').update(myPlayerId, { turtle_x, turtle_y, turtle_z, turtle_facing })

// Others receive
pb.collection('players').subscribe('*', (e) => {
  if (e.action === 'update') updateRemoteTurtle(e.record)
})
```

### New client join

On connect, client fetches current world state (all blocks, all player positions) then subscribes to real-time updates. This gives new joiners a snapshot + live updates without any custom sync logic.

```javascript
// Hydrate world on join
const blocks = await pb.collection('blocks').getFullList({ filter: `world_id = "${worldId}"` })
blocks.forEach(placeBlock)

const players = await pb.collection('players').getFullList({ filter: `world_id = "${worldId}"` })
players.forEach(spawnRemoteTurtle)

// Then subscribe to live updates
pb.collection('blocks').subscribe('*', handleBlockEvent)
pb.collection('players').subscribe('*', handlePlayerEvent)
```

### Update frequency

Events fire exactly when instructions execute, not on a timer. At 50 steps/second per student, 30 students: ~1500 writes/second to PocketBase. SQLite handles this comfortably on a laptop. No 30fps heartbeat, no continuous position streaming.

---

## 16. Research Instrumentation

Programs are saved server-side on every upload (not overwritten). This gives:

- **Iteration count** — how many times did a student upload a program?
- **Instruction count** — how complex is the final program?
- **Thread count** — did the student use parallelism?
- **Submission timing** — when did students upload relative to the deadline?
- **Block placement** — what did students actually build?

Example queries against the SQLite file:

```sql
-- Iteration count per student
SELECT p.display_name, COUNT(*) as uploads
FROM programs pr JOIN players p ON pr.player_id = p.id
WHERE pr.world_id = 'your-world-id'
GROUP BY p.id ORDER BY uploads DESC;

-- Average instruction count by submission hour
SELECT strftime('%H', submitted_at) as hour,
       AVG(instruction_count) as avg_instructions,
       COUNT(*) as submissions
FROM programs
GROUP BY hour ORDER BY hour;

-- Students who never placed any blocks (possibly stuck)
SELECT p.display_name
FROM players p
LEFT JOIN blocks b ON b.player_id = p.id AND b.world_id = p.world_id
WHERE p.world_id = 'your-world-id' AND b.id IS NULL;
```

The SQLite file can be analyzed directly with DBeaver, Python/pandas, R, or any standard SQL tool.

---

## 17. Deployment

### Local (Tier 2)

```
scripts/download-pocketbase.sh   # fetch binary for current platform
scripts/build.sh                 # build React app, copy to pb_public
cd server && ./pocketbase serve  # starts on :8090
```

Faculty share their laptop IP. Students open `http://192.168.x.x:8090`.

### Cloud (Tier 3)

```dockerfile
FROM alpine
COPY pocketbase /app/
COPY pb_public /app/pb_public/
WORKDIR /app
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
```

Deploy to Railway, Fly.io, or any VPS. One container, one port, one process.

### Distribution zips

`scripts/package.sh` produces:

```
knoxel-mac-arm64.zip
  pocketbase
  pb_public/
  start.command       # double-click on Mac
  README.txt

knoxel-windows-x64.zip
  pocketbase.exe
  pb_public/
  start.bat
  README.txt
```

The PocketBase binary is downloaded from the official PocketBase GitHub releases, not built from source. `download-pocketbase.sh` fetches the correct binary for the current platform.

### .gitignore

```gitignore
# Node
node_modules/
npm-debug.log*

# Vite build output — regenerated by build.sh
client/dist/

# PocketBase binary — downloaded separately, not built from source
server/pocketbase
server/pocketbase.exe

# PocketBase runtime data — NEVER COMMIT
# Contains SQLite database with all student records, emails, submissions.
# Committing this is a privacy violation. Back up manually if needed.
server/pb_data/

# PocketBase static serving — regenerated by build.sh
server/pb_public/

# Distribution zips — generated by package.sh
dist/

# OS
.DS_Store
Thumbs.db

# Environment files — may contain secrets (Worker URL, PocketBase URL)
.env
.env.local
.env.*.local

# Cloudflare Worker build artifacts
.wrangler/
worker/node_modules/
```

**`server/pb_data/` must never be committed.** This is the most important gitignore rule in the project. The directory contains the live SQLite database with student identities, emails, program submissions, and upload tokens. If you need to back up a world, copy `pb_data/` to a safe location outside the repo — never add it to git.

### Atlas files

`client/public/textures/atlas.png` and `client/src/lib/atlas.ts` ARE committed to git — they are generated artifacts but they are the outputs of a manual process (running `build-atlas.js` with the Faithful source checkout) that Weirdo cannot reproduce. They belong in the repo so Weirdo can use them without needing the Faithful checkout.

The Faithful source files (individual block PNGs) are NOT in the repo — they live on Jaime's machine in a separate Faithful git checkout. The script that generates the atlas from those files is in `scripts/build-atlas.js`.

---

## 18. Out of Scope

These are explicitly not part of this project:

- World generation (terrain, caves, biomes)
- Breakable blocks
- Mobs or NPCs
- Liquids or fire
- Inventory or crafting
- Daytime cycle (noon lighting only)
- A browser-based Java or JS code editor
- A Java-to-JavaScript transpiler
- Horizontal scaling or multi-instance deployment
- Minecraft protocol compatibility

The Minecraft mod (KnoxCraftMod) remains the Java programming environment. This project is the visualizer and shared world, not a Minecraft replacement.

---

## 19. Open Questions

- [ ] **Single-turtle `type` field:** Verify whether single-turtle programs emit `"type": "sequential"` or omit the field entirely. Parser handles both but good to confirm with a real v1 JSON sample.
- [ ] **Token expiry:** How long should upload tokens be valid? Per-world? Per-semester? Currently unspecified — tokens don't expire until a decision is made.
- [ ] **build-atlas.js first run:** Run the script once against the Faithful 1.21.8 checkout and check the missing textures report. Some skull/head texture filenames may not match expectations — add missing entries to `FALLBACK_TEXTURES`. Commit the resulting `atlas.png` and `atlas.ts` before handing to Weirdo.
- [ ] **Animated block textures:** Sea lantern, magma block, and a few others are animated in Faithful (MCMeta files). Currently using first frame only. Animation support is a v2 item.
- [ ] **GitHub Pages URL:** Confirm final URL — `knoxel.github.io` requires a GitHub organization (extra setup); `jspacco.github.io/knoxel` works with Jaime's existing account. Update `VITE_WORKER_URL` CORS header and any hardcoded references once decided.
- [ ] **Cloudflare Worker KV namespace name:** Decide on `PROGRAMS` or another name. Update `wrangler.toml`. Document the one-time `npx wrangler deploy` step in `docs/faculty-setup.md`.
- [ ] **Knoxel Java library `openInBrowser()`:** The standalone Java library needs this method — POSTs JSON to Cloudflare Worker, opens browser to `knoxel.github.io/?id=<id>`. This is Jaime's code to write, not Weirdo's. Weirdo documents the expected POST format and response shape in `docs/student-guide.md`.
- [ ] **`knoxel-server.js` wrapper:** Needs to be written as part of Stage 6. Should detect whether PocketBase is already running (port check) before starting it. Should open the browser automatically after world selection on Mac/Windows.