import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Crown, Download, Film, RefreshCw, Search, WalletCards } from 'lucide-react'
import { adminGetPurchaseDashboard } from '../lib/api'
import Loader from './Loader'
import '../styles/admin-purchases.css'

function formatMoney(cents) {
  const value = Number(cents || 0)
  if (!value) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100)
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function buyerName(row) {
  return row.username ? `@${row.username}` : row.email || row.user_id || 'Unknown user'
}

function matchesQuery(row, query) {
  const clean = query.trim().toLowerCase()
  if (!clean) return true

  const blob = [
    row.email,
    row.username,
    row.user_id,
    row.package_name,
    row.tier_name,
    row.tier_key,
    row.status,
    row.stripe_session_id,
    row.stripe_subscription_id,
    row.stripe_price_id,
    row.description,
    row.video_title
  ].filter(Boolean).join(' ').toLowerCase()

  return blob.includes(clean)
}

function exportCsv(filename, rows) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => {
      const value = row[header] ?? ''
      return `"${String(value).replace(/"/g, '""')}"`
    }).join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminPurchasesPanel() {
  const [tab, setTab] = useState('points')
  const [summary, setSummary] = useState(null)
  const [pointPurchases, setPointPurchases] = useState([])
  const [vipPurchases, setVipPurchases] = useState([])
  const [videoPurchases, setVideoPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    setNotice('')

    try {
      const data = await adminGetPurchaseDashboard()
      setSummary(data.summary || {})
      setPointPurchases(data.point_purchases || [])
      setVipPurchases(data.vip_purchases || [])
      setVideoPurchases(data.video_purchases || [])
    } catch (err) {
      setNotice(err.message || 'Could not load purchase history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visiblePointPurchases = useMemo(() => pointPurchases.filter((row) => matchesQuery(row, query)), [pointPurchases, query])
  const visibleVipPurchases = useMemo(() => vipPurchases.filter((row) => matchesQuery(row, query)), [vipPurchases, query])
  const visibleVideoPurchases = useMemo(() => videoPurchases.filter((row) => matchesQuery(row, query)), [videoPurchases, query])

  const activeRows = tab === 'points'
    ? visiblePointPurchases
    : tab === 'vip'
      ? visibleVipPurchases
      : visibleVideoPurchases

  if (loading) return <Loader />

  return (
    <section className="admin-purchases-panel">
      <div className="card admin-purchases-header">
        <div>
          <span className="eyebrow">Purchases</span>
          <h2>Purchase History</h2>
          <p>View users who purchased point packs, VIP subscriptions, and video access.</p>
        </div>
        <button className="button" type="button" onClick={load}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {notice && <p className="notice-text purchase-notice">{notice}</p>}

      <section className="purchase-summary-grid">
        <article className="card purchase-summary-card">
          <WalletCards size={22} />
          <span>Point buyers</span>
          <strong>{summary?.point_purchase_count || 0}</strong>
          <small>{summary?.point_amount_total || 0} points purchased</small>
        </article>

        <article className="card purchase-summary-card">
          <CreditCard size={22} />
          <span>Point revenue</span>
          <strong>{formatMoney(summary?.point_purchase_revenue_cents)}</strong>
          <small>Estimated from package price</small>
        </article>

        <article className="card purchase-summary-card">
          <Crown size={22} />
          <span>VIP subscribers</span>
          <strong>{summary?.active_vip_count || 0}</strong>
          <small>{summary?.vip_purchase_count || 0} total VIP records</small>
        </article>

        <article className="card purchase-summary-card">
          <Film size={22} />
          <span>Video purchases</span>
          <strong>{summary?.video_purchase_count || 0}</strong>
          <small>{formatMoney(summary?.video_purchase_revenue_cents)} estimated</small>
        </article>
      </section>

      <div className="purchase-controls card">
        <div className="message-tabs purchase-tabs">
          <button type="button" className={tab === 'points' ? 'active' : ''} onClick={() => setTab('points')}>Point Purchases</button>
          <button type="button" className={tab === 'vip' ? 'active' : ''} onClick={() => setTab('vip')}>VIP Purchases</button>
          <button type="button" className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>Video Purchases</button>
        </div>

        <label className="purchase-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, username, Stripe session, tier, package..." />
        </label>

        <button className="ghost-button" type="button" onClick={() => exportCsv(`hidden-gems-${tab}-purchases.csv`, activeRows)}>
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {tab === 'points' && (
        <section className="card purchase-table-card">
          <div className="split-line">
            <div>
              <span className="eyebrow">Point Packs</span>
              <h3>Users who purchased points</h3>
            </div>
            <small>{visiblePointPurchases.length} rows</small>
          </div>

          <div className="purchase-table-wrap">
            <table className="purchase-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Package</th>
                  <th>Points</th>
                  <th>Price</th>
                  <th>Stripe Session</th>
                  <th>Purchased</th>
                </tr>
              </thead>
              <tbody>
                {visiblePointPurchases.length ? visiblePointPurchases.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{buyerName(row)}</strong><small>{row.email || row.user_id}</small></td>
                    <td>{row.package_name || row.description || 'Point purchase'}</td>
                    <td>{row.points_purchased || row.amount || 0}</td>
                    <td>{formatMoney(row.price_cents)}</td>
                    <td><code>{row.stripe_session_id || '—'}</code></td>
                    <td>{formatDate(row.purchased_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="6">No point purchases found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'vip' && (
        <section className="card purchase-table-card">
          <div className="split-line">
            <div>
              <span className="eyebrow">VIP</span>
              <h3>Users who purchased VIP</h3>
            </div>
            <small>{visibleVipPurchases.length} rows</small>
          </div>

          <div className="purchase-table-wrap">
            <table className="purchase-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stripe Subscription</th>
                  <th>Started</th>
                  <th>Renews / Ends</th>
                </tr>
              </thead>
              <tbody>
                {visibleVipPurchases.length ? visibleVipPurchases.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{buyerName(row)}</strong><small>{row.email || row.user_id}</small></td>
                    <td>{row.tier_name || row.tier_key || row.subscription_tier || 'VIP'}</td>
                    <td><span className={`purchase-status ${row.status || 'unknown'}`}>{row.status || 'unknown'}</span></td>
                    <td>{formatMoney(row.price_cents)}</td>
                    <td><code>{row.stripe_subscription_id || row.stripe_session_id || '—'}</code></td>
                    <td>{formatDate(row.started_at)}</td>
                    <td>{formatDate(row.current_period_end || row.renews_at || row.expires_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="7">No VIP purchases found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'videos' && (
        <section className="card purchase-table-card">
          <div className="split-line">
            <div>
              <span className="eyebrow">Video Access</span>
              <h3>Users who purchased videos</h3>
            </div>
            <small>{visibleVideoPurchases.length} rows</small>
          </div>

          <div className="purchase-table-wrap">
            <table className="purchase-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Video</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stripe Session</th>
                  <th>Purchased</th>
                </tr>
              </thead>
              <tbody>
                {visibleVideoPurchases.length ? visibleVideoPurchases.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{buyerName(row)}</strong><small>{row.email || row.user_id}</small></td>
                    <td>{row.video_title || row.video_id}</td>
                    <td><span className={`purchase-status ${row.payment_status || 'unknown'}`}>{row.payment_status || 'unknown'}</span></td>
                    <td>{formatMoney(row.price_cents)}</td>
                    <td><code>{row.stripe_session_id || row.stripe_payment_intent || '—'}</code></td>
                    <td>{formatDate(row.purchased_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="6">No video purchases found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
