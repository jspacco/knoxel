/**
 * Getting a program into the browser: drop a file, paste JSON, load a
 * committed sample, or pick one that is already loaded.
 *
 * A real upload is one flat payload (`{email, program, threads}`); a bundled
 * file keyed `playerName -> programName -> payload` can carry several
 * programs. Both land in the same list — see `parseProgramFile`.
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

/** Ground truth sample files — see client/public/samples/, fetched by URL, never hardcoded inline. */
const SAMPLES = [
  { file: 'flag.json', label: 'Mauritius flag — single thread' },
  { file: 'pflag.json', label: 'Mauritius flag — 4 threads' },
  { file: 'pflag2.json', label: 'Mauritius flag — 4 threads, hex colors' },
]

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
  const [sampleLoading, setSampleLoading] = useState(false)
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

  const loadSample = useCallback(
    async (file: string) => {
      setSampleLoading(true)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}samples/${file}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        ingest(await response.text(), file)
      } catch (error) {
        onError(`${file}: could not be fetched (${error instanceof Error ? error.message : 'network error'}).`)
      } finally {
        setSampleLoading(false)
      }
    },
    [ingest, onError],
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

      <label className="slider-label" htmlFor="load-sample">
        Load sample
      </label>
      <select
        id="load-sample"
        value=""
        disabled={sampleLoading}
        onChange={(event) => {
          const file = event.target.value
          if (file) void loadSample(file)
        }}
      >
        <option value="">{sampleLoading ? 'Loading…' : 'Choose a sample…'}</option>
        {SAMPLES.map((sample) => (
          <option key={sample.file} value={sample.file}>
            {sample.label}
          </option>
        ))}
      </select>

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
