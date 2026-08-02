/**
 * Minimal tween manager driven by the Three.js render loop.
 *
 * The tick runner needs to await "all turtles have finished moving" (design.md
 * section 11, Promise.all over simultaneous animations), so every tween hands
 * back a promise that settles when it completes or is cancelled.
 *
 * Tweens are advanced by wall-clock delta from the render loop rather than by
 * frame count, so animation duration stays correct when the frame rate dips.
 */

export type Easing = (t: number) => number

/** Ease in/out — turtles accelerate away and settle rather than jerking. */
export const easeInOutQuad: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export const linear: Easing = (t) => t

interface Tween {
  elapsed: number
  duration: number
  easing: Easing
  onUpdate: (t: number) => void
  onDone: () => void
  cancelled: boolean
}

export class TweenManager {
  private tweens = new Set<Tween>()

  /**
   * Run `onUpdate(t)` with t going 0→1 over `durationMs`.
   *
   * A zero or negative duration applies the final value immediately and
   * resolves on the spot, which is what the speed slider needs above 20
   * ticks/second where animation collapses to instant placement.
   */
  add(durationMs: number, onUpdate: (t: number) => void, easing: Easing = easeInOutQuad): Promise<void> {
    if (durationMs <= 0) {
      onUpdate(1)
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      const tween: Tween = {
        elapsed: 0,
        duration: durationMs,
        easing,
        onUpdate,
        onDone: resolve,
        cancelled: false,
      }
      this.tweens.add(tween)
    })
  }

  /** Advance every active tween. Called once per rendered frame. */
  update(deltaMs: number): void {
    if (this.tweens.size === 0) return
    for (const tween of Array.from(this.tweens)) {
      if (tween.cancelled) {
        this.tweens.delete(tween)
        continue
      }
      tween.elapsed += deltaMs
      const raw = Math.min(1, tween.elapsed / tween.duration)
      tween.onUpdate(tween.easing(raw))
      if (raw >= 1) {
        this.tweens.delete(tween)
        tween.onDone()
      }
    }
  }

  /**
   * Finish every tween immediately at its end value and resolve its promise.
   *
   * Used by Stop and Reset: a half-finished lerp must not leave a turtle
   * stranded between two blocks.
   */
  finishAll(): void {
    for (const tween of Array.from(this.tweens)) {
      this.tweens.delete(tween)
      if (!tween.cancelled) {
        tween.onUpdate(1)
        tween.onDone()
      }
    }
  }

  get activeCount(): number {
    return this.tweens.size
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}
