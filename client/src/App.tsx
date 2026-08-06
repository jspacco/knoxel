/**
 * Wires the scene, the tick runner, and the panel together.
 *
 * Stage 1: solo visualiser. Everything happens in the browser — no server.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { World } from './components/World'
import { Panel } from './components/Panel'
import { ProgramLoader } from './components/ProgramLoader'
import { useWorld } from './hooks/useWorld'
import { useTurtle } from './hooks/useTurtle'
import type { ParsedProgram, Vec3 } from './lib/interpreter'
import { MIN_Y } from './lib/interpreter'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { world, atlasError, cameraMode, pointerLocked } = useWorld(canvasRef)

  const [programs, setPrograms] = useState<ParsedProgram[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [messages, setMessages] = useState<string[]>([])

  const turtle = useTurtle({ world })

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

  return (
    <div className="app">
      <World
        canvasRef={canvasRef}
        atlasError={atlasError}
        loading={!world}
        hint={
          cameraMode === 'first-person'
            ? 'WASD fly · mouse look · Space/Shift up/down · Esc for orbit'
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
      >
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
