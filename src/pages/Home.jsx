import { Link } from 'react-router-dom'
import { Crown, Gem, Search, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listPublishedVideos } from '../lib/api'
import VideoCard from '../components/VideoCard'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const { user } = useAuth()
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    if (!user) {
      setFeatured([])
      return
    }
    listPublishedVideos().then((videos) => setFeatured(videos.slice(0, 3))).catch(() => setFeatured([]))
  }, [user])

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

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Featured</span>
          <h2>{user ? 'Latest Gems' : 'Sign in to view videos'}</h2>
        </div>
        {user ? (
          <div className="video-grid">
            {featured.map((video) => <VideoCard key={video.id} video={video} />)}
          </div>
        ) : (
          <div className="card info-card locked-home-card">
            <h3>Video browsing is account-only</h3>
            <p>Create a free account, confirm you are 18+, then log in to browse video listings, previews, points, VIP, and your personal library.</p>
            <div className="actions">
              <Link className="button" to="/signup">Create Account</Link>
              <Link className="ghost-button" to="/login">Login</Link>
            </div>
          </div>
        )}
      </section>

      <section className="section how-grid">
        {[
          ['Create an account', 'Sign up with secure Supabase Auth.', ShieldCheck],
          ['Buy points', 'Stripe Checkout adds verified points to your wallet.', Gem],
          ['Unlock videos', 'Spend points to unlock specific gems.', Zap],
          ['Open from library', 'Unlocked and VIP links appear in your library through approved external partners.', Crown]
        ].map(([title, text, Icon]) => (
          <div className="card mini-card" key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
