import { useEffect, useState } from 'react'
import { MessageSquare, Pin, Send, Trash2 } from 'lucide-react'
import {
  createForumPost,
  createForumReply,
  deleteForumPost,
  deleteForumReply,
  listForumPosts,
  listForumReplies
} from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Loader from '../components/Loader'

const categories = ['General Discussion', 'Feedback', 'Requests', 'Site Issues', 'Video Suggestions']

function displayName(row) {
  const email = row.profiles?.email || 'Hidden Gems user'
  return email.split('@')[0]
}

export default function Forum() {
  const { isAdmin, user } = useAuth()
  const [posts, setPosts] = useState([])
  const [selected, setSelected] = useState(null)
  const [replies, setReplies] = useState([])
  const [postForm, setPostForm] = useState({ title: '', body: '', category: 'General Discussion' })
  const [replyBody, setReplyBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadPosts() {
    const data = await listForumPosts()
    setPosts(data)
    if (!selected && data[0]) setSelected(data[0])
    setLoading(false)
  }

  async function loadReplies(postId) {
    if (!postId) return setReplies([])
    setReplies(await listForumReplies(postId))
  }

  useEffect(() => {
    loadPosts().catch((err) => {
      setMessage(err.message || 'Unable to load forum. Make sure the forum migration ran in Supabase.')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadReplies(selected?.id).catch((err) => setMessage(err.message))
  }, [selected?.id])

  async function submitPost(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const created = await createForumPost(postForm)
      setPostForm({ title: '', body: '', category: 'General Discussion' })
      await loadPosts()
      setSelected(created)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setMessage('')
    try {
      await createForumReply(selected.id, replyBody)
      setReplyBody('')
      await loadReplies(selected.id)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removePost(postId) {
    if (!confirm('Delete this forum post?')) return
    await deleteForumPost(postId)
    setSelected(null)
    await loadPosts()
  }

  async function removeReply(replyId) {
    if (!confirm('Delete this reply?')) return
    await deleteForumReply(replyId)
    await loadReplies(selected.id)
  }

  if (loading) return <Loader />

  return (
    <div className="page forum-page">
      <section className="hero centered">
        <span className="eyebrow">Community</span>
        <h1>Hidden Gems Forum</h1>
        <p>Talk about site issues, requests, favorite categories, and what you want to see more of.</p>
      </section>

      {message && <p className="notice-text">{message}</p>}

      <section className="forum-grid">
        <div className="card admin-form">
          <h2>Create a Post</h2>
          <form className="vertical" onSubmit={submitPost}>
            <label>Category<select value={postForm.category} onChange={(e) => setPostForm((p) => ({ ...p, category: e.target.value }))}>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select></label>
            <label>Title<input value={postForm.title} onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))} required maxLength={120} /></label>
            <label>Post<textarea value={postForm.body} onChange={(e) => setPostForm((p) => ({ ...p, body: e.target.value }))} required maxLength={3000} /></label>
            <button className="button full" disabled={busy}>{busy ? 'Posting...' : 'Post to Forum'}</button>
          </form>
        </div>

        <div className="forum-list">
          {!posts.length && <div className="card forum-post"><h3>No forum posts yet</h3><p>Start the first community discussion.</p></div>}
          {posts.map((post) => (
            <article className={selected?.id === post.id ? 'card forum-post active' : 'card forum-post'} key={post.id} onClick={() => setSelected(post)}>
              <div className="split-line">
                <span className="pill">{post.category}</span>
                {post.pinned && <span className="pill"><Pin size={14} /> Pinned</span>}
              </div>
              <h3>{post.title}</h3>
              <p>{post.body}</p>
              <small>By {displayName(post)} · {new Date(post.created_at).toLocaleString()}</small>
              {(isAdmin || post.user_id === user?.id) && <button className="danger-button tiny" onClick={(e) => { e.stopPropagation(); removePost(post.id) }}><Trash2 size={14} /> Delete</button>}
            </article>
          ))}
        </div>

        <div className="card forum-thread">
          {selected ? (
            <>
              <span className="eyebrow">{selected.category}</span>
              <h2><MessageSquare size={22} /> {selected.title}</h2>
              <p>{selected.body}</p>
              <small>Started by {displayName(selected)}</small>

              <form className="comment-form" onSubmit={submitReply}>
                <label>Reply<textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} required maxLength={2000} /></label>
                <button className="button" disabled={busy || !replyBody.trim()}><Send size={16} /> Reply</button>
              </form>

              <div className="comment-list">
                {replies.length ? replies.map((reply) => (
                  <article className="comment-item" key={reply.id}>
                    <div><strong>{displayName(reply)}</strong><small>{new Date(reply.created_at).toLocaleString()}</small></div>
                    <p>{reply.body}</p>
                    {(isAdmin || reply.user_id === user?.id) && <button className="danger-button tiny" onClick={() => removeReply(reply.id)}><Trash2 size={14} /> Delete</button>}
                  </article>
                )) : <p className="muted">No replies yet.</p>}
              </div>
            </>
          ) : (
            <p className="muted">Choose or create a forum post.</p>
          )}
        </div>
      </section>
    </div>
  )
}
