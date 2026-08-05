/**
 * The 3D viewport.
 *
 * React renders this canvas once and never re-renders it. Everything drawn
 * inside is owned by `WorldScene`; the only React state here is the overlay
 * text drawn on top of the canvas.
 */

import type { RefObject } from 'react'

export interface WorldProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  /** Non-null when the texture atlas failed to load. */
  atlasError: string | null
  /** Shown while the scene is still being created. */
  loading: boolean
  /** Hint line describing the current camera mode and controls. */
  hint?: string
  /** True in first-person mode before the pointer is locked — shows the capture overlay. */
  showPointerLockPrompt?: boolean
}

export function World({ canvasRef, atlasError, loading, hint, showPointerLockPrompt }: WorldProps) {
  return (
    <div className="viewport">
      <canvas ref={canvasRef} className="viewport-canvas" />

      {loading && <div className="viewport-badge">Loading world…</div>}

      {atlasError && (
        <div className="viewport-banner viewport-banner-warn" role="status">
          {atlasError}
        </div>
      )}

      {showPointerLockPrompt && (
        <div className="viewport-banner viewport-pointer-lock-prompt" role="status">
          Click to capture mouse · ESC to exit
        </div>
      )}

      {hint && <div className="viewport-hint">{hint}</div>}
    </div>
  )
}
