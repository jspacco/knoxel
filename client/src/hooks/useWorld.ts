/**
 * The Three.js world: scene, camera, blocks, turtles, render loop.
 *
 * All Three.js state lives behind `WorldScene` and is mutated imperatively.
 * React renders the `<canvas>` exactly once and never touches the scene again
 * (design.md section 4). The hook below is only a lifecycle wrapper.
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ATLAS_COLS, ATLAS_ROWS, ATLAS_MAP, type BlockFaces } from '../lib/atlas'
import { hashColor, isHexColor, parseHexColor } from '../lib/blockColors'
import { TweenManager, linear } from '../lib/anim'
import { TurtleMesh, type TurtleMeshOptions } from '../components/Turtle'
import type { Facing, Vec3 } from '../lib/interpreter'

const ATLAS_URL = `${import.meta.env.BASE_URL}textures/atlas.png`

/** Blocks pop in over this long. Short enough to keep up at 20 ticks/second. */
const BLOCK_POP_MS = 100

const SKY_COLOR = 0x8ec7ee
const GROUND_COLOR = 0x6aa84f
/** Top surface of the unbreakable ground layer. Blocks start at y=1. */
const GROUND_Y = 1
const GROUND_SIZE = 400
const GRID_SIZE = 200

// ─────────────────────────────────────────────────────────────────────────────
// First-person camera rig — see design.md section 13
// ─────────────────────────────────────────────────────────────────────────────

export type CameraMode = 'orbit' | 'first-person'

const FP_MOVE_UNITS_PER_SECOND = 8
const FP_MOUSE_RADIANS_PER_PIXEL = 0.0025
/** Camera may never sink below the ground plane, in any camera mode. */
const CAMERA_MIN_Y = GROUND_Y + 0.5
/** Clamp to +-89 degrees so looking straight up/down never flips the view. */
const PITCH_LIMIT = (89 * Math.PI) / 180
const FP_MOVE_KEY_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'])

/** True when the event's target is a form control — F/WASD must not hijack typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

// ─────────────────────────────────────────────────────────────────────────────
// Block materials — atlas slicing and caching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Owns the atlas texture, the per-tile texture clones, and the per-block
 * materials. Everything is cached: a world with 10,000 stone blocks holds one
 * stone material and one stone tile texture.
 */
class BlockMaterialLibrary {
  private atlas: THREE.Texture | null = null
  private readonly tileCache = new Map<number, THREE.Texture>()
  private readonly materialCache = new Map<string, THREE.Material | THREE.Material[]>()

  async load(url: string): Promise<void> {
    const texture = await new THREE.TextureLoader().loadAsync(url)
    // NearestFilter must be set on the source BEFORE any clone is made —
    // setting it on a clone afterwards is unreliable. Without it the 32px
    // textures blur into a smeared mess. See design.md section 14.
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    this.atlas = texture
  }

  /**
   * One tile of the atlas as its own texture. `clone()` shares the underlying
   * GPU upload, so ~350 tiles cost ~350 tiny objects and one texture in VRAM.
   */
  private tileTexture(index: number): THREE.Texture {
    if (!this.atlas) throw new Error('Atlas texture not loaded')
    const col = index % ATLAS_COLS
    const row = Math.floor(index / ATLAS_COLS)

    const tile = this.atlas.clone()
    tile.needsUpdate = true

    // Three.js UV origin is bottom-left; the PNG's row 0 is at the top.
    // Without this flip every block renders someone else's texture.
    tile.offset.set(col / ATLAS_COLS, 1 - (row + 1) / ATLAS_ROWS)
    tile.repeat.set(1 / ATLAS_COLS, 1 / ATLAS_ROWS)
    return tile
  }

  private getTile(index: number): THREE.Texture {
    let tile = this.tileCache.get(index)
    if (!tile) {
      tile = this.tileTexture(index)
      this.tileCache.set(index, tile)
    }
    return tile
  }

  /** Materials for a block ID, cached. Array of 6 for multi-face blocks. */
  get(blockId: string): THREE.Material | THREE.Material[] {
    let material = this.materialCache.get(blockId)
    if (!material) {
      material = this.build(blockId)
      this.materialCache.set(blockId, material)
    }
    return material
  }

  /** Three resolution paths, in priority order. See design.md section 14. */
  private build(blockId: string): THREE.Material | THREE.Material[] {
    // Path 1 — hex colour from java.awt.Color.
    if (isHexColor(blockId)) {
      const { rgb, alpha, transparent } = parseHexColor(blockId)
      return new THREE.MeshLambertMaterial({ color: rgb, transparent, opacity: alpha })
    }

    // Path 2 — known Minecraft block, textured from the atlas.
    const faces: BlockFaces | undefined = ATLAS_MAP[blockId]
    if (faces !== undefined && this.atlas) {
      if (typeof faces === 'number') {
        return new THREE.MeshLambertMaterial({ map: this.getTile(faces) })
      }
      // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
      return [
        new THREE.MeshLambertMaterial({ map: this.getTile(faces.side) }),
        new THREE.MeshLambertMaterial({ map: this.getTile(faces.side) }),
        new THREE.MeshLambertMaterial({ map: this.getTile(faces.top) }),
        new THREE.MeshLambertMaterial({ map: this.getTile(faces.bottom) }),
        new THREE.MeshLambertMaterial({ map: this.getTile(faces.side) }),
        new THREE.MeshLambertMaterial({ map: this.getTile(faces.side) }),
      ]
    }

    // Path 3 — unknown block. Deterministic colour, never a crash.
    return new THREE.MeshLambertMaterial({ color: hashColor(blockId) })
  }

  dispose(): void {
    for (const material of this.materialCache.values()) {
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material.dispose()
    }
    this.materialCache.clear()
    for (const tile of this.tileCache.values()) tile.dispose()
    this.tileCache.clear()
    this.atlas?.dispose()
    this.atlas = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────────────────────

export function blockKey(position: Vec3): string {
  return `${position.x},${position.y},${position.z}`
}

export interface PlacedBlock {
  position: Vec3
  blockId: string
}

export class WorldScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly tweens = new TweenManager()

  private readonly renderer: THREE.WebGLRenderer
  private readonly canvas: HTMLCanvasElement
  private readonly materials = new BlockMaterialLibrary()
  private readonly blockGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly blocks = new Map<string, { mesh: THREE.Mesh; blockId: string }>()
  private readonly turtles = new Map<string, TurtleMesh>()
  private orbit: OrbitControls | null = null

  private animationFrame = 0
  private lastFrameTime = 0
  private elapsedSeconds = 0
  private resizeObserver: ResizeObserver | null = null
  private disposed = false

  private cameraModeValue: CameraMode = 'orbit'
  private pointerLockedValue = false
  private fpYaw = 0
  private fpPitch = 0
  private readonly moveKeys = new Set<string>()
  private readonly modeListeners = new Set<(mode: CameraMode, locked: boolean) => void>()

  /**
   * Opt-in: while enabled, orbit mode follows the running turtle until the
   * student manually orbits/pans/zooms, at which point it turns itself back
   * off. Defaults to off — jumping the camera to the turtle on every Run
   * click was disorienting, so the camera now only moves when the student
   * moves it or explicitly turns following on. Only meaningful in orbit mode;
   * first-person is always fully manual.
   */
  private autoFollowEnabled = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, 60, 240)

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    this.camera.position.set(14, 14, 20)
    this.camera.lookAt(0, GROUND_Y, 0)

    this.addLighting()
    this.addGround()
    this.resize()
  }

  /** Noon lighting: one strong overhead key light plus ambient fill. */
  private addLighting(): void {
    const sun = new THREE.DirectionalLight(0xffffff, 2.0)
    sun.position.set(60, 120, 40)
    this.scene.add(sun)

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    // Slight sky/ground bounce keeps the undersides of blocks from going flat.
    this.scene.add(new THREE.HemisphereLight(SKY_COLOR, GROUND_COLOR, 0.6))
  }

  private addGround(): void {
    const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE)
    const material = new THREE.MeshLambertMaterial({ color: GROUND_COLOR })
    const ground = new THREE.Mesh(geometry, material)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = GROUND_Y
    ground.name = 'ground'
    this.scene.add(ground)

    const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x4a7a36, 0x5f9448)
    grid.position.y = GROUND_Y + 0.002
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.35
    this.scene.add(grid)
  }

  async loadAtlas(): Promise<void> {
    await this.materials.load(ATLAS_URL)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Camera
  // ───────────────────────────────────────────────────────────────────────────

  /** Orbit / pan / zoom, active whenever the camera is not in first-person mode. */
  enableOrbitControls(): void {
    if (this.orbit) return
    const controls = new OrbitControls(this.camera, this.canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, GROUND_Y, 0)
    controls.maxPolarAngle = Math.PI / 2 - 0.02 // stay above the ground plane
    controls.minDistance = 2
    controls.maxDistance = 200
    controls.update()
    // Dispatched only from real pointer/wheel input (OrbitControls ignores
    // input entirely while `enabled` is false, i.e. in first-person mode).
    controls.addEventListener('start', () => {
      this.autoFollowEnabled = false
    })
    this.orbit = controls
  }

  get cameraMode(): CameraMode {
    return this.cameraModeValue
  }

  get pointerLocked(): boolean {
    return this.pointerLockedValue
  }

  /** Called whenever camera mode or pointer-lock state changes, for the UI overlay/hint. */
  onCameraModeChange(listener: (mode: CameraMode, locked: boolean) => void): () => void {
    this.modeListeners.add(listener)
    return () => this.modeListeners.delete(listener)
  }

  private notifyModeChange(): void {
    for (const listener of this.modeListeners) listener(this.cameraModeValue, this.pointerLockedValue)
  }

  toggleCameraMode(): void {
    this.setCameraMode(this.cameraModeValue === 'orbit' ? 'first-person' : 'orbit')
  }

  private setCameraMode(mode: CameraMode): void {
    if (this.cameraModeValue === mode) return
    this.cameraModeValue = mode
    this.moveKeys.clear()

    if (mode === 'first-person') {
      if (this.orbit) this.orbit.enabled = false
      // Derive yaw/pitch from the camera's current orientation so entering
      // first-person never snaps the view.
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ')
      this.fpYaw = euler.y
      this.fpPitch = euler.x
    } else {
      if (document.pointerLockElement === this.canvas) document.exitPointerLock()
      this.pointerLockedValue = false
      if (this.orbit) {
        this.orbit.enabled = true
        // Aim the orbit target at a point in front of the camera so switching
        // back to orbit doesn't snap the view either.
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
        this.orbit.target.copy(this.camera.position).addScaledVector(forward, 10)
        this.orbit.update()
      }
    }
    this.notifyModeChange()
  }

  /**
   * Pointer Lock API + WASD fly camera. Toggled against orbit mode with F.
   * No gravity, no collision — students fly freely through blocks. See
   * design.md section 13.
   */
  enableFirstPersonToggle(): void {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    this.canvas.addEventListener('click', this.handleCanvasClick)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    document.addEventListener('mousemove', this.handleMouseMove)
  }

  private disableFirstPersonToggle(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.canvas.removeEventListener('click', this.handleCanvasClick)
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange)
    document.removeEventListener('mousemove', this.handleMouseMove)
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return
    if (event.code === 'KeyF') {
      event.preventDefault()
      this.toggleCameraMode()
      return
    }
    if (this.cameraModeValue !== 'first-person') return
    if (FP_MOVE_KEY_CODES.has(event.code)) {
      this.moveKeys.add(event.code)
      event.preventDefault()
    }
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.moveKeys.delete(event.code)
  }

  /**
   * Pointer Lock requires a user gesture — this is that gesture. Clicking the
   * canvas always captures the mouse and enters first-person, matching the
   * convention of every other browser game. F remains as an alternative way
   * to toggle modes without touching the mouse.
   */
  private readonly handleCanvasClick = (): void => {
    if (this.cameraModeValue !== 'first-person') this.setCameraMode('first-person')
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock()
  }

  private readonly handlePointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas
    this.pointerLockedValue = locked
    // Escape (or losing the lock any other way) exits first-person entirely,
    // per design.md — students must always be able to reach the Stop button.
    if (!locked && this.cameraModeValue === 'first-person') {
      this.setCameraMode('orbit')
      return
    }
    this.notifyModeChange()
  }

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLockedValue || this.cameraModeValue !== 'first-person') return
    this.fpYaw -= event.movementX * FP_MOUSE_RADIANS_PER_PIXEL
    this.fpPitch -= event.movementY * FP_MOUSE_RADIANS_PER_PIXEL
    this.fpPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.fpPitch))
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ'))
  }

  private updateFirstPersonMovement(deltaSeconds: number): void {
    if (this.cameraModeValue !== 'first-person' || this.moveKeys.size === 0) return
    const yawOnly = new THREE.Euler(0, this.fpYaw, 0, 'YXZ')
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.fpPitch, this.fpYaw, 0, 'YXZ'))
    const right = new THREE.Vector3(1, 0, 0).applyEuler(yawOnly)

    const move = new THREE.Vector3()
    if (this.moveKeys.has('KeyW')) move.add(forward)
    if (this.moveKeys.has('KeyS')) move.sub(forward)
    if (this.moveKeys.has('KeyD')) move.add(right)
    if (this.moveKeys.has('KeyA')) move.sub(right)
    if (move.lengthSq() > 0) move.normalize()
    if (this.moveKeys.has('Space')) move.y += 1
    if (this.moveKeys.has('ShiftLeft') || this.moveKeys.has('ShiftRight')) move.y -= 1
    if (move.lengthSq() === 0) return

    this.camera.position.addScaledVector(move, FP_MOVE_UNITS_PER_SECOND * deltaSeconds)
  }

  /** No collision detection anywhere else, but the ground is the one surface
   * the camera may never pass through — clamp after every camera update. */
  private clampCameraToGround(): void {
    if (this.camera.position.y < CAMERA_MIN_Y) this.camera.position.y = CAMERA_MIN_Y
  }

  /** Point the orbit camera at a world position, keeping the current distance. */
  focusOn(position: Vec3): void {
    if (!this.orbit) return
    const target = new THREE.Vector3(position.x + 0.5, position.y + 0.5, position.z + 0.5)
    const offset = this.camera.position.clone().sub(this.orbit.target)
    this.orbit.target.copy(target)
    this.camera.position.copy(target).add(offset)
    this.orbit.update()
  }

  /** Frame a set of positions so all of them are visible at once. */
  frameAll(positions: Vec3[], padding = 8): void {
    if (!this.orbit || positions.length === 0) return
    const box = new THREE.Box3()
    for (const position of positions) {
      box.expandByPoint(new THREE.Vector3(position.x + 0.5, position.y + 0.5, position.z + 0.5))
    }
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const radius = Math.max(size.x, size.z, size.y, 1) / 2 + padding
    const fov = (this.camera.fov * Math.PI) / 180
    const distance = radius / Math.tan(fov / 2)

    this.orbit.target.copy(center)
    // Look down at roughly 45 degrees from the south-east.
    this.camera.position.set(center.x + distance * 0.6, center.y + distance * 0.75, center.z + distance * 0.6)
    this.orbit.update()
  }

  /** Turn following on/off — driven by the "Follow turtle" panel toggle. */
  setAutoFollow(enabled: boolean): void {
    this.autoFollowEnabled = enabled
  }

  get autoFollow(): boolean {
    return this.autoFollowEnabled
  }

  /**
   * Track a single running turtle in orbit mode. No-op once the student has
   * manually orbited/panned/zoomed, and no-op entirely in first-person (the
   * camera there is always fully manual). See design.md section 13.
   */
  followTurtle(position: Vec3): void {
    if (!this.autoFollowEnabled || this.cameraModeValue !== 'orbit') return
    this.focusOn(position)
  }

  /**
   * Wide/overhead view keeping every thread in frame — used while a threaded
   * program runs, since "auto-follow" is meaningless when turtles head in
   * different directions at once. See design.md section 11 and CLAUDE.md
   * Stage 2. Orbit-mode only, same reasoning as `followTurtle`.
   */
  frameThreads(positions: Vec3[]): void {
    if (this.cameraModeValue !== 'orbit') return
    this.frameAll(positions)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Blocks
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Place (or replace) a block. Last write wins, matching the server's upsert
   * on (world_id, x, y, z).
   *
   * `animate` drives the pop-in scale; pass false when hydrating an existing
   * world, where thousands of simultaneous tweens would be pointless.
   */
  placeBlock(position: Vec3, blockId: string, animate = true): void {
    if (position.y < GROUND_Y) return // nothing may be placed in the ground layer

    const key = blockKey(position)
    const existing = this.blocks.get(key)
    if (existing) {
      if (existing.blockId === blockId) return
      this.scene.remove(existing.mesh)
      this.blocks.delete(key)
    }

    const mesh = new THREE.Mesh(this.blockGeometry, this.materials.get(blockId))
    mesh.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5)
    this.scene.add(mesh)
    this.blocks.set(key, { mesh, blockId })

    if (animate) {
      mesh.scale.setScalar(0.01)
      void this.tweens.add(BLOCK_POP_MS, (t) => mesh.scale.setScalar(Math.max(0.01, t)), linear)
    }
  }

  removeBlock(position: Vec3): void {
    const key = blockKey(position)
    const entry = this.blocks.get(key)
    if (!entry) return
    this.scene.remove(entry.mesh)
    this.blocks.delete(key)
  }

  clearBlocks(): void {
    for (const { mesh } of this.blocks.values()) this.scene.remove(mesh)
    this.blocks.clear()
  }

  get blockCount(): number {
    return this.blocks.size
  }

  /** Every placed block, for saving or exporting a solo world. */
  listBlocks(): PlacedBlock[] {
    const out: PlacedBlock[] = []
    for (const [key, entry] of this.blocks) {
      const [x, y, z] = key.split(',').map(Number)
      out.push({ position: { x, y, z }, blockId: entry.blockId })
    }
    return out
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Turtles
  // ───────────────────────────────────────────────────────────────────────────

  addTurtle(id: string, position: Vec3, facing: Facing, options: TurtleMeshOptions): TurtleMesh {
    this.removeTurtle(id)
    const turtle = new TurtleMesh(position, facing, options)
    this.scene.add(turtle.group)
    this.turtles.set(id, turtle)
    return turtle
  }

  getTurtle(id: string): TurtleMesh | undefined {
    return this.turtles.get(id)
  }

  removeTurtle(id: string): void {
    const turtle = this.turtles.get(id)
    if (!turtle) return
    turtle.dispose()
    this.turtles.delete(id)
  }

  /** Remove every turtle whose id starts with `prefix` (e.g. all run threads). */
  removeTurtlesWithPrefix(prefix: string): void {
    for (const id of Array.from(this.turtles.keys())) {
      if (id.startsWith(prefix)) this.removeTurtle(id)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render loop
  // ───────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.animationFrame) return
    this.lastFrameTime = performance.now()
    const loop = (now: number) => {
      if (this.disposed) return
      const deltaMs = Math.min(now - this.lastFrameTime, 100) // clamp after tab switches
      this.lastFrameTime = now
      this.elapsedSeconds += deltaMs / 1000

      this.tweens.update(deltaMs)
      for (const turtle of this.turtles.values()) turtle.updateBob(this.elapsedSeconds)

      // OrbitControls.update() recomputes camera.position from its own stored
      // spherical coordinates every call — running it while first-person owns
      // the camera would fight the fly movement below and snap the view back.
      if (this.cameraModeValue === 'orbit') {
        this.orbit?.update()
      } else {
        this.updateFirstPersonMovement(deltaMs / 1000)
      }
      this.clampCameraToGround()

      this.renderer.render(this.scene, this.camera)
      this.animationFrame = requestAnimationFrame(loop)
    }
    this.animationFrame = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
  }

  observeResize(element: HTMLElement): void {
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(element)
  }

  resize(): void {
    const parent = this.canvas.parentElement
    const width = parent?.clientWidth || this.canvas.clientWidth || window.innerWidth
    const height = parent?.clientHeight || this.canvas.clientHeight || window.innerHeight
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.disposed = true
    this.stop()
    this.disableFirstPersonToggle()
    this.resizeObserver?.disconnect()
    this.orbit?.dispose()
    for (const turtle of this.turtles.values()) turtle.dispose()
    this.turtles.clear()
    this.clearBlocks()
    this.blockGeometry.dispose()
    this.materials.dispose()
    this.renderer.dispose()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseWorldResult {
  /** Null until the canvas is mounted and the atlas has loaded. */
  world: WorldScene | null
  atlasError: string | null
  cameraMode: CameraMode
  pointerLocked: boolean
}

/**
 * Create the scene once for the lifetime of the canvas.
 *
 * The returned `world` is a plain object, not React state that anything should
 * re-render on — it changes identity exactly once, when the scene is ready.
 * `cameraMode`/`pointerLocked` are mirrored into React state so the panel hint
 * and pointer-lock overlay can react to them.
 */
export function useWorld(canvasRef: React.RefObject<HTMLCanvasElement | null>): UseWorldResult {
  const [world, setWorld] = useState<WorldScene | null>(null)
  const [atlasError, setAtlasError] = useState<string | null>(null)
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit')
  const [pointerLocked, setPointerLocked] = useState(false)
  const sceneRef = useRef<WorldScene | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new WorldScene(canvas)
    sceneRef.current = scene
    scene.enableOrbitControls()
    scene.enableFirstPersonToggle()
    const unsubscribe = scene.onCameraModeChange((mode, locked) => {
      setCameraMode(mode)
      setPointerLocked(locked)
    })
    if (canvas.parentElement) scene.observeResize(canvas.parentElement)
    scene.start()

    let cancelled = false
    scene
      .loadAtlas()
      .catch((error: unknown) => {
        // A missing atlas degrades to hash colours rather than a blank screen.
        const message = error instanceof Error ? error.message : String(error)
        if (!cancelled) setAtlasError(`Texture atlas failed to load (${message}). Blocks will use flat colours.`)
      })
      .finally(() => {
        if (!cancelled) setWorld(scene)
      })

    return () => {
      cancelled = true
      unsubscribe()
      scene.dispose()
      sceneRef.current = null
      setWorld(null)
    }
  }, [canvasRef])

  return { world, atlasError, cameraMode, pointerLocked }
}
