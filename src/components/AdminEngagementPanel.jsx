import { useEffect, useMemo, useState } from 'react'
import {
  adminAdjustVideoEngagementStat,
  adminSetVideoEngagementStats,
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
    setEdits(Object.fromEntries((statsData || []).map((video) => [
      video.id,
      {
        like_count: Number(video.like_count || 0),
        dislike_count: Number(video.dislike_count || 0),
        view_count: Number(video.view_count || 0)
      }
    ])))
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
    setEdits((prev) => ({
      ...prev,
      [videoId]: {
        like_count: 0,
        dislike_count: 0,
        view_count: 0,
        ...(prev[videoId] || {}),
        [key]: value
      }
    }))
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

  async function saveStats(videoId) {
    setBusy(true)
    setMessage('')
    try {
      await adminSetVideoEngagementStats(videoId, edits[videoId] || {})
      await load()
      setMessage('Video stats updated.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function adjustStat(videoId, statName, amount) {
    setBusy(true)
    setMessage('')
    try {
      await adminAdjustVideoEngagementStat(videoId, statName, amount)
      await load()
      setMessage(`${statName.replace('_', ' ')} adjusted.`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetStats(videoId, type = 'all') {
    const current = edits[videoId] || {}
    const next = {
      like_count: type === 'all' || type === 'likes' ? 0 : Number(current.like_count || 0),
      dislike_count: type === 'all' || type === 'likes' ? 0 : Number(current.dislike_count || 0),
      view_count: type === 'all' || type === 'views' ? 0 : Number(current.view_count || 0)
    }

    setEdits((prev) => ({ ...prev, [videoId]: next }))
    setBusy(true)
    setMessage('')
    try {
      await adminSetVideoEngagementStats(videoId, next)
      await load()
      setMessage('Stats reset.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-settings-grid engagement-admin-panel">
      <form className="card admin-form" onSubmit={submitSettings}>
        <span className="eyebrow">Engagement</span>
        <h2>Stats Display Settings</h2>

        <label className="check"><input type="checkbox" checked={settings.show_likes} onChange={(e) => setField('show_likes', e.target.checked)} /> Show like counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_dislikes} onChange={(e) => setField('show_dislikes', e.target.checked)} /> Show dislike counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_views} onChange={(e) => setField('show_views', e.target.checked)} /> Show view counts</label>
        <label className="check"><input type="checkbox" checked={settings.show_comments} onChange={(e) => setField('show_comments', e.target.checked)} /> Show comment counts</label>

        <hr />

        <label className="check"><input type="checkbox" checked={settings.show_stats_on_cards} onChange={(e) => setField('show_stats_on_cards', e.target.checked)} /> Show stats on video cards</label>
        <label className="check"><input type="checkbox" checked={settings.show_stats_on_details} onChange={(e) => setField('show_stats_on_details', e.target.checked)} /> Show stats on video details pages</label>
        <label className="check"><input type="checkbox" checked={settings.show_stats_on_homepage} onChange={(e) => setField('show_stats_on_homepage', e.target.checked)} /> Show stats on homepage showcase rows</label>
        <label className="check"><input type="checkbox" checked={settings.view_tracking_enabled} onChange={(e) => setField('view_tracking_enabled', e.target.checked)} /> Enable view tracking</label>
        <label>View cooldown minutes<input type="number" min="1" value={settings.view_cooldown_minutes} onChange={(e) => setField('view_cooldown_minutes', e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={settings.compact_counts} onChange={(e) => setField('compact_counts', e.target.checked)} /> Compact count display, like 1.2K</label>

        <button className="button full" disabled={busy}>{busy ? 'Saving...' : 'Save Settings'}</button>
        {message && <p className="notice-text">{message}</p>}
      </form>

      <div className="card admin-list engagement-admin-list">
        <div className="split-line engagement-heading">
          <div>
            <span className="eyebrow">Easy edit</span>
            <h2>Likes, Dislikes & Views</h2>
            <p>Change the numbers here without touching SQL. Comment count stays based on real comments.</p>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos..." />
        </div>

        <div className="engagement-table">
          <div className="engagement-table-head">
            <span>Video</span>
            <span>Likes</span>
            <span>Dislikes</span>
            <span>Views</span>
            <span>Comments</span>
            <span>Actions</span>
          </div>

          {filteredVideos.map((video) => (
            <article className="engagement-stat-row" key={video.id}>
              <div className="engagement-video-title">
                <strong>{video.title}</strong>
                <small>{video.category_name || 'No category'} · {video.access_type}</small>
              </div>

              <label>
                <span className="sr-only">Likes</span>
                <input
                  type="number"
                  min="0"
                  value={edits[video.id]?.like_count ?? 0}
                  onChange={(e) => setEdit(video.id, 'like_count', e.target.value)}
                />
              </label>

              <label>
                <span className="sr-only">Dislikes</span>
                <input
                  type="number"
                  min="0"
                  value={edits[video.id]?.dislike_count ?? 0}
                  onChange={(e) => setEdit(video.id, 'dislike_count', e.target.value)}
                />
              </label>

              <label>
                <span className="sr-only">Views</span>
                <input
                  type="number"
                  min="0"
                  value={edits[video.id]?.view_count ?? 0}
                  onChange={(e) => setEdit(video.id, 'view_count', e.target.value)}
                />
              </label>

              <div className="comment-count-pill">💬 {video.comment_count || 0}</div>

              <div className="engagement-actions">
                <button className="button tiny" onClick={() => saveStats(video.id)} disabled={busy}>Save</button>
                <button className="ghost-button" onClick={() => adjustStat(video.id, 'view_count', 100)} disabled={busy}>+100 views</button>
                <button className="ghost-button" onClick={() => adjustStat(video.id, 'like_count', 100)} disabled={busy}>+100 likes</button>
                <button className="ghost-button" onClick={() => resetStats(video.id, 'views')} disabled={busy}>Reset views</button>
                <button className="danger-button" onClick={() => resetStats(video.id, 'likes')} disabled={busy}>Reset likes</button>
              </div>
            </article>
          ))}
        </div>

        {!filteredVideos.length && <p className="muted">No videos found.</p>}
      </div>
    </section>
  )
}
