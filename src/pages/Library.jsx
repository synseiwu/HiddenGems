import { useEffect, useState } from 'react'
import { Bot, ExternalLink, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listLibrary } from '../lib/api'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import useSiteMode from '../hooks/useSiteMode'
import '../styles/mode-pages.css'

export default function Library() {
  const { isAiMode, loading: modeLoading } = useSiteMode()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (modeLoading) return
    if (isAiMode) {
      setItems([])
      setLoading(false)
      return
    }
    listLibrary().then(setItems).finally(() => setLoading(false))
  }, [isAiMode, modeLoading])

  if (loading || modeLoading) return <Loader />

  if (isAiMode) {
    return (
      <div className="page narrow">
        <section className="card mode-unavailable-card">
          <Bot size={46} />
          <span className="eyebrow">AI Studio Mode</span>
          <h1>AI Workspace</h1>
          <p>Your video library is hidden while AI Studio Mode is active. Open AI Studio to view saved AI conversations and continue working from your account.</p>
          <div className="actions centered-text">
            <Link className="button" to="/ai-studio"><History size={16} /> Open AI Studio</Link>
            <Link className="ghost-button" to="/points">Buy Points</Link>
          </div>
        </section>
      </div>
    )
  }

  if (!items.length) return <EmptyState title="Your library is empty" text="Unlocked videos will appear here after you spend points or activate VIP." />

  return (
    <div className="page mode-aware-page">
      <section className="section-heading mode-section-heading">
        <span className="eyebrow">Account</span>
        <h1>Your Library</h1>
        <p>Access links are available only for videos you unlocked with points or through VIP.</p>
      </section>
      <div className="library-list mode-list">
        {items.map((item) => (
          <article className="library-item card mode-list-item" key={item.video_id}>
            <img src={item.thumbnail_url || '/placeholder.svg'} alt={item.title} loading="lazy" />
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>Unlocked: {item.purchased_at ? new Date(item.purchased_at).toLocaleDateString() : 'VIP access'}</small>
            </div>
            <a className="button" href={item.external_video_link} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a>
          </article>
        ))}
      </div>
    </div>
  )
}
