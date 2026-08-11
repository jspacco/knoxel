/**
 * PocketBase client singleton. See design.md section 7.
 *
 * `VITE_POCKETBASE_URL` unset or empty means solo mode — no server, no
 * login, static-tier build (see vite-env.d.ts). A relative value like `/`
 * works because the dev proxy (vite.config.ts) forwards `/api` and `/_` to
 * PocketBase, and in production PocketBase serves the built client itself
 * from the same origin.
 */
import PocketBase from 'pocketbase'

export const POCKETBASE_ENABLED = Boolean(import.meta.env.VITE_POCKETBASE_URL)

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || undefined)

export interface WorldRecord {
  id: string
  name: string
  auth_mode: 'open' | 'accounts'
  created_at: string
}

export interface PlayerRecord {
  id: string
  display_name: string
  email: string
  is_faculty: boolean
  world_id: string
  turtle_x: number
  turtle_y: number
  turtle_z: number
  turtle_facing: 'north' | 'south' | 'east' | 'west'
}

export interface BlockRecord {
  id: string
  world_id: string
  player_id: string
  x: number
  y: number
  z: number
  block_id: string
}

export interface ProgramRecord {
  id: string
  player_id: string
  world_id: string
  program_name: string
  json_content: unknown
  instruction_count: number
  thread_count: number
  submitted_at: string
}

/**
 * Picks "the" active world. There is no CLI world-selection wrapper yet
 * (design.md section 8 describes one but no build stage currently owns
 * writing it) so the most recently created world stands in for it — the
 * same convention server/pb_hooks/upload.pb.js uses for the Java upload
 * route. **NEEDS JAIME**: once that wrapper exists it should hand the
 * client an explicit world id instead (e.g. an env var or a config
 * endpoint) rather than relying on recency.
 */
export async function fetchActiveWorld(): Promise<WorldRecord | null> {
  try {
    const world = await pb.collection('worlds').getFirstListItem<WorldRecord>(
      'is_active = true'
    )
    return world
  } catch {
    // No active world set — fall back to most recently created
    try {
      const page = await pb.collection('worlds').getList<WorldRecord>(1, 1, {
        sort: '-created_at',
      })
      return page.items[0] ?? null
    } catch {
      return null
    }
  }
}
