import { Link } from 'react-router-dom'
import { ExternalLink, Gem, ShieldCheck, Zap } from 'lucide-react'

export default function About() {
  return (
    <div className="page info-page">
      <section className="card info-hero-card">
        <span className="eyebrow">About</span>
        <h1>About Hidden Gems</h1>
        <p>
          Hidden Gems is a premium digital video storefront built for rare drops, curated vault content,
          and account-based access. The platform is designed to stay fast by keeping heavy video files off-site
          while protecting full access links until a user is verified.
        </p>
        <p>
          Users buy point packs through secure Stripe checkout, then spend those points to unlock selected videos.
          Once unlocked, the selected title appears in the user&apos;s Library and the approved external access link becomes available.
        </p>
        <p>
          VIP members get access to VIP-only vault releases while their subscription is active. Preview content may be
          available before unlocking, and some previews may open externally if an embed is not supported by the provider.
        </p>
        <p>
          Hidden Gems content is roleplay-based digital entertainment and is provided purely as content. Any themes,
          scenarios, titles, previews, or vault releases should be understood as fictional/roleplay media created for
          entertainment purposes only.
        </p>
      </section>

      <section className="section info-grid">
        <article className="card mini-card">
          <Gem />
          <h3>Point-based access</h3>
          <p>Buy points once, then spend them only on the videos you choose to unlock.</p>
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
        <article className="card mini-card">
          <ShieldCheck />
          <h3>Roleplay content</h3>
          <p>Hidden Gems media is purely digital roleplay entertainment and should be viewed as fictional content.</p>
        </article>
      </section>

      <section className="card info-card partner-card">
        <span className="eyebrow">External access partners</span>
        <h2>PikPak, Mega, and approved file access</h2>
        <p>
          Hidden Gems uses trusted external access partners such as <strong>PikPak</strong> and <strong>Mega</strong> to provide approved
          video file access after a user unlocks content through points, VIP access, or admin approval.
        </p>
        <p>
          Full videos are not hosted directly on Hidden Gems. External links are part of the approved Hidden Gems access flow,
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
