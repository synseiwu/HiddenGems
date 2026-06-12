import { Link } from 'react-router-dom'
import { Bot, ExternalLink, Gem, ShieldCheck, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function About() {
  const { isAdmin } = useAuth()

  return (
    <div className="page info-page">
      <section className="card info-hero-card">
        <span className="eyebrow">About</span>
        <h1>About Hidden Gems</h1>
        <p>
          Hidden Gems is a premium digital access platform built for rare drops, curated vault content,
          point-based unlocks, VIP tiers, and account-based access. The platform is designed to stay fast by keeping
          heavy files off-site while protecting full access links until a user is verified.
        </p>
        <p>
          Users buy point packs, spend points to unlock selected digital releases, and access approved external links
          from their Library after access is verified.
        </p>
        <p>
          Hidden Gems also includes an internal AI Studio module for account-based AI usage, admin-controlled point costs,
          and saved AI conversations inside the same platform.
        </p>

        {isAdmin && (
          <div className="actions admin-ai-shortcut">
            <Link className="button" to="/ai-studio">
              <Bot size={16} />
              Open AI Studio
            </Link>
          </div>
        )}
      </section>

      <section className="section info-grid">
        <article className="card mini-card">
          <Gem />
          <h3>Point-based access</h3>
          <p>Buy points once, then spend them only on the digital access you choose to unlock.</p>
        </article>
        <article className="card mini-card">
          <ShieldCheck />
          <h3>Protected links</h3>
          <p>Full external links remain hidden until points, VIP, or admin access is verified.</p>
        </article>
        <article className="card mini-card">
          <Zap />
          <h3>Fast browsing</h3>
          <p>Only optimized thumbnails and optional previews load on-site, keeping the marketplace lightweight.</p>
        </article>
      </section>

      <section className="card info-card partner-card">
        <span className="eyebrow">External access partners</span>
        <h2>PikPak, Mega, and approved file access</h2>
        <p>
          Hidden Gems uses trusted external access partners such as <strong>PikPak</strong> and <strong>Mega</strong> to provide approved
          file access after a user unlocks content through points, VIP access, or admin approval.
        </p>
        <p>
          Full files are not hosted directly on Hidden Gems. External links are part of the approved Hidden Gems access flow,
          and they are revealed only after access has been verified. If a preview provider blocks embedded playback,
          users can still open the preview in a new tab.
        </p>
      </section>

      <section className="section actions centered-text">
        <Link className="button" to="/access-info">How Access Works</Link>
        <Link className="ghost-button" to="/points">Buy Points</Link>
        <Link className="ghost-button" to="/vip">View VIP</Link>
        <a className="ghost-button" href="https://mypikpak.com" target="_blank" rel="noreferrer">
          PikPak <ExternalLink size={16} />
        </a>
      </section>
    </div>
  )
}
