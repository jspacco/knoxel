/**
 * Full-screen login gate shown before a player is identified. See
 * design.md section 7 — open mode asks for a display name + Knox email and
 * never a password; accounts mode asks for the email + password faculty
 * distributed via the Stage 5.5 CSV export.
 */
import { useState, type FormEvent } from 'react'
import type { WorldRecord } from '../lib/pocketbase'

export interface LoginProps {
  world: WorldRecord | null
  worldLoading: boolean
  worldError: string | null
  onLoginOpen: (displayName: string, email: string) => Promise<void>
  onLoginAccounts: (email: string, password: string) => Promise<void>
  /**
   * Accounts-mode players are provisioned by faculty (Stage 5.5) with only
   * an email + password — there's nowhere for a display name to come from
   * until the student picks one here, after they've authenticated.
   */
  needsDisplayName?: boolean
  onSetDisplayName?: (displayName: string) => Promise<void>
}

export function Login({
  world,
  worldLoading,
  worldError,
  onLoginOpen,
  onLoginAccounts,
  needsDisplayName,
  onSetDisplayName,
}: LoginProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (needsDisplayName) {
        await onSetDisplayName?.(displayName)
      } else if (world?.auth_mode === 'accounts') {
        await onLoginAccounts(email, password)
      } else if (world) {
        await onLoginOpen(displayName, email)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Knoxel</h1>

        {!needsDisplayName && worldLoading && <p className="muted">Connecting…</p>}

        {!needsDisplayName && !worldLoading && worldError && <p className="login-error">{worldError}</p>}

        {needsDisplayName ? (
          <form onSubmit={handleSubmit}>
            <label className="field">
              Pick a display name
              <span className="muted small">shown on your turtle's nameplate in the world</span>
              <input
                type="text"
                required
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="lucky_creeper"
              />
            </label>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Continue'}
            </button>
          </form>
        ) : (
          !worldLoading &&
          world && (
            <form onSubmit={handleSubmit}>
              {world.auth_mode === 'accounts' ? (
                <>
                  <label className="field">
                    Knox email
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jdoe@knox.edu"
                    />
                  </label>
                  <label className="field">
                    Password
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="maple-river-22"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="field">
                    Display name
                    <input
                      type="text"
                      required
                      autoFocus
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="lucky_creeper"
                    />
                  </label>
                  <label className="field">
                    Knox email
                    <span className="muted small">so your instructor can identify your submissions</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jdoe@knox.edu"
                    />
                  </label>
                </>
              )}

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="button button-primary" disabled={submitting}>
                {submitting ? 'Connecting…' : 'Enter world'}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  )
}
