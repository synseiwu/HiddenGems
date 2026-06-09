import { useEffect, useMemo, useState } from 'react'
import {
  adminAdjustUserPoints,
  deleteCategory,
  deleteVideo,
  listAdminProfiles,
  listAdminSecurityOverview,
  listAdminVideos,
  listCategories,
  listPointPackagesAdmin,
  listVipTiers,
  saveCategory,
  savePointPackage,
  saveVideo,
  saveVipTier
} from '../lib/api'
import { compressImage } from '../lib/image'
import { supabase } from '../lib/supabase'
import Loader from '../components/Loader'
import AdminCommunityPanel from '../components/AdminCommunityPanel'

const emptyVideoForm = {
  title: '',
  description: '',
  category_id: '',
  point_cost: 300,
  thumbnail_url: '',
  preview_url: '',
  external_video_link: '',
  access_type: 'points',
  published: true
}

const emptyTierForm = {
  tier_key: 'vip',
  name: 'VIP',
  description: '',
  price_cents: 1999,
  stripe_price_id: '',
  tier_rank: 1,
  sort_order: 1,
  features: 'VIP vault access',
  active: true
}

const emptyPackForm = {
  name: '',
  description: '',
  points_amount: 500,
  price_cents: 500,
  stripe_price_id: '',
  sort_order: 1,
  active: true
}

const emptyCategoryForm = { name: '', description: '' }

export default function Admin() {
  const [videos, setVideos] = useState([])
  const [categories, setCategories] = useState([])
  const [vipTiers, setVipTiers] = useState([])
  const [pointPackages, setPointPackages] = useState([])
  const [profiles, setProfiles] = useState([])
  const [security, setSecurity] = useState({ purchases: [], transactions: [], subscriptions: [], securityEvents: [] })
  const [videoForm, setVideoForm] = useState(emptyVideoForm)
  const [tierForm, setTierForm] = useState(emptyTierForm)
  const [packForm, setPackForm] = useState(emptyPackForm)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState('videos')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pointAdjust, setPointAdjust] = useState({ user_id: '', amount: 0, description: 'Admin point adjustment' })

  async function load() {
    const [v, c, tiers, packs, users, overview] = await Promise.all([
      listAdminVideos(),
      listCategories(),
      listVipTiers(true),
      listPointPackagesAdmin(),
      listAdminProfiles(),
      listAdminSecurityOverview().catch(() => ({ purchases: [], transactions: [], subscriptions: [], securityEvents: [] }))
    ])
    setVideos(v)
    setCategories(c)
    setVipTiers(tiers)
    setPointPackages(packs)
    setProfiles(users)
    setSecurity(overview)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => videos.filter((v) => [v.title, v.description, v.access_type, v.category_name].join(' ').toLowerCase().includes(query.toLowerCase())), [videos, query])

  function setVideoField(key, value) {
    setVideoForm((prev) => ({ ...prev, [key]: value }))
  }

  async function uploadThumb(file) {
    if (!file) return
    setBusy(true)
    setMessage('Compressing thumbnail...')
    try {
      const compressed = await compressImage(file)
      const path = `${crypto.randomUUID()}-${compressed.name}`
      const { error } = await supabase.storage.from('thumbnails').upload(path, compressed, {
        cacheControl: '31536000',
        upsert: false,
        contentType: 'image/webp'
      })
      if (error) throw error
      const { data } = supabase.storage.from('thumbnails').getPublicUrl(path)
      setVideoField('thumbnail_url', data.publicUrl)
      setMessage('Thumbnail uploaded and optimized.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitVideo(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('Saving listing...')
    try {
      await saveVideo(videoForm)
      setVideoForm(emptyVideoForm)
      await load()
      setMessage('Listing saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeVideo(id) {
    if (!confirm('Delete this listing?')) return
    await deleteVideo(id)
    await load()
  }

  function editVideo(video) {
    setVideoForm({ ...video, point_cost: video.point_cost ?? video.price_cents ?? 0, preview_url: video.preview_url || '' })
    setPanel('videos')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitTier(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveVipTier(tierForm)
      setTierForm(emptyTierForm)
      await load()
      setMessage('VIP tier saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitPack(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await savePointPackage(packForm)
      setPackForm(emptyPackForm)
      await load()
      setMessage('Point package saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitCategory(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveCategory(categoryForm)
      setCategoryForm(emptyCategoryForm)
      await load()
      setMessage('Category saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeCategory(id) {
    if (!confirm('Delete this category? Videos will not be deleted.')) return
    await deleteCategory(id)
    await load()
  }

  async function submitPointAdjustment(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await adminAdjustUserPoints(pointAdjust.user_id, pointAdjust.amount, pointAdjust.description)
      setPointAdjust({ user_id: '', amount: 0, description: 'Admin point adjustment' })
      await load()
      setMessage('User points adjusted.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="page admin-page">
      <section className="section-heading admin-heading-row">
        <div>
          <span className="eyebrow">Protected</span>
          <h1>Admin Panel</h1>
          <p>Manage listings, tiers, point packs, security checks, categories, and protected external access links.</p>
        </div>
        <label className="admin-panel-switcher">
          Admin Controls
          <select value={panel} onChange={(e) => setPanel(e.target.value)}>
            <option value="videos">Video Listings</option>
            <option value="settings">Site Settings</option>
            <option value="community">Community Rewards</option>
            <option value="security">Security Tools</option>
          </select>
        </label>
      </section>

      {message && <p className="notice-text admin-message">{message}</p>}

      {panel === 'videos' && (
        <section className="admin-grid">
          <form className="card admin-form" onSubmit={submitVideo}>
            <h2>{videoForm.id ? 'Edit Listing' : 'Add New Listing'}</h2>
            <label>Title<input value={videoForm.title} onChange={(e) => setVideoField('title', e.target.value)} required /></label>
            <label>Description<textarea value={videoForm.description} onChange={(e) => setVideoField('description', e.target.value)} required /></label>
            <label>Category<select value={videoForm.category_id || ''} onChange={(e) => setVideoField('category_id', e.target.value)}>
              <option value="">No category</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select></label>
            <label>Point Cost<input type="number" value={videoForm.point_cost ?? 0} onChange={(e) => setVideoField('point_cost', e.target.value)} min="0" /></label>
            <label>External Video Link<input value={videoForm.external_video_link || ''} onChange={(e) => setVideoField('external_video_link', e.target.value)} required /></label>
            <label>Preview URL / Embed URL<input value={videoForm.preview_url || ''} onChange={(e) => setVideoField('preview_url', e.target.value)} placeholder="Optional preview/share link" /></label>
            <label>Access Type<select value={videoForm.access_type} onChange={(e) => setVideoField('access_type', e.target.value)}>
              <option value="points">Points</option>
              <option value="vip">VIP</option>
              <option value="supervip">Super VIP</option>
              <option value="ultravip">Ultra VIP</option>
              <option value="free">Free</option>
              <option value="admin_only">Admin Only</option>
            </select></label>
            <label>Thumbnail Upload<input type="file" accept="image/*" onChange={(e) => uploadThumb(e.target.files?.[0])} /></label>
            <label>Thumbnail URL<input value={videoForm.thumbnail_url || ''} onChange={(e) => setVideoField('thumbnail_url', e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={videoForm.published} onChange={(e) => setVideoField('published', e.target.checked)} /> Published</label>
            <button className="button full" disabled={busy}>{busy ? 'Working...' : 'Save Listing'}</button>
            {videoForm.id && <button type="button" className="ghost-button full" onClick={() => setVideoForm(emptyVideoForm)}>Cancel Edit</button>}
          </form>

          <div className="card admin-list">
            <div className="split-line"><h2>Listings</h2><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search admin listings..." /></div>
            {filtered.map((video) => (
              <article className="admin-row" key={video.id}>
                <img src={video.thumbnail_url || '/placeholder.svg'} alt="" />
                <div>
                  <h3>{video.title}</h3>
                  <small>{video.access_type} · {video.point_cost ?? video.price_cents ?? 0} pts · {video.published ? 'Published' : 'Draft'}</small>
                </div>
                <button className="ghost-button" onClick={() => editVideo(video)}>Edit</button>
                <button className="danger-button" onClick={() => removeVideo(video.id)}>Delete</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {panel === 'settings' && (
        <section className="admin-settings-grid">
          <form className="card admin-form" onSubmit={submitTier}>
            <span className="eyebrow">VIP tiers</span>
            <h2>Manage VIP Tiers</h2>
            <label>Tier Key<input value={tierForm.tier_key} onChange={(e) => setTierForm((p) => ({ ...p, tier_key: e.target.value }))} placeholder="vip, supervip, ultravip" /></label>
            <label>Name<input value={tierForm.name} onChange={(e) => setTierForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>Description<textarea value={tierForm.description} onChange={(e) => setTierForm((p) => ({ ...p, description: e.target.value }))} /></label>
            <label>Monthly Price in Cents<input type="number" value={tierForm.price_cents} onChange={(e) => setTierForm((p) => ({ ...p, price_cents: e.target.value }))} /></label>
            <label>Stripe Price ID<input value={tierForm.stripe_price_id || ''} onChange={(e) => setTierForm((p) => ({ ...p, stripe_price_id: e.target.value }))} placeholder="price_..." /></label>
            <label>Access Rank<input type="number" value={tierForm.tier_rank} min="1" onChange={(e) => setTierForm((p) => ({ ...p, tier_rank: e.target.value }))} /></label>
            <label>Features<textarea value={Array.isArray(tierForm.features) ? tierForm.features.join('\n') : tierForm.features} onChange={(e) => setTierForm((p) => ({ ...p, features: e.target.value }))} placeholder="One feature per line" /></label>
            <label className="check"><input type="checkbox" checked={tierForm.active} onChange={(e) => setTierForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>
            <button className="button full" disabled={busy}>Save VIP Tier</button>
          </form>

          <div className="card admin-list">
            <h2>Current VIP Tiers</h2>
            {vipTiers.map((tier) => (
              <article className="admin-row admin-row-wide" key={tier.tier_key}>
                <div>
                  <h3>{tier.name} <small>rank {tier.tier_rank}</small></h3>
                  <small>{tier.active ? 'Active' : 'Inactive'} · ${(Number(tier.price_cents || 0) / 100).toFixed(2)} · {tier.stripe_price_id || 'No Stripe Price ID'}</small>
                </div>
                <button className="ghost-button" onClick={() => setTierForm({ ...tier, features: (tier.features || []).join('\n') })}>Edit</button>
              </article>
            ))}
          </div>

          <form className="card admin-form" onSubmit={submitPack}>
            <span className="eyebrow">Point packs</span>
            <h2>Manage Point Packages</h2>
            <label>Name<input value={packForm.name} onChange={(e) => setPackForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>Description<textarea value={packForm.description} onChange={(e) => setPackForm((p) => ({ ...p, description: e.target.value }))} /></label>
            <label>Points Amount<input type="number" value={packForm.points_amount} onChange={(e) => setPackForm((p) => ({ ...p, points_amount: e.target.value }))} /></label>
            <label>Price in Cents<input type="number" value={packForm.price_cents} onChange={(e) => setPackForm((p) => ({ ...p, price_cents: e.target.value }))} /></label>
            <label>Stripe Price ID<input value={packForm.stripe_price_id || ''} onChange={(e) => setPackForm((p) => ({ ...p, stripe_price_id: e.target.value }))} placeholder="price_..." /></label>
            <label>Sort Order<input type="number" value={packForm.sort_order} onChange={(e) => setPackForm((p) => ({ ...p, sort_order: e.target.value }))} /></label>
            <label className="check"><input type="checkbox" checked={packForm.active} onChange={(e) => setPackForm((p) => ({ ...p, active: e.target.checked }))} /> Active</label>
            <button className="button full" disabled={busy}>Save Point Pack</button>
          </form>

          <div className="card admin-list">
            <h2>Point Packs</h2>
            {pointPackages.map((pack) => (
              <article className="admin-row admin-row-wide" key={pack.id}>
                <div><h3>{pack.name}</h3><small>{pack.points_amount} points · ${(pack.price_cents / 100).toFixed(2)} · {pack.active ? 'Active' : 'Inactive'}</small></div>
                <button className="ghost-button" onClick={() => setPackForm(pack)}>Edit</button>
              </article>
            ))}
          </div>

          <form className="card admin-form" onSubmit={submitCategory}>
            <span className="eyebrow">Categories</span>
            <h2>Manage Categories</h2>
            <label>Name<input value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>Description<textarea value={categoryForm.description || ''} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} /></label>
            <button className="button full" disabled={busy}>Save Category</button>
            {categoryForm.id && <button type="button" className="ghost-button full" onClick={() => setCategoryForm(emptyCategoryForm)}>Cancel Edit</button>}
          </form>

          <div className="card admin-list">
            <h2>Categories</h2>
            {categories.map((cat) => (
              <article className="admin-row admin-row-wide" key={cat.id}>
                <div><h3>{cat.name}</h3><small>{cat.description || 'No description'}</small></div>
                <button className="ghost-button" onClick={() => setCategoryForm(cat)}>Edit</button>
                <button className="danger-button" onClick={() => removeCategory(cat.id)}>Delete</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {panel === 'community' && <AdminCommunityPanel />}

      {panel === 'security' && (
        <section className="admin-settings-grid">
          <div className="card admin-list">
            <span className="eyebrow">Security</span>
            <h2>Protected Access Checklist</h2>
            <ul className="security-checklist">
              <li>Full external links are only returned by verified RPC access checks.</li>
              <li>Video table full rows are admin-only through RLS.</li>
              <li>Points can only be added by Stripe webhook or admin RPC.</li>
              <li>Points unlocks only happen through the Edge Function and database RPC.</li>
              <li>VIP tier status is set by Stripe webhook, not frontend input.</li>
            </ul>
          </div>

          <form className="card admin-form" onSubmit={submitPointAdjustment}>
            <span className="eyebrow">Admin only</span>
            <h2>Adjust User Points</h2>
            <label>User<select value={pointAdjust.user_id} onChange={(e) => setPointAdjust((p) => ({ ...p, user_id: e.target.value }))} required>
              <option value="">Choose user</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.email} · {profile.role} · {profile.subscription_tier || 'none'}</option>)}
            </select></label>
            <label>Amount<input type="number" value={pointAdjust.amount} onChange={(e) => setPointAdjust((p) => ({ ...p, amount: e.target.value }))} placeholder="Use negative number to remove" /></label>
            <label>Description<input value={pointAdjust.description} onChange={(e) => setPointAdjust((p) => ({ ...p, description: e.target.value }))} /></label>
            <button className="button full" disabled={busy}>Apply Adjustment</button>
          </form>

          <div className="card admin-list">
            <h2>Recent Point Transactions</h2>
            {security.transactions.map((tx) => (
              <article className="admin-row admin-row-wide" key={tx.id}>
                <div><h3>{tx.profiles?.email || tx.user_id}</h3><small>{tx.amount} · {tx.transaction_type} · {tx.description || 'No description'} · {new Date(tx.created_at).toLocaleString()}</small></div>
              </article>
            ))}
          </div>

          <div className="card admin-list">
            <h2>Recent Unlocks</h2>
            {security.purchases.map((purchase) => (
              <article className="admin-row admin-row-wide" key={purchase.id}>
                <div><h3>{purchase.videos?.title || purchase.video_id}</h3><small>{purchase.profiles?.email || purchase.user_id} · {purchase.payment_status} · {new Date(purchase.purchased_at).toLocaleString()}</small></div>
              </article>
            ))}
          </div>

          <div className="card admin-list">
            <h2>Recent VIP Subscriptions</h2>
            {security.subscriptions.map((sub) => (
              <article className="admin-row admin-row-wide" key={sub.id}>
                <div><h3>{sub.profiles?.email || sub.user_id}</h3><small>{sub.vip_tiers?.name || sub.tier_key || 'VIP'} · {sub.status} · {sub.stripe_subscription_id || 'No Stripe ID'}</small></div>
              </article>
            ))}
          </div>

          <div className="card admin-list">
            <h2>Security Events</h2>
            {security.securityEvents.length ? security.securityEvents.map((event) => (
              <article className="admin-row admin-row-wide" key={event.id}>
                <div><h3>{event.event_type}</h3><small>{event.email || event.user_id || 'unknown'} · {event.details?.reason || 'No details'} · {new Date(event.created_at).toLocaleString()}</small></div>
              </article>
            )) : <p className="muted">No security events yet.</p>}
          </div>
        </section>
      )}
    </div>
  )
}
