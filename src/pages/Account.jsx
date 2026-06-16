import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Gem } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getWallet } from '../lib/api'
import useSiteMode from '../hooks/useSiteMode'
import UsernameAccountCard from '../components/UsernameAccountCard'
import '../styles/mode-pages.css'
import '../styles/username-rewards.css'

export default function Account() {
  const { user, profile, isAdmin, isVip, signOut } = useAuth()
  const { isAiMode } = useSiteMode()
  const [wallet, setWallet] = useState({ points_balance: 0 })

  useEffect(() => {
    if (user) getWallet().then(setWallet).catch(() => setWallet({ points_balance: 0 }))
  }, [user])

  return (
    <div className="page narrow account-page-stack">
      <section className="card account-card mode-padded-card">
        <span className="eyebrow">Settings</span>
        <h1>{isAiMode ? 'AI Studio Account' : 'Account'}</h1>
        <div className="info-list">
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Username:</strong> {profile?.username ? `@${profile.username}` : 'Not created yet'}</p>
          <p><strong>Role:</strong> {isAdmin ? 'Admin' : 'User'}</p>
          <p><strong>{isAiMode ? 'Membership' : 'VIP'}:</strong> {isVip ? 'Active' : 'Inactive'}</p>
          <p><strong>Points:</strong> <Gem size={14} /> {wallet.points_balance || 0}</p>
          <p><strong>Joined:</strong> {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</p>
        </div>
        <div className="actions vertical">
          {isAiMode ? (
            <Link className="button full" to="/ai-studio"><Bot size={16} /> Open AI Studio</Link>
          ) : (
            <Link className="button full" to="/library">Open Library</Link>
          )}
          <Link className="ghost-button full" to="/points">Buy Points</Link>
          {!isAiMode && <Link className="ghost-button full" to="/vip">View VIP</Link>}
          {isAdmin && <Link className="ghost-button full" to="/admin">Admin Panel</Link>}
          <button className="ghost-button full" onClick={signOut}>Logout</button>
        </div>
      </section>

      <UsernameAccountCard />
    </div>
  )
}
