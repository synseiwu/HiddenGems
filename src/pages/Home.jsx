import { Link } from 'react-router-dom'
import { Crown, Gem, Search, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { listHomepageShowcaseRows, listPublishedVideos } from '../lib/api'
import VideoCard from '../components/VideoCard'
import { useAuth } from '../hooks/useAuth'

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
        <Link className="ghost-button" to="/videos">View All</Link>
      </div>

      <div className={layoutClass}>
        {videos.map((video) => <VideoCard key={`${row.id}-${video.id}`} video={video} />)}
      </div>
    </section>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [featured, setFeatured] = useState([])
  const [showcaseRows, setShowcaseRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)

  useEffect(() => {
    if (!user) {
      setFeatured([])
      setShowcaseRows([])
      return
    }

    setLoadingRows(true)

    Promise.all([
      listHomepageShowcaseRows().catch(() => []),
      listPublishedVideos().catch(() => [])
    ]).then(([rows, videos]) => {
      setShowcaseRows(rows)
      setFeatured(videos.slice(0, 3))
    }).finally(() => setLoadingRows(false))
  }, [user])

  const hasShowcaseRows = useMemo(() => user && showcaseRows.some((row) => (row.videos || []).length), [user, showcaseRows])

  return (
    <div className="page">
      <section className="hero grid-2">
        <div>
          <span className="eyebrow">Premium video marketplace</span>
          <h1>Unlock Exclusive Hidden Gems</h1>
          <p>
            Buy point packs, spend points on curated video drops, and open protected external links from your personal library after access is verified.
          </p>
          <div className="actions">
            <Link className="button" to="/videos">Browse Videos</Link>
            <Link className="ghost-button" to="/points">Buy Points</Link>
            <Link className="ghost-button" to="/vip">Upgrade to VIP</Link>
          </div>
        </div>
        <div className="vip-card card glow">
          <Gem size={44} />
          <h2>Points System</h2>
          <p>Users buy points through Stripe, unlock the exact videos they want, and open approved partner links after verification. VIP remains subscription-based.</p>
          <Link className="button full" to="/points">View Point Packs</Link>
        </div>
      </section>

      {user ? (
        <>
          {loadingRows && (
            <section className="section">
              <div className="card info-card">
                <h3>Loading homepage showcase...</h3>
                <p>Fetching admin-selected category rows.</p>
              </div>
            </section>
          )}

          {hasShowcaseRows ? (
            showcaseRows.map((row) => <ShowcaseRow key={row.id} row={row} />)
          ) : (
            <section className="section">
              <div className="section-heading">
                <span className="eyebrow">Featured</span>
                <h2>Latest Gems</h2>
              </div>
              <div className="video-grid">
                {featured.map((video) => <VideoCard key={video.id} video={video} />)}
              </div>
              {!featured.length && (
                <div className="card info-card">
                  <h3>No homepage showcase rows yet</h3>
                  <p>Admin can add homepage category rows from Admin Panel → Homepage Showcase.</p>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="section">
          <div className="section-heading">
            <span className="eyebrow">Featured</span>
            <h2>Sign in to view videos</h2>
          </div>
          <div className="card info-card locked-home-card">
            <h3>Video browsing is account-only</h3>
            <p>Create a free account, confirm you are 18+, then log in to browse video listings, previews, points, VIP, and your personal library.</p>
            <div className="actions">
              <Link className="button" to="/signup">Create Account</Link>
              <Link className="ghost-button" to="/login">Login</Link>
            </div>
          </div>
        </section>
      )}

      <section className="feature-grid">
        <div className="card"><Gem /><h3>Point-based access</h3><p>Buy points once, then spend them only on the videos you choose to unlock.</p></div>
        <div className="card"><ShieldCheck /><h3>Protected links</h3><p>Full external links remain hidden until points, VIP, or admin access is verified.</p></div>
        <div className="card"><Zap /><h3>Fast browsing</h3><p>Only optimized thumbnails and optional previews load on-site, keeping the marketplace lightweight.</p></div>
      </section>
    </div>
  )
}
