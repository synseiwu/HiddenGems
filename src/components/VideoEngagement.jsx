import { useEffect, useState } from 'react'
import { MessageCircle, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import {
  deleteVideoComment,
  getVideoReactionSummary,
  listVideoComments,
  setVideoReaction,
  submitVideoComment
} from '../lib/api'
import { useAuth } from '../hooks/useAuth'

function displayName(comment) {
  return comment.author_name || String(comment.author_email || 'Hidden Gems user').split('@')[0]
}

export default function VideoEngagement({ videoId }) {
  const { isAdmin, user, showRewardNotice } = useAuth()
  const [comments, setComments] = useState([])
  const [reaction, setReaction] = useState({ likes: 0, dislikes: 0, my_reaction: null })
  const [body, setBody] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!videoId || !user) return
    const [commentData, reactionData] = await Promise.all([
      listVideoComments(videoId),
      getVideoReactionSummary(videoId)
    ])
    setComments(commentData)
    setReaction(reactionData)
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message))
  }, [videoId, user])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await submitVideoComment(videoId, body)
      setBody('')
      await load()
      if (result.reward_granted) {
        showRewardNotice({
          title: 'Comment Reward',
          message: `Thanks for commenting! You received ${result.reward_amount || 10} points for today.`,
          points: result.reward_amount || 10,
          balance: result.points_balance,
          cta: 'Buy More Points',
          to: '/points'
        })
      } else {
        setMessage('Comment posted.')
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function react(nextReaction) {
    setBusy(true)
    setMessage('')
    try {
      await setVideoReaction(videoId, nextReaction)
      setReaction(await getVideoReactionSummary(videoId))
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeComment(commentId) {
    if (!confirm('Delete this comment?')) return
    await deleteVideoComment(commentId)
    await load()
  }

  return (
    <section className="card engagement-card">
      <div className="split-line">
        <h2><MessageCircle size={22} /> Community Feedback</h2>
        <div className="reaction-actions">
          <button
            className={reaction.my_reaction === 'like' ? 'ghost-button active-reaction' : 'ghost-button'}
            onClick={() => react('like')}
            disabled={busy}
          >
            <ThumbsUp size={16} /> {reaction.likes || 0}
          </button>
          <button
            className={reaction.my_reaction === 'dislike' ? 'ghost-button active-reaction' : 'ghost-button'}
            onClick={() => react('dislike')}
            disabled={busy}
          >
            <ThumbsDown size={16} /> {reaction.dislikes || 0}
          </button>
        </div>
      </div>

      <form className="comment-form" onSubmit={submit}>
        <label>
          Leave feedback
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you think? What would you like to see more of?"
            maxLength={1200}
            required
          />
        </label>
        <button className="button" disabled={busy || !body.trim()}>
          <Send size={16} /> {busy ? 'Posting...' : 'Post Comment'}
        </button>
      </form>

      {message && <p className="notice-text">{message}</p>}

      <div className="comment-list">
        {comments.length ? comments.map((comment) => (
          <article className="comment-item" key={comment.id}>
            <div>
              <strong>{displayName(comment)}</strong>
              <small>{new Date(comment.created_at).toLocaleString()}</small>
            </div>
            <p>{comment.body}</p>
            {(isAdmin || comment.user_id === user?.id) && (
              <button className="danger-button tiny" onClick={() => removeComment(comment.id)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </article>
        )) : <p className="muted">No comments yet. Be the first to leave feedback.</p>}
      </div>
    </section>
  )
}
