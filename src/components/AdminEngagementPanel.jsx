import { useEffect, useMemo, useState } from 'react'
import {
  adminAdjustVideoViewCount,
  adminSetVideoViewCount,
  getEngagementSettings,
  listAdminVideoStats,
  saveEngagementSettings
} from '../lib/api'
import Loader from './Loader'

const defaultSettings = {
  show_likes: true,
  show_dislikes: true,
  show_views: true,
  show_comments: true,
  show_stats_on_cards: true,
  show_stats_on_details: true,
  show_stats_on_homepage: true,
  view_tracking_enabled: true,
  view_cooldown_minutes: 60,
  compact_counts: true
}

export default function AdminEngagementPanel() {
  const [settings, setSettings] = useState(defaultSettings)
  const [videos, setVideos] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [edits, setEdits] = useState({})

  async function load() {
    const [settingsData, statsData] = await Promise.all([
      getEngagementSettings().catch(() => defaultSettings),
      listAdminVideoStats().catch(() => [])
    ])
    setSettings({ ...defaultSettings, ...settingsData })
    setVideos(statsData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filteredVideos = useMemo(() => {
    const needle = query.toLowerCase()
    return videos.filter((video) => [video.title, video.category_name, video.access_type].join(' ').toLowerCase().includes(needle))
  }, [videos, query])

  function setField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function setEdit(videoId, key, value) {
    setEdits((prev) => ({ ...prev, [videoId]: { ...(prev[videoId] || {}), [key]: value } }))
  }

  async function submitSettings(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveEngagementSettings(settings)
      await load()
      setMessage('Engagement settings saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function setViews(videoId) {
    setBusy(true)
    setMessage('')
    try {
      await adminSetVideoViewCount(videoId, edits[videoId]?.set_count ?? 0)
      await load()
      setMessage('View count updated.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function adjustViews(videoId, amount) {
    setBusy(true)
    setMessage('')
    try {
      await adminAdjustVideoViewCount(videoId, amount)
      await load()
      setMessage('View count adjusted.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-settings-grid">
      <form className="card admin-form" onSubmit={submitSettings}>
        <span className="eyebrow">Engagement</span>
        <h2>Video Stats Settings</h2>

        <label className="check"><input type="checkbox" checked={settings.show_likes} onChange={(e) => setField('show_likes', e.target.checked)} /> Show like counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_dislikes} onChange={(e) => setField('show_dislikes', e.target.checked)} /> Show dislike counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_views} onChange={(e) => setField('show_views', e.target.checked)} /> Show view counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_comments} onChange={(e) => setField('show_comments', e.target.checked)} /> Show comment counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_stats_on_cards} onChange={(e) => setField('show_stats_on_cards', e.target.checked)} /> Show stats on video cards</label>
        <label className="check"><input type="checkbox" checked={settings.show_stats_on_details} onChange={(e) => setField('show_stats_on_details', e.target.checked)} /> Show stats on video details pages</label>
        <label className="check"><input type="checkbox" checked={settings.show_stats_on_homepage} onChange={(e) => setField('show_stats_on_homepage', e.target.checked)} /> Show stats on homepage showcase rows</label>
        <label className="check"><input type="checkbox" checked={settings.view_tracking_enabled} onChange={(e) => setField('view_tracking_enabled', e.target.checked)} /> Enable view tracking</label>
        <label>View cooldown minutes<input type="number" min="1" value={settings.view_cooldown_minutes} onChange={(e) => setField('view_cooldown_minutes', e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={settings.compact_counts} onChange={(e) => setField('compact_counts', e.target.checked)} /> Compact count display, like 1.2K</label>

        <button className="button full" disabled={busy}>{busy ? 'Saving...' : 'Save Engagement Settings'}</button>
        {message && <p className="notice-text">{message}</p>}
      </form>

      <div className="card admin-list engagement-admin-list">
        <div className="split-line">
          <div>
            <span className="eyebrow">Admin controls</span>
            <h2>Video Stats + View Counts</h2>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos..." />
        </div>

        {filteredVideos.map((video) => (
          <article className="admin-row admin-row-wide stats-admin-row" key={video.id}>
            <div>
              <h3>{video.title}</h3>
              <small>{video.category_name || 'No category'} · {video.access_type}</small>
              <div className="admin-stat-line">
                <span>👍 {video.like_count || 0}</span>
                <span>👎 {video.dislike_count || 0}</span>
                <span>💬 {video.comment_count || 0}</span>
                <span>👁 {video.view_count || 0}</span>
              </div>
            </div>

            <div className="view-edit-controls">
              <input
                type="number"
                value={edits[video.id]?.set_count ?? video.view_count ?? 0}
                onChange={(e) => setEdit(video.id, 'set_count', e.target.value)}
                aria-label={`Set views for ${video.title}`}
              />
              <button className="ghost-button" onClick={() => setViews(video.id)} disabled={busy}>Set</button>
              <button className="ghost-button" onClick={() => adjustViews(video.id, 100)} disabled={busy}>+100</button>
              <button className="ghost-button" onClick={() => adjustViews(video.id, -100)} disabled={busy}>-100</button>
              <button className="danger-button" onClick={() => setEdit(video.id, 'set_count', 0) || adminSetVideoViewCount(video.id, 0).then(load)} disabled={busy}>Reset</button>
            </div>
          </article>
        ))}

        {!filteredVideos.length && <p className="muted">No videos found.</p>}
      </div>
    </section>
  )
}
