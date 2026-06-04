import { useEffect, useMemo, useState } from 'react'
import VideoCard from '../components/VideoCard'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { listPublishedVideos } from '../lib/api'

export default function Videos() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    listPublishedVideos().then(setVideos).finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['all', ...new Set(videos.map((v) => v.category_name).filter(Boolean))], [videos])

  const filtered = useMemo(() => {
    return videos
      .filter((v) => [v.title, v.description, v.category_name].join(' ').toLowerCase().includes(query.toLowerCase()))
      .filter((v) => category === 'all' || v.category_name === category)
      .sort((a, b) => {
        const aCost = a.point_cost ?? a.price_cents ?? 0
        const bCost = b.point_cost ?? b.price_cents ?? 0
        if (sort === 'price-low') return aCost - bCost
        if (sort === 'price-high') return bCost - aCost
        if (sort === 'title') return a.title.localeCompare(b.title)
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [videos, query, category, sort])

  if (loading) return <Loader />

  return (
    <div className="page">
      <section className="section-heading">
        <span className="eyebrow">Marketplace</span>
        <h1>Videos</h1>
        <p>Buy points, unlock gems, and keep external video links protected inside your library.</p>
      </section>

      <section className="filters card">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos..." />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((cat) => <option key={cat} value={cat}>{cat === 'all' ? 'All categories' : cat}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price-low">Points: low to high</option>
          <option value="price-high">Points: high to low</option>
          <option value="title">Title</option>
        </select>
      </section>

      {filtered.length ? <div className="video-grid">{filtered.map((video) => <VideoCard key={video.id} video={video} />)}</div> : (
        <EmptyState title="No gems found" text="Try a different search or category." />
      )}
    </div>
  )
}
