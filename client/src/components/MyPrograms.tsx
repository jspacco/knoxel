/**
 * Programs the logged-in player has already uploaded — from the browser or
 * from `turtle.upload()` in Java. Stage 4 verify step: "student ... can see
 * program list" (CLAUDE.md).
 *
 * Live: a Java-client upload arrives as a `programs` realtime create event,
 * not a browser action, so there's no natural moment to re-fetch — without a
 * subscription a student has to manually refresh or log out/in to see it.
 */
import { useEffect, useState } from 'react'
import { pb, type PlayerRecord, type ProgramRecord, type WorldRecord } from '../lib/pocketbase'
import { parsePayload, type ParsedProgram } from '../lib/interpreter'

export interface MyProgramsProps {
  player: PlayerRecord
  activeWorld: WorldRecord
  onLoaded: (programs: ParsedProgram[], sourceLabel: string) => void
  onError: (message: string) => void
}

export function MyPrograms({ player, activeWorld, onLoaded, onError }: MyProgramsProps) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    pb.collection('programs')
      .getFullList<ProgramRecord>({
        filter: pb.filter('player_id = {:player} && world_id = {:world}', { player: player.id, world: activeWorld.id }),
        sort: '-submitted_at',
      })
      .then((items) => {
        if (!cancelled) setPrograms(items)
      })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error.message : 'Could not load your programs.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [player.id, activeWorld.id, onError])

  // Realtime: prepend a newly uploaded program the moment it lands, filtered
  // to this player + world exactly like the initial fetch above. Guard
  // against the small window where the create event and the initial fetch
  // above could both deliver the same record (component mount timing).
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    pb.collection('programs')
      .subscribe<ProgramRecord>('*', (e) => {
        if (e.action !== 'create') return
        if (e.record.player_id !== player.id || e.record.world_id !== activeWorld.id) return
        setPrograms((prev) => (prev.some((p) => p.id === e.record.id) ? prev : [e.record, ...prev]))
      })
      .then((unsub) => {
        if (cancelled) unsub()
        else unsubscribe = unsub
      })
      .catch((error: unknown) => {
        console.error('Failed to subscribe to program uploads:', error)
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [player.id, activeWorld.id])

  const loadProgram = (record: ProgramRecord) => {
    const threads = parsePayload(record.json_content as Parameters<typeof parsePayload>[0]).filter((t) => t.length > 0)
    if (threads.length === 0) {
      onError(`${record.program_name}: no instructions found.`)
      return
    }
    onLoaded(
      [
        {
          playerName: player.display_name,
          programName: record.program_name,
          threads,
        },
      ],
      `server (${record.program_name})`,
    )
  }

  return (
    <section className="panel-section">
      <h2>My programs</h2>
      {loading && <p className="muted small">Loading…</p>}
      {!loading && programs.length === 0 && <p className="muted small">Nothing uploaded yet.</p>}
      {!loading && programs.length > 0 && (
        <ul className="program-list">
          {programs.map((record) => (
            <li key={record.id}>
              <button type="button" className="program-item" onClick={() => loadProgram(record)}>
                <span className="program-name">{record.program_name}</span>
                <span className="program-meta">
                  {record.instruction_count} instr · {record.thread_count} thread{record.thread_count === 1 ? '' : 's'} ·{' '}
                  {new Date(record.submitted_at).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
