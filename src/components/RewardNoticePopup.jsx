import { Link } from 'react-router-dom'
import { Gift, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function RewardNoticePopup() {
  const { rewardNotice, clearRewardNotice } = useAuth()

  if (!rewardNotice) return null

  return (
    <div className="starter-bonus-backdrop" role="dialog" aria-modal="true" aria-label="Reward notification">
      <div className="card starter-bonus-card">
        <button className="starter-bonus-close" onClick={clearRewardNotice} aria-label="Close reward popup">
          <X size={18} />
        </button>

        <div className="starter-bonus-icon">
          <Gift size={34} />
        </div>

        <span className="eyebrow">{rewardNotice.title || 'Reward Claimed'}</span>
        <h2>{rewardNotice.message}</h2>
        {rewardNotice.balance !== undefined && (
          <p>Your current balance is now <strong>{rewardNotice.balance}</strong> points.</p>
        )}

        <div className="starter-bonus-actions">
          <Link className="button full" to={rewardNotice.to || '/points'} onClick={clearRewardNotice}>
            {rewardNotice.cta || 'Buy More Points'}
          </Link>
          <button className="ghost-button full" onClick={clearRewardNotice}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
