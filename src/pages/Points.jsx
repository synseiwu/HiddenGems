import { useEffect, useState } from 'react'
import { Gem, ShieldCheck, Zap } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { createPointsCheckoutSession, getWallet, listPointPackages } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'

export default function Points() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [packages, setPackages] = useState([])
  const [wallet, setWallet] = useState({ points_balance: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const neededPoints = Number(searchParams.get('needed') || 0)
  const returnVideoId = searchParams.get('video') || ''
  const returnVideoTitle = searchParams.get('title') || ''
  const hasUnlockContext = neededPoints > 0

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

  if (loading) return <Loader />

  return (
    <div className="page">
      <section className="hero centered">
        <span className="eyebrow">Points</span>
        <h1>Buy Points. Unlock Gems.</h1>
        <p>Points are the main Hidden Gems unlock system. Buy a pack once, then spend points on the videos you want.</p>
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

      {error && <p className="error-text centered-text">{error}</p>}

      {packages.length ? (
        <section className="point-pack-grid">
          {packages.map((pack) => (
            <article className="card point-pack" key={pack.id}>
              <Gem size={34} />
              <span className="eyebrow">{pack.name}</span>
              <h2>{pack.points_amount.toLocaleString()} Points</h2>
              <p>{pack.description || 'Use these points to unlock paid video gems.'}</p>
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

      <section className="section how-grid compact">
        <div className="card mini-card"><Zap /><h3>Buy once</h3><p>Stripe confirms your point pack payment.</p></div>
        <div className="card mini-card"><Gem /><h3>Spend points</h3><p>Unlock only the specific videos you want.</p></div>
        <div className="card mini-card"><ShieldCheck /><h3>Protected links</h3><p>External links reveal only after secure unlock verification.</p></div>
      </section>
    </div>
  )
}
