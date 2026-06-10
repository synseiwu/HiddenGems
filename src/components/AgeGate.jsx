import { useEffect, useState } from 'react'
import { ShieldCheck, XCircle } from 'lucide-react'
import { getPublicSiteSettings } from '../lib/api'

const AGE_GATE_KEY = 'hidden_gems_age_verified_v1'

export default function AgeGate() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let active = true

    async function checkGate() {
      const settings = await getPublicSiteSettings()
      if (!active) return

      if (settings.disable_age_gate || settings.hide_all_videos || settings.safe_mode_enabled) {
        setStatus('accepted')
        return
      }

      const accepted = window.localStorage.getItem(AGE_GATE_KEY) === 'yes'
      setStatus(accepted ? 'accepted' : 'pending')
    }

    checkGate().catch(() => {
      const accepted = window.localStorage.getItem(AGE_GATE_KEY) === 'yes'
      setStatus(accepted ? 'accepted' : 'pending')
    })

    return () => { active = false }
  }, [])

  function enterSite() {
    window.localStorage.setItem(AGE_GATE_KEY, 'yes')
    setStatus('accepted')
  }

  function leaveSite() {
    setStatus('blocked')
  }

  if (status === 'checking' || status === 'accepted') return null

  return (
    <div className="age-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate-card card glow">
        {status === 'blocked' ? (
          <>
            <XCircle size={44} />
            <span className="eyebrow">Access blocked</span>
            <h1 id="age-gate-title">Adults Only</h1>
            <p>
              Hidden Gems is only intended for adults age 18 and older. You cannot enter this site without confirming you are 18+.
            </p>
            <a className="button full" href="https://www.google.com">Leave Site</a>
          </>
        ) : (
          <>
            <ShieldCheck size={48} />
            <span className="eyebrow">18+ Verification</span>
            <h1 id="age-gate-title">Adults Only</h1>
            <p>
              Hidden Gems is intended only for adults age 18 and older. By entering this site, you confirm that you are at least 18 years old and legally allowed to view adult-oriented roleplay entertainment in your location.
            </p>
            <p>
              All models featured in Hidden Gems content are 18+ consenting adults. All scenarios, themes, previews, and vault releases are roleplay-based digital entertainment and should be understood as fictional content created for entertainment purposes.
            </p>
            <div className="age-gate-actions">
              <button className="button full" type="button" onClick={enterSite}>I am 18+ — Enter</button>
              <button className="ghost-button full" type="button" onClick={leaveSite}>I am under 18 — Leave</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
