import { Link } from 'react-router-dom'
import { Gift, X } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import '../styles/reward-popup.css'

export default function RewardNoticePopup() {
  const { rewardNotice, clearRewardNotice } = useAuth()

  useEffect(() => {
    if (!rewardNotice) return

    function onKeyDown(event) {
      if (event.key === 'Escape') clearRewardNotice()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rewardNotice, clearRewardNotice])

  if (!rewardNotice) return null

  return (
    <div className="reward-popup-backdrop" role="dialog" aria-modal="true" aria-label="Daily points reward">
      <div className="card reward-popup-card">
        <button className="reward-popup-close" onClick={clearRewardNotice} aria-label="Close reward popup">
          <X size={18} />
        </button>

        <div className="reward-popup-icon">
          <Gift size={34} />
        </div>

        <span className="eyebrow">{rewardNotice.title || 'Reward Claimed'}</span>
        <h2>{rewardNotice.message}</h2>

        {rewardNotice.details && <p>{rewardNotice.details}</p>}

        {rewardNotice.balance !== undefined && (
          <p>Your current balance is now <strong>{rewardNotice.balance}</strong> points.</p>
        )}

        <div className="reward-popup-actions">
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
