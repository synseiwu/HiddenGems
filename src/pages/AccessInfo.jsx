import { Link } from 'react-router-dom'
import { Bot, BrainCircuit, Crown, Gem, History, ShieldCheck, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-pages.css'
import '../styles/site-messages.css'

export default function AccessInfo() {
  const { user, profile, isAdmin, isVip } = useAuth()
  const { isAiMode } = useSiteMode()

  return (
    <div className="page info-page mode-aware-page access-info-page">
      <section className="card info-hero-card mode-padded-card">
        <span className="eyebrow">Access</span>
        <h1>{isAiMode ? 'AI Studio Access Info' : 'Hidden Gems Access Info'}</h1>
        <p>
          {isAiMode
            ? 'AI Studio is the main public platform. Your same account and points wallet also work with Hidden Gems video mode when you deliberately enter it through this Access Info page.'
            : 'Hidden Gems video mode uses the same account, roles, and points wallet as AI Studio. No separate login or wallet is needed.'}
        </p>
      </section>

      {user && (
        <section className="card account-strip mode-padded-card">
          <p>
            Signed in: <strong>{user.email}</strong>
            {profile?.role && <> · Role: <strong>{profile.role}</strong></>}
            {isVip && <> · <strong>{isAiMode ? 'Membership active' : 'VIP active'}</strong></>}
            {isAdmin && <> · Admin can manage {isAiMode ? 'AI settings, users, points, messages, and site mode.' : 'listings, categories, messages, and access settings.'}</>}
          </p>
        </section>
      )}

      <section className="section access-grid mode-card-grid">
        <article className="card info-card mode-card">
          {isAiMode ? <Bot /> : <Gem />}
          <h2>{isAiMode ? 'AI first' : 'Session access'}</h2>
          <p>{isAiMode ? 'The site opens to AI Studio by default. Hidden Gems stays discreet until the Access Info switch is used.' : 'Hidden Gems opens for the current browser session after the Access Info switch is clicked.'}</p>
        </article>

        <article className="card info-card mode-card">
          {isAiMode ? <Wallet /> : <ShieldCheck />}
          <h2>Same wallet</h2>
          <p>Your points, login, roles, rewards, and account status stay shared across AI Studio and Hidden Gems.</p>
        </article>

        <article className="card info-card mode-card">
          {isAiMode ? <BrainCircuit /> : <Crown />}
          <h2>{isAiMode ? 'Where to switch' : 'Return to AI'}</h2>
          <p>{isAiMode ? 'Scroll near the bottom of this page. If enabled, a discreet Enter Hidden Gems button will appear.' : 'Use the same Access Info switch to open AI Studio again when you are ready.'}</p>
        </article>
      </section>

      <section className="card access-guidance-card mode-padded-card">
        <span className="eyebrow">How to access Hidden Gems</span>
        <h2>Use the discreet Access Info switch</h2>
        <p>
          AI Studio remains the main site. To access the Hidden Gems video side, stay on this page and scroll near the bottom.
          If access is enabled for your account/session, a small switch button appears in the bottom-right corner.
        </p>
        <p>
          This does not create a separate account. Your same email, guest/user/admin status, points wallet, VIP status, and rewards remain connected.
        </p>
      </section>

      <section className="section actions centered-text">
        <Link className="button" to={isAiMode ? '/ai-studio' : '/videos'}>{isAiMode ? 'Open AI Studio' : 'Browse Videos'}</Link>
        <Link className="ghost-button" to="/points">Buy Points</Link>
        {!isAiMode && <Link className="ghost-button" to="/vip">View VIP</Link>}
        {isAdmin && <Link className="ghost-button" to="/admin">Admin Panel</Link>}
      </section>
    </div>
  )
}
