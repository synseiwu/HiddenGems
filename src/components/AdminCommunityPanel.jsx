import { useEffect, useState } from 'react'
import {
  deleteForumPost,
  deleteForumReply,
  deleteVideoComment,
  getRewardSettings,
  listAdminCommunityOverview,
  saveRewardSettings
} from '../lib/api'
import Loader from './Loader'

const defaultSettings = {
  rewards_enabled: true,
  daily_user_points: 10,
  daily_vip_points: 50,
  daily_supervip_points: 100,
  daily_ultravip_points: 150,
  admin_daily_rewards_enabled: false,
  admin_daily_points: 0,
  comments_enabled: true,
  comment_rewards_enabled: true,
  comment_reward_points: 10,
  min_comment_seconds: 20,
  require_comment_approval: false,
  forum_enabled: true,
  daily_reward_message: 'Daily reward claimed!',
  comment_reward_message: 'Thanks for commenting!'
}

export default function AdminCommunityPanel() {
  const [settings, setSettings] = useState(defaultSettings)
  const [overview, setOverview] = useState({ comments: [], forumPosts: [], forumReplies: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [settingsData, overviewData] = await Promise.all([
      getRewardSettings().catch(() => defaultSettings),
      listAdminCommunityOverview().catch(() => ({ comments: [], forumPosts: [], forumReplies: [] }))
    ])
    setSettings({ ...defaultSettings, ...settingsData })
    setOverview(overviewData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function setField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveRewardSettings(settings)
      setMessage('Community and reward settings saved.')
      await load()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(type, id) {
    if (!confirm('Delete this item?')) return
    if (type === 'comment') await deleteVideoComment(id)
    if (type === 'post') await deleteForumPost(id)
    if (type === 'reply') await deleteForumReply(id)
    await load()
  }

  if (loading) return <Loader />

  return (
    <section className="admin-settings-grid">
      <form className="card admin-form" onSubmit={submit}>
        <span className="eyebrow">Rewards</span>
        <h2>Daily Points</h2>

        <label className="check"><input type="checkbox" checked={settings.rewards_enabled} onChange={(e) => setField('rewards_enabled', e.target.checked)} /> Enable daily login rewards</label>
        <label>Regular User Daily Points<input type="number" value={settings.daily_user_points} onChange={(e) => setField('daily_user_points', e.target.value)} /></label>
        <label>VIP Daily Points<input type="number" value={settings.daily_vip_points} onChange={(e) => setField('daily_vip_points', e.target.value)} /></label>
        <label>Super VIP Daily Points<input type="number" value={settings.daily_supervip_points} onChange={(e) => setField('daily_supervip_points', e.target.value)} /></label>
        <label>Ultra VIP Daily Points<input type="number" value={settings.daily_ultravip_points} onChange={(e) => setField('daily_ultravip_points', e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={settings.admin_daily_rewards_enabled} onChange={(e) => setField('admin_daily_rewards_enabled', e.target.checked)} /> Enable admin daily rewards</label>
        <label>Admin Daily Points<input type="number" value={settings.admin_daily_points} onChange={(e) => setField('admin_daily_points', e.target.value)} /></label>
        <label>Daily Reward Popup Message<input value={settings.daily_reward_message || ''} onChange={(e) => setField('daily_reward_message', e.target.value)} /></label>

        <hr />

        <span className="eyebrow">Comments</span>
        <h2>Comments + Feedback</h2>
        <label className="check"><input type="checkbox" checked={settings.comments_enabled} onChange={(e) => setField('comments_enabled', e.target.checked)} /> Enable comments</label>
        <label className="check"><input type="checkbox" checked={settings.comment_rewards_enabled} onChange={(e) => setField('comment_rewards_enabled', e.target.checked)} /> Enable daily comment reward</label>
        <label>Daily Comment Reward Points<input type="number" value={settings.comment_reward_points} onChange={(e) => setField('comment_reward_points', e.target.value)} /></label>
        <label>Minimum Seconds Between Comments<input type="number" value={settings.min_comment_seconds} onChange={(e) => setField('min_comment_seconds', e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={settings.require_comment_approval} onChange={(e) => setField('require_comment_approval', e.target.checked)} /> Require admin approval before comments show publicly</label>
        <label>Comment Reward Popup Message<input value={settings.comment_reward_message || ''} onChange={(e) => setField('comment_reward_message', e.target.value)} /></label>

        <hr />

        <span className="eyebrow">Forum</span>
        <label className="check"><input type="checkbox" checked={settings.forum_enabled} onChange={(e) => setField('forum_enabled', e.target.checked)} /> Enable forum</label>

        <button className="button full" disabled={busy}>{busy ? 'Saving...' : 'Save Community Settings'}</button>
        {message && <p className="notice-text">{message}</p>}
      </form>

      <div className="card admin-list">
        <h2>Recent Video Comments</h2>
        {overview.comments.length ? overview.comments.map((comment) => (
          <article className="admin-row admin-row-wide" key={comment.id}>
            <div>
              <h3>{comment.videos?.title || 'Video comment'}</h3>
              <small>{comment.profiles?.email || 'Unknown'} · {comment.body}</small>
            </div>
            <button className="danger-button" onClick={() => remove('comment', comment.id)}>Delete</button>
          </article>
        )) : <p className="muted">No comments yet.</p>}

        <h2>Recent Forum Posts</h2>
        {overview.forumPosts.length ? overview.forumPosts.map((post) => (
          <article className="admin-row admin-row-wide" key={post.id}>
            <div>
              <h3>{post.title}</h3>
              <small>{post.category} · {post.profiles?.email || 'Unknown'}</small>
            </div>
            <button className="danger-button" onClick={() => remove('post', post.id)}>Delete</button>
          </article>
        )) : <p className="muted">No forum posts yet.</p>}

        <h2>Recent Forum Replies</h2>
        {overview.forumReplies.length ? overview.forumReplies.map((reply) => (
          <article className="admin-row admin-row-wide" key={reply.id}>
            <div>
              <h3>{reply.forum_posts?.title || 'Forum reply'}</h3>
              <small>{reply.profiles?.email || 'Unknown'} · {reply.body}</small>
            </div>
            <button className="danger-button" onClick={() => remove('reply', reply.id)}>Delete</button>
          </article>
        )) : <p className="muted">No forum replies yet.</p>}
      </div>
    </section>
  )
}
