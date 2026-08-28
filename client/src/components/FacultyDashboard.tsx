import { Fragment, useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  fetchActiveWorld,
  pb,
  type BlockRecord,
  type PlayerRecord,
  type ProgramRecord,
  type WorldRecord,
} from '../lib/pocketbase'
import { generateAccountsCsv, generateMemorablePassword, parseEmailList, type ProvisionResultItem } from '../lib/passwords'
import { navigate } from '../lib/router'

interface FacultyDashboardProps {
  adminEmail: string | null
  onLogout: () => void
  onJoinAsStudent: (world: WorldRecord) => Promise<PlayerRecord>
}

interface StudentSubmissionRow {
  playerId: string
  displayName: string
  email: string
  provisionedPassword?: string
  submissionCount: number
  lastUpload: string // ISO timestamp of most recent submission
  recentInstructionCount: number
  mostRecentThreadCount: number
  firstSubmittedAt: string
  totalBlocks: number
  status: 'active' | 'idle' | 'never'
  lastSeen?: string
  programs: ProgramRecord[]
}

type SortField =
  | 'displayName'
  | 'email'
  | 'provisionedPassword'
  | 'submissionCount'
  | 'lastUpload'
  | 'recentInstructionCount'
  | 'totalBlocks'
  | 'status'

type SortDirection = 'asc' | 'desc'

interface ProvisionBatchResults {
  items: ProvisionResultItem[]
  created: Array<{ email: string; password: string }>
  skipped: ProvisionResultItem[]
  errors: ProvisionResultItem[]
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function formatFilenameDate(isoString: string): string {
  if (!isoString) return 'unknown-date'
  // 2026-08-27T11:30:00.000Z -> 2026-08-27_11-30-00
  return isoString.replace(/[: ]/g, '-').replace(/\.\d+Z?$/, '')
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function FacultyDashboard({ adminEmail, onLogout, onJoinAsStudent }: FacultyDashboardProps) {
  const [world, setWorld] = useState<WorldRecord | null>(null)
  const [worldLoading, setWorldLoading] = useState(true)
  const [worldError, setWorldError] = useState<string | null>(null)

  const [players, setPlayers] = useState<PlayerRecord[]>([])
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [blocks, setBlocks] = useState<BlockRecord[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('lastUpload')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string>>(new Set())
  const [joiningStudent, setJoiningStudent] = useState(false)
  const [modeUpdating, setModeUpdating] = useState(false)

  // Account provisioning state
  const [rawEmailInput, setRawEmailInput] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [provisionResults, setProvisionResults] = useState<ProvisionBatchResults | null>(null)

  const loadWorldAndData = useCallback(async () => {
    setWorldLoading(true)
    setWorldError(null)
    setDataLoading(true)
    setDataError(null)

    let activeWorld: WorldRecord | null = null
    try {
      activeWorld = await fetchActiveWorld()
      setWorld(activeWorld)
      if (!activeWorld) {
        setWorldError('No active world found on this server.')
        setDataLoading(false)
        return
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not fetch active world.'
      setWorldError(msg)
      setDataLoading(false)
      return
    } finally {
      setWorldLoading(false)
    }

    try {
      const worldFilter = pb.filter('world_id = {:world}', { world: activeWorld.id })

      const [loadedPlayers, loadedPrograms, loadedBlocks] = await Promise.all([
        pb.collection('players').getFullList<PlayerRecord>({
          filter: worldFilter,
        }),
        pb.collection('programs').getFullList<ProgramRecord>({
          filter: worldFilter,
          sort: '-submitted_at',
        }),
        pb.collection('blocks').getFullList<BlockRecord>({
          filter: worldFilter,
        }),
      ])

      setPlayers(loadedPlayers)
      setPrograms(loadedPrograms)
      setBlocks(loadedBlocks)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load submissions data.'
      setDataError(msg)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorldAndData()
  }, [loadWorldAndData])

  async function handleJoinAsStudent() {
    if (!world) return
    setJoiningStudent(true)
    try {
      await onJoinAsStudent(world)
      navigate('/')
    } catch (err: unknown) {
      alert(`Could not join as student: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setJoiningStudent(false)
    }
  }

  // Part A — Auth mode toggle
  async function handleToggleAuthMode() {
    if (!world || modeUpdating) return
    const currentMode = world.auth_mode
    const nextMode = currentMode === 'open' ? 'accounts' : 'open'

    if (currentMode === 'open' && nextMode === 'accounts') {
      if (players.length > 0) {
        const confirmed = window.confirm(
          'Switching this world to Accounts Mode will require all students to log in with a password. ' +
            'Students already connected in Open Mode will lose access until given a password. Continue?',
        )
        if (!confirmed) return
      }
    }

    setModeUpdating(true)
    try {
      const updated = await pb.collection('worlds').update<WorldRecord>(world.id, {
        auth_mode: nextMode,
      })
      setWorld(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not change authentication mode.'
      alert(msg)
    } finally {
      setModeUpdating(false)
    }
  }

  // Part B — Account Provisioning
  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text === 'string') {
        setRawEmailInput(text)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleProvisionAccounts() {
    if (!world || provisioning) return
    const parsedEmails = parseEmailList(rawEmailInput)
    if (parsedEmails.length === 0) {
      alert('Please enter or upload at least one valid email address.')
      return
    }

    setProvisioning(true)
    const items: ProvisionResultItem[] = []
    const createdList: Array<{ email: string; password: string }> = []
    const skippedList: ProvisionResultItem[] = []
    const errorList: ProvisionResultItem[] = []

    const currentPlayersMap = new Map<string, PlayerRecord>()
    try {
      const freshPlayers = await pb.collection('players').getFullList<PlayerRecord>({
        filter: pb.filter('world_id = {:world}', { world: world.id }),
      })
      for (const p of freshPlayers) {
        currentPlayersMap.set(p.email.toLowerCase(), p)
      }
    } catch {
      for (const p of players) {
        currentPlayersMap.set(p.email.toLowerCase(), p)
      }
    }

    for (const email of parsedEmails) {
      const existing = currentPlayersMap.get(email)
      if (existing) {
        const item: ProvisionResultItem = {
          email,
          status: 'skipped',
          reason: `${email} already has an account — skipped`,
          password: existing.provisioned_password,
        }
        items.push(item)
        skippedList.push(item)
        continue
      }

      const password = generateMemorablePassword()
      try {
        const record = await pb.collection('players').create<PlayerRecord>({
          email,
          password,
          passwordConfirm: password,
          provisioned_password: password,
          world_id: world.id,
          turtle_facing: 'north',
        })
        currentPlayersMap.set(email, record)
        const item: ProvisionResultItem = {
          email,
          status: 'created',
          password,
        }
        items.push(item)
        createdList.push({ email, password })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const item: ProvisionResultItem = {
          email,
          status: 'error',
          reason: msg,
        }
        items.push(item)
        errorList.push(item)
      }
    }

    setProvisionResults({
      items,
      created: createdList,
      skipped: skippedList,
      errors: errorList,
    })

    await loadWorldAndData()
    setProvisioning(false)
  }

  function downloadProvisionedCsv() {
    if (!world || !provisionResults || provisionResults.created.length === 0) return
    const csvContent = generateAccountsCsv(provisionResults.created)
    const filename = `knoxel-${sanitizeFilename(world.name)}-passwords.csv`
    downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;')
  }

  // Groupings & Aggregations
  const playersById = useMemo(() => {
    const map = new Map<string, PlayerRecord>()
    for (const p of players) {
      map.set(p.id, p)
    }
    return map
  }, [players])

  const programsByPlayer = useMemo(() => {
    const map = new Map<string, ProgramRecord[]>()
    for (const prog of programs) {
      const list = map.get(prog.player_id) || []
      list.push(prog)
      map.set(prog.player_id, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    }
    return map
  }, [programs])

  const blocksCountByPlayer = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of blocks) {
      map.set(b.player_id, (map.get(b.player_id) || 0) + 1)
    }
    return map
  }, [blocks])

  const distinctSubmittingPlayerIds = useMemo(() => {
    return Array.from(programsByPlayer.keys())
  }, [programsByPlayer])

  // Part A — Summary header numbers
  const summaryStats = useMemo(() => {
    const submittingStudentCount = distinctSubmittingPlayerIds.length
    const totalInstructions = programs.reduce((sum, p) => sum + (p.instruction_count || 0), 0)
    const avgInstructions = programs.length > 0 ? totalInstructions / programs.length : 0

    let sumRatios = 0
    for (const pid of distinctSubmittingPlayerIds) {
      const studentBlocks = blocksCountByPlayer.get(pid) || 0
      const studentSubs = (programsByPlayer.get(pid) || []).length
      const ratio = studentSubs > 0 ? studentBlocks / studentSubs : 0
      sumRatios += ratio
    }
    const avgBlocksPerSubmission = submittingStudentCount > 0 ? sumRatios / submittingStudentCount : 0

    return {
      submittingStudentCount,
      avgInstructions,
      avgBlocksPerSubmission,
      totalPrograms: programs.length,
    }
  }, [distinctSubmittingPlayerIds, programs, blocksCountByPlayer, programsByPlayer])

  const allStudentIds = useMemo(() => {
    const set = new Set<string>()
    for (const p of players) {
      set.add(p.id)
    }
    for (const pid of distinctSubmittingPlayerIds) {
      set.add(pid)
    }
    return Array.from(set)
  }, [players, distinctSubmittingPlayerIds])

  // Part B & C — Per-student rows
  const studentRows = useMemo<StudentSubmissionRow[]>(() => {
    const now = Date.now()
    const fiveMinutesMs = 5 * 60 * 1000

    return allStudentIds.map((pid) => {
      const player = playersById.get(pid)
      const studentPrograms = programsByPlayer.get(pid) || []
      const mostRecentProg = studentPrograms[0]
      const firstProg = studentPrograms[studentPrograms.length - 1]

      let status: 'active' | 'idle' | 'never' = 'never'
      if (player?.last_seen) {
        const lastSeenMs = new Date(player.last_seen).getTime()
        if (!isNaN(lastSeenMs)) {
          status = now - lastSeenMs <= fiveMinutesMs ? 'active' : 'idle'
        }
      }

      return {
        playerId: pid,
        displayName: player?.display_name || (player?.email ? player.email.split('@')[0] : '(no name)'),
        email: player?.email || '(no email)',
        provisionedPassword: player?.provisioned_password,
        submissionCount: studentPrograms.length,
        lastUpload: mostRecentProg?.submitted_at || '',
        recentInstructionCount: mostRecentProg?.instruction_count || 0,
        mostRecentThreadCount: mostRecentProg?.thread_count || 1,
        firstSubmittedAt: firstProg?.submitted_at || '',
        totalBlocks: blocksCountByPlayer.get(pid) || 0,
        status,
        lastSeen: player?.last_seen,
        programs: studentPrograms,
      }
    })
  }, [allStudentIds, playersById, programsByPlayer, blocksCountByPlayer])

  // Filtering & Sorting
  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let rows = studentRows
    if (q) {
      rows = rows.filter(
        (r) =>
          r.displayName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.provisionedPassword && r.provisionedPassword.toLowerCase().includes(q)),
      )
    }

    return [...rows].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'displayName':
          cmp = a.displayName.localeCompare(b.displayName)
          break
        case 'email':
          cmp = a.email.localeCompare(b.email)
          break
        case 'provisionedPassword':
          cmp = (a.provisionedPassword || '').localeCompare(b.provisionedPassword || '')
          break
        case 'submissionCount':
          cmp = a.submissionCount - b.submissionCount
          break
        case 'lastUpload':
          cmp = new Date(a.lastUpload).getTime() - new Date(b.lastUpload).getTime()
          break
        case 'recentInstructionCount':
          cmp = a.recentInstructionCount - b.recentInstructionCount
          break
        case 'totalBlocks':
          cmp = a.totalBlocks - b.totalBlocks
          break
        case 'status': {
          const rank = { active: 1, idle: 2, never: 3 }
          cmp = rank[a.status] - rank[b.status]
          break
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [studentRows, searchQuery, sortField, sortDirection])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'lastUpload' || field === 'submissionCount' || field === 'totalBlocks' ? 'desc' : 'asc')
    }
  }

  function toggleExpandRow(playerId: string) {
    setExpandedPlayerIds((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  function downloadIndividualSubmission(displayName: string, program: ProgramRecord) {
    let content: string
    if (typeof program.json_content === 'string') {
      content = program.json_content
    } else {
      content = JSON.stringify(program.json_content)
    }

    const datePart = formatFilenameDate(program.submitted_at)
    const namePart = sanitizeFilename(displayName || 'student')
    const progPart = sanitizeFilename(program.program_name || 'program')
    const filename = `${namePart}-${progPart}-${datePart}.json`

    downloadBlob(content, filename, 'application/json')
  }

  function exportFullJson() {
    if (!world) return
    const exportEntries = programs.map((p) => {
      const player = playersById.get(p.player_id)
      return {
        player_display_name: player?.display_name || '',
        player_email: player?.email || '',
        program_name: p.program_name,
        submitted_at: p.submitted_at,
        instruction_count: p.instruction_count,
        thread_count: p.thread_count,
        json_content: p.json_content,
      }
    })

    const content = JSON.stringify(exportEntries, null, 2)
    const filename = `knoxel-${sanitizeFilename(world.name)}-all-submissions.json`
    downloadBlob(content, filename, 'application/json')
  }

  function exportCsvSummary() {
    if (!world) return
    const headers = [
      'Display Name',
      'Email',
      'Submission Count',
      'Most Recent Instruction Count',
      'Most Recent Thread Count',
      'First Submission Timestamp',
      'Last Submission Timestamp',
      'Total Blocks Placed',
    ]

    const rows = studentRows.map((s) => [
      s.displayName,
      s.email,
      s.submissionCount,
      s.recentInstructionCount,
      s.mostRecentThreadCount,
      s.firstSubmittedAt,
      s.lastUpload,
      s.totalBlocks,
    ])

    const csvContent = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')

    const filename = `knoxel-${sanitizeFilename(world.name)}-summary.csv`
    downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;')
  }

  function formatStatNumber(num: number): string {
    return Number.isInteger(num) ? num.toString() : num.toFixed(1)
  }

  const tableColSpan = world?.auth_mode === 'accounts' ? 9 : 8

  return (
    <div className="faculty-screen">
      {/* Header */}
      <header className="faculty-header">
        <div className="faculty-header-left">
          <h1 className="faculty-title">Faculty Panel</h1>
          {world && (
            <div className="faculty-world-badge">
              <span className="world-name">{world.name}</span>
              <span className={`world-mode world-mode-${world.auth_mode}`}>
                {world.auth_mode === 'open' ? 'Open Mode' : 'Accounts Mode'}
              </span>
              <button
                type="button"
                className="button button-small mode-toggle-button"
                onClick={handleToggleAuthMode}
                disabled={modeUpdating}
                title={`Switch world to ${world.auth_mode === 'open' ? 'Accounts' : 'Open'} Mode`}
              >
                {modeUpdating
                  ? 'Updating…'
                  : world.auth_mode === 'open'
                  ? 'Switch to Accounts Mode'
                  : 'Switch to Open Mode'}
              </button>
            </div>
          )}
        </div>

        <div className="faculty-header-actions">
          {adminEmail && <span className="faculty-admin-email muted small">{adminEmail}</span>}
          {world && (
            <button
              type="button"
              className="button button-primary button-small"
              onClick={handleJoinAsStudent}
              disabled={joiningStudent}
            >
              {joiningStudent ? 'Joining…' : 'Join as Student'}
            </button>
          )}
          <button type="button" className="button button-small" onClick={loadWorldAndData} disabled={dataLoading}>
            Refresh
          </button>
          <button type="button" className="button button-small" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </header>

      {/* Main content scroll container */}
      <div className="faculty-body">
        {worldLoading && <div className="faculty-status-message">Loading active world…</div>}

        {worldError && (
          <div className="faculty-status-message faculty-error">
            <p>{worldError}</p>
            <button type="button" className="button button-small" onClick={loadWorldAndData} style={{ marginTop: '8px' }}>
              Retry
            </button>
          </div>
        )}

        {world && !worldLoading && (
          <>
            {/* Part B — Account Provisioning Section (Accounts Mode only) */}
            {world.auth_mode === 'accounts' && (
              <section className="faculty-section faculty-accounts-section">
                <div className="faculty-accounts-header">
                  <div>
                    <h2 className="faculty-section-title">Account Provisioning</h2>
                    <p className="faculty-section-desc muted small">
                      Upload or paste student Knox emails (one per line) to generate memorable passwords and create PocketBase auth accounts.
                    </p>
                  </div>
                </div>

                <div className="faculty-accounts-body">
                  <div className="faculty-accounts-form">
                    <label className="field">
                      <span className="field-label-text">
                        Student Knox emails <span className="muted small">(one per line, plain text or CSV)</span>
                      </span>
                      <textarea
                        className="faculty-emails-textarea font-mono"
                        rows={4}
                        value={rawEmailInput}
                        onChange={(e) => setRawEmailInput(e.target.value)}
                        placeholder={'alice@knox.edu\nbob@knox.edu\ncarol@knox.edu'}
                        disabled={provisioning}
                      />
                    </label>

                    <div className="faculty-accounts-actions">
                      <label className="button button-small faculty-file-upload-label">
                        Upload .txt / .csv
                        <input
                          type="file"
                          accept=".txt,.csv,text/plain,text/csv"
                          onChange={handleFileUpload}
                          disabled={provisioning}
                          style={{ display: 'none' }}
                        />
                      </label>

                      <button
                        type="button"
                        className="button button-primary button-small"
                        onClick={handleProvisionAccounts}
                        disabled={provisioning || !rawEmailInput.trim()}
                      >
                        {provisioning ? 'Provisioning Accounts…' : 'Generate & Provision Accounts'}
                      </button>

                      {rawEmailInput && (
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => {
                            setRawEmailInput('')
                            setProvisionResults(null)
                          }}
                          disabled={provisioning}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Provisioning Results */}
                  {provisionResults && (
                    <div className="faculty-provision-results">
                      <div className="faculty-provision-summary">
                        <div className="provision-summary-stats">
                          <span className="summary-stat-badge stat-created">
                            {provisionResults.created.length} created
                          </span>
                          <span className="summary-stat-badge stat-skipped">
                            {provisionResults.skipped.length} skipped
                          </span>
                          {provisionResults.errors.length > 0 && (
                            <span className="summary-stat-badge stat-error">
                              {provisionResults.errors.length} error{provisionResults.errors.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>

                        {provisionResults.created.length > 0 && (
                          <button
                            type="button"
                            className="button button-primary button-small"
                            onClick={downloadProvisionedCsv}
                          >
                            Download CSV ({provisionResults.created.length} passwords)
                          </button>
                        )}
                      </div>

                      <div className="faculty-provision-list-container">
                        <table className="faculty-provision-table">
                          <thead>
                            <tr>
                              <th>Email</th>
                              <th>Status</th>
                              <th>Password / Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {provisionResults.items.map((item, idx) => (
                              <tr key={idx} className={`provision-row-${item.status}`}>
                                <td className="font-mono">{item.email}</td>
                                <td>
                                  <span className={`status-pill provision-pill-${item.status}`}>
                                    {item.status === 'created'
                                      ? 'Created'
                                      : item.status === 'skipped'
                                      ? 'Skipped'
                                      : 'Error'}
                                  </span>
                                </td>
                                <td>
                                  {item.status === 'created' ? (
                                    <code className="password-badge font-mono">{item.password}</code>
                                  ) : (
                                    <span className="muted small">{item.reason}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Part A — Summary Header Stats */}
            <section className="faculty-section faculty-summary-section">
              <div className="faculty-metrics-grid">
                <div className="faculty-metric-card">
                  <div className="faculty-metric-value">{summaryStats.submittingStudentCount}</div>
                  <div className="faculty-metric-label">Students with Submissions</div>
                  <div className="faculty-metric-desc muted small">
                    Distinct students with ≥ 1 upload in this world
                  </div>
                </div>

                <div className="faculty-metric-card">
                  <div className="faculty-metric-value">{formatStatNumber(summaryStats.avgInstructions)}</div>
                  <div className="faculty-metric-label">Avg Instructions / Submission</div>
                  <div className="faculty-metric-desc muted small">
                    Across {summaryStats.totalPrograms} total upload{summaryStats.totalPrograms === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="faculty-metric-card">
                  <div className="faculty-metric-value">{formatStatNumber(summaryStats.avgBlocksPerSubmission)}</div>
                  <div className="faculty-metric-label">Avg Blocks / Submission</div>
                  <div className="faculty-metric-desc muted small">
                    Student average of blocks placed per submission
                  </div>
                </div>
              </div>
            </section>

            {/* Part B & C — Table and Export Actions */}
            <section className="faculty-section faculty-table-section">
              <div className="faculty-toolbar">
                <div className="faculty-search-box">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by name or email…"
                    className="faculty-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="link-button faculty-clear-search"
                      onClick={() => setSearchQuery('')}
                    >
                      clear
                    </button>
                  )}
                </div>

                <div className="faculty-export-buttons">
                  <button
                    type="button"
                    className="button button-small"
                    onClick={exportFullJson}
                    disabled={programs.length === 0}
                    title="Download one JSON file containing every submission in this world"
                  >
                    Export All Submissions (JSON)
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    onClick={exportCsvSummary}
                    disabled={studentRows.length === 0}
                    title="Download a CSV summary of all submitting students"
                  >
                    Export Summary (CSV)
                  </button>
                </div>
              </div>

              {dataLoading && <div className="faculty-status-message">Loading submissions data…</div>}

              {dataError && <div className="faculty-status-message faculty-error">{dataError}</div>}

              {!dataLoading && !dataError && (
                <div className="faculty-table-container">
                  <table className="faculty-table">
                    <thead>
                      <tr>
                        <th style={{ width: '32px' }}></th>
                        <th onClick={() => toggleSort('displayName')} className="sortable-th">
                          Display Name {sortField === 'displayName' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => toggleSort('email')} className="sortable-th">
                          Email {sortField === 'email' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        {world.auth_mode === 'accounts' && (
                          <th onClick={() => toggleSort('provisionedPassword')} className="sortable-th">
                            Password {sortField === 'provisionedPassword' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                        )}
                        <th onClick={() => toggleSort('submissionCount')} className="sortable-th numeric-th">
                          Submissions {sortField === 'submissionCount' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => toggleSort('lastUpload')} className="sortable-th">
                          Last Upload {sortField === 'lastUpload' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => toggleSort('recentInstructionCount')} className="sortable-th numeric-th">
                          Recent Instructions{' '}
                          {sortField === 'recentInstructionCount' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => toggleSort('totalBlocks')} className="sortable-th numeric-th">
                          Blocks Placed {sortField === 'totalBlocks' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th onClick={() => toggleSort('status')} className="sortable-th">
                          Status {sortField === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={tableColSpan} className="empty-table-cell muted">
                            {searchQuery
                              ? `No student matching "${searchQuery}" found.`
                              : 'No submissions yet in this world.'}
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedRows.map((student) => {
                          const isExpanded = expandedPlayerIds.has(student.playerId)
                          return (
                            <Fragment key={student.playerId}>
                              <tr
                                className={`faculty-row ${isExpanded ? 'faculty-row-expanded' : ''}`}
                                onClick={() => toggleExpandRow(student.playerId)}
                              >
                                <td className="expand-cell">
                                  <span className="expand-indicator">{isExpanded ? '▼' : '▶'}</span>
                                </td>
                                <td className="student-name-cell font-weight-medium">{student.displayName}</td>
                                <td className="student-email-cell muted">{student.email}</td>
                                {world.auth_mode === 'accounts' && (
                                  <td className="password-cell font-mono">
                                    {student.provisionedPassword ? (
                                      <code className="password-badge">{student.provisionedPassword}</code>
                                    ) : (
                                      <span className="muted">—</span>
                                    )}
                                  </td>
                                )}
                                <td className="numeric-cell font-mono">{student.submissionCount}</td>
                                <td className="timestamp-cell">{formatDate(student.lastUpload)}</td>
                                <td className="numeric-cell font-mono">{student.recentInstructionCount}</td>
                                <td className="numeric-cell font-mono">{student.totalBlocks}</td>
                                <td className="status-cell">
                                  <span className={`status-pill status-${student.status}`}>
                                    <span className="status-dot"></span>
                                    {student.status === 'active'
                                      ? 'Active'
                                      : student.status === 'idle'
                                      ? 'Idle'
                                      : 'Never connected'}
                                  </span>
                                </td>
                              </tr>

                              {/* Drill-down expanded submissions row */}
                              {isExpanded && (
                                <tr className="drilldown-row">
                                  <td colSpan={tableColSpan} className="drilldown-container">
                                    <div className="drilldown-content">
                                      <div className="drilldown-header">
                                        <div className="drilldown-header-title">
                                          <h4>Submissions for {student.displayName} ({student.programs.length})</h4>
                                          {world.auth_mode === 'accounts' && student.provisionedPassword && (
                                            <div className="drilldown-student-password muted small">
                                              Password: <code className="password-badge">{student.provisionedPassword}</code>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <table className="drilldown-table">
                                        <thead>
                                          <tr>
                                            <th>Program Name</th>
                                            <th>Submitted At</th>
                                            <th className="numeric-th">Instructions</th>
                                            <th className="numeric-th">Threads</th>
                                            <th style={{ width: '120px' }}>Action</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {student.programs.map((prog) => (
                                            <tr key={prog.id} className="drilldown-item-row">
                                              <td className="prog-name-cell font-mono">{prog.program_name}</td>
                                              <td className="prog-date-cell">{formatDate(prog.submitted_at)}</td>
                                              <td className="numeric-cell font-mono">{prog.instruction_count}</td>
                                              <td className="numeric-cell font-mono">{prog.thread_count}</td>
                                              <td>
                                                <button
                                                  type="button"
                                                  className="button button-small download-btn"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    downloadIndividualSubmission(student.displayName, prog)
                                                  }}
                                                >
                                                  Download JSON
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
