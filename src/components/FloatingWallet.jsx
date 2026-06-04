import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Coins, Plus } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getWallet } from '../lib/api'

export default function FloatingWallet() {
  const { user } = useAuth()
  const location = useLocation()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)

  async function loadWallet() {
    if (!user) return
    setLoading(true)
    try {
      const wallet = await getWallet()
      setBalance(Number(wallet?.points_balance || 0))
    } catch {
      setBalance(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadWallet()

    const onFocus = () => loadWallet()
    const onWalletUpdate = () => loadWallet()
    const onVisibility = () => {
      if (!document.hidden) loadWallet()
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('wallet:refresh', onWalletUpdate)
    document.addEventListener('visibilitychange', onVisibility)

    const interval = window.setInterval(loadWallet, 30000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('wallet:refresh', onWalletUpdate)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    if (user) loadWallet()
  }, [location.pathname, user])

  if (!user) return null

  return (
    <aside className="floating-wallet" aria-label="Current points balance">
      <div className="floating-wallet-main">
        <Coins size={20} />
        <span className="floating-wallet-label">Points</span>
        <strong>{loading ? '...' : balance.toLocaleString()}</strong>
      </div>
      <Link className="floating-wallet-action" to="/points" aria-label="Buy points">
        <Plus size={18} />
        <span>Buy</span>
      </Link>
    </aside>
  )
}
