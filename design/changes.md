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
