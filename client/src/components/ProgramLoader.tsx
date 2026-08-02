/**
 * Getting a program into the browser: drop a file, paste JSON, or pick one
 * that is already loaded.
 *
 * A single KnoxCraftMod file is `playerName -> programName -> payload`, so one
 * file can carry several programs. They all land in the same list.
 */

import { useCallback, useRef, useState } from 'react'
import {
  instructionCount,
  parseProgramFile,
  threadTickCount,
  type ParsedProgram,
} from '../lib/interpreter'

export interface ProgramLoaderProps {
  programs: ParsedProgram[]
  selectedIndex: number
  onSelect: (index: number) => void
  onLoaded: (programs: ParsedProgram[], sourceLabel: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

export function ProgramLoader({
  programs,
  selectedIndex,
  onSelect,
  onLoaded,
  onError,
  disabled,
}: ProgramLoaderProps) {
  const [dragging, setDragging] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ingest = useCallback(
    (text: string, sourceLabel: string) => {
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch (error) {
        onError(`${sourceLabel}: not valid JSON (${error instanceof Error ? error.message : 'parse error'}).`)
        return
      }
      const { programs: parsed, issues } = parseProgramFile(json)
      for (const issue of issues) onError(`${sourceLabel}: ${issue.message}`)
      if (parsed.length > 0) onLoaded(parsed, sourceLabel)
    },
    [onLoaded, onError],
  )

  const readFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        try {
          ingest(await file.text(), file.name)
        } catch (error) {
          onError(`${file.name}: could not be read (${error instanceof Error ? error.message : 'read error'}).`)
        }
      }
    },
    [ingest, onError],
  )

  return (
    <section className="panel-section">
      <h2>Programs</h2>

      <div
        className={`dropzone${dragging ? ' dropzone-active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (event.dataTransfer.files.length > 0) void readFiles(event.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
        }}
      >
        <strong>Drop a KnoxCraft JSON file</strong>
        <span>or click to browse</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void readFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      <button type="button" className="link-button" onClick={() => setPasteOpen((open) => !open)}>
        {pasteOpen ? 'Hide paste box' : 'Paste JSON instead'}
      </button>

      {pasteOpen && (
        <div className="paste-box">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder='{"lucky_creeper": {"flag": {"instructions": [...]}}}'
            rows={5}
            spellCheck={false}
          />
          <button
            type="button"
            className="button"
            disabled={pasteText.trim().length === 0}
            onClick={() => {
              ingest(pasteText, 'pasted JSON')
              setPasteText('')
            }}
          >
            Load pasted JSON
          </button>
        </div>
      )}

      {programs.length === 0 ? (
        <p className="muted">No programs loaded yet.</p>
      ) : (
        <ul className="program-list">
          {programs.map((program, index) => (
            <li key={`${program.playerName}/${program.programName}/${index}`}>
              <button
                type="button"
                className={`program-item${index === selectedIndex ? ' program-item-selected' : ''}`}
                onClick={() => onSelect(index)}
                disabled={disabled}
              >
                <span className="program-name">{program.programName}</span>
                <span className="program-meta">
                  {program.playerName} · {instructionCount(program)} instr ·{' '}
                  {program.threads.length} thread{program.threads.length === 1 ? '' : 's'} ·{' '}
                  {Math.max(...program.threads.map(threadTickCount))} ticks
                </span>
                {program.description && <span className="program-desc">{program.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
