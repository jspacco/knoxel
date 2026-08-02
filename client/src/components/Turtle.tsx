/**
 * Turtle mesh and its animation.
 *
 * This file holds no React component — the Three.js scene never enters React's
 * render cycle (design.md section 4). It exports a `TurtleMesh` class that
 * `useWorld` owns and mutates imperatively.
 *
 * Geometry is built facing north (-z) at yaw 0, matching `facingYaw()` in the
 * interpreter.
 */

import * as THREE from 'three'
import { facingYaw, type Facing, type Vec3 } from '../lib/interpreter'
import { easeInOutQuad, lerp, type TweenManager } from '../lib/anim'

/** Turtles stand on the floor of their cell and are centred within it. */
export function cellCenter(position: Vec3): THREE.Vector3 {
  return new THREE.Vector3(position.x + 0.5, position.y, position.z + 0.5)
}

const SHELL_COLOR_DARKEN = 0.55

export interface TurtleMeshOptions {
  /** Body colour. Each thread of a parallel program gets its own. */
  color: number
  /** Shown on the nameplate above the turtle. Empty string hides it. */
  label?: string
  /** Remote turtles render slightly translucent so your own turtle reads first. */
  ghost?: boolean
}

export class TurtleMesh {
  /** Root object placed at the turtle's world position. Yaw lives here. */
  readonly group: THREE.Group
  /** Inner object carrying the bob offset, so it never fights position tweens. */
  private readonly bobGroup: THREE.Group
  private readonly arrow: THREE.Mesh
  private readonly disposables: Array<{ dispose(): void }> = []
  private nameplate: THREE.Sprite | null = null

  /**
   * Continuous yaw in radians. Accumulated by +/- PI/2 per turn rather than
   * recomputed from facing, so turning west→north tweens the short way round
   * instead of unwinding through three quarters of a circle.
   */
  private yaw: number

  private bobPhase = Math.random() * Math.PI * 2

  constructor(
    position: Vec3,
    facing: Facing,
    private readonly options: TurtleMeshOptions,
  ) {
    this.group = new THREE.Group()
    this.group.position.copy(cellCenter(position))
    this.yaw = facingYaw(facing)
    this.group.rotation.y = this.yaw

    this.bobGroup = new THREE.Group()
    this.group.add(this.bobGroup)

    const opacity = options.ghost ? 0.55 : 1
    const transparent = Boolean(options.ghost)

    const bodyColor = new THREE.Color(options.color)
    const shellColor = bodyColor.clone().multiplyScalar(SHELL_COLOR_DARKEN)

    const bodyMaterial = this.track(
      new THREE.MeshLambertMaterial({ color: bodyColor, transparent, opacity }),
    )
    const shellMaterial = this.track(
      new THREE.MeshLambertMaterial({ color: shellColor, transparent, opacity }),
    )
    const eyeMaterial = this.track(
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent, opacity }),
    )

    // Body — a low slab.
    const bodyGeometry = this.track(new THREE.BoxGeometry(0.5, 0.18, 0.62))
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 0.16
    this.bobGroup.add(body)

    // Shell — a flattened dome sitting on the body.
    const shellGeometry = this.track(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2))
    const shell = new THREE.Mesh(shellGeometry, shellMaterial)
    shell.scale.set(1, 0.6, 1.05)
    shell.position.y = 0.24
    this.bobGroup.add(shell)

    // Head — protrudes north (-z), the facing direction.
    const headGeometry = this.track(new THREE.BoxGeometry(0.2, 0.16, 0.18))
    const head = new THREE.Mesh(headGeometry, bodyMaterial)
    head.position.set(0, 0.2, -0.36)
    this.bobGroup.add(head)

    // Eyes — on the front face of the head, so facing is readable up close.
    const eyeGeometry = this.track(new THREE.BoxGeometry(0.05, 0.05, 0.03))
    for (const dx of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
      eye.position.set(dx, 0.23, -0.45)
      this.bobGroup.add(eye)
    }

    // Legs.
    const legGeometry = this.track(new THREE.BoxGeometry(0.11, 0.1, 0.11))
    for (const [dx, dz] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.22],
      [0.2, 0.22],
    ]) {
      const leg = new THREE.Mesh(legGeometry, shellMaterial)
      leg.position.set(dx, 0.05, dz)
      this.bobGroup.add(leg)
    }

    // Ground arrow showing facing. Lies flat, points north (-z).
    const arrowGeometry = this.track(new THREE.ConeGeometry(0.16, 0.34, 3))
    const arrowMaterial = this.track(
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, depthWrite: false }),
    )
    this.arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
    this.arrow.rotation.x = -Math.PI / 2
    this.arrow.position.set(0, 0.02, -0.55)
    this.arrow.renderOrder = 1
    this.group.add(this.arrow)

    if (options.label) this.setLabel(options.label)
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource)
    return resource
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Position and facing
  // ───────────────────────────────────────────────────────────────────────────

  /** Snap to a position/facing with no animation. Used for manual controls. */
  setTransform(position: Vec3, facing: Facing): void {
    this.group.position.copy(cellCenter(position))
    this.yaw = nearestEquivalentYaw(this.yaw, facingYaw(facing))
    this.group.rotation.y = this.yaw
  }

  /**
   * Animate one tick: move and/or rotate simultaneously over `durationMs`.
   *
   * `yawDelta` is applied as a relative rotation so repeated right turns keep
   * winding in the same direction instead of snapping back at the wrap point.
   */
  animateStep(from: Vec3, to: Vec3, yawDelta: number, durationMs: number, tweens: TweenManager): Promise<void> {
    const start = cellCenter(from)
    const end = cellCenter(to)
    const yawStart = this.yaw
    const yawEnd = this.yaw + yawDelta
    this.yaw = yawEnd

    const moves = !start.equals(end)
    const turns = yawDelta !== 0

    if (!moves && !turns) return Promise.resolve()

    return tweens.add(
      durationMs,
      (t) => {
        if (moves) {
          this.group.position.set(lerp(start.x, end.x, t), lerp(start.y, end.y, t), lerp(start.z, end.z, t))
        }
        if (turns) {
          this.group.rotation.y = lerp(yawStart, yawEnd, t)
        }
      },
      easeInOutQuad,
    )
  }

  /** Subtle idle bob, driven by the render loop. */
  updateBob(elapsedSeconds: number): void {
    this.bobGroup.position.y = Math.sin(elapsedSeconds * 2.2 + this.bobPhase) * 0.018
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Nameplate
  // ───────────────────────────────────────────────────────────────────────────

  setLabel(text: string): void {
    this.clearLabel()
    if (!text) return
    const sprite = makeNameplate(text)
    sprite.position.set(0, 0.95, 0)
    this.group.add(sprite)
    this.nameplate = sprite
  }

  private clearLabel(): void {
    if (!this.nameplate) return
    this.group.remove(this.nameplate)
    this.nameplate.material.map?.dispose()
    this.nameplate.material.dispose()
    this.nameplate = null
  }

  get color(): number {
    return this.options.color
  }

  dispose(): void {
    this.clearLabel()
    for (const resource of this.disposables) resource.dispose()
    this.disposables.length = 0
    this.group.removeFromParent()
  }
}

/**
 * Pick the representation of `target` closest to `current` so a snap-to-facing
 * never rewinds the accumulated yaw by a full turn.
 */
function nearestEquivalentYaw(current: number, target: number): number {
  const twoPi = Math.PI * 2
  const turns = Math.round((current - target) / twoPi)
  return target + turns * twoPi
}

/** Canvas-backed sprite so player names float above their turtles. */
function makeNameplate(text: string): THREE.Sprite {
  const padding = 12
  const fontSize = 34
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  context.font = `600 ${fontSize}px system-ui, sans-serif`
  const width = Math.ceil(context.measureText(text).width) + padding * 2
  const height = fontSize + padding * 2
  canvas.width = width
  canvas.height = height

  // Measuring resets the context, so restate the font before drawing.
  context.font = `600 ${fontSize}px system-ui, sans-serif`
  context.fillStyle = 'rgba(15, 23, 42, 0.72)'
  roundRect(context, 0, 0, width, height, 10)
  context.fill()
  context.fillStyle = '#f8fafc'
  context.textBaseline = 'middle'
  context.fillText(text, padding, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.renderOrder = 10

  const scale = 0.006
  sprite.scale.set(width * scale, height * scale, 1)
  return sprite
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}
