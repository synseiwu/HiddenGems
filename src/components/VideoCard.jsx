import { Link } from 'react-router-dom'
import { Lock, Unlock, Crown, Gem } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getAccessLabel, getAccessRank, isVipAccessType } from '../lib/api'
import VideoStats from './VideoStats'

export default function VideoCard({ video, unlocked = false }) {
  const { isAdmin, vipRank } = useAuth()
  const requiredRank = getAccessRank(video.access_type)
  const tierLocked = isVipAccessType(video.access_type) && !unlocked && !isAdmin && Number(vipRank || 0) < requiredRank
  const cost = video.access_type === 'free'
    ? 'Free'
    : isVipAccessType(video.access_type)
      ? getAccessLabel(video.access_type)
      : `${video.point_cost ?? video.price_cents ?? 0} pts`

  return (
    <article className="video-card card">
      <Link to={`/videos/${video.id}`} className="thumb-link" aria-label={`Open ${video.title}`}>
        <img
          src={video.thumbnail_url || '/placeholder.svg'}
          alt={video.title}
          loading="lazy"
          width="640"
          height="360"
          className={tierLocked ? 'video-thumb vip-thumb-blur' : 'video-thumb'}
        />
        {tierLocked && <span className="vip-thumb-overlay">{getAccessLabel(video.access_type)} preview hidden</span>}
        {isVipAccessType(video.access_type) && <span className="pill vip"><Crown size={14} /> {getAccessLabel(video.access_type)}</span>}
      </Link>
      <div className="video-content">
        <div className="split-line">
          <span className="pill">{video.category_name || 'Gem'}</span>
          <strong className="points-label"><Gem size={14} /> {cost}</strong>
        </div>
        <h3>{video.title}</h3>
        <VideoStats video={video} variant="card" />
        <p>{video.description}</p>
        <Link className="button full" to={`/videos/${video.id}`}>
          {unlocked ? <Unlock size={16} /> : <Lock size={16} />}
          {unlocked ? 'Access Video' : 'View Details'}
        </Link>
      </div>
    </article>
  )
}
