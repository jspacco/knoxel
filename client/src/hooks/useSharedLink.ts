/**
 * Tier 1 (static GitHub Pages) landing behaviour: `?id=<id>` names a program
 * the Java client stashed in the Cloudflare Worker's KV store. Fetch it once
 * on mount and hand the parsed program to `onLoaded` so it lands in the same
 * program list a drag-and-drop file would. See design.md section 3 (Tier 1)
 * and the "Student flow — static tier" / "Landing page behavior" notes in
 * section 13.
 */
import { useEffect, useRef, useState } from 'react'
import { parseProgramFile, type ParsedProgram } from '../lib/interpreter'

const WORKER_URL = import.meta.env.VITE_WORKER_URL

export type SharedLinkStatus = 'none' | 'loading' | 'loaded' | 'error'

export interface UseSharedLinkResult {
  status: SharedLinkStatus
  errorMessage: string | null
}

export function useSharedLink(
  onLoaded: (programs: ParsedProgram[], sourceLabel: string) => void,
): UseSharedLinkResult {
  const [status, setStatus] = useState<SharedLinkStatus>('none')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const startedRef = useRef(false)
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const url = new URL(window.location.href)
    const id = url.searchParams.get('id')
    if (!id) return

    // Drop ?id= from the visible URL right away — reloading should show the
    // ordinary drag-and-drop landing page, not re-fetch (or re-fail on) a
    // link that may since have expired.
    url.searchParams.delete('id')
    window.history.replaceState({}, '', url.toString())

    if (!WORKER_URL) {
      setStatus('error')
      setErrorMessage('This build has no Cloudflare Worker configured — drag your JSON file here instead.')
      return
    }

    setStatus('loading')

    void (async () => {
      try {
        const response = await fetch(`${WORKER_URL}/?id=${encodeURIComponent(id)}`)

        if (response.status === 404) {
          setStatus('error')
          setErrorMessage(
            'This link has expired. Re-run your Java program to generate a new link, or drag your JSON file here.',
          )
          return
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const json = JSON.parse(await response.text())
        const { programs, issues } = parseProgramFile(json)

        if (programs.length > 0) {
          setStatus('loaded')
          onLoadedRef.current(programs, `shared link (${id})`)
          return
        }

        setStatus('error')
        setErrorMessage(issues[0]?.message ?? 'The shared program was empty.')
      } catch (error) {
        setStatus('error')
        setErrorMessage(
          `Could not load the shared program (${error instanceof Error ? error.message : 'network error'}). Drag your JSON file here instead.`,
        )
      }
    })()
  }, [])

  return { status, errorMessage }
}
