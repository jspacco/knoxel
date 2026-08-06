/**
 * The tick runner: drives every thread of a program forward in lockstep and
 * animates them simultaneously.
 *
 * One loop, all threads. Never one interval per thread — independent intervals
 * at the same rate drift apart within seconds and the parallelism, which is
 * the whole pedagogical point, stops being visible. See design.md section 11.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MIN_Y,
  createTurtleState,
  facingVector,
  step,
  turnLeft,
  turnRight,
  type Facing,
  type ParsedProgram,
  type TurtleState,
  type Vec3,
} from '../lib/interpreter'
import { sleep } from '../lib/anim'
import { threadColor } from '../lib/blockColors'
import { isTypingTarget, type WorldScene } from './useWorld'

export type RunState = 'idle' | 'running' | 'paused' | 'done'

/** Minecraft's tick rate, and the reference speed for Knoxel. */
export const DEFAULT_TICKS_PER_SECOND = 20
export const MIN_TICKS_PER_SECOND = 1
export const MAX_TICKS_PER_SECOND = 100

/**
 * Above this rate animation is dropped entirely and blocks appear instantly.
 * Queuing more tweens than the renderer can retire looks worse than skipping
 * them. See design.md section 11.
 */
const SMOOTH_ANIMATION_LIMIT = 20

/** Fraction of a tick spent animating; the rest lets placed blocks register. */
const ANIMATION_FRACTION = 0.8

const TURTLE_ID_PREFIX = 'turtle-'

const SPAWN_POSITION: Vec3 = { x: 0, y: MIN_Y, z: 0 }
const SPAWN_FACING: Facing = 'north'

/** Colour of the turtle when a program is not running (single-turtle case). */
const SOLO_TURTLE_COLOR = 0x2fb35a

export interface TurtleTransform {
  position: Vec3
  facing: Facing
}

export interface ThreadProgress {
  index: number
  color: number
  position: Vec3
  facing: Facing
  /** Instructions consumed so far. */
  pc: number
  total: number
  done: boolean
}

export interface UseTurtleOptions {
  world: WorldScene | null
  /** Called for every block the local turtle places. Used to sync multiplayer. */
  onBlockPlaced?: (position: Vec3, blockId: string) => void
  /** Called when the primary turtle settles, at most once per tick. */
  onTurtleMoved?: (transform: TurtleTransform) => void
  /** Called when a run finishes or is stopped. */
  onRunEnded?: (reason: 'finished' | 'stopped') => void
}

export interface UseTurtleResult {
  runState: RunState
  ticksPerSecond: number
  setTicksPerSecond: (rate: number) => void
  /** Transform of the primary (first) turtle. */
  transform: TurtleTransform
  threads: ThreadProgress[]
  tick: number
  log: string[]
  clearLog: () => void
  spawnAt: (position: Vec3, facing?: Facing) => void
  nudge: (direction: 'forward' | 'back' | 'left' | 'right' | 'up' | 'down') => void
  rotate: (direction: 'left' | 'right') => void
  run: (program: ParsedProgram) => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: () => void
}

const MAX_LOG_LINES = 200

export function useTurtle(options: UseTurtleOptions): UseTurtleResult {
  const { world, onBlockPlaced, onTurtleMoved, onRunEnded } = options

  const [runState, setRunState] = useState<RunState>('idle')
  const [ticksPerSecond, setTicksPerSecondState] = useState(DEFAULT_TICKS_PER_SECOND)
  const [transform, setTransform] = useState<TurtleTransform>({
    position: { ...SPAWN_POSITION },
    facing: SPAWN_FACING,
  })
  const [threads, setThreads] = useState<ThreadProgress[]>([])
  const [tick, setTick] = useState(0)
  const [log, setLog] = useState<string[]>([])

  // Refs mirror the state the tick loop needs, so the loop never closes over
  // a stale render.
  const statesRef = useRef<TurtleState[]>([])
  const transformRef = useRef<TurtleTransform>(transform)
  const rateRef = useRef(ticksPerSecond)
  const runStateRef = useRef<RunState>('idle')
  /** Bumped on every stop/reset so an in-flight loop knows to abandon. */
  const generationRef = useRef(0)
  const callbacksRef = useRef({ onBlockPlaced, onTurtleMoved, onRunEnded })

  callbacksRef.current = { onBlockPlaced, onTurtleMoved, onRunEnded }

  const setRunStateBoth = useCallback((next: RunState) => {
    runStateRef.current = next
    setRunState(next)
  }, [])

  const appendLog = useCallback((line: string) => {
    setLog((previous) => {
      const next = previous.length >= MAX_LOG_LINES ? previous.slice(previous.length - MAX_LOG_LINES + 1) : previous
      return [...next, line]
    })
  }, [])

  const clearLog = useCallback(() => setLog([]), [])

  // ───────────────────────────────────────────────────────────────────────────
  // Mesh synchronisation
  // ───────────────────────────────────────────────────────────────────────────

  const turtleId = (index: number) => `${TURTLE_ID_PREFIX}${index}`

  /** Rebuild the turtle meshes so there is exactly one per interpreter state. */
  const syncMeshes = useCallback(
    (states: TurtleState[], labelled: boolean) => {
      if (!world) return
      world.removeTurtlesWithPrefix(TURTLE_ID_PREFIX)
      states.forEach((state, index) => {
        world.addTurtle(
          turtleId(index),
          { x: state.x, y: state.y, z: state.z },
          state.facing,
          {
            color: states.length > 1 ? threadColor(index) : SOLO_TURTLE_COLOR,
            label: labelled && states.length > 1 ? `thread ${index}` : undefined,
          },
        )
      })
    },
    [world],
  )

  const publishThreads = useCallback((states: TurtleState[]) => {
    setThreads(
      states.map((state, index) => ({
        index,
        color: states.length > 1 ? threadColor(index) : SOLO_TURTLE_COLOR,
        position: { x: state.x, y: state.y, z: state.z },
        facing: state.facing,
        pc: state.pc,
        total: state.instructions.length,
        done: state.done,
      })),
    )
  }, [])

  const publishTransform = useCallback((state: TurtleState) => {
    const next: TurtleTransform = {
      position: { x: state.x, y: state.y, z: state.z },
      facing: state.facing,
    }
    transformRef.current = next
    setTransform(next)
    callbacksRef.current.onTurtleMoved?.(next)
  }, [])

  /**
   * Wide/overhead framing for threaded runs, auto-follow for single-thread
   * ones — auto-follow is meaningless once turtles head in different
   * directions at once. See design.md section 13, CLAUDE.md Stage 2 item 8.
   */
  const syncCamera = useCallback(
    (states: TurtleState[]) => {
      if (!world || states.length === 0) return
      const positions = states.map((state) => ({ x: state.x, y: state.y, z: state.z }))
      if (states.length > 1) {
        world.frameThreads(positions)
      } else {
        world.followTurtle(positions[0])
      }
    },
    [world],
  )

  // Create the idle turtle as soon as the scene exists.
  useEffect(() => {
    if (!world) return
    const idle = createTurtleState([], transformRef.current.position, transformRef.current.facing)
    statesRef.current = [idle]
    syncMeshes(statesRef.current, false)
    publishThreads(statesRef.current)
  }, [world, syncMeshes, publishThreads])

  // ───────────────────────────────────────────────────────────────────────────
  // Manual positioning (idle only)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Manual control always collapses back to a single turtle. After a parallel
   * run four turtles sit where their threads finished; touching an arrow key
   * means "I want to place my turtle again", so the extras go away and the
   * primary keeps the lead thread's position.
   */
  const collapseToSingle = useCallback((): TurtleState => {
    const first = statesRef.current[0] ?? createTurtleState([], SPAWN_POSITION, SPAWN_FACING)
    const single = createTurtleState([], { x: first.x, y: first.y, z: first.z }, first.facing)
    statesRef.current = [single]
    return single
  }, [])

  const isMovable = () => runStateRef.current === 'idle' || runStateRef.current === 'done'

  const applyManual = useCallback(
    (mutate: (state: TurtleState) => void) => {
      if (!isMovable()) return
      const hadMany = statesRef.current.length > 1
      const single = collapseToSingle()
      mutate(single)
      if (single.y < MIN_Y) single.y = MIN_Y
      if (hadMany || !world?.getTurtle(turtleId(0))) {
        syncMeshes(statesRef.current, false)
      } else {
        // Manual movement is instant — animation is only for program execution.
        world.getTurtle(turtleId(0))?.setTransform({ x: single.x, y: single.y, z: single.z }, single.facing)
      }
      setRunStateBoth('idle')
      publishTransform(single)
      publishThreads(statesRef.current)
    },
    [collapseToSingle, world, syncMeshes, publishTransform, publishThreads, setRunStateBoth],
  )

  const spawnAt = useCallback(
    (position: Vec3, facing?: Facing) => {
      applyManual((state) => {
        state.x = Math.floor(position.x)
        state.y = Math.max(MIN_Y, Math.floor(position.y))
        state.z = Math.floor(position.z)
        if (facing) state.facing = facing
      })
    },
    [applyManual],
  )

  const nudge = useCallback(
    (direction: 'forward' | 'back' | 'left' | 'right' | 'up' | 'down') => {
      applyManual((state) => {
        switch (direction) {
          case 'up':
            state.y += 1
            return
          case 'down':
            state.y -= 1
            return
          case 'forward': {
            const v = facingVector(state.facing)
            state.x += v.x
            state.z += v.z
            return
          }
          case 'back': {
            const v = facingVector(state.facing)
            state.x -= v.x
            state.z -= v.z
            return
          }
          case 'left': {
            const v = facingVector(turnLeft(state.facing))
            state.x += v.x
            state.z += v.z
            return
          }
          case 'right': {
            const v = facingVector(turnRight(state.facing))
            state.x += v.x
            state.z += v.z
          }
        }
      })
    },
    [applyManual],
  )

  const rotate = useCallback(
    (direction: 'left' | 'right') => {
      applyManual((state) => {
        state.facing = direction === 'left' ? turnLeft(state.facing) : turnRight(state.facing)
      })
    },
    [applyManual],
  )

  // Arrow keys + Page Up/Down + Q/E, separate from the camera's WASD so both
  // can be active at once (design.md section 13). nudge()/rotate() already
  // no-op outside idle/done, so this listener doesn't need its own run-state
  // guard.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      switch (event.code) {
        case 'ArrowUp':
          nudge('forward')
          break
        case 'ArrowDown':
          nudge('back')
          break
        case 'ArrowLeft':
          nudge('left')
          break
        case 'ArrowRight':
          nudge('right')
          break
        case 'PageUp':
          nudge('up')
          break
        case 'PageDown':
          nudge('down')
          break
        case 'KeyQ':
          rotate('left')
          break
        case 'KeyE':
          rotate('right')
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nudge, rotate])

  const reset = useCallback(() => {
    generationRef.current += 1
    world?.tweens.finishAll()
    world?.resetAutoFollow()
    setRunStateBoth('idle')
    const single = createTurtleState([], SPAWN_POSITION, SPAWN_FACING)
    statesRef.current = [single]
    syncMeshes(statesRef.current, false)
    publishTransform(single)
    publishThreads(statesRef.current)
    setTick(0)
  }, [world, syncMeshes, publishTransform, publishThreads, setRunStateBoth])

  // ───────────────────────────────────────────────────────────────────────────
  // The tick loop
  // ───────────────────────────────────────────────────────────────────────────

  const setTicksPerSecond = useCallback((rate: number) => {
    const clamped = Math.min(MAX_TICKS_PER_SECOND, Math.max(MIN_TICKS_PER_SECOND, Math.round(rate)))
    rateRef.current = clamped
    setTicksPerSecondState(clamped)
  }, [])

  const runLoop = useCallback(
    async (generation: number) => {
      if (!world) return
      let ticks = 0
      let lastUiUpdate = 0

      while (generationRef.current === generation) {
        if (runStateRef.current === 'paused') {
          await sleep(60)
          continue
        }
        if (runStateRef.current !== 'running') break

        const states = statesRef.current
        const active = states.filter((state) => !state.done)
        if (active.length === 0) break

        const tickMs = 1000 / rateRef.current
        const smooth = rateRef.current <= SMOOTH_ANIMATION_LIMIT
        const animationMs = smooth ? tickMs * ANIMATION_FRACTION : 0

        // Phase 1 — advance every live thread by exactly one tick and collect
        // what happened. State advances here; nothing is drawn yet.
        const results = states.map((state) => (state.done ? null : step(state)))

        // Phase 2 — commit block placements. A block is placed at the position
        // the turtle occupies *before* it moves, so it belongs on screen as the
        // animation starts, not after it.
        for (const result of results) {
          if (!result?.placed) continue
          world.placeBlock(result.placed.position, result.placed.blockId, smooth)
          callbacksRef.current.onBlockPlaced?.(result.placed.position, result.placed.blockId)
        }

        // Phase 3 — animate every turtle at once. Never sequentially: four
        // turtles moving one after another does not read as parallelism.
        await Promise.all(
          results.map((result, index) => {
            if (!result) return Promise.resolve()
            const mesh = world.getTurtle(turtleId(index))
            if (!mesh) return Promise.resolve()
            if (!smooth) {
              mesh.setTransform(result.to, result.toFacing)
              return Promise.resolve()
            }
            return mesh.animateStep(result.from, result.to, result.yawDelta, animationMs, world.tweens)
          }),
        )

        if (generationRef.current !== generation) return

        // Phase 4 — short settle so placed blocks register visually.
        await sleep(tickMs - animationMs)
        if (generationRef.current !== generation) return

        ticks += 1
        const now = performance.now()
        if (now - lastUiUpdate > 100) {
          lastUiUpdate = now
          setTick(ticks)
          publishThreads(statesRef.current)
          publishTransform(statesRef.current[0])
          syncCamera(statesRef.current)
        }
      }

      if (generationRef.current !== generation) return

      const finished = statesRef.current.every((state) => state.done)
      setTick(ticks)
      publishThreads(statesRef.current)
      publishTransform(statesRef.current[0])
      setRunStateBoth('done')
      appendLog(finished ? `Program finished after ${ticks} ticks.` : `Stopped after ${ticks} ticks.`)
      callbacksRef.current.onRunEnded?.(finished ? 'finished' : 'stopped')
    },
    [world, publishThreads, publishTransform, syncCamera, setRunStateBoth, appendLog],
  )

  const run = useCallback(
    (program: ParsedProgram) => {
      if (!world) return
      generationRef.current += 1
      const generation = generationRef.current
      world.tweens.finishAll()
      world.resetAutoFollow()

      const origin = { ...transformRef.current.position }
      const facing = transformRef.current.facing

      statesRef.current = program.threads.map((instructions) =>
        createTurtleState(instructions, { ...origin }, facing),
      )
      syncMeshes(statesRef.current, true)
      publishThreads(statesRef.current)
      syncCamera(statesRef.current)
      setTick(0)

      const threadCount = program.threads.length
      appendLog(
        `Running ${program.playerName}/${program.programName} — ${threadCount} thread${threadCount === 1 ? '' : 's'} from (${origin.x}, ${origin.y}, ${origin.z}) facing ${facing}.`,
      )

      setRunStateBoth('running')
      void runLoop(generation)
    },
    [world, syncMeshes, publishThreads, syncCamera, appendLog, setRunStateBoth, runLoop],
  )

  const pause = useCallback(() => {
    if (runStateRef.current === 'running') setRunStateBoth('paused')
  }, [setRunStateBoth])

  const resume = useCallback(() => {
    if (runStateRef.current === 'paused') setRunStateBoth('running')
  }, [setRunStateBoth])

  const stop = useCallback(() => {
    if (runStateRef.current !== 'running' && runStateRef.current !== 'paused') return
    generationRef.current += 1
    world?.tweens.finishAll()
    setRunStateBoth('done')
    // Snap every turtle to its true interpreter position: a half-finished lerp
    // must not leave a turtle stranded between two blocks.
    statesRef.current.forEach((state, index) => {
      world?.getTurtle(turtleId(index))?.setTransform({ x: state.x, y: state.y, z: state.z }, state.facing)
    })
    publishThreads(statesRef.current)
    publishTransform(statesRef.current[0])
    appendLog('Stopped.')
    callbacksRef.current.onRunEnded?.('stopped')
  }, [world, publishThreads, publishTransform, setRunStateBoth, appendLog])

  // Abandon any in-flight loop when the scene goes away.
  useEffect(() => {
    return () => {
      generationRef.current += 1
    }
  }, [])

  return {
    runState,
    ticksPerSecond,
    setTicksPerSecond,
    transform,
    threads,
    tick,
    log,
    clearLog,
    spawnAt,
    nudge,
    rotate,
    run,
    pause,
    resume,
    stop,
    reset,
  }
}
