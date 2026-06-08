import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Gem, ShieldCheck, Sparkles } from 'lucide-react'
import { createVipCheckoutSession, listVipTiers } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Loader from '../components/Loader'

const fallbackTiers = [
  {
    tier_key: 'vip',
    name: 'VIP',
    description: 'Base VIP vault access.',
    price_cents: 1999,
    tier_rank: 1,
    features: ['VIP-only listings', 'Verified subscription access', 'Vault releases']
  }
]

export default function Vip() {
  const { user, vipRank, vipTier } = useAuth()
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyTier, setBusyTier] = useState('')

  useEffect(() => {
    listVipTiers(false)
      .then((data) => setTiers(data.length ? data : fallbackTiers))
      .catch(() => setTiers(fallbackTiers))
      .finally(() => setLoading(false))
  }, [])

  async function upgrade(tierKey) {
    setBusyTier(tierKey)
    setError('')
    try {
      const url = await createVipCheckoutSession(tierKey)
      window.location.href = url
    } catch (err) {
      setError(err.message)
      setBusyTier('')
    }
  }

  if (loading) return <Loader />

  return (
    <div className="page">
      <section className="hero centered">
        <span className="eyebrow">VIP Vault</span>
        <h1>Choose Your Hidden Gems Tier</h1>
        <p>VIP tiers unlock role-based vault releases while your subscription is active. Higher tiers include access to lower-tier vault content unless changed by admin.</p>
      </section>

      <section className="vip-tier-grid">
        {tiers.map((tier) => {
          const current = Number(vipRank || 0) >= Number(tier.tier_rank || 1) && vipTier !== 'none'
          const price = `$${(Number(tier.price_cents || 0) / 100).toFixed(2)}`
          return (
            <article className={current ? 'card vip-tier-card active-tier' : 'card vip-tier-card'} key={tier.tier_key}>
              <div className="split-line">
                <Crown size={34} />
                <span className="pill">Rank {tier.tier_rank}</span>
              </div>
              <span className="eyebrow">{tier.name}</span>
              <h2>{price}<small>/month</small></h2>
              <p>{tier.description}</p>
              <ul className="tier-features">
                {(tier.features || []).map((feature) => <li key={feature}><ShieldCheck size={16} /> {feature}</li>)}
                {Number(tier.tier_rank || 1) > 1 && <li><Sparkles size={16} /> Includes lower-tier access</li>}
              </ul>
              {user ? (
                <button className="button full" onClick={() => upgrade(tier.tier_key)} disabled={busyTier === tier.tier_key || current}>
                  {current ? 'Current Access Active' : busyTier === tier.tier_key ? 'Opening Checkout...' : `Upgrade to ${tier.name}`}
                </button>
              ) : (
                <Link className="button full" to="/login">Login to Upgrade</Link>
              )}
            </article>
          )
        })}
      </section>

      <section className="card wide info-card">
        <Gem size={30} />
        <h2>Points and VIP stay separate</h2>
        <p>Points unlock standard videos one by one. VIP, Super VIP, and Ultra VIP unlock tier-based vault releases only while the matching Stripe subscription is active.</p>
      </section>

      {error && <p className="error-text centered-text">{error}</p>}
    </div>
  )
}
