import { Link } from 'react-router-dom'
import { Bot, BrainCircuit, ExternalLink, Gem, History, ShieldCheck, Wallet, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-pages.css'

export default function About() {
  const { isAdmin } = useAuth()
  const { isAiMode } = useSiteMode()

  if (isAiMode) {
    return (
      <div className="page info-page mode-aware-page">
        <section className="card info-hero-card mode-padded-card">
          <span className="eyebrow">About</span>
          <h1>About AI Studio</h1>
          <p>
            AI Studio is a point-based AI access platform built into the same account system. Users can buy points,
            send AI messages, save conversations, and use enabled AI tools from one shared wallet.
          </p>
          <p>
            Points stay attached to the same account balance, so users do not need a separate AI wallet or separate checkout flow.
          </p>
          <p>
            Admins can control AI availability, model settings, point cost per message, and the public site mode from the Admin Panel.
          </p>

          {isAdmin && (
            <div className="actions admin-ai-shortcut">
              <Link className="button" to="/ai-studio">
                <Bot size={16} />
                Open AI Studio
              </Link>
              <Link className="ghost-button" to="/admin">Admin Panel</Link>
            </div>
          )}
        </section>

        <section className="section info-grid mode-card-grid">
          <article className="card mini-card mode-card">
            <BrainCircuit />
            <h3>Point-based AI</h3>
            <p>Use points for AI messages and enabled AI Studio tools.</p>
          </article>
          <article className="card mini-card mode-card">
            <History />
            <h3>Saved workspace</h3>
            <p>AI conversations stay connected to the user account.</p>
          </article>
          <article className="card mini-card mode-card">
            <Wallet />
            <h3>Shared wallet</h3>
            <p>The same points wallet powers AI Studio access.</p>
          </article>
        </section>

        <section className="card info-card partner-card mode-padded-card">
          <span className="eyebrow">Platform access</span>
          <h2>Account-based AI tools</h2>
          <p>
            AI Studio uses secure account login, a shared points wallet, and admin-managed AI settings. The public AI experience is separate from marketplace browsing while AI Studio Mode is active.
          </p>
        </section>

        <section className="section actions centered-text">
          <Link className="button" to="/ai-studio">Open AI Studio</Link>
          <Link className="ghost-button" to="/points">Buy Points</Link>
          <Link className="ghost-button" to="/access-info">Access Info</Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page info-page mode-aware-page">
      <section className="card info-hero-card mode-padded-card">
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

      <section className="section info-grid mode-card-grid">
        <article className="card mini-card mode-card">
          <Gem />
          <h3>Point-based access</h3>
          <p>Buy points once, then spend them only on the digital access you choose to unlock.</p>
        </article>
        <article className="card mini-card mode-card">
          <ShieldCheck />
          <h3>Protected links</h3>
          <p>Full external links remain hidden until points, VIP, or admin access is verified.</p>
        </article>
        <article className="card mini-card mode-card">
          <Zap />
          <h3>Fast browsing</h3>
          <p>Only optimized thumbnails and optional previews load on-site, keeping the marketplace lightweight.</p>
        </article>
      </section>

      <section className="card info-card partner-card mode-padded-card">
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
