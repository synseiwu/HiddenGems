import { Link, NavLink, Outlet } from 'react-router-dom'
import { Bot, Gem, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import FloatingWallet from './FloatingWallet'
import AgeGate from './AgeGate'
import RewardNoticePopup from './RewardNoticePopup'
import ModeSwitchPopout from './ModeSwitchPopout'
import NotificationBell from './NotificationBell'
import MessagePopupCenter from './MessagePopupCenter'
import '../styles/home-spacing-fix.css'
import '../styles/site-messages.css'
import '../styles/site-dms.css'

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const { settings, isAiMode } = useSiteMode()
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)
  const hideMarketplaceNav = isAiMode && settings.hide_video_marketplace_in_ai_mode !== false

  return (
    <>
      <AgeGate />
      <header className={isAiMode ? 'site-header ai-mode-header' : 'site-header'}>
        <Link className="brand" to="/" onClick={close}>
          {isAiMode ? <Bot size={24} /> : <Gem size={24} />}
          <span>{isAiMode ? 'AI Studio' : 'Hidden Gems'}</span>
        </Link>

        <button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>

        <nav className={open ? 'nav open' : 'nav'}>
          <NavLink onClick={close} to="/">Home</NavLink>
          {!hideMarketplaceNav && <NavLink onClick={close} to="/videos">Videos</NavLink>}
          <NavLink onClick={close} to="/points">Buy Points</NavLink>
          {!hideMarketplaceNav && <NavLink onClick={close} to="/vip">VIP</NavLink>}
          {user && !hideMarketplaceNav && <NavLink onClick={close} to="/forum">Forum</NavLink>}
          {user && !hideMarketplaceNav && <NavLink onClick={close} to="/library">Library</NavLink>}
          {user && <NotificationBell onClick={close} />}
          {isAdmin && <NavLink onClick={close} to="/admin">Admin Panel</NavLink>}
          {user ? (
            <>
              <NavLink onClick={close} to="/account">Account</NavLink>
              <button className="ghost-button" onClick={() => { close(); signOut() }}>Logout</button>
            </>
          ) : (
            <>
              <NavLink onClick={close} to="/login">Login</NavLink>
              <NavLink onClick={close} className="button tiny" to="/signup">Sign Up</NavLink>
            </>
          )}
        </nav>
      </header>

      <main className={isAiMode ? 'ai-mode-main' : undefined}>
        <Outlet />
      </main>

      <FloatingWallet />
      <RewardNoticePopup />
      <MessagePopupCenter />
      <ModeSwitchPopout />

      <footer className={isAiMode ? 'footer site-footer ai-mode-footer' : 'footer site-footer'}>
        <div className="footer-brand">
          <strong>{isAiMode ? 'AI Studio' : 'Hidden Gems'}</strong>
          <span>
            {isAiMode
              ? 'Point-based AI access, saved chat history, and account-based digital tools powered by your existing wallet.'
              : 'Point-based video access with protected external links through approved partners like PikPak and Mega.'}
          </span>
        </div>
        <nav className="footer-links" aria-label="Footer policies">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund-policy">Refund Policy</Link>
          {!isAiMode && <Link to="/2257-compliance">18 USC 2257 Compliance</Link>}
          <Link to="/access-info">Access Info</Link>
        </nav>
      </footer>
    </>
  )
}
