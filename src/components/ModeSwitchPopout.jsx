import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-switch-popout.css'

export default function ModeSwitchPopout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { settings } = useSiteMode()
  const [visible, setVisible] = useState(false)

  // Hard rule: this bottom-right button belongs on the About page only.
  const isAboutPage = location.pathname === '/about'

  // Reuse the same visibility settings, but this button is now a clean Access Info shortcut.
  const showForAdmin = isAdmin && settings.show_admin_mode_switch !== false
  const showForPublic = !isAdmin && Boolean(settings.show_public_mode_switch)
  const shouldShow = isAboutPage && (showForAdmin || showForPublic)

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

  return (
    <aside className={visible ? 'mode-switch-popout visible' : 'mode-switch-popout'} aria-label="Access information shortcut">
      <button type="button" onClick={() => navigate('/access-info')}>
        <span className="mode-switch-icon">
          <ShieldCheck size={20} />
        </span>
        <span className="mode-switch-copy">
          <strong>Access Info</strong>
          <small>How platform access works</small>
        </span>
      </button>
    </aside>
  )
}
