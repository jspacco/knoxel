/**
 * Colour resolution for blocks that are not textured from the atlas.
 *
 * Two cases, both described in design.md section 14:
 *   1. Hex strings emitted by the Java library from `java.awt.Color`.
 *      6 digits `#rrggbb` = opaque, 8 digits `#rrggbbaa` = alpha channel.
 *   2. Unknown block IDs, which hash to a deterministic colour so the same
 *      unrecognised block always looks the same and nothing ever crashes.
 */

export interface ParsedColor {
  /** 0xrrggbb, ready for THREE.Color / material `color`. */
  rgb: number
  /** 0.0–1.0. Exactly 1.0 for 6-digit hex. */
  alpha: number
  /** True when alpha < 1 and the material needs `transparent: true`. */
  transparent: boolean
}

const HEX6 = /^#[0-9a-fA-F]{6}$/
const HEX8 = /^#[0-9a-fA-F]{8}$/

/** True for any block ID the hex path should handle. */
export function isHexColor(blockId: string): boolean {
  return blockId.startsWith('#')
}

/**
 * Parse `#rrggbb` or `#rrggbbaa`.
 *
 * Malformed hex (wrong length, bad digits) falls back to the hash colour for
 * the raw string rather than throwing — students mistype colours and the
 * program should still run.
 */
export function parseHexColor(blockId: string): ParsedColor {
  if (HEX8.test(blockId)) {
    const rgb = parseInt(blockId.slice(1, 7), 16)
    const alpha = parseInt(blockId.slice(7, 9), 16) / 255
    return { rgb, alpha, transparent: alpha < 1 }
  }
  if (HEX6.test(blockId)) {
    return { rgb: parseInt(blockId.slice(1, 7), 16), alpha: 1, transparent: false }
  }
  return { rgb: hashColor(blockId), alpha: 1, transparent: false }
}

/**
 * Deterministic colour for an unrecognised block ID.
 *
 * Same string always yields the same colour, across sessions and machines.
 */
export function hashColor(blockId: string): number {
  let hash = 0
  for (let i = 0; i < blockId.length; i++) {
    hash = blockId.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0 // keep it a 32-bit int so long IDs don't lose precision
  }
  return Math.abs(hash) % 0xffffff
}

/**
 * Distinct body colours for the turtles of a threaded program.
 *
 * When four turtles set off in four directions the eye can only track them by
 * colour, so these are chosen to stay separable at speed and against both the
 * green ground and the sky. See design.md section 11.
 */
export const THREAD_COLORS: readonly number[] = [
  0xff5252, // red
  0x448aff, // blue
  0xffd740, // amber
  0x69f0ae, // green
  0xe040fb, // magenta
  0x40c4ff, // cyan
  0xff9100, // orange
  0xb388ff, // violet
]

export function threadColor(index: number): number {
  return THREAD_COLORS[index % THREAD_COLORS.length]
}

/** CSS `#rrggbb` for a numeric colour, for use in the panel UI. */
export function cssColor(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`
}
