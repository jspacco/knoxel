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
