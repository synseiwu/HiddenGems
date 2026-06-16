import { useEffect, useState } from 'react'
import { AtSign, Gift, X } from 'lucide-react'
import { createUsername, getUsernameStatus } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/username-rewards.css'

export default function UsernamePrompt() {
  const { user, rewardNotice } = useAuth()
  const [status, setStatus] = useState(null)
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState(false)

  async function refresh() {
    if (!user) return
    const next = await getUsernameStatus().catch(() => null)
    setStatus(next)
  }

  useEffect(() => { refresh() }, [user])

  if (!user || rewardNotice || closed || !status || status.has_username) return null

  const settings = status.settings || {}
  if (settings.require_username_on_login === false) return null

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const result = await createUsername(username)
      setMessage(result.points_awarded > 0 ? `Username created. ${result.points_awarded} points added to your wallet.` : 'Username created.')
      window.setTimeout(() => setClosed(true), 1200)
    } catch (err) {
      setMessage(err.message || 'Could not create username.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="username-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create your username">
      <section className="card username-modal-card">
        {settings.allow_username_skip && (
          <button className="username-modal-close" type="button" onClick={() => setClosed(true)} aria-label="Close username prompt">
            <X size={18} />
          </button>
        )}

        <div className="username-modal-icon"><AtSign size={34} /></div>
        <span className="eyebrow">Create username</span>
        <h2>Choose your username</h2>
        <p>Pick a username so people can find and DM you easier. You will receive <strong>{settings.username_bonus_points || 100} bonus points</strong> after creating it.</p>

        <form onSubmit={submit} className="username-form">
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="example_name"
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={24}
            />
          </label>
          <small>Use 3-24 letters, numbers, underscores, or dots. No spaces.</small>
          <button className="button full" disabled={busy || username.trim().length < 3}>
            <Gift size={16} />
            {busy ? 'Creating...' : 'Create Username'}
          </button>
        </form>

        {message && <p className={message.includes('points') || message.includes('created') ? 'notice-text' : 'error-text'}>{message}</p>}
      </section>
    </div>
  )
}
