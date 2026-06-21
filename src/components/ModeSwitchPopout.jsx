import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bot, Gem, RotateCcw } from 'lucide-react'
import { claimHiddenGemsAccessBonus, setLocalSiteModeOverride } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-switch-popout.css'

export default function ModeSwitchPopout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isAiMode } = useSiteMode()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  // Hard rule:
  // The discreet site switch belongs only on Access Info,
  // but it must be available to normal users, guest-role users, new users, and admins.
  // Do NOT gate this behind admin-only settings.
  const isAccessInfoPage = location.pathname === '/access-info'
  const shouldShow = isAccessInfoPage

  const nextMode = isAiMode ? 'hidden_gems' : 'ai_studio'
  const label = isAiMode ? 'Enter Hidden Gems' : 'Open AI Studio'
  const subtitle = isAiMode ? 'Switch to video mode' : 'Use points for AI tools'

  useEffect(() => {
    if (!shouldShow) {
      setVisible(false)
      return
    }

    function checkScroll() {
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop || 0
      const viewportBottom = scrollTop + window.innerHeight
      const pageHeight = Math.max(doc.scrollHeight, document.body.scrollHeight)
      const nearBottom = pageHeight - viewportBottom < 520

      // Show it after some scrolling, and always near the bottom.
      setVisible(scrollTop > 220 || nearBottom)
    }

    checkScroll()
    window.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)

    return () => {
      window.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [shouldShow, location.pathname])

  if (!shouldShow) return null

  async function switchMode() {
    if (busy) return

    setBusy(true)
    setMessage('')

    try {
      // Switch the current browser/session immediately.
      // This must work for every signed-in role and should not depend on admin settings.
      setLocalSiteModeOverride(nextMode)

      // Reward is only for logged-in users and must never block the switch.
      // If the reward function fails or the user already claimed it, the switch still works.
      if (nextMode === 'hidden_gems' && user) {
        const reward = await claimHiddenGemsAccessBonus().catch(() => null)
        if (reward?.granted) {
          setMessage(`+${reward.amount || 100} point access bonus`)
          window.dispatchEvent(new Event('wallet:refresh'))
          window.dispatchEvent(new Event('site-messages:refresh'))
        }
      }

      window.setTimeout(() => {
        setBusy(false)
        navigate(nextMode === 'ai_studio' ? '/ai-studio' : '/')
      }, nextMode === 'hidden_gems' ? 550 : 50)
    } catch (err) {
      // Last-resort fallback: even if something unexpected happens,
      // still place the user into the requested session mode and navigate.
      setLocalSiteModeOverride(nextMode)
      setBusy(false)
      setMessage(err.message || 'Switching anyway...')
      window.setTimeout(() => {
        navigate(nextMode === 'ai_studio' ? '/ai-studio' : '/')
      }, 150)
    }
  }

  return (
    <aside className={visible ? 'mode-switch-popout visible' : 'mode-switch-popout'} aria-label="Site mode switch">
      <button type="button" onClick={switchMode} disabled={busy}>
        <span className="mode-switch-icon">
          {isAiMode ? <Gem size={20} /> : <Bot size={20} />}
        </span>
        <span className="mode-switch-copy">
          <strong>{busy ? 'Switching...' : label}</strong>
          <small>{message || subtitle}</small>
        </span>
        <RotateCcw size={17} />
      </button>
    </aside>
  )
}
