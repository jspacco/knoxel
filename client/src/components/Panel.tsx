/**
 * The side panel: everything that is not the 3D view.
 *
 * Pure React. It never touches the Three.js scene directly — it calls the
 * callbacks the app hands it, and the app forwards those to the hooks.
 */

import type { ReactNode } from 'react'
import { cssColor } from '../lib/blockColors'
import {
  MAX_TICKS_PER_SECOND,
  MIN_TICKS_PER_SECOND,
  type RunState,
  type ThreadProgress,
  type TurtleTransform,
} from '../hooks/useTurtle'

export interface PanelProps {
  runState: RunState
  canRun: boolean
  onRun: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onReset: () => void

  ticksPerSecond: number
  onTicksPerSecondChange: (rate: number) => void

  followEnabled: boolean
  onFollowEnabledChange: (enabled: boolean) => void

  transform: TurtleTransform
  threads: ThreadProgress[]
  tick: number
  blockCount: number

  onSpawnAtCamera: () => void

  log: string[]
  onClearLog: () => void

  /** Program picker, session UI, player list — composed by the app. */
  children?: ReactNode
  /** Rendered above everything else (identity / world info). */
  header?: ReactNode
}

export function Panel(props: PanelProps) {
  const {
    runState,
    canRun,
    onRun,
    onPause,
    onResume,
    onStop,
    onReset,
    ticksPerSecond,
    onTicksPerSecondChange,
    followEnabled,
    onFollowEnabledChange,
    transform,
    threads,
    tick,
    blockCount,
    onSpawnAtCamera,
    log,
    onClearLog,
    children,
    header,
  } = props

  const running = runState === 'running' || runState === 'paused'
  const smooth = ticksPerSecond <= 20

  return (
    <aside className="panel">
      <header className="panel-header">
        <h1>Knoxel</h1>
        {header}
      </header>

      <div className="panel-scroll">
        {children}

        <section className="panel-section">
          <h2>Run</h2>

          <div className="button-row">
            {runState === 'paused' ? (
              <button type="button" className="button button-primary" onClick={onResume}>
                Resume
              </button>
            ) : (
              <button
                type="button"
                className="button button-primary"
                onClick={running ? onPause : onRun}
                disabled={!running && !canRun}
              >
                {running ? 'Pause' : 'Run'}
              </button>
            )}
            <button type="button" className="button" onClick={onReset} disabled={running}>
              Reset
            </button>
          </div>

          {/* Always visible, unmissable while running — a student who realises
              their program is wrong must be able to stop it instantly. */}
          <button
            type="button"
            className={`button stop-button${running ? ' stop-button-hot' : ''}`}
            onClick={onStop}
            disabled={!running}
          >
            Stop
          </button>

          <label className="slider-label" htmlFor="speed">
            Speed
            <span className="slider-value">
              {ticksPerSecond} ticks/s{ticksPerSecond === 20 ? ' (Minecraft)' : ''}
            </span>
          </label>
          <input
            id="speed"
            type="range"
            min={MIN_TICKS_PER_SECOND}
            max={MAX_TICKS_PER_SECOND}
            value={ticksPerSecond}
            onChange={(event) => onTicksPerSecondChange(Number(event.target.value))}
          />
          {!smooth && <p className="muted small">Above 20 ticks/s animation is skipped — blocks appear instantly.</p>}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={followEnabled}
              onChange={(event) => onFollowEnabledChange(event.target.checked)}
            />
            Follow turtle with camera
          </label>
        </section>

        <section className="panel-section">
          <h2>Turtle</h2>
          <dl className="stat-grid">
            <dt>Position</dt>
            <dd>
              {transform.position.x}, {transform.position.y}, {transform.position.z}
            </dd>
            <dt>Facing</dt>
            <dd>{transform.facing}</dd>
            <dt>Tick</dt>
            <dd>{tick}</dd>
            <dt>Blocks</dt>
            <dd>{blockCount}</dd>
          </dl>

          <button type="button" className="button" onClick={onSpawnAtCamera} disabled={running}>
            Spawn turtle at camera
          </button>

          {threads.length > 1 && (
            <ul className="thread-list">
              {threads.map((thread) => (
                <li key={thread.index}>
                  <span className="thread-swatch" style={{ background: cssColor(thread.color) }} />
                  <span className="thread-label">thread {thread.index}</span>
                  <span className="thread-progress">
                    {thread.pc}/{thread.total}
                    {thread.done ? ' ✓' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <details className="controls-help">
            <summary>Controls</summary>
            <dl className="keys">
              <dt>Click canvas</dt>
              <dd>capture mouse, enter first-person</dd>
              <dt>WASD / Space / Shift</dt>
              <dd>fly the camera</dd>
              <dt>Esc</dt>
              <dd>release the mouse</dd>
              <dt>F</dt>
              <dd>toggle first-person / orbit</dd>
              <dt>IJKL (or arrow keys)</dt>
              <dd>move the turtle</dd>
              <dt>U / O (or Page Up / Down)</dt>
              <dd>turtle up / down</dd>
              <dt>Q / E</dt>
              <dd>rotate the turtle</dd>
            </dl>
          </details>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <h2>Log</h2>
            <button type="button" className="link-button" onClick={onClearLog}>
              clear
            </button>
          </div>
          <div className="log">
            {log.length === 0 ? (
              <p className="muted small">Nothing yet.</p>
            ) : (
              log.map((line, index) => (
                <div key={index} className="log-line">
                  {line}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
