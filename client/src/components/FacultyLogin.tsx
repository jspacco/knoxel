import { useState, type FormEvent } from 'react'
import { navigate } from '../lib/router'

interface FacultyLoginProps {
  onLogin: (email: string, password: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function FacultyLogin({ onLogin, loading, error }: FacultyLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (!email.trim()) {
      setLocalError('Please enter your email.')
      return
    }
    if (!password) {
      setLocalError('Please enter your password.')
      return
    }
    try {
      await onLogin(email, password)
    } catch {
      // Error handled by parent / hook
    }
  }

  const displayError = localError || error

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Faculty Panel</h1>
        <p className="muted small" style={{ marginBottom: '16px' }}>
          Sign in with your PocketBase admin / superuser account.
        </p>

        {displayError && <div className="login-error">{displayError}</div>}

        <label className="field">
          Admin Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            autoComplete="username"
            placeholder="admin@knox.edu"
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>

        <button type="submit" className="button button-primary" disabled={loading} style={{ marginTop: '8px' }}>
          {loading ? 'Signing in…' : 'Sign In as Faculty'}
        </button>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button type="button" className="link-button" onClick={() => navigate('/')}>
            ← Return to Student View
          </button>
        </div>
      </form>
    </div>
  )
}
