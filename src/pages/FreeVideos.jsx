import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, ExternalLink, Gift, Lock, PlayCircle, Sparkles } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ModeUnavailable from '../components/ModeUnavailable'
import { claimFreeVideoReward, getPublicRewardSettings, getWallet, listFreeVideos, listMyFreeVideoRewardClaims } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/free-videos.css'

export default function FreeVideos() {
  const { user, isAdmin } = useAuth()
  const { isAiMode, loading: modeLoading } = useSiteMode()
  const [videos, setVideos] = useState([])
  const [claims, setClaims] = useState([])
  const [settings, setSettings] = useState(null)
  const [wallet, setWallet] = useState({ points_balance: 0 })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [timerState, setTimerState] = useState({})
  const [message, setMessage] = useState('')
  const timers = useRef({})

  const claimedVideoIds = useMemo(() => new Set((claims || []).map((claim) => claim.video_id)), [claims])

  async function load() {
    setLoading(true)
    setMessage('')

    try {
      const rewardSettings = await getPublicRewardSettings()
      setSettings(rewardSettings)

      const freeVideos = await listFreeVideos()
      setVideos(freeVideos)

      if (user) {
        const [claimRows, walletData] = await Promise.all([
          listMyFreeVideoRewardClaims().catch(() => []),
          getWallet().catch(() => ({ points_balance: 0 }))
        ])

        setClaims(claimRows)
        setWallet(walletData)
      } else {
        setClaims([])
      }
    } catch (err) {
      setMessage(err.message || 'Could not load free videos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (modeLoading) return
    if (isAiMode && !isAdmin) {
      setLoading(false)
      return
    }

    load()

    return () => {
      Object.values(timers.current).forEach((timer) => window.clearInterval(timer))
      timers.current = {}
    }
  }, [user, isAiMode, isAdmin, modeLoading])

  function getRewardAmount(video) {
    return Number(video.free_reward_points ?? settings?.free_video_default_points ?? 25)
  }

  function getMinSeconds(video) {
    return Number(video.free_reward_min_seconds ?? settings?.free_video_min_watch_seconds ?? 20)
  }

  async function claim(video) {
    if (!user) return
    setBusyId(video.id)
    setMessage('')

    try {
      const result = await claimFreeVideoReward(video.id)

      if (result?.granted) {
        setMessage(result.message || `Earned ${result.amount || getRewardAmount(video)} points.`)
        setWallet((prev) => ({ ...prev, points_balance: result.points_balance ?? prev.points_balance }))
        await load()
      } else {
        setMessage(result?.message || 'Reward already claimed or currently unavailable.')
        await load()
      }
    } catch (err) {
      setMessage(err.message || 'Could not claim this reward.')
    } finally {
      setBusyId('')
      setTimerState((prev) => ({ ...prev, [video.id]: null }))
    }
  }

  function startWatch(video) {
    if (!user) return
    if (claimedVideoIds.has(video.id)) return

    if (video.external_video_link) {
      window.open(video.external_video_link, '_blank', 'noopener,noreferrer')
    }

    const minSeconds = Math.max(getMinSeconds(video), 0)

    if (minSeconds <= 0) {
      claim(video)
      return
    }

    if (timers.current[video.id]) {
      return
    }

    setTimerState((prev) => ({ ...prev, [video.id]: minSeconds }))
    setMessage(`Watch timer started for ${video.title}. Keep this page open for ${minSeconds} seconds.`)

    timers.current[video.id] = window.setInterval(() => {
      setTimerState((prev) => {
        const remaining = Number(prev[video.id] || 0) - 1

        if (remaining <= 0) {
          window.clearInterval(timers.current[video.id])
          delete timers.current[video.id]
          claim(video)
          return { ...prev, [video.id]: 0 }
        }

        return { ...prev, [video.id]: remaining }
      })
    }, 1000)
  }

  if (loading || modeLoading) return <Loader />

  if (isAiMode && !isAdmin) {
    return (
      <ModeUnavailable
        title="Free Videos are available in Hidden Gems mode"
        text="Open Access Info and switch into Hidden Gems video mode to view free videos and earn points."
      />
    )
  }

  return (
    <div className="page free-videos-page">
      <section className="hero free-videos-hero">
        <span className="eyebrow">Hidden Gems</span>
        <h1>Free Videos</h1>
        <p>Watch free videos and earn points while exploring Hidden Gems.</p>

        <div className="free-video-stats-row">
          <span><Gift size={16} /> Default reward: {settings?.free_video_default_points ?? 25} points</span>
          <span><Clock size={16} /> Watch timer: {settings?.free_video_min_watch_seconds ?? 20}s</span>
          {user && <span><Sparkles size={16} /> Balance: {wallet.points_balance || 0} points</span>}
        </div>
      </section>

      {message && <p className="notice-text free-video-notice">{message}</p>}

      {!settings?.free_video_reward_enabled && (
        <div className="card free-video-warning">
          <strong>Rewards are currently disabled.</strong>
          <p>You can still view free videos, but points are not being awarded right now.</p>
        </div>
      )}

      {videos.length ? (
        <section className="free-video-grid">
          {videos.map((video) => {
            const claimed = claimedVideoIds.has(video.id)
            const remaining = timerState[video.id]
            const rewardAmount = getRewardAmount(video)
            const rewardEnabled = settings?.free_video_reward_enabled !== false && video.free_reward_enabled !== false

            return (
              <article className="card free-video-card" key={video.id}>
                <div className="free-video-thumb-wrap">
                  <img src={video.thumbnail_url || '/placeholder.svg'} alt="" />
                  <span className="free-video-badge">Free</span>
                  {rewardEnabled && <span className="free-video-reward">+{rewardAmount} pts</span>}
                </div>

                <div className="free-video-body">
                  <span className="eyebrow">{video.category_name || video.access_type || 'Free Video'}</span>
                  <h2>{video.title}</h2>
                  <p>{video.description || 'Watch this free video and earn points for your account.'}</p>
                </div>

                <div className="free-video-actions">
                  {video.external_video_link && (
                    <a className="ghost-button" href={video.external_video_link} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      Open Video
                    </a>
                  )}

                  {!user ? (
                    <Link className="button" to="/login">
                      <Lock size={16} />
                      Log in to Earn
                    </Link>
                  ) : claimed ? (
                    <button className="button disabled-button" type="button" disabled>
                      Already Claimed
                    </button>
                  ) : remaining > 0 ? (
                    <button className="button" type="button" disabled>
                      <Clock size={16} />
                      Earning in {remaining}s
                    </button>
                  ) : (
                    <button className="button" type="button" onClick={() => startWatch(video)} disabled={busyId === video.id || !rewardEnabled}>
                      <PlayCircle size={16} />
                      {busyId === video.id ? 'Claiming...' : rewardEnabled ? 'Watch & Earn' : 'Rewards Disabled'}
                    </button>
                  )}
                </div>

                <Link className="free-video-detail-link" to={`/videos/${video.id}`}>
                  View details
                </Link>
              </article>
            )
          })}
        </section>
      ) : (
        <EmptyState title="No free videos yet" text="Admin can mark videos as free from the video editor." />
      )}
    </div>
  )
}
