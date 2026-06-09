import { Link, NavLink, Outlet } from 'react-router-dom'
import { Gem, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import FloatingWallet from './FloatingWallet'
import AgeGate from './AgeGate'
import RewardNoticePopup from './RewardNoticePopup'

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <>
      <AgeGate />
      <header className="site-header">
        <Link className="brand" to="/" onClick={close}>
          <Gem size={24} />
          <span>Hidden Gems</span>
        </Link>

        <button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>

        <nav className={open ? 'nav open' : 'nav'}>
          <NavLink onClick={close} to="/">Home</NavLink>
          <NavLink onClick={close} to="/videos">Videos</NavLink>
          <NavLink onClick={close} to="/points">Buy Points</NavLink>
          <NavLink onClick={close} to="/vip">VIP</NavLink>
          <NavLink onClick={close} to="/about">About</NavLink>
          {user && <NavLink onClick={close} to="/forum">Forum</NavLink>}
          {user && <NavLink onClick={close} to="/library">Library</NavLink>}
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

      <main>
        <Outlet />
      </main>

      <FloatingWallet />

      <footer className="footer site-footer">
        <div className="footer-brand">
          <strong>Hidden Gems</strong>
          <span>Point-based video access with protected external links through approved partners like PikPak and Mega.</span>
        </div>
        <nav className="footer-links" aria-label="Footer policies">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund-policy">Refund Policy</Link>
          <Link to="/2257-compliance">18 USC 2257 Compliance</Link>
          <Link to="/access-info">Access Info</Link>
        </nav>
      </footer>
    </>
  )
}
