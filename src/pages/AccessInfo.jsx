import { Link } from 'react-router-dom'
import { Bot, BrainCircuit, Crown, Gem, History, ShieldCheck, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-pages.css'

export default function AccessInfo() {
  const { user, profile, isAdmin, isVip } = useAuth()
  const { isAiMode } = useSiteMode()

  return (
    <div className="page info-page mode-aware-page">
      <section className="card info-hero-card mode-padded-card">
        <span className="eyebrow">Access</span>
        <h1>{isAiMode ? 'Point-Based AI Access' : 'Point-Based Video Access'}</h1>
        <p>
          {isAiMode
            ? 'AI Studio uses the same secure point wallet already attached to your account. Buy points, send AI messages, and keep saved conversations in one workspace.'
            : 'Hidden Gems uses a secure point-based unlock system. Users buy point packs through Stripe, spend points on the videos they want, and open approved external links only after access is verified.'}
        </p>
      </section>

      {user && (
        <section className="card account-strip mode-padded-card">
          <p>
            Signed in: <strong>{user.email}</strong>
            {profile?.role && <> · Role: <strong>{profile.role}</strong></>}
            {isVip && <> · <strong>{isAiMode ? 'Membership active' : 'VIP active'}</strong></>}
            {isAdmin && <> · Admin can manage {isAiMode ? 'AI settings, users, points, and site mode.' : 'listings, categories, and access settings.'}</>}
          </p>
        </section>
      )}

      <section className="section access-grid mode-card-grid">
        <article className="card info-card mode-card">
          {isAiMode ? <Wallet /> : <Gem />}
          <h2>{isAiMode ? 'Buy points' : 'Buy points'}</h2>
          <p>{isAiMode ? 'Use points for AI messages and enabled AI Studio tools.' : 'Choose a point pack, complete checkout, and your balance updates after payment is verified.'}</p>
        </article>

        <article className="card info-card mode-card">
          {isAiMode ? <BrainCircuit /> : <ShieldCheck />}
          <h2>{isAiMode ? 'Use AI Studio' : 'Unlock access'}</h2>
          <p>{isAiMode ? 'Open AI Studio, send prompts, and continue saved conversations from your account.' : 'Spend points or use VIP access to unlock approved protected links.'}</p>
        </article>

        <article className="card info-card mode-card">
          {isAiMode ? <History /> : <Crown />}
          <h2>{isAiMode ? 'Saved workspace' : 'VIP tiers'}</h2>
          <p>{isAiMode ? 'Conversations remain connected to your logged-in account so you can return later.' : 'VIP tiers unlock tier-based vault access while the matching subscription is active.'}</p>
        </article>
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
