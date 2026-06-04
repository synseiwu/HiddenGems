import { Link } from 'react-router-dom'
import { Crown, ExternalLink, Gem, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AccessInfo() {
  const { user, profile, isAdmin, isVip } = useAuth()

  return (
    <div className="page info-page">
      <section className="card info-hero-card">
        <span className="eyebrow">Access</span>
        <h1>Point-Based Video Access</h1>
        <p>
          Hidden Gems uses a secure point-based unlock system. Users buy point packs through Stripe,
          spend points on the videos they want, and open approved external links only after access is verified.
        </p>
      </section>

      {user && (
        <section className="card account-strip">
          <p>
            Signed in: <strong>{user.email}</strong>
            {profile?.role && <> · Role: <strong>{profile.role}</strong></>}
            {isVip && <> · <strong>VIP active</strong></>}
            {isAdmin && <> · Admin can manage listings, categories, and access settings.</>}
          </p>
        </section>
      )}

      <section className="section access-grid">
        <article className="card info-card">
          <span className="eyebrow">How it works</span>
          <ol className="clean-list">
            <li>Create or sign into your Hidden Gems account.</li>
            <li>Buy a point pack through secure Stripe checkout.</li>
            <li>Browse available videos and preview content when available.</li>
            <li>Spend points to unlock the videos you want.</li>
            <li>Unlocked videos appear in your Library for that account.</li>
            <li>Full external links remain hidden until access is verified.</li>
            <li>VIP-only videos require an active VIP subscription.</li>
          </ol>
          <div className="actions">
            <Link className="button" to="/videos">Browse Videos</Link>
            <Link className="ghost-button" to="/points">Buy Points</Link>
          </div>
        </article>

        <article className="card info-card">
          <span className="eyebrow">VIP vault</span>
          <Crown className="info-icon" />
          <p>
            VIP access is separate from point unlocks. VIP members can access VIP-only releases while their
            subscription is active. If a subscription is inactive, VIP-only full links stay protected.
          </p>
          <Link className="button" to="/vip">Open VIP checkout</Link>
        </article>
      </section>

      <section className="card info-card partner-card">
        <span className="eyebrow">External links</span>
        <h2>Why videos open through PikPak, Mega, or approved partners</h2>
        <p>
          Hidden Gems keeps the website fast by not hosting full video files directly. Approved external partners,
          including PikPak and Mega, may be used for full video access after a successful point unlock or VIP verification.
        </p>
        <p>
          Preview links may be embedded when supported. If a provider blocks on-site embeds, the preview opens in a new tab instead.
        </p>
        <a className="ghost-button" href="https://mypikpak.com" target="_blank" rel="noreferrer">
          Visit PikPak <ExternalLink size={16} />
        </a>
      </section>
    </div>
  )
}
