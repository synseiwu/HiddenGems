import { Link } from 'react-router-dom'
import { Lock, Unlock, Crown, Gem } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function VideoCard({ video, unlocked = false }) {
  const { isAdmin, isVip } = useAuth()
  const shouldBlurVip = video.access_type === 'vip' && !unlocked && !isAdmin && !isVip
  const cost = video.access_type === 'free' ? 'Free' : video.access_type === 'vip' ? 'VIP' : `${video.point_cost ?? video.price_cents ?? 0} pts`
  return (
    <article className="video-card card">
      <Link to={`/videos/${video.id}`} className="thumb-link" aria-label={`Open ${video.title}`}>
        <img
          src={video.thumbnail_url || '/placeholder.svg'}
          alt={video.title}
          loading="lazy"
          width="640"
          height="360"
          className={shouldBlurVip ? 'video-thumb vip-thumb-blur' : 'video-thumb'}
        />
        {shouldBlurVip && <span className="vip-thumb-overlay">VIP preview hidden</span>}
        {video.access_type === 'vip' && <span className="pill vip"><Crown size={14} /> VIP</span>}
      </Link>
      <div className="video-content">
        <div className="split-line">
          <span className="pill">{video.category_name || 'Gem'}</span>
          <strong className="points-label"><Gem size={14} /> {cost}</strong>
        </div>
        <h3>{video.title}</h3>
        <p>{video.description}</p>
        <Link className="button full" to={`/videos/${video.id}`}>
          {unlocked ? <Unlock size={16} /> : <Lock size={16} />}
          {unlocked ? 'Access Video' : 'View Details'}
        </Link>
      </div>
    </article>
  )
}
