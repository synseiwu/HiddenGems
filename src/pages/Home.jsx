import { Link } from 'react-router-dom'
import { Bot, BrainCircuit, Crown, Gem, History, Search, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  categorySlug,
  getPublicSiteSettings,
  listHomepageShowcaseRows,
  listPublishedVideos,
  saveAdminSiteSettings
} from '../lib/api'
import VideoCard from '../components/VideoCard'
import { useAuth } from '../hooks/useAuth'
import useSiteContent from '../hooks/useSiteContent'
import '../styles/ai-site-mode.css'

function buildViewAllLink(row) {
  const categoryName = row.category_names?.[0]
  const categoryId = row.category_ids?.[0]

  if (categoryId && categoryName && categoryName !== 'Recently Uploaded') {
    return `/videos?category=${encodeURIComponent(categoryId)}&categoryName=${encodeURIComponent(categorySlug(categoryName))}`
  }

  return '/videos?sort=newest'
}

function ShowcaseRow({ row }) {
  const videos = row.videos || []
  const layoutClass = `showcase-row-videos showcase-${row.layout_type || 'horizontal'}`

  if (!videos.length) return null

  return (
    <section className="section homepage-showcase-section">
      <div className="section-heading split-line">
        <div>
          <span className="eyebrow">{(row.category_names || []).join(' • ') || 'Featured'}</span>
          <h2>{row.title}</h2>
          {row.subtitle && <p>{row.subtitle}</p>}
        </div>
        <Link className="ghost-button" to={buildViewAllLink(row)}>View All</Link>
      </div>

      <div className={layoutClass}>
        {videos.map((video) => <VideoCard key={`${row.id}-${video.id}`} video={video} />)}
      </div>
    </section>
  )
}

function AIStudioHome({ user, isAdmin, siteSettings, onReturnHiddenGems }) {
  const showAdminSwitch = isAdmin && siteSettings.show_admin_mode_switch !== false
  const showPublicSwitch = Boolean(siteSettings.show_public_mode_switch)

  return (
    <div className="page ai-public-home">
      <section className="hero grid-2 ai-public-hero">
        <div>
          <span className="eyebrow">AI Studio</span>
          <h1>AI tools powered by your points wallet.</h1>
          <p>
            Use your existing account points to chat with AI, save conversations, and access account-based AI tools
            inside the same Hidden Gems platform.
          </p>
          <div className="actions">
            <Link className="button" to={user ? '/ai-studio' : '/login'}>
              <Bot size={16} />
              {user ? 'Start AI Chat' : 'Login to Start'}
            </Link>
            <Link className="ghost-button" to="/points">
              <Wallet size={16} />
              Buy Points
            </Link>
            {!user && <Link className="ghost-button" to="/signup">Create Account</Link>}
          </div>

          {(showAdminSwitch || showPublicSwitch) && (
            <div className="ai-mode-switch-card">
              {showAdminSwitch ? (
                <button className="ghost-button" type="button" onClick={onReturnHiddenGems}>
                  Admin: Return to Hidden Gems
                </button>
              ) : (
                <Link className="ghost-button" to="/about">About the platform</Link>
              )}
            </div>
          )}
        </div>

        <div className="card glow ai-public-card">
          <Sparkles size={46} />
          <h2>Same points. New AI access.</h2>
          <p>
            The AI Studio uses the existing points wallet. No second balance, no separate account, and no duplicated checkout system.
          </p>
          <div className="ai-public-stats">
            <span><Gem size={16} /> Point-based usage</span>
            <span><History size={16} /> Saved chat history</span>
            <span><ShieldCheck size={16} /> Account protected</span>
          </div>
        </div>
      </section>

      <section className="section info-grid ai-feature-grid">
        <article className="card mini-card">
          <BrainCircuit />
          <h3>AI chat access</h3>
          <p>Send prompts and receive AI responses inside your logged-in account.</p>
        </article>
        <article className="card mini-card">
          <Wallet />
          <h3>Wallet aligned</h3>
          <p>AI messages use the same Hidden Gems points balance already attached to your account.</p>
        </article>
        <article className="card mini-card">
          <ShieldCheck />
          <h3>Admin controlled</h3>
          <p>Admins can control AI cost, model, prompts, and public mode from the Admin Panel.</p>
        </article>
      </section>

      <section className="card centered-text ai-public-cta">
        <span className="eyebrow">Ready</span>
        <h2>Start using AI Studio</h2>
        <p>Buy points once, then use them for AI access and other enabled platform features.</p>
        <div className="actions centered-text">
          <Link className="button" to={user ? '/ai-studio' : '/login'}>{user ? 'Open AI Studio' : 'Login'}</Link>
          <Link className="ghost-button" to="/points">Buy Points</Link>
        </div>
      </section>
    </div>
  )
}

export default function Home() {
  const { user, isAdmin } = useAuth()
  const [featured, setFeatured] = useState([])
  const [showcaseRows, setShowcaseRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [siteSettings, setSiteSettings] = useState({
    hide_all_videos: false,
    safe_mode_enabled: false,
    site_mode: 'hidden_gems',
    ai_studio_public_mode: false,
    show_admin_mode_switch: true,
    show_public_mode_switch: false
  })
  const [modeMessage, setModeMessage] = useState('')
  const { sections } = useSiteContent('home')

  const isAiMode = siteSettings.site_mode === 'ai_studio' || siteSettings.ai_studio_public_mode

  useEffect(() => {
    if (!user) {
      getPublicSiteSettings()
        .then(setSiteSettings)
        .catch(() => {})
      setFeatured([])
      setShowcaseRows([])
      return
    }

    setLoadingRows(true)

    Promise.all([
      getPublicSiteSettings().catch(() => ({ hide_all_videos: false, safe_mode_enabled: false, site_mode: 'hidden_gems' })),
      listHomepageShowcaseRows().catch(() => []),
      listPublishedVideos().catch(() => [])
    ]).then(([settings, rows, videos]) => {
      setSiteSettings(settings)
      setShowcaseRows(rows)
      setFeatured(videos.slice(0, 3))
    }).finally(() => setLoadingRows(false))
  }, [user])

  const hasShowcaseRows = useMemo(() => user && showcaseRows.some((row) => (row.videos || []).length), [user, showcaseRows])

  async function returnToHiddenGems() {
    if (!isAdmin) return
    setModeMessage('')
    const next = {
      ...siteSettings,
      site_mode: 'hidden_gems',
      ai_studio_public_mode: false
    }
    try {
      await saveAdminSiteSettings(next)
      setSiteSettings(next)
      setModeMessage('Hidden Gems mode restored.')
    } catch (err) {
      setModeMessage(err.message)
    }
  }

  if (isAiMode) {
    return (
      <>
        <AIStudioHome
          user={user}
          isAdmin={isAdmin}
          siteSettings={siteSettings}
          onReturnHiddenGems={returnToHiddenGems}
        />
        {modeMessage && <p className="notice-text centered-text">{modeMessage}</p>}
      </>
    )
  }

  return (
    <div className="page">
      <section className="hero grid-2">
        <div>
          <span className="eyebrow">{sections.hero?.eyebrow || 'Premium video marketplace'}</span>
          <h1>{sections.hero?.title || 'Unlock Exclusive Hidden Gems'}</h1>
          <p>{sections.hero?.subtitle || 'Buy point packs, spend points on curated video drops, and open protected external links from your personal library after access is verified.'}</p>
          <div className="actions">
            <Link className="button" to="/videos">Browse Videos</Link>
            <Link className="ghost-button" to="/points">Buy Points</Link>
            <Link className="ghost-button" to="/vip">Upgrade to VIP</Link>
          </div>
        </div>
        <div className="vip-card card glow">
          <Gem size={44} />
          <h2>Points and VIP stay separate</h2>
          <p>Points unlock standard videos one by one. VIP tiers unlock tier-based vault releases while subscriptions are active.</p>
        </div>
      </section>

      <section className="section info-grid">
        <article className="card mini-card"><Search /><h3>Browse</h3><p>Search the catalog by category, title, or newest drops.</p></article>
        <article className="card mini-card"><ShieldCheck /><h3>Unlock</h3><p>Use points or VIP access to unlock protected external access links.</p></article>
        <article className="card mini-card"><Zap /><h3>Fast</h3><p>Optimized thumbnails and external delivery keep the site lightweight.</p></article>
      </section>

      {(siteSettings.hide_all_videos || siteSettings.safe_mode_enabled) && user && (
        <section className="section">
          <div className="card centered-text safe-mode-public-card">
            <span className="eyebrow">{sections.safe_mode?.eyebrow || 'Update in progress'}</span>
            <h2>{sections.safe_mode?.title || 'Content is temporarily unavailable'}</h2>
            <p>{sections.safe_mode?.subtitle || 'The marketplace is being updated. Please check back soon.'}</p>
          </div>
        </section>
      )}

      {user && hasShowcaseRows && showcaseRows.map((row) => <ShowcaseRow key={row.id} row={row} />)}

      {user && !hasShowcaseRows && !loadingRows && featured.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">Featured</span>
            <h2>Recent Gems</h2>
          </div>
          <div className="video-grid">
            {featured.map((video) => <VideoCard key={video.id} video={video} />)}
          </div>
        </section>
      )}

      {!user && (
        <section className="card centered-text">
          <Crown size={40} />
          <h2>Members only browsing</h2>
          <p>Create an account or log in to browse videos, buy points, and unlock access.</p>
          <div className="actions centered-text">
            <Link className="button" to="/signup">Create Account</Link>
            <Link className="ghost-button" to="/login">Login</Link>
          </div>
        </section>
      )}
    </div>
  )
}
