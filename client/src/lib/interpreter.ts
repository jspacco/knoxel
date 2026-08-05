/**
 * Knoxel turtle interpreter — pure TypeScript state machine.
 *
 * No React, no Three.js, no PocketBase. The calling code owns timing; this
 * module only answers "what happens on the next tick?".
 *
 * See design.md sections 10 (JSON format) and 11 (interpreter design).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Coordinates and facing
// ─────────────────────────────────────────────────────────────────────────────

/** Minecraft convention: north = -z, south = +z, east = +x, west = -x. */
export type Facing = 'north' | 'south' | 'east' | 'west'

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Unit step for each facing. */
const FACING_VECTORS: Record<Facing, Vec3> = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
}

/** Clockwise order, viewed from above. Turning right advances by one. */
const CLOCKWISE: Facing[] = ['north', 'east', 'south', 'west']

export function facingVector(facing: Facing): Vec3 {
  return FACING_VECTORS[facing]
}

export function turnRight(facing: Facing): Facing {
  return CLOCKWISE[(CLOCKWISE.indexOf(facing) + 1) % 4]
}

export function turnLeft(facing: Facing): Facing {
  return CLOCKWISE[(CLOCKWISE.indexOf(facing) + 3) % 4]
}

/**
 * Mesh yaw (radians about +Y) for a facing, with the turtle model built
 * facing north (-z) at yaw 0.
 */
export function facingYaw(facing: Facing): number {
  switch (facing) {
    case 'north':
      return 0
    case 'east':
      return -Math.PI / 2
    case 'south':
      return Math.PI
    case 'west':
      return Math.PI / 2
  }
}

/** Lowest y a turtle may occupy. y=0 is the unbreakable ground layer. */
export const MIN_Y = 1

// ─────────────────────────────────────────────────────────────────────────────
// Instructions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union of every command the interpreter understands.
 * See design.md section 10 for the command reference.
 */
export type Instruction =
  // movement — strafe in place, facing never changes
  | { cmd: 'forward'; n?: number }
  | { cmd: 'back'; n?: number }
  | { cmd: 'up'; n?: number }
  | { cmd: 'down'; n?: number }
  | { cmd: 'left'; n?: number }
  | { cmd: 'right'; n?: number }
  // rotation — changes facing, never takes n (design.md section 10)
  | { cmd: 'turnLeft' }
  | { cmd: 'turnRight' }
  // block placement and synchronisation
  | { cmd: 'setBlock'; blk: string }
  | { cmd: 'nop'; n?: number }
  // v2 line drawing
  | { cmd: 'setBlockForward'; n?: number; blk: string }
  | { cmd: 'setBlockBack'; n?: number; blk: string }
  | { cmd: 'setBlockUp'; n?: number; blk: string }
  | { cmd: 'setBlockDown'; n?: number; blk: string }
  | { cmd: 'setBlockLeft'; n?: number; blk: string }
  | { cmd: 'setBlockRight'; n?: number; blk: string }

export const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
  'forward',
  'back',
  'up',
  'down',
  'left',
  'right',
  'turnLeft',
  'turnRight',
  'setBlock',
  'nop',
  'setBlockForward',
  'setBlockBack',
  'setBlockUp',
  'setBlockDown',
  'setBlockLeft',
  'setBlockRight',
])

// ─────────────────────────────────────────────────────────────────────────────
// Micro-steps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A micro-step is exactly one tick of work.
 *
 * Instructions carrying an `n` parameter (`forward 10`, `setBlockForward 4`)
 * are expanded into n micro-steps at runtime — the JSON keeps the compact form
 * so research tooling can still see the shorthand, but the animation shows the
 * turtle actually walking. See design.md section 10 ("The interpreter expands
 * these at runtime").
 *
 * A micro-step places a block at the position the turtle occupies *before* the
 * move, which is exactly the place-then-move rule from design.md section 10.
 */
export interface MicroStep {
  /** Block to place at the pre-move position, if any. */
  place?: string
  /** Translation applied after placing, if any. */
  move?: Vec3
  /** New facing, if this step turns. */
  turn?: Facing
}

/** An empty micro-step: a tick that consumes time and does nothing (`nop`). */
const NOP_STEP: MicroStep = {}

function stepCount(instruction: { n?: number }): number {
  const n = instruction.n
  if (n === undefined || n === null) return 1
  if (!Number.isFinite(n)) return 1
  // Clamp: a negative or zero count is a no-op tick, not an infinite loop.
  return Math.max(0, Math.floor(n))
}

function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k }
}

/** Direction to the turtle's left, given its facing. Facing does not change. */
function leftVector(facing: Facing): Vec3 {
  return facingVector(turnLeft(facing))
}

/** Direction to the turtle's right, given its facing. Facing does not change. */
function rightVector(facing: Facing): Vec3 {
  return facingVector(turnRight(facing))
}

const UP: Vec3 = { x: 0, y: 1, z: 0 }
const DOWN: Vec3 = { x: 0, y: -1, z: 0 }

/**
 * Expand one instruction into the micro-steps that execute it, given the
 * facing the turtle has when the instruction begins.
 *
 * Unknown commands expand to a single nop so a malformed program never
 * crashes the runner.
 */
export function expandInstruction(instruction: Instruction, facing: Facing): MicroStep[] {
  switch (instruction.cmd) {
    case 'forward':
      return repeatMove(facingVector(facing), stepCount(instruction))
    case 'back':
      return repeatMove(scale(facingVector(facing), -1), stepCount(instruction))
    case 'up':
      return repeatMove(UP, stepCount(instruction))
    case 'down':
      return repeatMove(DOWN, stepCount(instruction))

    // Strafe sideways — facing never changes. See design.md section 10:
    // v2 confirmed `left`/`right` are movement, distinct from `turnLeft`/`turnRight`.
    case 'left':
      return repeatMove(leftVector(facing), stepCount(instruction))
    case 'right':
      return repeatMove(rightVector(facing), stepCount(instruction))

    case 'turnLeft':
      return [{ turn: turnLeft(facing) }]
    case 'turnRight':
      return [{ turn: turnRight(facing) }]

    case 'nop':
      return repeatNop(stepCount(instruction))

    case 'setBlock':
      return [{ place: instruction.blk }]

    case 'setBlockForward':
      return drawLine(instruction.blk, facingVector(facing), stepCount(instruction))
    case 'setBlockBack':
      return drawLine(instruction.blk, scale(facingVector(facing), -1), stepCount(instruction))
    case 'setBlockUp':
      return drawLine(instruction.blk, UP, stepCount(instruction))
    case 'setBlockDown':
      return drawLine(instruction.blk, DOWN, stepCount(instruction))
    case 'setBlockLeft':
      return drawLine(instruction.blk, leftVector(facing), stepCount(instruction))
    case 'setBlockRight':
      return drawLine(instruction.blk, rightVector(facing), stepCount(instruction))

    default:
      // Unknown command — burn a tick rather than crash.
      return [NOP_STEP]
  }
}

function repeatMove(direction: Vec3, count: number): MicroStep[] {
  if (count === 0) return [NOP_STEP]
  return Array.from({ length: count }, () => ({ move: direction }))
}

function repeatNop(count: number): MicroStep[] {
  if (count === 0) return [NOP_STEP]
  return Array.from({ length: count }, () => NOP_STEP)
}

/**
 * Place-then-move: n placements, n-1 moves, ending on the last block placed.
 * Encoded as n micro-steps where the final step places without moving.
 */
function drawLine(blk: string, direction: Vec3, count: number): MicroStep[] {
  if (count === 0) return [NOP_STEP]
  const steps: MicroStep[] = []
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1
    steps.push(isLast ? { place: blk } : { place: blk, move: direction })
  }
  return steps
}

// ─────────────────────────────────────────────────────────────────────────────
// Turtle state
// ─────────────────────────────────────────────────────────────────────────────

export interface TurtleState {
  x: number
  y: number
  z: number
  facing: Facing
  /** Index of the next instruction to expand. */
  pc: number
  instructions: Instruction[]
  /** Micro-steps remaining for the instruction currently being executed. */
  pending: MicroStep[]
  /** Set once pc has run off the end and pending is empty. */
  done: boolean
}

export function createTurtleState(
  instructions: Instruction[],
  origin: Vec3 = { x: 0, y: MIN_Y, z: 0 },
  facing: Facing = 'north',
): TurtleState {
  return {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    facing,
    pc: 0,
    instructions,
    pending: [],
    done: instructions.length === 0,
  }
}

/**
 * What one tick did. Returned by {@link step} so the renderer can animate the
 * transition and place any block.
 */
export interface StepResult {
  from: Vec3
  to: Vec3
  fromFacing: Facing
  toFacing: Facing
  /** Rotation delta in radians about +Y: -PI/2 right, +PI/2 left, 0 otherwise. */
  yawDelta: number
  /** Block placed this tick, at `from`. */
  placed: { position: Vec3; blockId: string } | null
  /** True when the turtle finished its program on or before this tick. */
  done: boolean
}

/**
 * Advance one tick. Mutates `state` and returns what happened, or null if the
 * turtle was already finished.
 */
export function step(state: TurtleState): StepResult | null {
  if (state.done) return null

  // Refill the micro-step queue from the next instruction(s). Instructions can
  // legitimately expand to zero steps only if malformed, so loop rather than
  // returning an empty tick.
  while (state.pending.length === 0) {
    if (state.pc >= state.instructions.length) {
      state.done = true
      return null
    }
    const instruction = state.instructions[state.pc]
    state.pc += 1
    state.pending = expandInstruction(instruction, state.facing)
  }

  const micro = state.pending.shift()!
  const from: Vec3 = { x: state.x, y: state.y, z: state.z }
  const fromFacing = state.facing

  let placed: StepResult['placed'] = null
  if (micro.place !== undefined) {
    placed = { position: { ...from }, blockId: micro.place }
  }

  if (micro.turn !== undefined) {
    state.facing = micro.turn
  }

  if (micro.move !== undefined) {
    const nextY = state.y + micro.move.y
    // The ground is unbreakable: a move that would go below MIN_Y is refused,
    // but the tick is still consumed so threads stay in lockstep.
    if (nextY >= MIN_Y) {
      state.x += micro.move.x
      state.y = nextY
      state.z += micro.move.z
    }
  }

  if (state.pending.length === 0 && state.pc >= state.instructions.length) {
    state.done = true
  }

  return {
    from,
    to: { x: state.x, y: state.y, z: state.z },
    fromFacing,
    toFacing: state.facing,
    yawDelta: yawDeltaFor(fromFacing, state.facing),
    placed,
    done: state.done,
  }
}

/**
 * Shortest signed rotation from one facing to another, in radians about +Y.
 * Only ever called for single 90-degree turns, so the result is 0 or +/-PI/2.
 */
function yawDeltaFor(from: Facing, to: Facing): number {
  if (from === to) return 0
  if (turnRight(from) === to) return -Math.PI / 2
  if (turnLeft(from) === to) return Math.PI / 2
  return Math.PI // 180-degree flip; not emitted by any current command
}

// ─────────────────────────────────────────────────────────────────────────────
// Program parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A program ready to run: always a list of threads, because a sequential
 * program is just the one-thread case. See design.md section 10.
 */
export interface ParsedProgram {
  playerName: string
  programName: string
  description?: string
  threads: Instruction[][]
}

export interface ProgramParseIssue {
  message: string
}

export interface ParseResult {
  programs: ParsedProgram[]
  issues: ProgramParseIssue[]
}

interface RawPayload {
  type?: string
  description?: string
  instructions?: unknown
  threads?: unknown
}

/**
 * The shape `KnoxelUploader` actually POSTs for a single upload: no
 * playerName/programName nesting, just the payload directly plus `email` and
 * `program` alongside it. Confirmed from the committed sample files.
 */
interface RawFlatPayload extends RawPayload {
  email?: string
  program?: string
}

/**
 * Normalise one KnoxCraftMod payload into a thread list.
 *
 * `"type": "parallel"` means `threads` is an array of bare instruction arrays.
 * Anything else is treated as the degenerate single-thread case using
 * `instructions`, which also covers `"type": "sequential"` should the mod emit
 * it (design.md section 19 lists this as unconfirmed).
 */
export function parsePayload(payload: RawPayload): Instruction[][] {
  if (payload.type === 'parallel' || Array.isArray(payload.threads)) {
    const threads = Array.isArray(payload.threads) ? payload.threads : []
    return threads.map((thread) => sanitizeInstructions(thread))
  }
  return [sanitizeInstructions(payload.instructions)]
}

/** Drop anything that isn't an object with a string `cmd`. */
function sanitizeInstructions(raw: unknown): Instruction[] {
  if (!Array.isArray(raw)) return []
  const out: Instruction[] = []
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && typeof (entry as { cmd?: unknown }).cmd === 'string') {
      out.push(entry as Instruction)
    }
  }
  return out
}

/** True when `value` is a payload directly (has `threads` or `instructions`), not a playerName map. */
function isFlatPayload(value: Record<string, unknown>): boolean {
  return Array.isArray(value.threads) || Array.isArray(value.instructions)
}

/**
 * A single upload's JSON is a flat payload — `KnoxelUploader` POSTs
 * `{version, email, program, description, threads}` directly, no
 * playerName/programName nesting. See design.md section 10.
 */
function parseFlatPayload(payload: RawFlatPayload): ParseResult {
  const threads = parsePayload(payload).filter((thread) => thread.length > 0)
  if (threads.length === 0) {
    return { programs: [], issues: [{ message: 'No instructions found.' }] }
  }
  return {
    programs: [
      {
        playerName: payload.email ?? 'unknown',
        programName: payload.program ?? 'program',
        description: typeof payload.description === 'string' ? payload.description : undefined,
        threads,
      },
    ],
    issues: [],
  }
}

/**
 * Parse a whole KnoxCraftMod JSON file.
 *
 * Two top-level shapes are accepted: a single upload's flat payload
 * (`{email, program, threads}` — what the real Java client POSTs), or a
 * bundle of many programs keyed `playerName -> programName -> payload`.
 *
 * Returns every program found plus a list of human-readable issues, so the UI
 * can show partial results for a file that is mostly valid.
 */
export function parseProgramFile(json: unknown): ParseResult {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { programs: [], issues: [{ message: 'Expected a JSON object.' }] }
  }

  const root = json as Record<string, unknown>
  if (isFlatPayload(root)) return parseFlatPayload(root as RawFlatPayload)

  const programs: ParsedProgram[] = []
  const issues: ProgramParseIssue[] = []

  for (const [playerName, programMap] of Object.entries(root)) {
    if (!programMap || typeof programMap !== 'object' || Array.isArray(programMap)) {
      issues.push({ message: `Skipped "${playerName}": expected an object of program names.` })
      continue
    }

    for (const [programName, rawPayload] of Object.entries(programMap as Record<string, unknown>)) {
      if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
        issues.push({ message: `Skipped "${playerName}/${programName}": payload is not an object.` })
        continue
      }
      const payload = rawPayload as RawPayload
      const threads = parsePayload(payload).filter((thread) => thread.length > 0)

      if (threads.length === 0) {
        issues.push({ message: `Skipped "${playerName}/${programName}": no instructions found.` })
        continue
      }

      programs.push({
        playerName,
        programName,
        description: typeof payload.description === 'string' ? payload.description : undefined,
        threads,
      })
    }
  }

  if (programs.length === 0 && issues.length === 0) {
    issues.push({ message: 'No programs found in this file.' })
  }

  return { programs, issues }
}

/** Total instructions across all threads — the denormalised count PocketBase stores. */
export function instructionCount(program: ParsedProgram): number {
  return program.threads.reduce((sum, thread) => sum + thread.length, 0)
}

/** Number of ticks a thread will take, accounting for `n` expansion. */
export function threadTickCount(instructions: Instruction[]): number {
  // Expansion depends on facing only for direction, never for step count, so a
  // fixed facing gives the right total.
  let ticks = 0
  for (const instruction of instructions) {
    ticks += expandInstruction(instruction, 'north').length
  }
  return ticks
}

/** Human-readable one-line summary of an instruction, for the run log. */
export function describeInstruction(instruction: Instruction): string {
  const anyInstruction = instruction as { cmd: string; n?: number; blk?: string }
  const parts: string[] = [anyInstruction.cmd]
  if (anyInstruction.n !== undefined) parts.push(String(anyInstruction.n))
  if (anyInstruction.blk !== undefined) parts.push(anyInstruction.blk)
  return parts.join(' ')
}
