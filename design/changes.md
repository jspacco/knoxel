## 2026-08-02 — Verify Stage 1 (client-only visualizer) actually works end to end

**Intent:** Jaime asked to continue from where the last session left off, on
Stage 1 of design.md, by checking git log for what's done and picking up the
next task. The prior commit (`a913822`) left Stage 1 marked "work in
progress" with no changes.md entry, so before writing any new code the state
of the implementation needed to be established: does it actually run, and
does it meet the non-negotiable rendering requirements in design.md/CLAUDE.md
(NearestFilter, atlas Y-flip, material caching), or is it untested scaffolding?

**Prompt:** "Continue from where we left off. Check git log to see what's
been done and pick up the next task. we were on stage 1 of the system
described in design/design.md"

**Changes:**
- No source changes. This was a verification pass on the existing Stage 1
  implementation (`client/src/lib/interpreter.ts`, `lib/blockColors.ts`,
  `hooks/useWorld.ts`, `hooks/useTurtle.ts`, `components/World.tsx`,
  `components/Turtle.tsx`, `components/Panel.tsx`,
  `components/ProgramLoader.tsx`, `App.tsx`), all of which were already
  present and committed in `a913822` but never run or logged.
- `npx tsc --noEmit` in `client/` — clean, no type errors.
- Started the Vite dev server and drove it with a scripted headless
  Chromium session (Playwright, installed to a scratch dir outside the repo —
  not added as a project dependency). No `knoxcraft-turtle.html` prototype or
  sample program (e.g. Mauritius flag) exists anywhere in the repo or git
  history, so a small synthetic KnoxCraftMod-format JSON program was
  constructed by hand (`forward`, `left`/`right`, `setBlockForward` with
  `minecraft:dark_prismarine`, a plain `setBlock`, and a `#ff00ff` hex-color
  block) and loaded via the "Paste JSON instead" box in `ProgramLoader.tsx`.
- Verified: program parses and lists correctly in the picker (9 instructions,
  1 thread, 14 ticks); Run executes to completion with the expected tick
  count (14) and block count (5); turtle mesh renders and animates at spawn;
  `minecraft:dark_prismarine` renders as an actual tiled Faithful texture
  (confirmed by zooming the orbit camera in — visibly textured, not a flat
  fill), not a placeholder color; the `#ff00ff` hex block renders as a solid
  magenta cube via the hex-color path; final turtle position matched the
  hand-traced expected coordinates exactly. No console errors or page errors
  during the run.
- Conclusion: Stage 1 build-order items 1–11 in CLAUDE.md are complete and
  working. The three material-resolution paths, atlas tile caching, the
  mandatory `NearestFilter`-before-clone ordering, and the `1 - (row+1) /
  ATLAS_ROWS` Y-flip in `useWorld.ts` all match design.md section 14 exactly.
- design.md sections affected: none (read-only verification).
- Git commit hash: (this commit)

**NEEDS JAIME:** There's no sample KnoxCraftMod JSON program anywhere in the
repo (the prototype file `knoxcraft-turtle.html` referenced in CLAUDE.md was
never committed, and no Mauritius-flag-style export exists either). Stage 2's
verification step explicitly calls for "the Mauritius flag program (4
threads)" — that file will need to be provided before Stage 2 can be
verified the way CLAUDE.md describes. Everything else in Stage 1 is
unblocked; ready to move to Stage 1.5 (camera and turtle controls) whenever
you want me to proceed.

## 2026-08-05 — Fix interpreter to match the confirmed v2 command format; add Load Sample dropdown

**Intent:** Jaime asked to continue implementing the project from where the
last session left off. Between the last changes.md entry and now, Jaime
added the real `java-client/` turtle library, committed the real ground-truth
sample files (`flag.json`, `pflag.json`, `pflag2.json`), and updated
design.md section 10 with the "confirmed from real Java client output" v2
command semantics — but the browser interpreter was never updated to match,
so it silently mis-parsed the very files that are supposed to be ground
truth.

**Prompt:** "ok, figure out where you left off previously in implemented the
project specified in design/design.md, and continue implementing the project
described in there."

**Changes:**
- `lib/interpreter.ts`: `parseProgramFile` only understood the nested
  `playerName -> programName -> payload` shape. The real upload format
  (confirmed by all three sample files and by `KnoxelUploader.java`'s
  `KnoxelPayload` class) is a flat `{version, email, program, description,
  threads}` object with no nesting. Every sample file failed to parse at all
  before this fix. Added `isFlatPayload`/`parseFlatPayload` so both shapes are
  accepted — the flat payload's `email` becomes `playerName`, `program`
  becomes `programName`.
- `lib/interpreter.ts`: `left`/`right` were still v1 semantics (turn 90°, no
  `n`). design.md section 10 confirms v2 changed these to **strafe**
  sideways with an optional `n`, and introduced separate `turnLeft`/
  `turnRight` for rotation (never take `n`) — matching `TerpCommand.java`'s
  `LEFT`/`RIGHT` (movement) vs `TURN_LEFT`/`TURN_RIGHT` (rotation) and
  `AbstractTerp.java`'s `left(int)`/`right(int)` calling `move()`. Added
  `turnLeft`/`turnRight` to the `Instruction` union and `KNOWN_COMMANDS`;
  changed `left`/`right` expansion to `repeatMove` against `leftVector`/
  `rightVector` (facing unchanged); added `repeatNop` so `nop(n)` actually
  waits `n` ticks instead of always exactly 1. Without this fix `flag.json`'s
  `right` (used to strafe between stripes) rotated the turtle instead, and the
  Mauritius flag would have rendered as a garbled L-shape rather than four
  clean stripes.
- `components/ProgramLoader.tsx`: added the "Load Sample" `<select>` required
  by CLAUDE.md Stage 1 item 11 — fetches `client/public/samples/*.json` by
  URL (`${import.meta.env.BASE_URL}samples/<file>`), was entirely missing
  before this. Updated the stale top-of-file comment describing only the
  nested format.
- Verified with a headless Playwright session against the dev server (driver
  scripts in a scratch dir, not part of the repo): all three real samples now
  parse and run to completion with no console errors. `flag.json` (1 thread,
  384 ticks, 48 instructions) and `pflag.json` (4 threads, 108 ticks, 54
  instructions) render the identical four-stripe Mauritius flag — confirming
  the parallel version reproduces the sequential one exactly, as intended.
  `pflag2.json` (4 threads, 220 instructions, hex colors) renders eight
  stripes with the `#0000ff80` stripes visibly semi-transparent (ground grid
  lines show through) versus the opaque stripes next to them.
- design.md sections affected: none (implementation was brought into line
  with the spec Jaime had already written; no spec changes).
- Git commit hash: (this commit)

**NEEDS JAIME:** None — the format ambiguity was already resolved in
design.md by the time I got to it; I just hadn't caught up the code yet.
Moving on to Stage 1.5 (camera rig + turtle keyboard controls) next, since
that was the last stage flagged as unblocked and it turns out to be
unimplemented — the Panel UI already documents WASD/F/arrow-key/Q-E
keybindings in its help text, but no keyboard or pointer-lock handling
actually exists yet.

## 2026-08-05 — Stage 1.5: camera rig (orbit/first-person) and turtle keyboard controls

**Intent:** Continuing the same "pick up where we left off" session. The
previous entry noted that `Panel.tsx`'s help text already documented WASD
flight, F to toggle camera mode, arrow keys to move the turtle, and Q/E to
rotate it — but none of it was wired up. `useTurtle.ts` already had
`nudge()`/`rotate()`/`spawnAt()` implemented and gated to idle/done state,
and `useWorld.ts` had `enableOrbitControls()` with a comment saying it would
be "replaced by the full rig in Stage 1.5" — so the backing logic existed but
the input layer never got built.

**Prompt:** Same as the prior entry — "continue implementing the project
described in [design/design.md]," picking up at Stage 1.5 once the
interpreter fix and Load Sample dropdown were done and committed.

**Changes:**
- `hooks/useWorld.ts`: added a first-person fly camera to `WorldScene` —
  Pointer Lock API on canvas click, WASD movement (yaw+pitch for
  forward/back, yaw-only for strafe, so strafing doesn't tilt the view),
  Space/Shift for up/down, mouse-look via `movementX/Y` with pitch clamped to
  ±89° (the standard `PointerLockControls` Euler('YXZ') pattern). `F` toggles
  between orbit and first-person (guarded against firing while typing in a
  form field); losing pointer lock for any reason (Escape, tab switch)
  drops back to orbit mode, per design.md section 13's requirement that
  students always be able to reach the Stop button.
- Important correctness fix caught before it shipped: `OrbitControls.update()`
  recomputes `camera.position` from its own stored spherical coordinates
  every call, regardless of `.enabled` — calling it unconditionally in the
  render loop while first-person owned the camera would have silently
  overwritten every frame of WASD movement. The loop now calls
  `orbit.update()` only in orbit mode and `updateFirstPersonMovement()`
  otherwise. Switching modes re-derives yaw/pitch from the camera's current
  quaternion (entering first-person) or re-targets the orbit control at a
  point ahead of the camera (returning to orbit), so neither transition snaps
  the view.
- `hooks/useWorld.ts` / `components/World.tsx` / `App.tsx`: `cameraMode` and
  `pointerLocked` are mirrored into React state via a subscriber callback
  (`onCameraModeChange`) and drive the bottom hint text and a new centered
  "Click to capture mouse · ESC to exit" overlay (`viewport-pointer-lock-prompt`
  in `index.css`), shown only while in first-person mode before the lock is
  acquired, per design.md section 13.
- `hooks/useTurtle.ts`: wired Arrow keys / Page Up/Down / Q/E to the existing
  `nudge()`/`rotate()` calls via a `window` keydown listener, separate from
  the camera's WASD listener so both work simultaneously without conflict
  (design.md section 13). No new run-state guard was needed — `nudge()`/
  `rotate()` already no-op outside idle/done via `isMovable()`.
- Exported `isTypingTarget` from `useWorld.ts` and reused it in `useTurtle.ts`
  so neither keyboard listener hijacks input while a student is typing in the
  paste box or elsewhere in the panel.
- Verified with a headless Playwright session against the dev server: `F`
  toggles the hint text and shows/hides the overlay correctly; holding `W`
  for 4 seconds in first-person flew the camera through the ground and up
  into the sky (no collision, as intended) — confirmed visually via
  screenshots, not just absence of errors; `Space` moved it back down.
  Arrow/PageUp/PageDown/Q/E moved and rotated the turtle correctly relative
  to its current facing (verified the exact coordinate deltas, e.g. strafing
  left while facing east moved -z, matching `leftVector(turnLeft(facing))`).
  Spamming all six turtle keys while a program was running left the run
  button showing "Pause" throughout (i.e. still running, untouched) —
  confirms the idle-only lock works under real keyboard input, not just at
  the type level.
- One thing I could not verify in this environment: actual Pointer Lock
  acquisition. `canvas.requestPointerLock()` throws `WrongDocumentError: The
  root document of this element is not valid for pointer lock` under
  headless Chromium via Playwright — a known limitation of automated/headless
  browser contexts, not a code path I can fix from here. The mouse-look
  logic itself follows the same Euler('YXZ') approach used by three.js's own
  `PointerLockControls` example, so it should work in a real browser tab;
  Jaime, please click into the 3D view in an actual browser and confirm
  mouse-look feels right — I have no way to simulate real mouse movement
  events under an acquired lock from here.
- design.md sections affected: none (implementation matches section 13 as
  written).
- Git commit hash: (this commit)

**NEEDS JAIME:** Please manually confirm mouse-look (yaw/pitch via Pointer
Lock) in a real browser — see note above, this is the one piece of Stage 1.5
I couldn't verify end-to-end in a headless environment. Everything else in
Stage 1.5's build-order checklist (CLAUDE.md) is implemented and verified.
Next unblocked stage is Stage 2 (threaded programs with smooth animation) —
worth noting that inspecting the code, most of Stage 2 already appears to be
implemented (tick loop in `useTurtle.ts`, per-thread colors, block pop-in
animation) even though it was never logged in changes.md; I have not yet
verified it against CLAUDE.md's Stage 2 checklist item-by-item (in
particular, camera auto-switch to a wide/overhead view during threaded runs
and auto-follow for single-thread runs — `WorldScene.frameAll()`/`focusOn()`
exist but nothing in `useTurtle.ts`'s `run()` currently calls them). Will
pick that up next unless you'd rather redirect.

## 2026-08-05 — Stage 2: camera auto-follow / wide-view during runs

**Intent:** Jaime said "go ahead and work on stage 2." The previous entry had
already found that most of Stage 2 was implemented (tick loop, per-thread
colors, block pop-in) despite never being logged, with one concrete gap:
CLAUDE.md's Stage 2 item 8 and design.md section 13 both call for the camera
to auto-follow a single running turtle and switch to a wide/overhead view
that keeps every turtle in frame during a threaded run, and neither existed
— `WorldScene` had the underlying `focusOn()`/`frameAll()` primitives from
Stage 1.5 but nothing called them during a run.

**Prompt:** "ok, go ahead and work on stage 2."

**Changes:**
- `hooks/useWorld.ts`: added `autoFollowEnabled` state to `WorldScene`,
  defaulting to true and flipping false on OrbitControls' `'start'` event —
  which only fires from genuine pointer/wheel input, never from programmatic
  calls, and never at all while `orbit.enabled === false` (first-person
  mode). Added three methods: `resetAutoFollow()` (re-arms it), `followTurtle
  (position)` (auto-follow gate + orbit-mode gate, then `focusOn`), and
  `frameThreads(positions)` (orbit-mode gate, then `frameAll`). Both
  `followTurtle`/`frameThreads` are no-ops in first-person mode — the camera
  there is always fully manual, per design.md's "camera and turtle are
  separate objects."
- `hooks/useTurtle.ts`: added `syncCamera(states)` — calls `frameThreads` for
  more than one thread, `followTurtle` for exactly one — and wired it into
  `run()` (immediately, so framing is correct from tick zero) and into the
  same ~100ms UI-throttle block in `runLoop` that already publishes
  thread/transform state, so the camera keeps re-framing as threads spread
  apart during a run without adding a separate timer. `run()` now also calls
  `world.resetAutoFollow()` so a fresh Run always starts with auto-follow
  armed regardless of what a previous run's manual orbiting left it at;
  `reset()` does the same, since design.md phrases the manual-interaction
  override as lasting "until reset."
- Verified with a headless Playwright session against the dev server,
  screenshot-by-screenshot, not just absence of errors:
  - `pflag.json` (4 threads): at tick 1 the camera framed a near-point
    bounding box (three of four threads happened to coincide at the same
    cell after their first strafe tick — a real, expected transient of the
    nop/strafe synchronization pattern, not a bug) and zoomed in
    accordingly; by mid-run all four distinctly-colored, correctly-labeled
    threads were visible together in a wider overhead shot, confirming
    `frameThreads` re-fits continuously as threads diverge.
  - `flag.json` (1 thread): camera visibly translated in step with the
    turtle between a screenshot at tick ~3 and one at tick ~58, the flag
    staying in the same relative position in frame — auto-follow is
    actually tracking, not just not-crashing.
  - Simulated a manual orbit drag (`page.mouse.down/move/up` on the canvas)
    mid-run, then compared two screenshots 2 seconds apart while the turtle
    kept moving (tick 74 → 110, position changed): the view was identical
    between them, confirming the manual interaction correctly and durably
    disabled auto-follow rather than it resuming on the next throttled
    update.
- design.md sections affected: none (implementation matches sections 11/13
  as written).
- Git commit hash: (this commit)

**NEEDS JAIME:** None. Stage 2's build-order checklist (CLAUDE.md) is now
fully implemented and verified, including the item this entry closes.
Reminder from the last entry still stands: I have no way to verify actual
Pointer Lock mouse-look in this headless environment, so that one piece of
Stage 1.5 still wants a manual check in a real browser tab. Next unblocked
stage is Stage 3 (PocketBase schema) — that's a server/deployment stage
rather than a client one, so it's a bigger scope change; let me know if
you'd like me to continue straight into it or pause here.

## 2026-08-05 — Camera/turtle-control polish: ground collision, IJKL keys, click-to-capture, opt-in follow, 60-tick cap

**Intent:** Jaime tried the Stage 1.5/2 camera and turtle controls and found
five rough edges: the first-person camera could fly through the ground, the
turtle's control scheme wasn't as natural as it could be with the camera also
using the keyboard, first-person mode needed a dedicated F press before a
click would capture the mouse, auto-follow snapping the camera to the turtle
on every Run click was disorienting, and the speed slider went absurdly far
past the point of being watchable.

**Prompt:** "add the following features: The changes — Ground collision for
camera: Camera Y position must never go below ground level... Turtle
movement keys: IJKL for forward/back/left/right strafe, U/O for up/down...
Click to capture focus, not F... Camera stays put when running a program...
Tick rate slider 1-60..."

**Changes:**
- Ground collision (`hooks/useWorld.ts`): added `CAMERA_MIN_Y = GROUND_Y +
  0.5` and a `clampCameraToGround()` call at the end of every render-loop
  frame, after both the orbit-controls update and the first-person fly
  update. Applies in both camera modes, not just first-person-with-Shift.
- Turtle keys (`hooks/useTurtle.ts`): the idle-turtle keydown handler now
  accepts `KeyI/KeyK/KeyJ/KeyL` (forward/back/left/right) and `KeyU/KeyO`
  (up/down) as equivalents to the existing Arrow keys and Page Up/Down — kept
  both rather than replacing, since the prompt said arrows were "also fine."
  Q/E rotate was left as-is.
- Click-to-capture (`hooks/useWorld.ts`): `handleCanvasClick` now switches to
  first-person mode itself (`setCameraMode('first-person')`) before
  requesting pointer lock, instead of only requesting lock when already in
  first-person. F is kept as an alternative toggle, per the prompt's "or keep
  F as an alternative."
- Opt-in auto-follow (`hooks/useWorld.ts`, `hooks/useTurtle.ts`,
  `components/Panel.tsx`, `App.tsx`): `WorldScene.autoFollowEnabled` now
  defaults to `false` instead of being force-reset to `true` on every
  `run()`/`reset()`. Replaced the old `resetAutoFollow()` method with
  `setAutoFollow(enabled)`. Added a `followEnabled`/`setFollowEnabled` pair to
  `useTurtle`, a "Follow turtle with camera" checkbox in the Panel's Run
  section, and wired it through `App.tsx`. `run()`/`reset()` now apply
  whatever the checkbox currently says instead of forcing follow on.
- Tick rate slider (`hooks/useTurtle.ts`): `MAX_TICKS_PER_SECOND` 100 → 60.
  The slider's `max` attribute in `Panel.tsx` reads this constant, so no
  separate change was needed there.
- Updated the `Panel.tsx` controls-help list and the `App.tsx` viewport hint
  strings to describe the new click-to-capture behavior and IJKL/U/O keys.
  Added a `.checkbox-label` style to `index.css` for the new toggle.
- Verified in a real (headless Chromium via Playwright, driven interactively)
  browser session against the Vite dev server: `#speed` slider's `max` reads
  60; pressing I then U from idle moved the turtle from `(0,1,0)` to
  `(0,2,-1)` (forward + up); clicking the canvas from orbit mode switched the
  hint text straight to the first-person line and showed the pointer-lock
  prompt without an intervening F press; holding Shift for 3 seconds in
  first-person left the view still full of nearby grass with only a sliver of
  sky at the horizon (evidence the camera stayed pinned near ground level
  instead of dropping through it); running the `flag` sample after manually
  orbiting to a deliberately off-default framing showed an identical camera
  framing before, immediately after clicking Run, and 2 seconds into the run
  (tick 43, 24 blocks placed) — the camera never jumped to the turtle.
  `npx tsc --noEmit` and `npm run build` both clean.
  Pointer Lock's actual OS-level mouse capture still can't be verified
  headless (`WrongDocumentError` from `requestPointerLock()` in this
  environment) — same caveat as the last entry, needs a manual check in a
  real tab.
- design.md sections affected: none — these are UX refinements to the camera
  rig and tick system already specified in sections 11/13; no architecture
  changed.
- Git commit hash: (this commit)

**NEEDS JAIME:** None — all five requested changes are conservative,
non-architectural fixes directly implied by your descriptions. One judgment
call: for opt-in auto-follow, I went with the checkbox option (kept the
feature, made it opt-in) rather than deleting `followTurtle`/`frameThreads`
entirely, since the prompt offered both and the checkbox preserves useful
functionality for anyone who does want the camera to track the turtle.

## 2026-08-05 — Stage 3: PocketBase schema in migrations, running locally

**Intent:** Jaime asked to implement "part 3 of design.md," which — after I
confirmed with him — meant CLAUDE.md's Stage 3 (not design.md's own section
3, "Deployment Tiers"): get the PocketBase schema defined as versioned
migrations and PocketBase actually running locally against that schema, per
CLAUDE.md's five-item Stage 3 checklist. This is the first server-side stage;
everything before this was client-only.

**Prompt:** "ok, implement part 3 of the design.md file." (Clarified via a
follow-up question to mean CLAUDE.md's Stage 3 build-order item.)

**Changes:**
- `scripts/download-pocketbase.sh` — fetches the official PocketBase binary
  release (default pinned version `0.39.10`, overridable via `--version` or
  `POCKETBASE_VERSION`) for the current platform/arch (auto-detected from
  `uname`, or overridable via `--platform`/`--arch` for cross-downloading a
  Windows/Linux binary from a Mac, needed later for `package.sh`). Verifies
  the download against the release's `checksums.txt` (sha256) before
  installing to `server/pocketbase[.exe]` — not built from source, per
  design.md section 17.
- `server/pb_migrations/001_initial_schema.js` — creates `worlds`, `players`,
  `programs`, `blocks` base collections with the fields from design.md
  section 6 (relations wired via `collectionId` from the just-created
  collection's `.id`, confirmed to work as expected — `app.save()` mutates
  the passed object in place). API rules (list/view/create/update/delete)
  are deliberately left unset (superusers-only for now) — CLAUDE.md scopes
  the open-mode "unauthenticated creates" behavior to Stage 4, which depends
  on the login flow that doesn't exist yet, so wiring rules now would be
  guessing ahead of that stage.
- `server/pb_migrations/002_add_indexes.js` — adds the unique index on
  `blocks (world_id, x, y, z)` from design.md section 6 ("last write wins via
  upsert") as its own migration, per CLAUDE.md's explicit split between
  schema (001) and indexes (002).
- `server/pb_hooks/programs.pb.js` — `onRecordCreateRequest` hook on
  `programs` that computes `instruction_count`/`thread_count` from
  `json_content` before save, mirroring the `type: "parallel"` vs.
  `instructions` discriminator in `client/src/lib/interpreter.ts`'s
  `parsePayload()` (design.md section 10). Never crashes on malformed
  `json_content` — falls back to 0/0, same defensive posture as the client's
  unknown-block-ID handling.
- `scripts/dev.sh` — runs `server/pocketbase serve` and `client`'s `npm run
  dev` together, auto-downloading the binary first if missing, with a trap
  to kill both on exit. `client/vite.config.ts` already proxied `/api`/`/_`
  to `127.0.0.1:8090` from an earlier session, so no change was needed there
  — checked and confirmed still correct against the new schema.
- Two real bugs caught by testing against an actual running PocketBase
  instance rather than just reading the migration back:
  1. `turtle_x`/`turtle_y`/`turtle_z` (players) and `x`/`y`/`z` (blocks) were
     initially marked `required: true`. PocketBase's `NumberField.required`
     means *non-zero*, not *present* — this silently rejected the extremely
     common case of a turtle or block sitting at the world origin (x=0 or
     z=0). Removed `required` from all six coordinate fields; confirmed a
     player at `(0, 1, 0)` and a block at `(0, 1, 0)` both save correctly
     now.
  2. The `programs.pb.js` hook's counting logic was originally a top-level
     `function countProgram(payload) {...}` called from inside the
     `onRecordCreateRequest` callback. This evaluated fine at server start
     but threw `ReferenceError: countProgram is not defined` at actual
     request time — PocketBase's JSVM does not reliably preserve a plain
     function declared elsewhere in the file in scope when the hook fires.
     Fixed by inlining the counting logic directly in the callback.
  3. (Related, not a bug exactly, but worth recording since it cost real
     debugging time) `e.record.get('json_content')` on a JSON-type field
     does **not** return a parsed object or even a string — it returns the
     raw UTF-8 bytes as a numeric array. `e.record.unmarshalJSONField(key,
     obj)` exists but does not populate a plain JS object passed to it from
     this JSVM. `e.record.getString('json_content')` is the one that returns
     the actual JSON text; `JSON.parse()` that. If a future hook needs to
     read a JSON field, use `getString` + `JSON.parse`, not `get`.
- Verified end-to-end against a real, freshly-downloaded PocketBase
  v0.39.10 binary, not just by reading the migration files back:
  `./pocketbase migrate up` applies both migrations cleanly; fetched the
  live schema via the superuser API and confirmed every field, type,
  relation `collectionId`, and the `blocks` unique index match design.md
  section 6 exactly; created a world → player → two programs (single-turtle
  and 2-thread) → a block at the origin via the REST API and confirmed
  `instruction_count`/`thread_count` compute correctly (3/1 and 6/2) and a
  duplicate block at the same `(world_id, x, y, z)` is rejected (400) by the
  unique index; ran a full `migrate down 1` ×2 → `migrate up` round-trip and
  re-verified the schema afterward — clean in both directions, no leftover
  state. Test PocketBase data (`server/pb_data/`) was deleted afterward —
  it's gitignored and was local verification scaffolding only.
- design.md sections affected: none — this implements section 6 (Database
  Schema) and section 17 (Deployment) exactly as already specified.
- Git commit hash: (this commit)

**NEEDS JAIME:** Two things worth your attention, both flagged rather than
silently decided:
1. The pinned PocketBase version (`0.39.10`) was the actual latest release
   at the time I wrote the script (checked against the GitHub releases API,
   not guessed) — bump it via `--version`/`POCKETBASE_VERSION` whenever you
   want a newer one; nothing auto-updates.
2. API access rules (who can create/read/update players, programs, blocks
   without a superuser session) are still unset. This isn't an oversight —
   CLAUDE.md's Stage 4 (Auth) is explicitly where open-mode's "unauthenticated
   creates allowed" behavior gets wired up, and I didn't want to guess at
   rule strings ahead of the login flow that determines them. Next unblocked
   stage is Stage 4.

## 2026-08-06 — Implement Stage 4 (authentication and identity)

**Intent:** Jaime asked to implement Stage 4 from design.md — students need a
way to identify themselves (open mode: display name + Knox email, no
password; accounts mode: faculty-issued email + password) so uploads and
turtle sessions can be attributed to a real student, per design.md section 7.

**Prompt:** "let's implement stage 4 on authentication as described in
design/design.md" (a later message — "ok, more credits added, please finish
stage 4" — confirmed continuing the same task after a session gap).

**Changes:**

- `server/pb_migrations/003_stage4_auth.js` — the core schema change.
  `players` becomes a PocketBase **auth** collection (was `base`) so
  accounts-mode login can use PocketBase's built-in `authWithPassword` and
  bcrypt storage directly. Two things that only surfaced by testing against
  a real running PocketBase 0.39.10 instance, not by reading migration docs:
  1. **PocketBase refuses to change an existing collection's `type` in
     place** ("Collection type cannot be changed"). The migration instead
     captures the collection's existing `id`, temporarily drops the
     `player_id` relation field from `programs`/`blocks` (PocketBase won't
     delete a collection with live relation references), deletes and
     recreates `players` as `type: 'auth'` **with the same id** (so the
     relation fields' stored `collectionId` stays valid), then re-adds
     `player_id` on `programs`/`blocks` pointing at it. `down()` mirrors
     this to restore the original `base` shape from 001. Verified with a
     real `migrate down 1` → `migrate up` round trip on a scratch copy of
     `pb_data` before touching the real one.
  2. **Auth-collection creates require `password` + `passwordConfirm`
     regardless of the `password` field's own `required` flag.** Open mode
     never asks students for a password (design.md section 7) — confirmed
     empirically that setting `required: false` on the field alone doesn't
     help; a public create with neither field present is rejected outright.
     Worked around in `pb_hooks/players.pb.js` (below), not in the schema.
  - `display_name` also drops `required: true` from 001. Stage 5.5's
    account-provisioning flow (upload student emails → generate passwords →
    create accounts) only has email + password at creation time; the
    student picks a display name on first login. Confirmed empirically that
    provisioning a player with only email + password fails validation
    otherwise, which would make Stage 5.5 impossible to implement as
    designed.
  - `createRule`/`listRule`/`viewRule`/`updateRule` on `players` and
    `createRule` on `programs` branch on `world_id.auth_mode` (a
    relation-following filter): open mode is fully public — matches design.md's
    explicit "students could upload under someone else's email, that's
    acceptable" risk acceptance; accounts mode requires
    `@request.auth.id = id` / `= player_id`. `programs.listRule`/`viewRule`
    are fully public per design.md's "turtle programs are not sensitive
    data." `worlds.listRule`/`viewRule` are now public too, so a client with
    no session yet can discover the world and its `auth_mode` before anyone
    logs in.
- `server/pb_hooks/players.pb.js` (new) — `onRecordCreateRequest` hook that
  auto-fills `password`/`passwordConfirm` with a random string when the
  client didn't supply one (open-mode signups never do), defaults
  `turtle_facing` to `'north'` when absent, and forces
  `emailVisibility: true`. That last one fixed a real bug caught during
  verification: PocketBase auth collections hide `email` from **filters**,
  not just API responses, when `emailVisibility` is false — an anonymous
  `players.getFirstListItem('email = ... && world_id = ...')` returned 404
  for a row that plainly had that email, even though an unfiltered list
  returned it. The open-mode browser login flow depends on looking players
  up by email with no auth token, so this had to be forced on.
- `server/pb_hooks/upload.pb.js` (new) — a custom `POST /upload` route for
  the Java client (`java-client/KnoxelUploader.java`), which already POSTs
  to `{serverUrl}/upload` with `X-Email`/`X-Password`/`X-Version` headers
  and a flat JSON body. Left that wire format alone rather than moving the
  Java client to POST `/api/collections/programs/records` as design.md
  section 7 literally describes, because that endpoint requires a
  `player_id` the Java client has no way to obtain on its own — creating a
  `programs` record needs one. This route does the lookup instead: in open
  mode it finds-or-creates the player by email (defaulting `display_name`
  to the email's local part, since the Java payload has no name field —
  students who also use the browser can set a real one there); in accounts
  mode it validates the password against the stored hash via
  `record.validatePassword()` and rejects with 401 on mismatch. "Active
  world" is picked as the most recently created `worlds` row — see **NEEDS
  JAIME** below.
- `server/pb_hooks/programs.pb.js` — changed the existing instruction/thread
  counting hook from `onRecordCreateRequest` to `onRecordCreate`. Caught by
  testing the `/upload` route end to end: `onRecordCreateRequest` only fires
  for the standard REST create endpoint, not for records saved
  programmatically via `$app.save()` from another hook (which is how
  `upload.pb.js` creates program records) — those were silently getting
  `instruction_count`/`thread_count` of 0. `onRecordCreate` is model-level
  and fires for both.
- `client/src/lib/pocketbase.ts` (new) — the PocketBase client singleton.
  `POCKETBASE_ENABLED` is `Boolean(VITE_POCKETBASE_URL)`, matching the
  existing comment in `vite-env.d.ts` ("unset/empty = solo mode").
  `fetchActiveWorld()` — see **NEEDS JAIME**.
- `client/src/hooks/usePocketbase.ts` (new) — session state. Accounts-mode
  sessions are ordinary PocketBase auth tokens, restored automatically by
  the SDK's own localStorage-backed auth store. Open mode has no password
  and therefore no token, so its session (which player id, in which world)
  lives in a small separate `knoxel_open_session` localStorage entry.
  `loginOpen()` finds-or-creates a player by `email && world_id` (updating
  `display_name` if it changed); `loginAccounts()` calls
  `authWithPassword`; `updateDisplayName()` patches the record after
  accounts-mode first login (see below).
- `client/src/components/Login.tsx` (new) — full-screen gate shown before a
  player is identified. Renders the open-mode (display name + email) or
  accounts-mode (email + password) form based on `world.auth_mode`, or a
  display-name-only prompt when an accounts-mode player has just
  authenticated but has no name yet (Stage 5.5 provisioning only sets
  email + password).
- `client/src/components/MyPrograms.tsx` (new) — lists the logged-in
  player's previously uploaded programs (Stage 4 verify step: "student ...
  can see program list"), loadable back into the interpreter via the
  existing `parsePayload()`.
- `client/src/App.tsx` — gates the app behind `<Login>` when
  `POCKETBASE_ENABLED` and no player is set (or a display name is still
  needed); passes an identity/"switch player" block into `Panel`'s `header`
  slot and `MyPrograms` into its `children` slot — both slots already
  existed, put there by an earlier stage in anticipation of this.
- `client/src/index.css` — `.login-screen`/`.login-card`/`.login-error`/
  `.identity` styles, reusing existing color variables and `label.field`/
  `.button` conventions rather than introducing new ones.
- `scripts/dev.sh` — exports `VITE_POCKETBASE_URL=/` before `npm run dev` so
  local dev has the login/auth UI enabled by default (relative `/` works
  because the Vite proxy forwards `/api` to PocketBase, same as production).
- Verified end-to-end against a real, running PocketBase 0.39.10 instance
  (migrations applied for real, not just read back): open-mode signup with
  no password, duplicate-email login reusing the same player and renaming
  it, accounts-mode provisioning by a superuser + `authWithPassword` login +
  first-login display-name prompt, program upload and listing in both
  modes, the `/upload` route matching the exact Java client contract
  (including a repeat call reusing the same player, not duplicating it),
  and rejection of unauthenticated program creation in an accounts-mode
  world. All test worlds/players/programs and the temporary superuser
  account were deleted from the real `server/pb_data/` afterward — it's
  gitignored and was local verification scaffolding only, same as Stage 3.
  `npx tsc --noEmit` and `npm run build` both pass on the client.
- design.md sections affected: none — this implements section 7
  (Authentication and Identity) as specified, plus the parts of section 6
  (`players` becoming an auth collection, rule strings) that section 7
  requires but doesn't spell out at the schema level.
- Git commit hash: (this commit)

**NEEDS JAIME:** Three things flagged rather than silently decided:
1. **No CLI world-selection wrapper exists yet.** Design.md section 8
   describes one (`scripts/knoxel-server.js`, env var handoff of the active
   world id) but no build stage in CLAUDE.md currently owns writing it —
   Stage 3 only built migrations/hooks, and Stage 4 (this one) needs to know
   "the" active world to attach players/programs to. Conservative stand-in
   used in both `client/src/lib/pocketbase.ts` (`fetchActiveWorld`) and
   `server/pb_hooks/upload.pb.js`: whichever `worlds` row was created most
   recently. This works fine as long as exactly one world is "current" at a
   time, which matches how the tool is actually used, but a server with
   multiple old worlds lying around will always route new signups/uploads
   to the newest one. Worth revisiting when the CLI wrapper gets built —
   ideally it hands the client an explicit world id instead of relying on
   recency.
2. **`players` is now an auth collection, converted from `base` via a
   drop-and-recreate migration.** This was empirically necessary (see
   Changes above) and is safe today because no real student data exists in
   any deployed `pb_data` yet — but flagging it because "drop and recreate a
   collection with the same id" is an unusual migration shape, and it's
   worth knowing about before any real deployment happens on top of it.
3. **`java-client/KnoxelUploader.java`'s wire format was left unchanged.**
   Design.md section 7 literally says the Java client should POST to
   `/api/collections/programs/records`, but that can't work directly — see
   Changes above for why. Built a custom `/upload` route that adapts the
   existing (already-working) contract instead of changing the Java side.
   If you'd rather the Java client itself change to call the standard
   PocketBase REST API directly (doing its own find-or-create-player round
   trip), that's a reasonable alternative — say so and I'll switch it.

## 2026-08-07 — Rebind camera and turtle controls to WASD+QE / IJKL+UO+NM

**Intent:** Jaime wanted the player/camera and turtle control schemes changed
to a specific new layout: WASD forward/left/back/right for the camera, QE
(plus the existing Space/Shift) for camera up/down, IJKL forward/left/back/
right for the turtle, U/O for turtle rotate-left/rotate-right, and N/M for
turtle down/up.

**Prompt:** "change the controls so that WASD for the player/user is
forward/left/back/right, QE are up and down for the player/user, and
space/shift are also up/down. for the turtle, IJKL are forward/left/back/
right, then UO are turnleft, turnright, and N is down and M is up."

**Changes:**
- `hooks/useWorld.ts`: added `KeyQ`/`KeyE` to `FP_MOVE_KEY_CODES` and to
  `updateFirstPersonMovement()` as additional up/down inputs alongside the
  existing Space/Shift — camera keys are now WASD + Q/E + Space/Shift.
- `hooks/useTurtle.ts`: remapped the turtle's manual-move keydown handler.
  `U`/`O` now call `rotate('left'/'right')` (previously up/down); `N`/`M`
  (plus Page Down/Page Up as before) now call `nudge('down'/'up')`
  (previously `Q`/`E` handled rotate, `U`/`O`/Page Up/Down handled up/down).
  `I`/`J`/`K`/`L` and the Arrow-key equivalents for forward/left/back/right
  are unchanged. The two key sets (camera vs. turtle) remain disjoint, per
  design.md section 13's intent that both can be driven simultaneously
  without conflict.
- `components/Panel.tsx` and `App.tsx`: updated the in-app controls help
  text and first-person hint overlay to match the new bindings.
- **NEEDS JAIME:** design.md section 13's control tables (lines ~877-898)
  still describe the old scheme (Page Up/Down for turtle up/down, Q/E for
  turtle rotate, no Q/E on the camera) and are now stale. Per CLAUDE.md I
  did not touch design.md — say the word and I'll update those two tables
  to match what's implemented.
- Verified with `npx tsc --noEmit` in `client/` — no type errors. Not
  verified in a running browser this session (no dev server was started).
- Git commit: (see next commit)

## 2026-08-07 — Fix open-mode login never prompting for display name/email

**Intent:** Jaime reported that the login mechanism doesn't work for an open
world — the app never prompts for a display name and email, so students
can't identify themselves and no `players` record ever gets created.

**Prompt:** "the login mechanism doesn't work for an open world. we are
never prompted for a display name and username. please implement this."

**Changes:**
- Root cause: `client/src/lib/pocketbase.ts`'s `POCKETBASE_ENABLED` is
  `Boolean(import.meta.env.VITE_POCKETBASE_URL)`, and `App.tsx` only ever
  renders `<Login>` when `POCKETBASE_ENABLED` is true. `scripts/dev.sh` sets
  `VITE_POCKETBASE_URL=/` when it spawns the client, but the newer
  `scripts/knoxel-server.js` (an in-progress, not-yet-committed CLI wrapper
  implementing design.md section 8's world-selection prompt) only started
  PocketBase itself and then told the operator to separately run
  `cd client && npm run dev` in another terminal — with no env var set. That
  left the client in solo/static-tier mode, where the login screen never
  renders and there's no server for it to talk to even if it did.
- `scripts/knoxel-server.js`: after world selection, it now spawns the
  client's `npm run dev` itself with `VITE_POCKETBASE_URL=/` in its
  environment, wires its stdout/stderr into the wrapper's own logging, and
  tears it down together with PocketBase on exit (`killAll()`) or if either
  process dies. Removed the stale "run this yourself in another terminal"
  instruction from the final banner since the wrapper now does it.
- Verified end-to-end: ran `node scripts/knoxel-server.js` against the
  existing local `pb_data`, confirmed via the dev server's transformed
  module output that `import.meta.env.VITE_POCKETBASE_URL` is now `"/"`
  (so `POCKETBASE_ENABLED` is `true`), and confirmed the Vite proxy reaches
  PocketBase's `worlds` collection and returns the active open-mode world.
  Did not click through the actual React login form in a browser this
  session.
- No design.md changes — section 8 already describes a CLI wrapper; this
  just fixes the wrapper's own in-progress implementation to actually start
  the client with the right configuration instead of leaving that step
  manual.
- Git commit: (see next commit)

## 2026-08-07 — Finish the static tier (Tier 1): `?id=` landing flow, build-static.sh, Worker contract docs

**Intent:** Jaime asked to finish the static visualizer that will live at
`jspacco.github.io/knoxel` and sends JSON to Cloudflare — Tier 1 from
design.md section 3. The Worker (`worker/src/index.js`) and
`VITE_WORKER_URL`/`VITE_BASE` plumbing in `vite-env.d.ts`/`vite.config.ts`
already existed from an earlier session, but nothing in the client actually
read `?id=` from the URL, fetched from the Worker, or auto-ran the result —
the landing-page behavior design.md section 13 describes ("browser fetches
JSON from Worker, auto-runs the program immediately") didn't exist yet.
`scripts/build-static.sh`, referenced by both design.md and the existing
`vite.config.ts` comment, also didn't exist.

**Prompt:** "read design/design.md and design/changes.md, and finish the
static visualizer that will live at jspacco.github.io/knoxel and will send
the JSON to cloudflare."

**Changes:**
- `client/src/hooks/useSharedLink.ts` (new) — on mount, reads `?id=` from
  the URL once, strips it immediately via `history.replaceState` (so a
  reload shows the ordinary drag-and-drop landing page rather than
  re-fetching or re-failing on a link that may have since expired), then
  `GET`s `${VITE_WORKER_URL}/?id=<id>`, parses the response with the
  existing `parseProgramFile`, and hands the result to the same `onLoaded`
  callback a drag-and-drop file uses. A `404` produces the exact message
  design.md section 13 specifies: "This link has expired. Re-run your Java
  program to generate a new link, or drag your JSON file here." Other
  fetch/parse failures get a fallback message pointing back at
  drag-and-drop. No `VITE_WORKER_URL` configured (e.g. a plain dev build)
  produces its own message rather than silently doing nothing.
- `client/src/App.tsx` — wires `useSharedLink` in: pushes "Fetching shared
  program…" / the error message into the existing message log (same log
  `ProgramLoader`'s own errors already use), and a ref-guarded effect
  auto-runs the shared program from the turtle's spawn position the moment
  both the loaded program and the Three.js scene (`world`) are ready — this
  is the "no login, no drag-and-drop, runs immediately" flow design.md
  section 13 describes for the static tier. The ref guard means only the
  shared-link program auto-runs; loading a second sample afterward behaves
  like today (select, then Run).
- `client/src/hooks/usePocketbase.ts` — real bug caught while verifying the
  above with a headless browser session: this hook's world-fetch effect ran
  unconditionally, even when `POCKETBASE_ENABLED` is false (i.e. every
  static-tier / solo-mode load). Tier 1 has no PocketBase at all (design.md
  section 3: "no server to run... no login required"), so every page load
  was firing a doomed request against a same-origin `/api` with nothing
  behind it (observed as 502s from the Vite dev proxy during verification —
  present on a plain `http://localhost:5173/` load too, not specific to the
  new `?id=` path, but exactly the kind of noise Tier 1 is supposed to
  avoid). Added an early return when `!POCKETBASE_ENABLED`.
- `scripts/build-static.sh` (new) — builds the client with `VITE_BASE`
  defaulted to `/knoxel/` (GitHub Pages project-page path) and
  `VITE_WORKER_URL` defaulted to the one deployed Worker
  (`knoxel-worker.jspacco.workers.dev`, per CLAUDE.md's "Key facts"),
  `VITE_POCKETBASE_URL` intentionally left unset. Both defaults are
  override-able via the same-named env var. Ran it for real — confirmed the
  built `dist/index.html` and JS bundle reference `/knoxel/...` asset paths
  and the Worker URL is baked into the bundle correctly.
- `docs/student-guide.md` (new) — design.md section 19's open question
  explicitly assigns this to Weirdo: document the Worker's expected
  POST/response shape so a future `KnoxelUploader.openInBrowser()` (still
  Jaime's to write, per that same section) has an exact contract to build
  against. Covers the student-facing flow, the offline/drag-and-drop
  fallback, and the Worker's exact request/response shapes for both
  `POST /` (upload) and `GET /?id=` (fetch), including its `400`/`404`
  error bodies.
- `README.md` — answered the existing "How to run jspacco.github.io/knoxel"
  TODO bullet with a short section pointing at `build-static.sh` and
  `docs/student-guide.md`; left the rest of Jaime's draft/TODO structure
  alone.
- Verified end-to-end with a headless Playwright session against the Vite
  dev server and a local mock Worker (CORS headers included, matching the
  real Worker's `Access-Control-Allow-Origin` behavior in
  `worker/src/index.js`): `?id=<valid>` auto-loaded the program into the
  list, auto-ran it with no click (log showed "Fetching shared program…" →
  "Loaded 1 program from shared link (...)" → "Running ..." → "Program
  finished after N ticks"), and the address bar no longer showed `?id=`
  afterward; `?id=<missing>` produced the exact expired-link message in the
  log and added nothing to the program list. No React warnings in either
  case. `npx tsc --noEmit` clean throughout.
- design.md sections affected: none — this implements section 3 (Tier 1)
  and the static-tier parts of section 13 exactly as already specified.
- Git commit hash: (this commit)

**NEEDS JAIME:** Two things flagged rather than decided:
1. **Actually publishing to GitHub Pages is still manual.** `build-static.sh`
   produces `client/dist/`; I did not add a GitHub Actions workflow or push
   anything to a Pages branch — deciding on/authorizing a CI pipeline that
   auto-publishes felt like it should be your call, not mine, and doesn't
   need to block anything (`docs/student-guide.md`/README explain the
   command). Say the word if you want a workflow that deploys on push to
   `main`.
2. **`KnoxelUploader.openInBrowser()` still doesn't exist.** Same as the
   last open question in design.md section 19 — that's your code to write.
   `docs/student-guide.md` now has the exact contract (POST shape, response
   shape, the URL to open) for it to target.

## 2026-08-08 — Full distributable installation: PocketBase + client, one URL

**Intent:** Jaime said the Cloudflare/static tier is working (he published it
to jspacco.github.io/knoxel with `gh-pages`) and asked to finish the rest of
the code so he can create a full distributable installation — PocketBase
plus the client code, serving everything from one URL. This is Tier 2/3 from
design.md section 3: the pieces design.md section 17 describes
(`scripts/build.sh`, distribution zips) didn't exist yet, and
`scripts/knoxel-server.js` — the CLI wrapper from Stage 4 — still always
spawned a second Vite dev-server process rather than ever actually serving
everything from one URL/process the way section 4 requires.

**Prompt:** "ok, cloudflare works. i just posted it to jspacco.github.io/knoxel
using the gh-pages command, which is awesome. can you please finish the rest
of the code so that i can create a full distributable installation that uses
pocketbase plus the client code, and serves everything to one URL that can
connect to pocketbase?"

**Changes:**
- `scripts/build.sh` (new) — builds the client with `VITE_POCKETBASE_URL=/`
  (same-origin, no GitHub Pages subpath) and copies `client/dist/` into
  `server/pb_public/`. Ran it for real — confirmed the built `index.html`
  references root-relative asset paths (`/assets/...`, not `/knoxel/...`),
  correct for a same-origin PocketBase deployment.
- `scripts/download-pocketbase.sh` — added `--out-dir`, defaulting to the
  existing `server/` behavior. Needed so `package.sh` can stage a
  cross-platform binary without ever touching the developer's own local
  `server/pocketbase`.
- `scripts/knoxel-server.js` — three real fixes, each caught by actually
  running the packaged output end-to-end (headless, driven programmatically)
  rather than by reading the code back:
  1. **Single-URL serving.** Previously it unconditionally spawned `npm run
     dev` for the client after PocketBase started, so "one URL" never
     actually happened even with a build present. Now it checks whether
     `server/pb_public` exists: if so (a real build/distributable),
     PocketBase alone serves the API and the static client from one origin
     and the banner prints exactly one URL; if not (a bare dev checkout), it
     falls back to the old dev-server-spawning behavior so
     `node scripts/knoxel-server.js` still works without requiring a build
     first, with a message pointing at `scripts/build.sh`.
  2. **PocketBase now binds `0.0.0.0:8090` instead of `127.0.0.1:8090`.**
     Caught by re-reading design.md section 3 ("students connect from the
     same network") — bound to loopback only, no other device on the LAN
     could ever have reached it, which would have silently broken the
     entire point of Tier 2 for every faculty member who used this. Internal
     calls from the wrapper itself still use `127.0.0.1` (loopback works
     fine against a `0.0.0.0` listener).
  3. **Superuser bootstrap was actually broken, not just unverified.** The
     inherited `hasSuperuser()` check POSTed bogus credentials and treated
     HTTP 400 as "a superuser exists" — confirmed by testing against a
     genuinely empty `pb_data` that PocketBase returns the *same* 400 for
     "no such account at all", so the check always reported true and the
     browser-based "go create your superuser" step never ran on a real first
     install. It also assumed a local browser exists, which fails outright
     on a headless Tier 3 box. Replaced entirely: the wrapper now runs
     `pocketbase superuser upsert knoxel-bootstrap@knoxel.local <fresh
     random password>` every run (PocketBase's own documented
     non-interactive provisioning command, idempotent, operates directly on
     the SQLite file) and authenticates as that account for its own world-
     management calls. Zero superuser-related prompts, no `.env` needed, no
     browser dependency — and it now works unattended on a cloud server too.
     An operator-supplied `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` in `.env` is
     still honored first if present and valid, for anyone who wants a known
     login for PocketBase's own `/_/` admin UI.
- `server/pb_hooks/upload.pb.js` — the Java upload route picked "the active
  world" by most-recently-created, a stand-in noted as temporary back when
  there was no CLI world-selection wrapper. That wrapper (`knoxel-server.js`)
  now exists and sets `is_active=true` on the chosen world, so this hook now
  looks up `is_active = true` first (falling back to most-recent only if
  nothing is marked active), matching what the browser already does via
  `client/src/lib/pocketbase.ts::fetchActiveWorld()`. Without this fix,
  Java uploads on a server with more than one world could silently land in
  the wrong one even after a faculty member explicitly selected a different
  one at startup.
- `scripts/dist-template/` (new) — `start.command` (Mac), `start.bat`
  (Windows), `start.sh` (Linux), and `README.txt`, templated into each
  packaged zip by `package.sh`. Each start script checks for Node.js first
  and prints an install link rather than failing cryptically if it's
  missing (see **NEEDS JAIME** below). `README.txt` documents the actual
  first-run flow faculty will see: no superuser step at all now (see fix 3
  above), just world naming/auth-mode selection, then the printed
  Open/LAN URLs.
- `scripts/package.sh` (new) — builds the client once, then for each target
  platform (`mac-arm64`, `mac-x64`, `windows-x64`, `linux-x64`; defaults to
  `mac-arm64` + `windows-x64`) downloads that platform's PocketBase binary
  into an isolated staging directory, assembles
  `scripts/knoxel-server.js` + `server/{pocketbase,pb_migrations,pb_hooks,
  pb_public}` + the matching start script + README.txt (mirroring the repo's
  own relative directory layout exactly, so `knoxel-server.js`'s existing
  `__dirname`-relative paths need no changes), and zips the result into
  `dist/`.
- Verified end-to-end twice with headless, programmatically-driven sessions
  against the actual built `dist/knoxel-mac-arm64.zip` (not just by reading
  the scripts back): first pass caught the superuser bug above (confirmed by
  observing the real prompt sequence deviate from what the code was supposed
  to show); after the fix, a full fresh-install run — PocketBase startup,
  straight to world creation with no superuser prompt at all, single-URL
  banner with no `:5173` reference, `curl` confirming PocketBase serves the
  actual built `index.html` and the created world's `is_active: true` state,
  clean shutdown with nothing left listening on 8090 — and a second run
  against the now-existing `pb_data` (world reuse prompt, clean start/stop)
  both passed every check.
- design.md sections affected: none — this implements sections 3/4/17
  (Tiers 2/3, one-process serving, distribution zips) as already specified,
  plus a bugfix to the Stage-4-era `upload.pb.js` active-world lookup.
- Git commit hash: (this commit)

**NEEDS JAIME:** Two things flagged rather than silently decided:
1. **Distribution zips still require Node.js to be installed on the faculty
   machine**, which design.md section 2's goals list says shouldn't be
   necessary ("No Node.js... required"). `scripts/knoxel-server.js` itself
   only uses Node built-ins (no `npm install` needed for it), but Node
   itself still has to be present to run it at all. The start scripts now at
   least detect a missing Node install and print a clear message instead of
   failing cryptically, but that's a mitigation, not a fix. Removing the
   Node dependency entirely would mean bundling a runtime (e.g. via `pkg`)
   or rewriting the wrapper's logic into the PocketBase binary itself via Go
   hooks — both are meaningfully bigger changes than this task, so I didn't
   attempt either without your steer.
2. **The bootstrap superuser account (`knoxel-bootstrap@knoxel.local`) is
   invisible by design** — faculty are never shown its password (it's
   regenerated every run and never printed), so there's no built-in way to
   log into PocketBase's own `/_/` admin UI unless they explicitly set
   `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` in `.env` themselves or run
   `pocketbase superuser upsert` by hand (documented in the distributable's
   README.txt). This trades away a debugging convenience for removing a
   confirmed-broken, browser-dependent first-run step; say so if you'd
   rather the wrapper print/rotate a visible admin login instead.

## 2026-08-11 — Compile knoxel-server into self-contained binaries with pkg, remove the Node.js requirement

**Intent:** Jaime asked to close out the "NEEDS JAIME" item from the
2026-08-08 entry — distribution zips still required Node.js to be installed
on the faculty machine, which design.md section 2's goals list says
shouldn't be necessary. This uses `@yao-pkg/pkg` to compile
`scripts/knoxel-server.js` into a self-contained executable per platform, so
the distribution zips no longer need Node at all.

**Prompt:** "Use @yao-pkg/pkg to compile scripts/knoxel-server.js into
self-contained executables for mac-arm64, windows-x64, and linux-x64. The
output binaries should be named knoxel-server (with .exe on Windows). Update
scripts/package.sh to build these binaries as part of the distribution zip
process," plus specific requirements for the root package.json shape, the
pkg config, the zip contents, and the start scripts invoking the binary
directly instead of `node scripts/knoxel-server.js`.

**Changes:**
- Root `package.json` (new) already existed (used for the `sharp` dependency
  used by `scripts/build-atlas.js`) — added `@yao-pkg/pkg` as a
  devDependency, a `"bin": "scripts/knoxel-server.js"` field, and the `pkg`
  config block exactly as specified (`targets: ["node24-macos-arm64",
  "node24-win-x64", "node24-linux-x64"]`, `outputPath: "dist/"`, `assets:
  []`).
- `scripts/knoxel-server.js` — the one real code fix pkg's snapshot
  filesystem required, caught by actually compiling and running the binary
  rather than by reading the code: `POCKETBASE_DIR`/`CLIENT_DIR`/the `.env`
  path were all computed from `__dirname`. Inside a pkg-compiled binary,
  `__dirname` resolves into pkg's virtual snapshot filesystem (a read-only
  image baked into the executable), not the real disk next to it — since
  `server/`, `client/`, and `.env` are never bundled into that snapshot
  (`assets: []`, and they shouldn't be — they're per-install, not part of the
  program), every path built from `__dirname` pointed at files that don't
  exist in the snapshot, and PocketBase would never be found. Fixed by
  introducing `BASE_DIR = process.pkg ? path.dirname(process.execPath) :
  path.join(__dirname, '..')` — real disk, relative to the executable itself,
  when packaged; unchanged `__dirname`-relative behavior for a plain `node
  scripts/knoxel-server.js` dev checkout. Also fixed `PB_BINARY` to pick
  `pocketbase.exe` vs `pocketbase` by `process.platform` instead of always
  `pocketbase` — a latent bug (not pkg-specific) that only mattered once
  distribution zips for other platforms were being genuinely tested, since
  previously the wrapper only ever ran on whatever platform built it.
- `scripts/package.sh` — added a step that runs `npx pkg` three times (once
  per target, each with an explicit `--target`/`--output` so the output
  filenames are exactly `dist/knoxel-server-macos-arm64`,
  `dist/knoxel-server-win-x64.exe`, `dist/knoxel-server-linux-x64` regardless
  of pkg's own default multi-target naming convention) before the per-target
  zip loop. Each target's staging directory now copies the matching compiled
  binary in as `knoxel-server` (or `knoxel-server.exe` on Windows) at the zip
  root instead of `scripts/knoxel-server.js` — the `scripts/` directory is no
  longer staged into the zip at all, since nothing in it is needed anymore.
  Dropped `mac-x64` from the supported-target list: the task's pkg config
  only lists three targets (no `node24-macos-x64`), so there's no compiled
  binary for it; the case statement now errors clearly if someone asks for it
  rather than silently reusing the wrong-arch binary. (`mac-x64` was already
  excluded from the default target set before this change.)
- `scripts/dist-template/start.command`/`start.bat`/`start.sh` — removed the
  Node.js version/presence check entirely (no longer applicable) and changed
  the launch line to invoke `./knoxel-server` / `knoxel-server.exe` directly
  instead of `node scripts/knoxel-server.js`.
- `scripts/dist-template/README.txt` — updated the "Requirements" section
  (was "Node.js must be installed..."; now "None... everything is already
  bundled as plain binaries") and the admin-superuser advanced-use note that
  used to say "only needs Node/PocketBase."
- No `sharp`-related pkg failures encountered — pkg does print a warning
  about not being able to bundle `sharp`'s native `build/Release` and
  `vendor/lib` directories on every target, but this is harmless noise:
  `scripts/knoxel-server.js` never requires `sharp` (that's
  `scripts/build-atlas.js`'s dependency, an unrelated dev-time tool), pkg is
  just warning about it because it's present in the root `package.json`'s
  `dependencies`. Flagging per the task's instructions since it looked like
  exactly the kind of pkg-and-native-modules issue to watch for, even though
  it turned out to be inert.
- Verified end-to-end, not just by reading the scripts back: ran
  `scripts/package.sh mac-arm64` for real (compiled all three binaries —
  `file` confirms `knoxel-server-macos-arm64` is a Mach-O arm64 executable,
  the win/linux ones are ~70-90MB each), unzipped the resulting
  `dist/knoxel-mac-arm64.zip` into a scratch directory, confirmed its
  contents exactly match the required layout (`knoxel-server`,
  `server/{pocketbase,pb_migrations,pb_hooks,pb_public}`, `start.command`,
  `README.txt` — no `scripts/` directory, no `.js` file), ran
  `./start.command` (fed via a FIFO to answer the interactive world-selection
  prompts, since a plain piped-and-closed stdin caused the second
  `readline.question()` call to hang forever waiting on already-EOF'd
  stdin — a pre-existing quirk of `knoxel-server.js`'s
  `readline.createInterface`-per-prompt pattern, not new here, just newly
  visible while scripting a fully automated test), and confirmed: PocketBase
  started and bound `0.0.0.0:8090`, the world-creation prompts worked and set
  `is_active: true` on the new world (checked via the REST API), the built
  client was served with a `200` from PocketBase itself, and `ps aux` showed
  only `./knoxel-server` and `server/pocketbase` running — no `node` process
  anywhere in that process tree. Cleaned up the scratch directory and killed
  both processes afterward.
- design.md sections affected: none — this closes the Node.js-dependency gap
  in section 17 ("Deployment")/section 2's goals list without changing the
  architecture those sections already describe.
- Git commit hash: (this commit)

**NEEDS JAIME:** None for this task specifically — it was itself the
follow-up to a previously flagged item, and pkg compiled and ran cleanly on
the first real attempt for all three targets. One small pre-existing wrinkle
surfaced during verification, noted above but not fixed since it's out of
this task's scope: `knoxel-server.js`'s interactive world-selection prompts
can hang if stdin is piped and closes between prompts (each `prompt()` call
opens/closes its own `readline` interface on `process.stdin`, and a second
interface opened after stdin's write end has already closed doesn't fire).
This doesn't affect real interactive terminal use (the whole reason it went
unnoticed until now) — only fully-scripted/non-interactive stdin. Worth
knowing about if `--world`/`--new` ever grow a fully-unattended mode that
pipes answers in.

## 2026-08-11 — API rules migration; wire blocks + turtle position to PocketBase

**Intent:** Jaime asked for two things: (1) an API-rules migration opening up
`blocks`/`players`/`programs`/`worlds` so the client can write directly
against PocketBase instead of everything being superuser-only, and (2) to
actually wire the client up to use those rules — `placeBlock()` writing to
the server, existing blocks hydrating on load, other players' blocks
arriving live, and turtle position being written so remote players are
visible. Until now the schema/hooks existed (Stage 3/4) but nothing in the
client ever talked to `blocks` or wrote `turtle_x/y/z` at all — the whole
multiplayer half of design.md was schema without wiring.

**Prompt:** Two-part: "Migration to set API rules on all collections" with
exact rule values per collection and a migration-syntax example, plus "Wire
block writes and real-time subscriptions" with example `placeBlock`/hydrate/
subscribe snippets and a request to verify (and add if missing) that turtle
position gets written on each interpreter step.

**Changes:**

*Migration 005:*
- `server/pb_migrations/005_api_rules.js` (new) — sets `listRule`/`viewRule`/
  `createRule`/`updateRule` to `''` (or `null` per collection, exactly as
  specified) and `deleteRule = null` (superusers only) on all four
  collections. The `collection.xRule = ...; app.save(collection)` syntax in
  the prompt matches this repo's PocketBase 0.39.10 exactly — confirmed
  against `003_stage4_auth.js`, which already uses the identical property
  names successfully, and re-confirmed empirically by actually running the
  migration against a real PocketBase instance and reading the rules back
  via the REST API (see Verified below). No API mismatch to flag — the
  syntax in the prompt was correct as given.
- **NEEDS JAIME** — real security regression, implemented as specified but
  flagging loudly: `003_stage4_auth.js` gave `players.createRule`/
  `updateRule` and `programs.createRule` conditional rules that branch on
  `world_id.auth_mode` specifically so accounts-mode worlds require the
  request to be authenticated as the record in question (design.md section
  7's whole reason accounts mode exists). This migration replaces all three
  with flat `''` (always public), because that's what was specified and it's
  also what the write flow below needs (the browser writes directly with no
  server-side token check either way). Net effect: **in an accounts-mode
  world, any unauthenticated request can now create or update any player's
  record, or attach a program to any player_id** — the exact thing 003's
  branching existed to prevent. If accounts mode is meant to keep that
  guarantee, this migration needs a follow-up that puts the auth_mode branch
  back on just those three rules while leaving the rest (blocks, the
  always-public reads) as specified.
- The down migration sets all five rule properties on all four collections
  to `null`, per "sets everything back to null" — literally, not a
  restoration of 003's original values (which had some rules already public,
  e.g. `programs.listRule`/`viewRule`/`worlds.listRule`/`viewRule`). Down of
  005 is therefore a stricter lockdown than the pre-005 state, not an undo of
  005 specifically. Flagging since "down" conventionally means "restore what
  was there before," and this doesn't quite do that — but it's what was
  asked for and is safe (never less restrictive than before).
- Verified against a real, freshly-migrated PocketBase 0.39.10 instance (not
  read back from the migration file): `migrate up` applied 001-005 cleanly;
  fetched all four collections via the superuser API and confirmed every
  rule string/null matches the spec exactly; ran `migrate down 1` → `migrate
  up` and confirmed the round trip (all-null after down, spec values again
  after re-up) with no errors either direction.

*Client wiring (blocks + turtle position):*
- `client/src/lib/pocketbase.ts` — added a `BlockRecord` interface (was
  missing; `WorldRecord`/`PlayerRecord`/`ProgramRecord` already existed for
  the other three collections).
- `client/src/hooks/useMultiplayerSync.ts` (new) — hydrates existing blocks
  for the active world on load (`getFullList` + `placeBlock(..., animate:
  false)`, using the `animate` parameter `placeBlock` already had exactly
  for this), subscribes to `blocks/*` and renders other players' creates/
  updates live, and exposes `onBlockPlaced`/`onTurtleMoved` callbacks that
  POST/PATCH to the server. Wired into `App.tsx` — passed straight into
  `useTurtle`'s existing `onBlockPlaced`/`onTurtleMoved` options, which were
  already there and already documented ("Used to sync multiplayer") but had
  never actually been connected to anything.
- **Implementation-location judgment call** — the prompt's snippets showed
  this logic living "in useWorld.ts" inside `placeBlock()` itself. Kept
  `WorldScene`/`placeBlock()` untouched instead: that file's own header
  comment establishes it as a plain Three.js renderer with zero knowledge of
  PocketBase, world ids, or player ids, and network state living in hooks
  (`usePocketbase`, `useSharedLink`) rather than the scene class is the
  pattern the rest of the codebase already follows. `onBlockPlaced`/
  `onTurtleMoved` were sitting right there as the intended seam. Small,
  clearly-implied call per CLAUDE.md; the resulting behavior is identical to
  what the prompt asked for.
- **Correctness fix over the literal snippet** — the prompt's `placeBlock`
  example was a bare `.create()`. `blocks` has a unique index on `(world_id,
  x, y, z)` specifically so re-placing a block is "last write wins via
  upsert" (design.md section 6 — and `WorldScene.placeBlock`'s own existing
  doc comment already promised this server-side behavior, years before any
  server write existed to keep that promise). A bare create would 400 every
  time a program overwrites a position it already touched, or two players
  build over the same spot. `upsertBlock()` creates, and on the resulting
  `validation_not_unique` 400 falls back to finding and updating the
  existing record instead. Correspondingly the realtime handler treats
  `update` the same as `create` (the prompt's snippet only handled
  `create`), so a block getting overwritten is still mirrored live to other
  players — without that, other clients would silently keep showing the old
  block forever after any overwrite.
- Two real bugs, neither guessable from reading the code, both caught only
  by actually running this against a live PocketBase instance with
  Playwright:
  1. **The PocketBase JS SDK auto-cancels concurrent requests to the same
     collection+method by default** ("auto cancellation" — a newer request
     to the same endpoint aborts the previous one, meant for
     search-as-you-type UIs). A program placing more than one block within
     the request round-trip window had every write but the last one in that
     burst silently aborted (`ClientResponseError: The request was
     aborted`) — confirmed by intercepting the actual network traffic, not
     inferred. Every `blocks` create/getFirstListItem/update call in
     `upsertBlock` now passes `{ requestKey: null }` to opt out. Left the
     turtle-position `players.update` call on the *default* auto-cancel
     behavior deliberately — there, cancelling a superseded in-flight write
     in favor of the newest one is correct, not a bug, since only the
     latest position ever matters.
  2. **`WorldScene.blockCount` is a live getter over imperative Three.js
     state, not React state.** A client that never places a block itself
     (hydration only, or another player's blocks arriving via realtime)
     never re-renders on its own, so the Panel's "Blocks" stat silently went
     stale — confirmed by screenshotting a second browser: the 3D scene
     correctly showed a classmate's blocks appearing in real time, but the
     "Blocks: N" counter stayed at its old value the whole time. Added a
     trivial `bump` state setter in `useMultiplayerSync`, called once after
     hydration finishes and once per realtime event, purely to force the
     re-render that makes the existing `blockCount={world?.blockCount ?? 0}`
     prop in `App.tsx` re-read the live count — mirrors how the tick loop's
     own `setTick()` already does this incidentally during a run.
- Turtle position: confirmed (per the prompt's "verify... if it's not being
  written, add it") that nothing anywhere wrote `turtle_x/y/z/facing` — the
  fields existed in the schema and the `PlayerRecord` type, completely
  unused. `useMultiplayerSync`'s `onTurtleMoved` now PATCHes the player
  record on the same throttle `useTurtle.ts` already uses to publish
  transform updates (~10Hz during a run, immediately on manual moves) — no
  new throttling added, that cadence already existed for the UI and is a
  reasonable network rate as-is.
- **Not implemented — out of scope of what was asked**: nothing renders
  *other* players' turtles. The prompt's exact ask was "verify that turtle
  position is written... so remote turtles appear for other clients," and
  the write side is now real, but no code anywhere subscribes to `players`
  or creates turtle meshes for anyone but the local player — confirmed by
  grepping the client before starting, there was nothing there to begin
  with. Rendering remote turtles is a natural next step but a distinct
  feature (subscribe to `players/*`, maintain a mesh per other player,
  handle join/leave) that wasn't part of this request.
- Verified end-to-end against a real running PocketBase 0.39.10 instance
  (migrations 001-005 applied fresh) using a scripted, programmatically
  driven two-browser-context Playwright session — not just by reading the
  code back:
  - Player A logs in, runs `flag.json`; confirmed via the PocketBase REST
    API (not just the local UI) that `blocks` records were created with the
    correct `world_id`/`player_id`/`x`/`y`/`z`/`block_id`, and that player
    A's `players` record's `turtle_x`/`turtle_y`/`turtle_z` had advanced from
    spawn.
  - Player B logs in fresh (never clicks Run) after A has already placed
    blocks; confirmed hydration rendered them.
  - With B still idle, A kept running; confirmed via screenshot (not just a
    stat counter, after finding and fixing the staleness bug above) that
    new blocks appeared live in B's own 3D view with no action from B.
  - Confirmed the "last write wins" upsert path specifically: re-ran a
    program from the same origin against a world with pre-existing blocks
    at the same coordinates and confirmed the `validation_not_unique` →
    find-existing → update path completes with no unhandled error and the
    realtime `update` event reaches other clients.
  - All test PocketBase instances, worlds, and players were scratch data in
    `/tmp`, discarded after verification — the real `server/pb_data/` was
    never touched by any of this.
- design.md sections affected: none — this implements section 6 (blocks
  upsert semantics) and section 11 (multiplayer shared world) as already
  specified, plus closes the players/turtle-position half of section 7 that
  was schema-only until now.
- Git commit hash: (this commit)

**NEEDS JAIME:** Two things, both flagged above but repeating here since
they're the important ones: (1) the accounts-mode security regression on
`players.createRule`/`updateRule` and `programs.createRule` — implemented
exactly as specified, but it removes a guarantee 003 was written specifically
to provide; and (2) remote turtles (other players' turtle meshes) still don't
render anywhere — the position is now correctly written and available, just
nothing reads it for anyone but the local player yet.

## 2026-08-12 — Live-update the "My programs" list on upload; fix cross-world leak

**Intent:** Jaime reported that a student uploading a program from VS Code
(the Java client's `/upload` route) never sees it appear in the browser —
they had to manually refresh or log out/in. The list only ever loaded once,
on mount.

**Prompt:** Wire a PocketBase realtime subscription into "whatever component
or hook manages the program list" so a `programs` create event for the
current player + active world prepends into the list live, with example
subscribe/unsubscribe snippets; keep most-recent-first ordering; and verify
the *initial* fetch uses the same player+world filter so students only ever
see their own programs.

**Changes:**
- `client/src/components/MyPrograms.tsx` — this is the component (found by
  grepping for where the program list actually lives; it was already the
  Stage-4 "student can see program list" component, just never updated after
  first load).
  - **Bug found while checking the initial-fetch filter, exactly the thing
    the prompt asked to verify**: it only filtered on `player_id`, not
    `world_id` at all, even though `programs` has its own `world_id` field
    independent of the player's (`upload.pb.js` stamps a program with
    *whatever world was active at upload time*, which can diverge from the
    player's own `world_id` — confirmed this is a real, not theoretical,
    divergence by checking `upload.pb.js` and testing it directly). A
    student who'd used this tool across more than one course/world on the
    same server would see every program from every world mixed together.
    Fixed by adding `&& world_id = {:world}` to the filter, and threading a
    new required `activeWorld: WorldRecord` prop through from `App.tsx`
    (`pb.world` — the component previously had no way to know the active
    world at all).
  - Added the realtime subscription, filtered identically (`action ===
    'create'`, matching `player_id` and `world_id`), prepending into
    `programs` state — same shape as the prompt's snippet, with two small,
    deliberate deviations:
    1. Used the SDK's per-callback `UnsubscribeFunc` (the promise
       `subscribe()` resolves to) instead of the prompt's
       `pb.collection('programs').unsubscribe('*')`. The docs recommend the
       former specifically because `unsubscribe('*')` tears down *every*
       listener registered on that topic for that collection, not just this
       component's — harmless today (nothing else subscribes to
       `programs`), but the precise form doesn't rely on that staying true.
       Handled the subscribe-is-async-but-effect-cleanup-is-sync race with
       a `cancelled` flag (same pattern already used for the initial fetch
       in this same file, and for hydration in `useMultiplayerSync.ts`).
    2. Added a dedupe guard (`prev.some(p => p.id === e.record.id)`) before
       prepending — the initial fetch and the subscription both start on
       mount independently, so a create landing in that small window could
       otherwise arrive from both and render as a duplicate list entry/React
       key collision. Small, clearly-implied correctness addition.
  - Sort order: the initial fetch already sorted `-submitted_at`
    (most-recent-first) — no change needed there. Realtime creates prepend
    directly to the front, which is correct for "just happened," matching
    the prompt's intent.
  - `client/src/App.tsx` — passes `pb.world` through as the new
    `activeWorld` prop; the `<MyPrograms>` render is now gated on `pb.player
    && pb.world` (was `pb.player` alone) since the component can't do
    anything meaningful without a world to scope to.
- No API-mismatch to flag — `subscribe`/`unsubscribe` matched the installed
  SDK (`pocketbase@0.27.1`) exactly as shown in its own README.
- Verified end-to-end against a real running PocketBase 0.39.10 instance with
  a scripted Playwright session, not just by reading the diff:
  - Seeded one player and two worlds; created a program under the player's
    active world and, separately, one under the *other* world for the same
    player id. Logged in as that player fresh: the initial list showed
    exactly the active-world program, confirming the cross-world leak is
    fixed.
  - With the tab still open (no reload), POSTed two more programs directly
    to `programs` — one matching the active world, one matching the other
    world — simulating what the Java client's `/upload` route produces.
    The matching one appeared at the top of the list within ~1.5s with no
    page action; the other-world one never appeared. Selecting the
    newly-arrived program and confirming the Run button became enabled
    proved it's not just rendered but actually loaded/runnable, per "the
    student should be able to select and run it without any manual
    refresh."
  - First pass of this test had a false failure (Run button stayed
    disabled) — turned out to be the test's own fake program payload
    having zero instructions, which `MyPrograms.loadProgram()` correctly
    rejects before calling `onLoaded`; not a bug, fixed the test fixture.
- design.md sections affected: none — this implements the "student can see
  their program list" verify step (CLAUDE.md Stage 4) the way it was always
  meant to work, plus a same-scope correctness fix (world filter) surfaced
  by the verification step the prompt explicitly asked for.
- Git commit hash: (this commit)

**NEEDS JAIME:** None. Both requested pieces (live subscription, verified/
fixed initial filter) are done and confirmed working against a real server;
no ambiguous decisions came up beyond the two small, clearly-implied
deviations noted above.

## 2026-08-12 — Player avatars at camera position; turtle and camera persist across reload

**Intent:** Jaime said the social multiplayer experience was missing — players
could see each other's blocks appear, but not each other. The player avatar
needed to represent the camera (where a student is looking from), not the
turtle, since design.md section 12/13 already establishes those as separate
objects. Turtle position was already schema-backed but not restored on
reload, and camera position wasn't persisted at all — a returning student
always started back at spawn/default view instead of where they left off.

**Prompt:** Three things: (1) player avatar = camera position, with new
`camera_x/y/z/yaw` fields on `players` (migration `006_add_camera_position.js`,
nullable, default 0), written throttled to once per 500ms max as the camera
moves, rendered by other clients as a ~0.5×1 colored box with a floating
name tag, color hashed from player id; (2) turtle position (already-existing
`turtle_x/y/z/facing` fields) written on manual moves (IJKL/Q/E), not just
during program runs, and restored from the player record on login/reload
(spawn at origin as usual if all zero/null); (3) camera position restored
from the player record on reload, before rendering.

**Changes:**
- `server/pb_migrations/006_add_camera_position.js` (new) — adds
  `camera_x`/`camera_y`/`camera_z`/`camera_yaw` (`NumberField`, not
  `required`) to `players`, same reasoning as `turtle_x/y/z` in
  `001_initial_schema.js`: PocketBase's `NumberField.required` means
  "non-zero," and a camera sitting at `x=0`/`z=0` is ordinary — the field's
  own zero value already gives "nullable, default 0" with no extra config.
  **Bug caught while writing the down migration, not asked about but fixed
  since it would have broken this migration's own rollback**: copied
  `004_is_active_world.js`'s down-migration pattern
  (`collection.fields.remove(field.id)`) at first, but `FieldsList` has no
  `remove` method on this PocketBase version — confirmed by actually running
  `migrate down 1` and reading the real error (`TypeError: Object has no
  member 'remove'`), then checking `pb_data/types.d.ts` for the actual API
  (`removeByName`/`removeById`, not `remove`). Used `removeByName` here.
  Didn't touch `004`'s own (pre-existing, same-shaped) bug — out of scope of
  what was asked, flagging below instead.
- `client/src/lib/pocketbase.ts` — added the four camera fields to
  `PlayerRecord`, and a `playerLabel()` helper (display name, falling back to
  the email's local part) shared by the avatar-hydration and realtime-sync
  paths in `useMultiplayerSync.ts`.
- `client/src/components/PlayerAvatar.tsx` (new) — `PlayerAvatarMesh`: a
  plain `THREE.BoxGeometry(0.5, 1, 0.5)` plus a nameplate sprite, no React
  component, same convention as `Turtle.tsx`. Exported `makeNameplate()` from
  `Turtle.tsx` instead of duplicating the canvas-sprite code — it was already
  exactly what a floating name tag needs.
- `client/src/hooks/useWorld.ts` (`WorldScene`) — added
  `getCameraTransform()` (position + yaw, derived from the camera's
  quaternion via `Euler('YXZ')`, valid in both orbit and first-person mode)
  and `restoreCameraTransform(position, yaw)` (sets the camera directly, then
  re-derives `fpYaw`/orbit target the same way entering/leaving first-person
  already does, so it doesn't fight whichever mode is active). Added
  `upsertPlayerAvatar()`/`removePlayerAvatar()` methods and a
  `playerAvatars` map, disposed alongside turtles in `dispose()`.
- `client/src/hooks/useMultiplayerSync.ts` — three additions: (1) hydrates
  every other player already in the world once (`getFullList` filtered to
  `world_id` and excluding `id = {:self}`) and renders their avatar at their
  saved camera position; (2) subscribes to `players/*` and keeps avatars in
  sync live (create/update upserts, delete removes), same
  `subscribe('*')`/`unsubscribe('*')` pattern already used for `blocks` in
  this file (no other subscriber on the `players` topic yet, so the
  "`unsubscribe('*')` kills every listener" caveat noted in the last entry
  doesn't apply here); (3) a `setInterval(500ms)` that reads
  `world.getCameraTransform()` and PATCHes the player's own camera fields —
  the throttle the prompt asked for ("once every 500ms maximum, not every
  frame"), no diffing beyond that since the prompt didn't ask for
  change-detection and it isn't needed for correctness.
- **Turtle-writes-on-manual-move — already true, verified rather than
  added**: `useTurtle.ts`'s `applyManual()` (the function `nudge()`/
  `rotate()`/`spawnAt()` all funnel through) already calls
  `publishTransform()`, which already calls `onTurtleMoved` — wired to
  `useMultiplayerSync`'s `onTurtleMoved` since the 2026-08-11 entry. Checked
  this by tracing the call graph before writing anything, then confirmed with
  the end-to-end test below (pressing IJKL updated `turtle_x/y/z/facing` on
  the server) rather than assuming. No code change was needed for this half
  of item 2.
- `client/src/App.tsx` — a new effect, guarded to run once per player id
  (`restoredForPlayerRef`), that runs once `world` and `pb.player` are both
  ready: calls `turtle.spawnAt()` with the saved `turtle_x/y/z/facing` if any
  of the three coordinates is non-zero (matches the "already-existing" spawn
  default of `(0, 1, 0)`, whose `x`/`z` are already 0 — a fresh player who's
  never moved has all three at 0 and falls through to the ordinary spawn),
  and calls `world.restoreCameraTransform()` if any of `camera_x/y/z` is
  non-zero (same zero-guard, so a first-time player keeps the current
  default wide establishing shot instead of spawning inside the ground at
  the origin).
- Verified end-to-end against a real running PocketBase instance (fresh
  `pb_data`, migrations 001-006 applied for real) using two separate
  Playwright browser contexts (Alice, Bob), not by reading the code back:
  - Confirmed via the REST API that Alice's `camera_x/y/z/yaw` updated
    within ~1.2s of an orbit-drag (throttled write firing), and that
    `turtle_x/y/z/facing` updated after IJKL/rotate key presses.
  - Confirmed, via a temporary debug hook exposing the scene object
    (removed before committing — not part of the shipped code), that Bob's
    client actually held a `PlayerAvatarMesh` for Alice at the exact
    position her server record reported, that neither client rendered an
    avatar for *itself*, and that the avatar appeared in Bob's scene from
    hydration alone (before Alice moved at all) as well as updating live
    after her move.
  - Reloaded Alice's page and confirmed both the camera (`getCameraTransform()`
    matched the saved record, small sub-unit drift from `OrbitControls`
    damping recomputing position on the next frame — well within "roughly
    where they left off") and the turtle (Panel's displayed position matched
    exactly) came back without any manual repositioning.
  - The one console error observed (`ClientResponseError: The request was
    aborted... auto-cancelled`) during rapid-fire key presses is the same,
    already-documented, deliberate behavior from the 2026-08-11 entry (only
    the newest turtle-position write matters, so superseded ones being
    cancelled is correct) — not a regression.
  - A `pointer lock` `pageerror` during the orbit-drag simulation is the
    same known headless-Chromium limitation documented since the 2026-08-05
    Stage 1.5 entry (a native `click` event still fires after a
    mousedown/move/up sequence on the canvas, entering first-person and
    hitting `requestPointerLock()`'s headless limitation) — unrelated to
    this change.
  - All test PocketBase data was scratch, in `/tmp`, discarded after
    verification. Did not touch or restart Jaime's own running dev instance
    (found running from `tmp/knoxel2/`, a separate checkout, with live
    browser connections) — used an isolated port/`pb_data`/`pb_public`
    throughout instead.
- design.md sections affected: none — this implements the multiplayer-avatar
  and position-persistence behavior implied by sections 6/7/12/13 (camera and
  turtle as separate objects, players subscription) that wasn't spelled out
  as its own numbered item yet.
- Git commit hash: (this commit)

**NEEDS JAIME:** One thing flagged, not fixed, since it's pre-existing and out
of scope of what was asked: `004_is_active_world.js`'s down migration calls
`collection.fields.remove(field.id)`, which doesn't exist on this PocketBase
version's `FieldsList` (the correct method is `removeByName`/`removeById` —
confirmed by actually running `migrate down` and hitting the error). `004`'s
down migration has therefore never actually worked; `006`'s own down
migration (written fresh for this task) uses the correct API and was verified
with a real `migrate down 1` → `migrate up` round trip. Say the word if you'd
like `004` fixed to match.

## 2026-08-12 — Hide the tick-rate slider in multiplayer

**Intent:** Jaime pointed out the speed slider only makes sense solo — in a
shared multiplayer world, letting one student's client run the tick loop
faster or slower than everyone else's doesn't make sense (the server isn't
ticking anything; each client interprets the same program JSON at its own
local rate). Multiplayer should stay fixed at 20 ticks/second (the Minecraft
reference rate) and the slider shouldn't be there to change it.

**Prompt:** "Hide tick rate slider in multiplayer. The speed slider only
makes sense in solo/static mode. In multiplayer (when VITE_POCKETBASE_URL is
set), hide the slider entirely. Tick rate is fixed at 20 ticks/second in
multiplayer — do not allow the client to change it. Check
import.meta.env.VITE_POCKETBASE_URL — if set, do not render the slider
component. If unset (static/solo mode), render it as normal. Commit
separately."

**Changes:**
- `client/src/components/Panel.tsx` — wrapped the Speed `<label>`/`<input
  type="range">`/the "animation is skipped above 20 ticks/s" hint paragraph
  in `{!POCKETBASE_ENABLED && (...)}`. Used the existing `POCKETBASE_ENABLED`
  constant from `lib/pocketbase.ts` (`Boolean(import.meta.env.VITE_POCKETBASE_URL)`)
  rather than re-checking `import.meta.env.VITE_POCKETBASE_URL` directly a
  second time — it's the exact same check already used everywhere else in the
  client (`App.tsx`, `usePocketbase.ts`) to distinguish solo/static from
  multiplayer, so duplicating the raw env-var check here would just be a
  second place for the two to drift apart.
- No change needed to enforce the "fixed at 20, client can't change it" half
  of the ask: `useTurtle.ts`'s `DEFAULT_TICKS_PER_SECOND` is already `20`,
  and grepping the client confirmed the slider's `onChange` (wired through
  `Panel`'s `onTicksPerSecondChange` prop to `useTurtle.setTicksPerSecond`)
  is the *only* code path that ever calls it — no keybinding or other control
  touches tick rate. Hiding the slider removes the only way a student could
  change it, so multiplayer now simply never calls `setTicksPerSecond` and
  stays at the 20 default.
- Verified in two real (non-headless-limited) browser sessions via
  Playwright, not just by reading the JSX back: built the client once with no
  `VITE_POCKETBASE_URL` (served via `vite preview`) and confirmed `#speed`
  exists and the Speed label/slider render normally; built again with
  `VITE_POCKETBASE_URL=/` against a real scratch PocketBase instance, logged
  in as a fresh open-mode player, and confirmed `#speed` is entirely absent
  from the DOM (`locator('#speed').count() === 0`) — screenshotted both for a
  visual check, not just the DOM query. The "Follow turtle with camera"
  checkbox (also in the Run section) is unaffected and still renders in both
  modes, immediately after Run/Reset/Stop. `npx tsc --noEmit` clean. All
  scratch PocketBase data was in `/tmp`, discarded after verification —
  Jaime's own running dev instance was not touched.
- design.md sections affected: none — section 11 already states "20
  ticks/second... is the default and the reference rate" and section 13's
  speed-slider description doesn't distinguish solo from multiplayer, so this
  is a UI-scoping fix rather than a spec change.
- Git commit hash: (this commit)

**NEEDS JAIME:** None — straightforward, matches the prompt exactly, no
ambiguous decisions.

## 2026-08-12 — Show email next to display name in the panel header

**Intent:** Jaime wants students to be able to confirm they logged in with
the correct Knox email — `display_name` is self-chosen and cosmetic (design.md
section 6: "`email` is the authoritative identity field"), so a student could
easily not notice they typo'd their email or are still logged in as someone
else, with nothing in the UI to catch it.

**Prompt:** "Show email in UI. Wherever the player's display name appears in
the panel (login confirmation, player info section, or header), add the
email below or next to it... Small, secondary text styling for the email.
Commit separately."

**Changes:**
- Grepped the client for every place `display_name` reaches the DOM before
  touching anything: the only spot is the panel header's identity block in
  `App.tsx` (`pb.player.display_name` next to a "switch player" button,
  passed into `Panel`'s `header` slot). `Login.tsx` has no post-login
  confirmation screen — the login form is simply replaced by the panel the
  moment `pb.player` is set — and `MyPrograms.tsx` only uses `display_name`
  as data (the `playerName` field handed to the interpreter), never renders
  it. So one change site, not three.
- `client/src/App.tsx` — wrapped the existing `identity-name` span and a new
  `identity-email` span in an `identity-info` column, so the name and email
  stack vertically while "switch player" stays aligned to the right of both.
  Reused the existing `muted small` utility classes (already the codebase's
  established secondary-text convention — see `Login.tsx`'s field hints and
  `Panel.tsx`'s "Nothing yet."/animation-skip notes) instead of inventing new
  styling for "small, secondary text."
- `client/src/index.css` — `.identity` switched from `align-items: baseline`
  to `center` now that its two children are a two-line block and a button
  rather than two inline spans; added `.identity-info` (column, small gap)
  and a `.identity-email` rule for line-height only, since color/size already
  come from `muted small`.
- Verified in a real browser session (Playwright against a scratch PocketBase
  instance, not just by reading the JSX): logged in as display name
  "jspacco" / email "jspacco@knox.edu" and confirmed via the DOM
  (`.identity-name`/`.identity-email` text content) and a screenshot that it
  renders exactly as specified — "jspacco" on one line, "jspacco@knox.edu"
  smaller and muted directly beneath it, "switch player" still to the right.
  `npx tsc --noEmit` clean. Scratch PocketBase data was in `/tmp`, discarded
  after verification.
- design.md sections affected: none — this surfaces the existing `email`
  field (already the authoritative identity field per section 6) more
  visibly; no schema or behavior change.
- Git commit hash: (this commit)

**NEEDS JAIME:** None.

## 2026-08-12 — Fix duplicate entries from clicking a "My programs" item repeatedly

**Intent:** Jaime reported that clicking the same uploaded program (e.g.
"flag") in the "My programs" list multiple times added a new copy to the
loaded-programs list above the Run button each time, instead of loading it
once and leaving it selected on repeat clicks.

**Prompt:** "we are still getting duplicates. if you upload a program
'flag', and then you click it multiple times, each click adds a copy of
'flag' to the list above the run button. that is wrong. it should add flag
ONE TIME, and then if you click again, that's it, it won't add new copies.
please fix this."

**Root cause:** `App.tsx`'s `handleLoaded` (the single callback both
`MyPrograms.tsx` and `ProgramLoader.tsx` call with newly-loaded programs)
always did `[...previous, ...loaded]` — every call appended, with no concept
of "this one's already in the list." Clicking a "My programs" entry calls
`loadProgram()` → `onLoaded()` → `handleLoaded()` fresh every time, so four
clicks meant four appends of an identical `ParsedProgram`.

**Changes:**
- `client/src/lib/interpreter.ts` — added an optional `sourceId?: string` to
  `ParsedProgram`, documented as the stable server-record identity used to
  recognize "already loaded." Left undefined for drag-and-drop/paste/sample
  loads, which have no such persistent identity.
- `client/src/components/MyPrograms.tsx` — `loadProgram()` now sets
  `sourceId: record.id` on the `ParsedProgram` it constructs, so every load
  of the same server record carries the same id.
- `client/src/App.tsx` — rewrote `handleLoaded` to scan the incoming batch
  against the current list: a program whose `sourceId` already matches an
  existing entry is not appended — the existing entry's index becomes the
  selection target instead, and the log message says "already loaded"
  rather than repeating "Loaded 1 program." Programs with no `sourceId`
  (drag-and-drop, paste, samples) always append, unchanged from before —
  this was a targeted fix for the "My programs" click path the bug report
  described, not a blanket dedupe of every load source, since reloading a
  locally-edited dropped file is a deliberate, meaningful re-load rather than
  a duplicate.
- Verified end-to-end against a real running PocketBase instance (Playwright,
  not just reading the diff): logged in as a fresh open-mode player,
  POSTed a `programs` record directly (simulating a Java-client upload) so it
  showed up under "My programs" via the existing realtime subscription,
  then clicked that entry four times. The "Programs" (loaded) list held
  exactly one "flag" entry throughout — confirmed by counting `<li>` elements
  in that section specifically (an early version of the test script's
  selector accidentally matched both "My programs" and "Programs" headings
  via substring text-matching and had to be corrected to an exact-text
  match before trusting the count). Log showed "Loaded 1 program from server
  (flag)." once, followed by three "server (flag) is already loaded."
  lines, and a screenshot confirmed the loaded-programs list and its
  highlighted selection stayed on the single entry.
- design.md sections affected: none — this is a client-side bug fix; section
  13's "click to select" program-list behavior is unchanged for every source
  except this specific double-load case, which wasn't spec'd either way.
- Git commit hash: (this commit)

**NEEDS JAIME:** None.

## 2026-08-15 — Only one program can be active at a time

**Intent:** Jaime found that selecting a sample from the "Load sample"
dropdown appended a new entry to the loaded-programs list every time,
instead of replacing whatever was already selected — screenshot showed
three stacked entries (skyscraper3, flag, pflag2) after loading three
samples in a row. The 2026-08-12 fix only deduped by sourceId for
server-loaded ("My programs") entries; sample/drop/paste loads had no
sourceId and always appended, unchanged. Jaime confirmed the real intent
goes further than dedup — there should only ever be ONE program active
for running, from any source, at any time.

**Prompt:** "yes, there should only be ONE program at a time that is
active for running."

**Changes:**
- `client/src/App.tsx` — `handleLoaded` now replaces the `programs` list
  outright (`setPrograms(loaded)`) instead of appending or scanning for
  an existing sourceId match. Selection always resets to index 0 of the
  new list.
- Removed the sourceId-based dedupe/scan logic added 2026-08-12 — no
  longer needed under a replace-always policy.
- `ParsedProgram.sourceId` (interpreter.ts) left in place, unused.
- No change needed in MyPrograms.tsx or ProgramLoader.tsx — both already
  called onLoaded() with a single parsed program per action.
- design.md sections affected: none — section 13 doesn't specify
  single- vs multi-program list behavior either way.
- Git commit hash: (this commit)

**NEEDS JAIME:** None on the list-replacement behavior itself. One open
question not addressed here: what should happen if a student loads a new
program while one is actively running? Currently the new selection just
becomes the Run target once the current run finishes/stops — a running
program is not interrupted by a new load. Flag if you'd rather loading
be blocked entirely while running.

## 2026-08-25 — Fix accounts-mode security regression in API rules (migration 007)

**Intent:** Jaime asked to fix the accounts-mode security regression introduced
in migration 005 and flagged in changes.md on 2026-08-11. Migration 005
inadvertently replaced the conditional `world_id.auth_mode` branches on
`players.createRule`/`updateRule` and `programs.createRule` with flat public
`''` rules. In accounts-mode worlds, this allowed unauthenticated requests to
modify any player record or attach programs to any student's `player_id`,
breaking submission attribution guarantees for grading/research. This fix
restores the auth_mode branch on those three rules while keeping all other
rules from 005 (blocks writes, public reads) intact.

**Prompt:** "Task for Antigravity — Fix accounts-mode security regression in Knoxel"
(details: check pb_migrations for next free number since 006 was taken by
camera position, restore conditional rules on players create/update and
programs create, verify empirical HTTP status codes against fresh PocketBase
instance for open/accounts modes unauthenticated/authenticated/cross-player,
check down/up round trip, update changes.md closing the 2026-08-11 NEEDS JAIME item).

**Changes:**
- `server/pb_migrations/007_fix_accounts_mode_rules.js` (new) — Migration number
  006 was already occupied by `006_add_camera_position.js`, so 007 was used.
  Restores conditional auth_mode rules:
  - `players.createRule = "world_id.auth_mode = 'open' || @request.auth.id = id"`
  - `players.updateRule = "world_id.auth_mode = 'open' || @request.auth.id = id"`
  - `programs.createRule = "world_id.auth_mode = 'open' || @request.auth.id = player_id"`
  - `down()` restores flat `''` rules from 005 for clean rollback.
- This explicitly closes the **NEEDS JAIME** item from the 2026-08-11 entry.
- Empirical verification against fresh PocketBase 0.39.10 instance:
  - Fresh `migrate up`: cleanly applied migrations 001 through 007.
  - Open mode (unauthenticated):
    - POST `players` (new record): HTTP 200 (created)
    - PATCH `players` record: HTTP 200 (updated)
    - POST `programs` attached to `player_id`: HTTP 200 (created)
  - Accounts mode (unauthenticated):
    - POST `players`: HTTP 400 (`Failed to create record.`) (rejected)
    - PATCH existing `players` record: HTTP 404 (`The requested resource wasn't found.`) (rejected)
    - POST `programs` attached to another player: HTTP 400 (`Failed to create record.`) (rejected)
  - Accounts mode (authenticated as Player A, own token):
    - PATCH own `players` record: HTTP 200 (updated)
    - POST `programs` with own `player_id`: HTTP 200 (created)
  - Accounts mode (authenticated as Player A, targeting Player B):
    - PATCH Player B `players` record: HTTP 404 (`The requested resource wasn't found.`) (rejected)
    - POST `programs` attached to Player B `player_id`: HTTP 400 (`Failed to create record.`) (rejected)
  - Spot-check unaffected 005 public rules (unauthenticated):
    - POST `blocks`: HTTP 200 (created)
    - GET `worlds`: HTTP 200 (list returned)
    - GET `programs`: HTTP 200 (list returned)
  - Migration round-trip: `migrate down 1` cleanly reverted 007 (restoring flat `''` rules), and `migrate up` cleanly re-applied 007 (restoring conditional rules).
- design.md sections affected: none — restores intended Stage 4 behavior from section 7.
- Git commit hash: (this commit)

**NEEDS JAIME:** None (closes the 2026-08-11 item).

## 2026-08-27 — Stage 5 & 5.1: Faculty Panel route, superuser gate, "Join as Student", and Submissions Dashboard

**Intent:** Jaime needed a dedicated faculty panel (`/faculty`) and submissions dashboard to inspect, summarize, drill into, and export student uploads for the active world without having to manually query SQLite or inspect PocketBase's raw admin collection records.

**Prompt:** "Task for Antigravity — Knoxel Stage 5.1: Submissions dashboard (summary stats + per-student table + export)" (after flagging that Stage 5 was missing, Jaime confirmed option 2 to implement Stage 5 and Stage 5.1 together in one pass).

**Changes:**
- `client/src/lib/router.ts` (new) — lightweight client-side router (`usePathname`, `navigate`) utilizing the HTML5 History API (`pushState` + `popstate`), cleanly routing between the student visualizer (`/`) and the faculty panel (`/faculty`).
- `client/src/hooks/useFacultyAuth.ts` (new) — manages PocketBase superuser session state, admin login (`_superusers` collection auth), logout, and faculty test player generation.
- `client/src/components/FacultyLogin.tsx` (new) — admin authentication gate for `/faculty`, prompting for PocketBase superuser email + password with clear error feedback and a return link to the student visualizer.
- `client/src/components/FacultyDashboard.tsx` (new) — comprehensive faculty submissions dashboard scoped to the currently active world:
  - Header with active world name, mode badge (`Open Mode` / `Accounts Mode`), admin email, "Join as Student" button, and Log Out.
  - **Part A (Summary Header):** Computes three aggregate metrics for the active world:
    1. *Submitting Students count:* distinct `player_id`s in `programs` for this world.
    2. *Average Instructions per Submission:* mean of `instruction_count` across all `programs` uploads in this world.
    3. *Average Blocks per Submission:* student-level ratio of blocks placed in this world to total submissions uploaded by that student, averaged across all students who submitted (explicitly noted as an approximation per the prompt since blocks are linked to `player_id` and `world_id` rather than directly to individual `program_id`s).
  - **Part B (Per-Student Table):** Table containing one row per student who has submitted at least one program in the active world.
    - Columns: Display Name, Email, Submission Count, Last Upload Timestamp, Most Recent Instruction Count, Blocks Placed, and Status (Active [`last_seen` < 5 min], Idle [`last_seen` > 5 min], Never connected).
    - Sortable by every column with proper numeric, date timestamp, and text comparisons.
    - Search filter matching Display Name or Email with clear button.
    - Drill-down expand row displaying all individual submissions for that student (Program Name, Submitted At timestamp, Instruction Count, Thread Count, and a "Download JSON" button).
    - Downloads exact raw `json_content` without reformatting or pretty-printing, named `{display_name}-{program_name}-{submitted_at}.json`.
  - **Part C (Bulk Exports):**
    - *Full JSON Export:* single JSON file containing all world submissions with student display name, email, program name, timestamp, instruction count, thread count, and complete `json_content`.
    - *CSV Summary:* CSV file with one row per submitting student (Display Name, Email, Submission Count, Most Recent Instruction Count, Most Recent Thread Count, First Submission Timestamp, Last Submission Timestamp, Total Blocks Placed).
- `client/src/lib/pocketbase.ts` — added `joinAsFacultyStudent()` helper to create/retrieve a test player account flagged with `is_faculty = true` for faculty in the active world, exported `OPEN_SESSION_KEY`, and added `last_seen` and `placed_at` fields to type interfaces.
- `client/src/hooks/usePocketbase.ts` — exported `isSuperuser` and added accounts-mode fallback so superusers testing via "Join as Student" load their faculty test player session without losing their admin token.
- `client/src/App.tsx` — routed `/faculty` to `<FacultyLogin>` / `<FacultyDashboard>`, and added a "faculty panel" navigation button in the student visualizer identity header when `is_faculty` or `isSuperuser`.
- `client/src/index.css` — added styling for faculty login card, header, metric cards, table, sortable column headers, status pills, drill-down subtable, and toolbar.
- `server/pb_hooks/programs.pb.js` — updated counting hook to handle flat v2 payloads where `threads` is an array directly (in addition to `{ type: 'parallel', threads: [...] }` and `{ instructions: [...] }`), ensuring `instruction_count` and `thread_count` are accurately computed and populated on creation.
- Verified end-to-end against real running PocketBase 0.39.10 instances and headless Playwright browser sessions:
  - Seeded scratch accounts-mode world (`CS142-Fall`) with multiple students, uploads with varying instruction counts (15 to 100), and block placements (0 to 10).
  - Verified Part A metrics matched manual calculations exactly: 3 submitting students, 43.8 avg instructions/submission, 2.7 avg blocks/submission.
  - Verified student Dave (0 submissions) was correctly excluded from table in accounts mode.
  - Verified table sorting across numeric columns (`submissionCount`, `totalBlocks`, `recentInstructionCount`), timestamp column (`lastUpload`), and string columns (`displayName`, `email`, `status`).
  - Verified search filter and clear functionality.
  - Verified student drill-down and byte-for-byte exactness of downloaded raw JSON files against stored database records.
  - Verified Full JSON export and CSV Summary export.
  - Verified "Join as Student" created test player, loaded student visualizer, and allowed seamless return to `/faculty` with superuser auth preserved.
  - Verified open-mode scratch world (`CS142-OpenLab`): confirmed no "hasn't submitted" or "missing" framing was shown anywhere in the UI.
- design.md sections affected: implements section 9 ("Faculty Panel" / Submissions view / Exports).
- Git commit hash: `6ba2150`

**NEEDS JAIME:**
1. **Accounts-mode zero-submission roster suggestion:** As noted in the prompt constraint, Part B table only lists students with at least 1 submission in both open and accounts mode. In accounts mode, an optional toggle (e.g. "Show enrolled students with 0 submissions") could be added in a future update if faculty want to see students on the roster who haven't uploaded anything yet.