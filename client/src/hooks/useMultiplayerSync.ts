/**
 * Syncs the local turtle's block placements and position to PocketBase, and
 * mirrors other players' block placements back into the scene in real time.
 * See design.md section 6 ("last write wins via upsert" on blocks) and
 * section 11 (multiplayer shared world).
 *
 * Deliberately kept separate from `WorldScene` (useWorld.ts): the scene is a
 * plain Three.js renderer with no knowledge of PocketBase, world ids, or
 * player ids (see that file's own header comment) — network state lives in
 * hooks, same as `usePocketbase`/`useSharedLink`. This hook is the seam
 * `useTurtle`'s `onBlockPlaced`/`onTurtleMoved` callbacks already existed
 * for ("Used to sync multiplayer" — they just weren't wired up yet).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { POCKETBASE_ENABLED, pb, type BlockRecord, type PlayerRecord, type WorldRecord } from '../lib/pocketbase'
import type { Vec3 } from '../lib/interpreter'
import type { WorldScene } from './useWorld'
import type { TurtleTransform } from './useTurtle'

export interface UseMultiplayerSyncOptions {
  world: WorldScene | null
  activeWorld: WorldRecord | null
  player: PlayerRecord | null
}

export interface UseMultiplayerSyncResult {
  /** Pass directly as `useTurtle`'s `onBlockPlaced`. */
  onBlockPlaced: (position: Vec3, blockId: string) => void
  /** Pass directly as `useTurtle`'s `onTurtleMoved`. */
  onTurtleMoved: (transform: TurtleTransform) => void
}

/**
 * Creates the block, or — on the (world_id, x, y, z) unique-index conflict
 * that means a block already exists there — updates it instead. Mirrors
 * `WorldScene.placeBlock`'s own "place (or replace)" semantics on the server.
 *
 * Every call passes `requestKey: null`. The JS SDK auto-cancels an in-flight
 * request the moment another one to the same collection+method starts (see
 * the SDK's "auto cancellation" behavior) — confirmed the hard way while
 * testing this against a real running server: a program that places more
 * than one block per tick (the normal case — flag.json places one block per
 * thread) had every write but the last one in that tick silently cancelled
 * (`ClientResponseError: The request was aborted`), because they're all
 * POSTs to the same `/api/collections/blocks/records` endpoint fired within
 * milliseconds of each other. That auto-cancellation assumption (only the
 * newest request to an endpoint matters) is correct for a search-as-you-type
 * list call but wrong here — each block write is a distinct, independent
 * mutation that must complete, not a stale duplicate.
 */
async function upsertBlock(worldId: string, playerId: string, position: Vec3, blockId: string): Promise<void> {
  try {
    await pb.collection('blocks').create<BlockRecord>(
      {
        world_id: worldId,
        player_id: playerId,
        x: position.x,
        y: position.y,
        z: position.z,
        block_id: blockId,
      },
      { requestKey: null },
    )
  } catch (error) {
    if (!(error instanceof ClientResponseError) || error.status !== 400) {
      console.error('Failed to sync placed block to server:', error)
      return
    }
    try {
      const existing = await pb.collection('blocks').getFirstListItem<BlockRecord>(
        pb.filter('world_id = {:world} && x = {:x} && y = {:y} && z = {:z}', {
          world: worldId,
          x: position.x,
          y: position.y,
          z: position.z,
        }),
        { requestKey: null },
      )
      await pb
        .collection('blocks')
        .update<BlockRecord>(existing.id, { player_id: playerId, block_id: blockId }, { requestKey: null })
    } catch (updateError) {
      console.error('Failed to upsert replaced block on server:', updateError)
    }
  }
}

export function useMultiplayerSync(options: UseMultiplayerSyncOptions): UseMultiplayerSyncResult {
  const { world, activeWorld, player } = options

  // Refs so the callbacks below always see the latest world/player without
  // needing to be re-created (and re-handed to useTurtle) on every change.
  const activeWorldRef = useRef(activeWorld)
  activeWorldRef.current = activeWorld
  const playerRef = useRef(player)
  playerRef.current = player

  const hydratedForWorldId = useRef<string | null>(null)

  // `WorldScene.blockCount` (read by App.tsx as `world?.blockCount` for the
  // Panel's "Blocks" stat) is a plain getter over imperative Three.js state,
  // not React state — so it only reflects reality at the next render this
  // component happens to do for some *other* reason (the tick loop's own
  // setTick() during a run, say). A client that placed nothing itself and is
  // just watching (hydration, or another player's blocks arriving over
  // realtime) never re-renders on its own, so the displayed count would
  // silently go stale. Confirmed by actually watching it happen against a
  // real server before adding this: a second browser sitting idle showed
  // "Blocks: 0" even after the block meshes had visibly appeared in its own
  // 3D view. `bump` exists purely to force a re-render after both of the
  // effects below touch the scene outside of React's own render cycle.
  const [, bump] = useState(0)

  // Hydrate: render every block already on the server for this world, once,
  // the first time the scene and the active world are both ready.
  useEffect(() => {
    if (!POCKETBASE_ENABLED || !world || !activeWorld) return
    if (hydratedForWorldId.current === activeWorld.id) return
    hydratedForWorldId.current = activeWorld.id

    let cancelled = false
    pb.collection('blocks')
      .getFullList<BlockRecord>({ filter: pb.filter('world_id = {:world}', { world: activeWorld.id }) })
      .then((existing) => {
        if (cancelled) return
        for (const block of existing) {
          world.placeBlock({ x: block.x, y: block.y, z: block.z }, block.block_id, false)
        }
        bump((n) => n + 1)
      })
      .catch((error: unknown) => {
        console.error('Failed to load existing blocks for this world:', error)
      })
    return () => {
      cancelled = true
    }
  }, [world, activeWorld])

  // Live sync: render blocks placed (or replaced) by other players as they
  // happen. Echoes of this client's own writes are harmless — placeBlock
  // no-ops when the same blockId is already at that position.
  useEffect(() => {
    if (!POCKETBASE_ENABLED || !world || !activeWorld) return

    const worldId = activeWorld.id
    pb.collection('blocks').subscribe<BlockRecord>('*', (e) => {
      if (e.record.world_id !== worldId) return
      if (e.action !== 'create' && e.action !== 'update') return
      world.placeBlock({ x: e.record.x, y: e.record.y, z: e.record.z }, e.record.block_id, true)
      bump((n) => n + 1)
    })

    return () => {
      pb.collection('blocks').unsubscribe('*')
    }
  }, [world, activeWorld])

  const onBlockPlaced = useCallback((position: Vec3, blockId: string) => {
    const currentWorld = activeWorldRef.current
    const currentPlayer = playerRef.current
    if (!POCKETBASE_ENABLED || !currentWorld || !currentPlayer) return
    void upsertBlock(currentWorld.id, currentPlayer.id, position, blockId)
  }, [])

  const onTurtleMoved = useCallback((transform: TurtleTransform) => {
    const currentPlayer = playerRef.current
    if (!POCKETBASE_ENABLED || !currentPlayer) return
    // Unlike upsertBlock, the SDK's default auto-cancellation (same
    // collection+method -> newest request wins, older ones are aborted) is
    // exactly right here: only the turtle's latest position is ever
    // meaningful, so letting a superseded in-flight PATCH get cancelled
    // instead of possibly resolving out of order and clobbering a newer
    // write is a feature, not a bug. requestKey is left at its default.
    void pb
      .collection('players')
      .update<PlayerRecord>(currentPlayer.id, {
        turtle_x: transform.position.x,
        turtle_y: transform.position.y,
        turtle_z: transform.position.z,
        turtle_facing: transform.facing,
      })
      .catch((error: unknown) => {
        console.error('Failed to sync turtle position to server:', error)
      })
  }, [])

  return { onBlockPlaced, onTurtleMoved }
}
