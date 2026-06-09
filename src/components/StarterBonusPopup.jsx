import { Link } from 'react-router-dom'
import { Gift, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function StarterBonusPopup() {
  const { starterBonus, clearStarterBonus } = useAuth()

  if (!starterBonus) return null

  return (
    <div className="starter-bonus-backdrop" role="dialog" aria-modal="true" aria-label="Starter points awarded">
      <div className="card starter-bonus-card">
        <button className="starter-bonus-close" onClick={clearStarterBonus} aria-label="Close starter bonus popup">
          <X size={18} />
        </button>

        <div className="starter-bonus-icon">
          <Gift size={34} />
        </div>

        <span className="eyebrow">Starter Bonus</span>
        <h2>You received {starterBonus.points || 300} free points!</h2>
        <p>
          Welcome to Hidden Gems. Your starter points have been added to your account so you can try the point unlock system.
        </p>

        <div className="starter-bonus-actions">
          <Link className="button full" to="/points" onClick={clearStarterBonus}>
            Buy More Points
          </Link>
          <button className="ghost-button full" onClick={clearStarterBonus}>
            Continue Browsing
          </button>
        </div>

        <small className="tiny-note">
          Current balance: {starterBonus.balance ?? starterBonus.points ?? 300} points
        </small>
      </div>
    </div>
  )
}
