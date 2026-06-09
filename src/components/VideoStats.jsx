import { Eye, MessageCircle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { formatStatCount } from '../lib/api'

export default function VideoStats({ video, variant = 'card', settings = null }) {
  if (!video) return null

  const showLikes = settings?.show_likes ?? true
  const showDislikes = settings?.show_dislikes ?? true
  const showViews = settings?.show_views ?? true
  const showComments = settings?.show_comments ?? true

  const stats = [
    showLikes && { key: 'likes', icon: ThumbsUp, label: 'likes', value: video.like_count ?? video.likes ?? 0 },
    showDislikes && { key: 'dislikes', icon: ThumbsDown, label: 'dislikes', value: video.dislike_count ?? video.dislikes ?? 0 },
    showViews && { key: 'views', icon: Eye, label: 'views', value: video.view_count ?? video.views ?? 0 },
    showComments && { key: 'comments', icon: MessageCircle, label: 'comments', value: video.comment_count ?? video.comments ?? 0 }
  ].filter(Boolean)

  if (!stats.length) return null

  return (
    <div className={`video-stats video-stats-${variant}`}>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <span className="video-stat" key={stat.key} title={`${stat.value} ${stat.label}`}>
            <Icon size={variant === 'details' ? 17 : 14} />
            <strong>{formatStatCount(stat.value)}</strong>
            {variant === 'details' && <small>{stat.label}</small>}
          </span>
        )
      })}
    </div>
  )
}
