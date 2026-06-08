import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Crown, ExternalLink, Gem, Lock, PlayCircle, ShieldCheck, XCircle } from 'lucide-react'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { getAccessLabel, getAccessRank, getUnlockedVideo, getVideoDetails, getWallet, isVipAccessType, unlockVideoWithPoints } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

function canEmbedPreview(url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export default function VideoDetails() {
  const { id } = useParams()
  const { user, isAdmin, vipRank } = useAuth()
  const [video, setVideo] = useState(null)
  const [unlocked, setUnlocked] = useState(null)
  const [wallet, setWallet] = useState({ points_balance: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewMode, setPreviewMode] = useState('idle')

  async function load() {
    try {
      const safeVideo = await getVideoDetails(id)
      setVideo(safeVideo)
      if (user) {
        const [unlockData, walletData] = await Promise.all([getUnlockedVideo(id), getWallet()])
        setUnlocked(unlockData)
        setWallet(walletData)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPreviewMode('idle')
    setLoading(true)
    load()
  }, [id, user])

  async function unlock() {
    if (!user) return
    setBusy(true)
    setError('')
    try {
      await unlockVideoWithPoints(id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />
  if (!video) return <EmptyState title="Video not found" text={error || 'This listing may be unpublished.'} />

  const pointCost = video.point_cost ?? video.price_cents ?? 0
  const requiredRank = getAccessRank(video.access_type)
  const accessLabel = getAccessLabel(video.access_type)
  const costLabel = video.access_type === 'free' ? 'Free' : isVipAccessType(video.access_type) ? accessLabel : `${pointCost} points`
  const canAfford = Number(wallet.points_balance || 0) >= Number(pointCost || 0)
  const missingPoints = Math.max(Number(pointCost || 0) - Number(wallet.points_balance || 0), 0)
  const canShowPreview = canEmbedPreview(video.preview_url)
  const hasFullAccess = Boolean(unlocked?.external_video_link)
  const tierLocked = isVipAccessType(video.access_type) && !hasFullAccess && !isAdmin && Number(vipRank || 0) < requiredRank

  return (
    <div className="page details-page">
      <section className="grid-2 detail-grid">
        <div className="detail-media-stack">
          <div className={tierLocked ? 'detail-image-shell vip-locked-media card' : 'detail-image-shell card'}>
            <img className="detail-image" src={video.thumbnail_url || '/placeholder.svg'} alt={video.title} />
            {tierLocked && <div className="vip-media-overlay"><Crown size={18} /> {accessLabel} preview hidden</div>}
          </div>
          {video.preview_url && (
            <div className="card preview-card">
              <div className="split-line">
                <h3><PlayCircle size={18} /> Preview</h3>
                <a className="ghost-button small" href={video.preview_url} target="_blank" rel="noreferrer">Open Preview</a>
              </div>

              {previewMode === 'idle' && (
                <div className="preview-shell">
                  <img className={tierLocked ? 'vip-thumb-blur' : ''} src={video.thumbnail_url || '/placeholder.svg'} alt={`${video.title} preview thumbnail`} />
                  <div className="preview-overlay">
                    <p>Preview available</p>
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => setPreviewMode(canShowPreview ? 'embed' : 'blocked')}
                    >
                      <PlayCircle size={16} /> Play Preview
                    </button>
                    <small>Loads only when clicked so the page stays fast.</small>
                  </div>
                </div>
              )}

              {previewMode === 'embed' && (
                <>
                  <iframe
                    title={`${video.title} preview`}
                    src={video.preview_url}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    allow="autoplay; fullscreen; picture-in-picture"
                  />
                  <p className="muted tiny-note">If the player shows an error or blank page, this provider does not allow on-site embeds. Use Open Preview instead.</p>
                </>
              )}

              {previewMode === 'blocked' && (
                <div className="preview-blocked">
                  <XCircle size={18} />
                  <p>This preview link cannot be embedded safely. Open it in a new tab instead.</p>
                  <a className="button compact" href={video.preview_url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} /> Open Preview
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="card detail-panel">
          <span className="pill">{video.category_name || 'Gem'}</span>
          <h1>{video.title}</h1>
          <p>{video.description}</p>
          <div className="price-line"><strong>{costLabel}</strong> <span>{isVipAccessType(video.access_type) ? 'Subscription tier access' : 'Point unlock access'}</span></div>
          {user && <p className="wallet-line"><Gem size={16} /> Your balance: <strong>{wallet.points_balance || 0} points</strong></p>}
          {isVipAccessType(video.access_type) && video.access_type !== 'admin_only' && <p className="notice"><Crown size={16} /> {accessLabel} members can access this content while their subscription is active.</p>}
          {video.access_type === 'admin_only' && <p className="notice"><ShieldCheck size={16} /> Admin-only content. Full links stay hidden from customer roles.</p>}

          {hasFullAccess ? (
            <a className="button full" href={unlocked.external_video_link} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Open External Video Link
            </a>
          ) : !user ? (
            <Link className="button full" to="/login"><Lock size={16} /> Login to Unlock</Link>
          ) : isVipAccessType(video.access_type) ? (
            <Link className="button full" to="/vip"><Crown size={16} /> Upgrade to {accessLabel}</Link>
          ) : video.access_type === 'free' ? (
            <button className="button full" onClick={unlock} disabled={busy}>{busy ? 'Unlocking...' : 'Unlock Free Video'}</button>
          ) : canAfford ? (
            <button className="button full" onClick={unlock} disabled={busy}>
              <Gem size={16} /> {busy ? 'Unlocking...' : `Unlock for ${pointCost} Points`}
            </button>
          ) : (
            <Link
              className="button full"
              to={`/points?needed=${missingPoints}&video=${id}&title=${encodeURIComponent(video.title)}`}
            >
              <Gem size={16} /> Need {missingPoints} More Points
            </Link>
          )}

          {error && <p className="error-text">{error}</p>}
          <small>Full external links stay hidden until points are spent, the required VIP tier is active, or admin access is verified.</small>
        </div>
      </section>
    </div>
  )
}
