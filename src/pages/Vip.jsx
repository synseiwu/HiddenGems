import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, BrainCircuit, Crown, Gem, ShieldCheck, Sparkles } from 'lucide-react'
import { createVipCheckoutSession, listVipTiers } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import Loader from '../components/Loader'
import '../styles/mode-pages.css'

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

function aiFeatureText(feature) {
  return String(feature || '')
    .replaceAll('VIP-only listings', 'Member AI features')
    .replaceAll('Vault releases', 'Premium AI Studio access')
    .replaceAll('vault releases', 'AI Studio releases')
    .replaceAll('vault content', 'AI Studio access')
    .replaceAll('videos', 'AI tools')
    .replaceAll('video', 'AI tool')
    .replaceAll('drops', 'features')
}

export default function Vip() {
  const { user, vipRank, vipTier } = useAuth()
  const { isAiMode, loading: modeLoading } = useSiteMode()
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

  if (loading || modeLoading) return <Loader />

  return (
    <div className="page mode-aware-page">
      <section className="hero centered mode-hero">
        <span className="eyebrow">{isAiMode ? 'AI Membership' : 'VIP Vault'}</span>
        <h1>{isAiMode ? 'Premium AI Studio Access' : 'Choose Your Hidden Gems Tier'}</h1>
        <p>
          {isAiMode
            ? 'Membership tiers can support expanded AI Studio features while your subscription is active. Points remain the shared wallet for AI messages and enabled tools.'
            : 'VIP tiers unlock role-based vault releases while your subscription is active. Higher tiers include access to lower-tier vault content unless changed by admin.'}
        </p>
      </section>

      <section className="vip-tier-grid mode-card-grid">
        {tiers.map((tier) => {
          const current = Number(vipRank || 0) >= Number(tier.tier_rank || 1) && vipTier !== 'none'
          const price = `$${(Number(tier.price_cents || 0) / 100).toFixed(2)}`
          const description = isAiMode ? aiFeatureText(tier.description || 'Premium AI Studio access.') : tier.description
          return (
            <article className={current ? 'card vip-tier-card active-tier mode-card' : 'card vip-tier-card mode-card'} key={tier.tier_key}>
              <div className="split-line">
                {isAiMode ? <Bot size={34} /> : <Crown size={34} />}
                <span className="pill">Rank {tier.tier_rank}</span>
              </div>
              <span className="eyebrow">{tier.name}</span>
              <h2>{price}<small>/month</small></h2>
              <p>{description}</p>
              <ul className="tier-features">
                {(tier.features || []).map((feature) => <li key={feature}><ShieldCheck size={16} /> {isAiMode ? aiFeatureText(feature) : feature}</li>)}
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

      <section className="card wide info-card mode-info-card">
        {isAiMode ? <BrainCircuit size={30} /> : <Gem size={30} />}
        <h2>{isAiMode ? 'Points and AI access stay aligned' : 'Points and VIP stay separate'}</h2>
        <p>
          {isAiMode
            ? 'Your existing points wallet powers AI messages and enabled AI Studio tools. Membership status can unlock premium platform features while active.'
            : 'Points unlock standard videos one by one. VIP, Super VIP, and Ultra VIP unlock tier-based vault releases only while the matching Stripe subscription is active.'}
        </p>
      </section>

      {error && <p className="error-text centered-text">{error}</p>}
    </div>
  )
}
