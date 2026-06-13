import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bot, Gem, RotateCcw } from 'lucide-react'
import { clearLocalSiteModeOverride, saveAdminSiteSettings, setLocalSiteModeOverride } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-switch-popout.css'

export default function ModeSwitchPopout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { settings, isAiMode } = useSiteMode()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  // Hard rule: the variant switch belongs on Access Info only.
  // It should not appear on Home, About, AI Studio chat, Points, Account, Admin, etc.
  const isAccessInfoPage = location.pathname === '/access-info'
  const showForAdmin = isAdmin && settings.show_admin_mode_switch !== false
  const showForPublic = !isAdmin && Boolean(settings.show_public_mode_switch)
  const shouldShow = isAccessInfoPage && (showForAdmin || showForPublic)

  const nextMode = isAiMode ? 'hidden_gems' : 'ai_studio'
  const label = isAiMode ? 'Enter Hidden Gems' : 'Open AI Studio'
  const subtitle = isAiMode ? 'Switch to video marketplace mode' : 'Use points for AI tools'

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

      setVisible(scrollTop > 420 || nearBottom)
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
    setBusy(true)
    setMessage('')

    try {
      if (isAdmin) {
        // Admins switch the real global site mode.
        clearLocalSiteModeOverride()
        await saveAdminSiteSettings({
          ...settings,
          site_mode: nextMode,
          ai_studio_public_mode: nextMode === 'ai_studio'
        })
        window.dispatchEvent(new Event('hidden-gems:site-mode-refresh'))
      } else {
        // Public/guest users only switch their browser session.
        setLocalSiteModeOverride(nextMode)
      }

      navigate('/access-info')
    } catch (err) {
      setMessage(err.message || 'Could not switch modes.')
    } finally {
      setBusy(false)
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
          <small>{subtitle}</small>
          {message && <small className="mode-switch-error">{message}</small>}
        </span>
        <RotateCcw size={17} />
      </button>
    </aside>
  )
}
