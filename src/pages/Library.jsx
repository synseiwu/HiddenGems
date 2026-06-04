import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { listLibrary } from '../lib/api'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'

export default function Library() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listLibrary().then(setItems).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader />
  if (!items.length) return <EmptyState title="Your library is empty" text="Unlocked videos will appear here after you spend points or activate VIP." />

  return (
    <div className="page">
      <section className="section-heading">
        <span className="eyebrow">Account</span>
        <h1>Your Library</h1>
        <p>Access links are available only for videos you unlocked with points or through VIP.</p>
      </section>
      <div className="library-list">
        {items.map((item) => (
          <article className="library-item card" key={item.video_id}>
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
