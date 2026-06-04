import { Crown, Gem, ShieldCheck } from 'lucide-react'
import { createVipCheckoutSession } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Vip() {
  const { user, isVip } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function upgrade() {
    setBusy(true)
    setError('')
    try {
      const url = await createVipCheckoutSession()
      window.location.href = url
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <section className="hero centered">
        <span className="eyebrow">VIP</span>
        <h1>Premium Hidden Gems Access</h1>
        <p>VIP unlocks member-only vault releases while your subscription is active. Points remain the main unlock method for standard videos.</p>
      </section>
      <section className="vip-card card wide glow">
        <Crown size={56} />
        <h2>{isVip ? 'You are VIP' : 'Upgrade to VIP'}</h2>
        <p>VIP status is verified through Stripe and stored securely in Supabase so VIP-only links stay protected until your subscription is active.</p>
        <div className="how-grid compact">
          <div><Gem /> VIP-only listings</div>
          <div><ShieldCheck /> Verified subscription access</div>
          <div><Crown /> Vault releases</div>
        </div>
        {user ? (
          <button className="button full" onClick={upgrade} disabled={busy || isVip}>{isVip ? 'VIP Active' : busy ? 'Opening Checkout...' : 'Upgrade with Stripe'}</button>
        ) : (
          <Link className="button full" to="/login">Login to Upgrade</Link>
        )}
        {error && <p className="error-text">{error}</p>}
      </section>
    </div>
  )
}
