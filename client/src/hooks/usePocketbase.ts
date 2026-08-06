/**
 * Auth + session state for Stage 4. See design.md section 7.
 *
 * Accounts-mode sessions are PocketBase auth tokens, restored automatically
 * by the SDK's own localStorage-backed auth store. Open mode has no
 * password and therefore no token — its session (which player id, in which
 * world) is tracked in a small separate localStorage entry here.
 */
import { useCallback, useEffect, useState } from 'react'
import { ClientResponseError } from 'pocketbase'
import { fetchActiveWorld, pb, type PlayerRecord, type WorldRecord } from '../lib/pocketbase'

const OPEN_SESSION_KEY = 'knoxel_open_session'

interface OpenSession {
  playerId: string
  worldId: string
}

function loadOpenSession(): OpenSession | null {
  try {
    const raw = localStorage.getItem(OPEN_SESSION_KEY)
    return raw ? (JSON.parse(raw) as OpenSession) : null
  } catch {
    return null
  }
}

function saveOpenSession(session: OpenSession | null) {
  if (session) localStorage.setItem(OPEN_SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(OPEN_SESSION_KEY)
}

export function usePocketbase() {
  const [world, setWorld] = useState<WorldRecord | null>(null)
  const [worldLoading, setWorldLoading] = useState(true)
  const [worldError, setWorldError] = useState<string | null>(null)

  const [player, setPlayer] = useState<PlayerRecord | null>(null)
  const [playerLoading, setPlayerLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setWorldLoading(true)
    fetchActiveWorld()
      .then((found) => {
        if (cancelled) return
        setWorld(found)
        if (!found) setWorldError('No world is configured on this server yet.')
      })
      .catch((error: unknown) => {
        if (!cancelled) setWorldError(error instanceof Error ? error.message : 'Could not reach the server.')
      })
      .finally(() => {
        if (!cancelled) setWorldLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!world) {
      setPlayerLoading(false)
      return
    }
    let cancelled = false
    setPlayerLoading(true)
    ;(async () => {
      try {
        if (world.auth_mode === 'accounts') {
          if (pb.authStore.isValid && pb.authStore.record) {
            const record = await pb.collection('players').getOne<PlayerRecord>(pb.authStore.record.id)
            if (!cancelled) setPlayer(record)
          } else if (!cancelled) {
            setPlayer(null)
          }
        } else {
          const session = loadOpenSession()
          if (session && session.worldId === world.id) {
            try {
              const record = await pb.collection('players').getOne<PlayerRecord>(session.playerId)
              if (!cancelled) setPlayer(record)
            } catch {
              saveOpenSession(null)
              if (!cancelled) setPlayer(null)
            }
          } else if (!cancelled) {
            setPlayer(null)
          }
        }
      } finally {
        if (!cancelled) setPlayerLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [world])

  const loginOpen = useCallback(
    async (displayName: string, email: string) => {
      if (!world) throw new Error('No world loaded yet.')
      const trimmedEmail = email.trim()
      const trimmedName = displayName.trim()

      let record: PlayerRecord
      try {
        record = await pb
          .collection('players')
          .getFirstListItem<PlayerRecord>(pb.filter('email = {:email} && world_id = {:world}', { email: trimmedEmail, world: world.id }))
        if (record.display_name !== trimmedName) {
          record = await pb.collection('players').update<PlayerRecord>(record.id, { display_name: trimmedName })
        }
      } catch (error) {
        if (!(error instanceof ClientResponseError) || error.status !== 404) throw error
        record = await pb.collection('players').create<PlayerRecord>({
          display_name: trimmedName,
          email: trimmedEmail,
          world_id: world.id,
          turtle_facing: 'north',
        })
      }

      saveOpenSession({ playerId: record.id, worldId: world.id })
      setPlayer(record)
    },
    [world],
  )

  const loginAccounts = useCallback(async (email: string, password: string) => {
    const auth = await pb.collection('players').authWithPassword<PlayerRecord>(email.trim(), password)
    setPlayer(auth.record)
  }, [])

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!player) return
      const record = await pb.collection('players').update<PlayerRecord>(player.id, { display_name: displayName.trim() })
      setPlayer(record)
    },
    [player],
  )

  const logout = useCallback(() => {
    pb.authStore.clear()
    saveOpenSession(null)
    setPlayer(null)
  }, [])

  return {
    world,
    worldLoading,
    worldError,
    player,
    playerLoading,
    loginOpen,
    loginAccounts,
    updateDisplayName,
    logout,
  }
}
