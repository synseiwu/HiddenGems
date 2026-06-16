import { useEffect, useState } from 'react'
import { AtSign, Gift } from 'lucide-react'
import { createUsername, getUsernameStatus, updateUsername } from '../lib/api'
import '../styles/username-rewards.css'

export default function UsernameAccountCard() {
  const [status, setStatus] = useState(null)
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const next = await getUsernameStatus().catch(() => null)
    setStatus(next)
    setUsername(next?.username || '')
  }

  useEffect(() => { refresh() }, [])

  if (!status) return null

  const settings = status.settings || {}
  const canChange = status.has_username && settings.allow_username_changes
  const canCreate = !status.has_username

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      const result = canCreate ? await createUsername(username) : await updateUsername(username)
      if (canCreate && result.points_awarded > 0) {
        setMessage(`Username created. ${result.points_awarded} points added to your wallet.`)
      } else {
        setMessage(canCreate ? 'Username created.' : 'Username updated.')
      }
      await refresh()
    } catch (err) {
      setMessage(err.message || 'Could not save username.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card username-account-card">
      <AtSign size={26} />
      <div>
        <span className="eyebrow">Username</span>
        <h2>{status.has_username ? `@${status.username}` : 'Create your username'}</h2>
        <p>Username helps other users find you in DMs.</p>
        {status.username_bonus_claimed && <small><Gift size={14} /> Username bonus already claimed.</small>}
      </div>

      {(canCreate || canChange) ? (
        <form onSubmit={submit} className="username-inline-form">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" maxLength={24} />
          <button className="button" disabled={busy || username.trim().length < 3}>{busy ? 'Saving...' : canCreate ? 'Create' : 'Update'}</button>
        </form>
      ) : (
        <p className="muted">Username changes are currently disabled.</p>
      )}

      {message && <p className={message.includes('Could') || message.includes('invalid') || message.includes('taken') ? 'error-text' : 'notice-text'}>{message}</p>}
    </section>
  )
}
