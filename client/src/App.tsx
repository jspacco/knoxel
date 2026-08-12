/**
 * Wires the scene, the tick runner, and the panel together.
 *
 * Stage 1: solo visualiser. Everything happens in the browser — no server.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { World } from './components/World'
import { Panel } from './components/Panel'
import { ProgramLoader } from './components/ProgramLoader'
import { Login } from './components/Login'
import { MyPrograms } from './components/MyPrograms'
import { useWorld } from './hooks/useWorld'
import { useTurtle } from './hooks/useTurtle'
import { usePocketbase } from './hooks/usePocketbase'
import { useMultiplayerSync } from './hooks/useMultiplayerSync'
import { useSharedLink } from './hooks/useSharedLink'
import { POCKETBASE_ENABLED } from './lib/pocketbase'
import type { ParsedProgram, Vec3 } from './lib/interpreter'
import { MIN_Y } from './lib/interpreter'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { world, atlasError, cameraMode, pointerLocked } = useWorld(canvasRef)

  const [programs, setPrograms] = useState<ParsedProgram[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [messages, setMessages] = useState<string[]>([])

  const pb = usePocketbase()
  const multiplayer = useMultiplayerSync({ world, activeWorld: pb.world, player: pb.player })
  const turtle = useTurtle({ world, onBlockPlaced: multiplayer.onBlockPlaced, onTurtleMoved: multiplayer.onTurtleMoved })

  const pushMessage = useCallback((message: string) => {
    setMessages((previous) => [...previous.slice(-19), message])
  }, [])

  const handleLoaded = useCallback(
    (loaded: ParsedProgram[], sourceLabel: string) => {
      setPrograms((previous) => {
        const next = [...previous, ...loaded]
        // Select the first newly loaded program so Run is immediately useful.
        setSelectedIndex(previous.length)
        return next
      })
      pushMessage(`Loaded ${loaded.length} program${loaded.length === 1 ? '' : 's'} from ${sourceLabel}.`)
    },
    [pushMessage],
  )

  const selected = selectedIndex >= 0 ? programs[selectedIndex] : undefined

  const handleRun = useCallback(() => {
    if (!selected) return
    turtle.run(selected)
  }, [selected, turtle])

  // Tier 1 (static GitHub Pages): a `?id=` link from the Java client's
  // Cloudflare Worker upload should fetch and run automatically, with no
  // login or drag-and-drop. See design.md section 3/13.
  const shared = useSharedLink(handleLoaded)

  useEffect(() => {
    if (shared.status === 'loading') pushMessage('Fetching shared program…')
    if (shared.status === 'error' && shared.errorMessage) pushMessage(shared.errorMessage)
  }, [shared.status, shared.errorMessage, pushMessage])

  const sharedAutoRunRef = useRef(false)
  useEffect(() => {
    if (sharedAutoRunRef.current) return
    if (shared.status !== 'loaded' || !world || !selected) return
    sharedAutoRunRef.current = true
    turtle.run(selected)
  }, [shared.status, world, selected, turtle])

  // On login/reload, put the turtle and camera back roughly where the
  // student left them, instead of always starting fresh at spawn. Guarded to
  // run once per player id — after that, manual moves and program runs keep
  // the server copy up to date, not the other way around.
  const restoredForPlayerRef = useRef<string | null>(null)
  useEffect(() => {
    if (!POCKETBASE_ENABLED || !world || !pb.player) return
    if (restoredForPlayerRef.current === pb.player.id) return
    restoredForPlayerRef.current = pb.player.id

    const p = pb.player
    if (p.turtle_x !== 0 || p.turtle_y !== 0 || p.turtle_z !== 0) {
      turtle.spawnAt({ x: p.turtle_x, y: p.turtle_y, z: p.turtle_z }, p.turtle_facing)
    }
    if (p.camera_x !== 0 || p.camera_y !== 0 || p.camera_z !== 0) {
      world.restoreCameraTransform({ x: p.camera_x, y: p.camera_y, z: p.camera_z }, p.camera_yaw)
    }
  }, [world, pb.player, turtle])

  /**
   * Drop the turtle where the camera is looking from, snapped to the block
   * grid. Students fly somewhere empty and spawn there to avoid building on
   * top of each other's work.
   */
  const handleSpawnAtCamera = useCallback(() => {
    if (!world) return
    const p = world.camera.position
    const position: Vec3 = {
      x: Math.floor(p.x),
      y: Math.max(MIN_Y, Math.floor(p.y)),
      z: Math.floor(p.z),
    }
    turtle.spawnAt(position)
    pushMessage(`Turtle spawned at (${position.x}, ${position.y}, ${position.z}).`)
  }, [world, turtle, pushMessage])

  const combinedLog = useMemo(() => [...messages, ...turtle.log], [messages, turtle.log])

  const clearLog = useCallback(() => {
    setMessages([])
    turtle.clearLog()
  }, [turtle])

  const needsDisplayName = POCKETBASE_ENABLED && Boolean(pb.player) && !pb.player?.display_name
  const showLogin = POCKETBASE_ENABLED && (!pb.player || needsDisplayName)

  return (
    <div className="app">
      {showLogin && (
        <Login
          world={pb.world}
          worldLoading={pb.worldLoading}
          worldError={pb.worldError}
          onLoginOpen={pb.loginOpen}
          onLoginAccounts={pb.loginAccounts}
          needsDisplayName={needsDisplayName}
          onSetDisplayName={pb.updateDisplayName}
        />
      )}

      <World
        canvasRef={canvasRef}
        atlasError={atlasError}
        loading={!world}
        hint={
          cameraMode === 'first-person'
            ? 'WASD fly · mouse look · Q/E or Space/Shift up/down · Esc for orbit'
            : 'Left-drag to orbit · right-drag to pan · scroll to zoom · click to enter first-person'
        }
        showPointerLockPrompt={cameraMode === 'first-person' && !pointerLocked}
      />

      <Panel
        runState={turtle.runState}
        canRun={Boolean(selected) && Boolean(world)}
        onRun={handleRun}
        onPause={turtle.pause}
        onResume={turtle.resume}
        onStop={turtle.stop}
        onReset={turtle.reset}
        ticksPerSecond={turtle.ticksPerSecond}
        onTicksPerSecondChange={turtle.setTicksPerSecond}
        followEnabled={turtle.followEnabled}
        onFollowEnabledChange={turtle.setFollowEnabled}
        transform={turtle.transform}
        threads={turtle.threads}
        tick={turtle.tick}
        blockCount={world?.blockCount ?? 0}
        onSpawnAtCamera={handleSpawnAtCamera}
        log={combinedLog}
        onClearLog={clearLog}
        header={
          pb.player && (
            <div className="identity">
              <span className="identity-name">{pb.player.display_name}</span>
              <button type="button" className="link-button" onClick={pb.logout}>
                switch player
              </button>
            </div>
          )
        }
      >
        {pb.player && pb.world && (
          <MyPrograms player={pb.player} activeWorld={pb.world} onLoaded={handleLoaded} onError={pushMessage} />
        )}

        <ProgramLoader
          programs={programs}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onLoaded={handleLoaded}
          onError={pushMessage}
          disabled={turtle.runState === 'running' || turtle.runState === 'paused'}
        />
      </Panel>
    </div>
  )
}
