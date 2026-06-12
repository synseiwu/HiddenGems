import { useEffect, useState } from 'react'
import { Bot, BrainCircuit, Gem, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { createPointsCheckoutSession, getWallet, listPointPackages } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import '../styles/mode-pages.css'

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
        text: 'Buy points once, then use the same account wallet for AI messages, saved chats, and enabled AI Studio tools.'
      }
    : {
        eyebrow: 'Points',
        title: 'Buy Points. Unlock Gems.',
        text: 'Points are the main Hidden Gems unlock system. Buy a pack once, then spend points on the videos you want.'
      }

  return (
    <div className="page mode-aware-page">
      <section className="hero centered mode-hero">
        <span className="eyebrow">{hero.eyebrow}</span>
        <h1>{hero.title}</h1>
        <p>{hero.text}</p>
        {user && <p className="wallet-badge"><Gem size={18} /> Current balance: <strong>{wallet.points_balance || 0} points</strong></p>}
      </section>

      {hasUnlockContext && (
        <div className="card points-context-card">
          <Gem size={22} />
          <div>
            <strong>You need {neededPoints.toLocaleString()} more points{decodeURIComponent(returnVideoTitle || '') ? ` to unlock ${decodeURIComponent(returnVideoTitle)}` : ''}.</strong>
            <p>Pick a pack below, then return to the video to unlock it with points.</p>
          </div>
          {returnVideoId && <Link className="ghost-button small" to={`/videos/${returnVideoId}`}>Back to video</Link>}
        </div>
      )}

      {isAiMode && (
        <section className="card mode-info-card">
          <BrainCircuit size={30} />
          <div>
            <span className="eyebrow">Same wallet</span>
            <h2>Your points stay aligned</h2>
            <p>No separate AI balance is created. AI Studio uses the same points wallet already attached to your account.</p>
          </div>
          <Link className="button" to="/ai-studio">Open AI Studio</Link>
        </section>
      )}

      {error && <p className="error-text centered-text">{error}</p>}

      {packages.length ? (
        <section className="point-pack-grid mode-card-grid">
          {packages.map((pack) => (
            <article className="card point-pack mode-card" key={pack.id}>
              {isAiMode ? <Bot size={34} /> : <Gem size={34} />}
              <span className="eyebrow">{pack.name}</span>
              <h2>{pack.points_amount.toLocaleString()} Points</h2>
              <p>
                {isAiMode
                  ? (pack.description || 'Use these points for AI messages and enabled AI Studio tools.')
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

      <section className="section how-grid compact mode-how-grid">
        <div className="card mini-card"><Zap /><h3>Buy once</h3><p>Stripe confirms your point pack payment.</p></div>
        <div className="card mini-card">
          {isAiMode ? <Sparkles /> : <Gem />}
          <h3>{isAiMode ? 'Use with AI' : 'Spend points'}</h3>
          <p>{isAiMode ? 'Send AI messages and use enabled AI Studio tools.' : 'Unlock only the specific videos you want.'}</p>
        </div>
        <div className="card mini-card">
          {isAiMode ? <Wallet /> : <ShieldCheck />}
          <h3>{isAiMode ? 'Same wallet' : 'Protected links'}</h3>
          <p>{isAiMode ? 'Your account balance stays shared across the platform.' : 'External links reveal only after secure unlock verification.'}</p>
        </div>
      </section>
    </div>
  )
}
