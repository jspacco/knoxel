/**
 * A remote player's avatar — a coloured box at their *camera* position, not
 * their turtle. See design.md section 12/13: the camera is the student's
 * viewpoint and the turtle is a separate object, so what other students see
 * flying around the world is where you're looking from, not your turtle.
 *
 * No React component here, same convention as Turtle.tsx: the Three.js scene
 * never touches React's render cycle (design.md section 4).
 */

import * as THREE from 'three'
import type { Vec3 } from '../lib/interpreter'
import { makeNameplate } from './Turtle'

const AVATAR_WIDTH = 0.5
const AVATAR_HEIGHT = 1

export interface PlayerAvatarOptions {
  /** Consistent per player, derived by hashing their player id. */
  color: number
  /** Display name, or email prefix if no display name is set. */
  label: string
}

export class PlayerAvatarMesh {
  readonly group: THREE.Group
  private readonly geometry: THREE.BoxGeometry
  private readonly material: THREE.MeshLambertMaterial
  private readonly nameplate: THREE.Sprite

  constructor(position: Vec3, yaw: number, options: PlayerAvatarOptions) {
    this.group = new THREE.Group()

    this.geometry = new THREE.BoxGeometry(AVATAR_WIDTH, AVATAR_HEIGHT, AVATAR_WIDTH)
    this.material = new THREE.MeshLambertMaterial({ color: options.color })
    this.group.add(new THREE.Mesh(this.geometry, this.material))

    this.nameplate = makeNameplate(options.label)
    this.nameplate.position.y = AVATAR_HEIGHT / 2 + 0.3
    this.group.add(this.nameplate)

    this.setTransform(position, yaw)
  }

  setTransform(position: Vec3, yaw: number): void {
    this.group.position.set(position.x, position.y, position.z)
    this.group.rotation.y = yaw
  }

  dispose(): void {
    this.group.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
    this.nameplate.material.map?.dispose()
    this.nameplate.material.dispose()
  }
}
