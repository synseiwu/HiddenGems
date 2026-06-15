import { useEffect, useState } from 'react'
import { Bot, BrainCircuit, Gem, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { createPointsCheckoutSession, getWallet, listPointPackages } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import '../styles/mode-pages.css'
import '../styles/points-page-fix.css'

export default function Points() {
  const { user } = useAuth()
  const { isAiMode, loading: modeLoading } = useSiteMode()
  const [searchParams] = useSearchParams()
  const [packages, setPackages] = useState([])
  const [wallet, setWallet] = useState({ points_balance: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const neededPoints = Number(searchParams.get('needed') || 0)
  const returnVideoId = searchParams.get('video') || ''
  const returnVideoTitle = searchParams.get('title') || ''
  const hasUnlockContext = !isAiMode && neededPoints > 0

  useEffect(() => {
    Promise.all([listPointPackages(), user ? getWallet() : Promise.resolve({ points_balance: 0 })])
      .then(([packs, walletData]) => {
        setPackages(packs)
        setWallet(walletData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user])

  async function buyPack(pack) {
    if (!user) return
    setBusyId(pack.id)
    setError('')
    try {
      const url = await createPointsCheckoutSession(pack.id)
      window.location.href = url
    } catch (err) {
      setError(err.message)
      setBusyId('')
    }
  }

  if (loading || modeLoading) return <Loader />

  const hero = isAiMode
    ? {
        eyebrow: 'AI Points',
        title: 'Buy Points for AI Studio',
        text: 'Use points to access AI Studio. Each AI message costs 5 points.'
      }
    : {
        eyebrow: 'Points',
        title: 'Buy Points. Unlock Gems.',
        text: 'Use points to unlock Hidden Gems content when you enter video mode through Access Info.'
      }

  return (
    <div className="page mode-aware-page points-page">
      <section className="hero centered mode-hero points-hero">
        <span className="eyebrow">{hero.eyebrow}</span>
        <h1>{hero.title}</h1>
        <p>{hero.text}</p>
        {user && <p className="wallet-badge"><Gem size={18} /> Current balance: <strong>{wallet.points_balance || 0} points</strong></p>}
      </section>

      {hasUnlockContext && (
        <div className="card points-context-card points-spaced-card">
          <Gem size={22} />
          <div>
            <strong>You need {neededPoints.toLocaleString()} more points{decodeURIComponent(returnVideoTitle || '') ? ` to unlock ${decodeURIComponent(returnVideoTitle)}` : ''}.</strong>
            <p>Pick a pack below, then return to the video to unlock it with points.</p>
          </div>
          {returnVideoId && <Link className="ghost-button small" to={`/videos/${returnVideoId}`}>Back to video</Link>}
        </div>
      )}

      {isAiMode && (
        <section className="card mode-info-card points-wallet-card">
          <BrainCircuit size={30} />
          <div>
            <span className="eyebrow">Same wallet</span>
            <h2>Your points stay aligned</h2>
            <p>AI Studio uses your current points wallet. Every AI message costs 5 points.</p>
          </div>
          <Link className="button" to="/ai-studio">Open AI Studio</Link>
        </section>
      )}

      {error && <p className="error-text centered-text">{error}</p>}

      {packages.length ? (
        <section className="point-pack-grid points-pack-grid">
          {packages.map((pack) => (
            <article className="card point-pack points-pack-card" key={pack.id}>
              {isAiMode ? <Bot size={34} /> : <Gem size={34} />}
              <span className="eyebrow">{pack.name}</span>
              <h2>{pack.points_amount.toLocaleString()} Points</h2>
              <p>
                {isAiMode
                  ? 'Use these points for AI access.'
                  : (pack.description || 'Use these points to unlock paid video gems.')}
              </p>
              <strong className="pack-price">${(pack.price_cents / 100).toFixed(2)}</strong>
              {user ? (
                <button className="button full" onClick={() => buyPack(pack)} disabled={busyId === pack.id || !pack.stripe_price_id}>
                  {busyId === pack.id ? 'Opening Checkout...' : 'Buy Pack'}
                </button>
              ) : (
                <Link className="button full" to="/login">Login to Buy Points</Link>
              )}
              {!pack.stripe_price_id && <small className="error-text">Missing Stripe Price ID. Add one in Supabase.</small>}
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="No point packs yet" text="Add Stripe Price IDs to your point_packages table in Supabase." />
      )}

      <section className="section how-grid compact points-how-grid">
        <div className="card mini-card">
          <Zap />
          <h3>Buy once</h3>
          <p>Choose a point pack and checkout through Stripe.</p>
        </div>
        <div className="card mini-card">
          {isAiMode ? <Sparkles /> : <Gem />}
          <h3>{isAiMode ? 'Use with AI' : 'Spend points'}</h3>
          <p>{isAiMode ? 'Send AI messages for 5 points each.' : 'Unlock only the specific videos you want.'}</p>
        </div>
        <div className="card mini-card">
          {isAiMode ? <Wallet /> : <ShieldCheck />}
          <h3>Same wallet</h3>
          <p>Your account balance stays shared across the platform.</p>
        </div>
      </section>
    </div>
  )
}
