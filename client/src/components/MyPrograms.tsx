/**
 * Programs the logged-in player has already uploaded — from the browser or
 * from `turtle.upload()` in Java. Stage 4 verify step: "student ... can see
 * program list" (CLAUDE.md).
 */
import { useEffect, useState } from 'react'
import { pb, type PlayerRecord, type ProgramRecord } from '../lib/pocketbase'
import { parsePayload, type ParsedProgram } from '../lib/interpreter'

export interface MyProgramsProps {
  player: PlayerRecord
  onLoaded: (programs: ParsedProgram[], sourceLabel: string) => void
  onError: (message: string) => void
}

export function MyPrograms({ player, onLoaded, onError }: MyProgramsProps) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    pb.collection('programs')
      .getFullList<ProgramRecord>({
        filter: pb.filter('player_id = {:id}', { id: player.id }),
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
  }, [player.id, onError])

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
