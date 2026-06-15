import { Link } from 'react-router-dom'
import { Bot, Gem, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getUserOnboardingStatus, markVerifiedAccessPopupSeen } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/site-messages.css'

export default function VerifiedAccessPopup() {
  const { user, rewardNotice } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const emailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at)

  useEffect(() => {
    let mounted = true

    async function check() {
      if (!user || !emailVerified || rewardNotice) return
      const status = await getUserOnboardingStatus().catch(() => ({ verified_access_popup_seen: true }))
      if (mounted && !status.verified_access_popup_seen) {
        window.setTimeout(() => {
          if (mounted) setShow(true)
        }, 450)
      }
    }

    check()
    return () => {
      mounted = false
    }
  }, [user, emailVerified, rewardNotice])

  useEffect(() => {
    if (!show) return

    function onKeyDown(event) {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [show])

  if (!show || !user || !emailVerified || rewardNotice) return null

  async function close() {
    setBusy(true)
    await markVerifiedAccessPopupSeen().catch(() => {})
    setBusy(false)
    setShow(false)
  }

  return (
    <div className="site-popup-backdrop" role="dialog" aria-modal="true" aria-label="Welcome to AI Studio">
      <section className="card site-popup-card">
        <button className="site-popup-close" type="button" onClick={close} aria-label="Close welcome popup">
          <X size={18} />
        </button>

        <div className="site-popup-icon">
          <Bot size={34} />
        </div>

        <span className="eyebrow">Account verified</span>
        <h2>Welcome to AI Studio</h2>
        <p>
          Your account is active. AI Studio is the main platform. If you are looking for Hidden Gems video access,
          open <strong>Access Info</strong> near the bottom of the site. From there, a discreet button will appear that allows eligible users to enter Hidden Gems video mode.
        </p>
        <p>
          Your same account and points wallet work across both AI Studio and Hidden Gems. No separate account is needed.
        </p>

        <div className="site-popup-actions">
          <Link className="button full" to="/access-info" onClick={close}>
            <Gem size={16} />
            Open Access Info
          </Link>
          <Link className="ghost-button full" to="/ai-studio" onClick={close}>
            Continue to AI Studio
          </Link>
        </div>

        {busy && <small className="muted">Saving...</small>}
      </section>
    </div>
  )
}
