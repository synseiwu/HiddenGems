import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import VideoCard from '../components/VideoCard'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { listPublishedVideos } from '../lib/api'

export default function Videos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'all')
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest')

  useEffect(() => {
    listPublishedVideos().then(setVideos).finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const unique = new Map()
    videos.forEach((video) => {
      if (video.category_id && video.category_name) {
        unique.set(video.category_id, video.category_name)
      }
    })
    return [['all', 'All'], ...Array.from(unique.entries())]
  }, [videos])

  useEffect(() => {
    const categoryParam = searchParams.get('category') || 'all'
    const sortParam = searchParams.get('sort') || 'newest'
    const queryParam = searchParams.get('q') || ''

    setCategory(categoryParam)
    setSort(sortParam)
    setQuery(queryParam)
  }, [searchParams])

  useEffect(() => {
    if (!videos.length) return
    if (category === 'all') return

    const existsById = videos.some((video) => video.category_id === category)
    const existsByName = videos.some((video) => video.category_name?.toLowerCase() === category.toLowerCase())

    if (!existsById && !existsByName) {
      const next = new URLSearchParams(searchParams)
      next.delete('category')
      next.delete('categoryName')
      setSearchParams(next, { replace: true })
    }
  }, [videos, category, searchParams, setSearchParams])

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams)

    if (!value || value === 'all' || (key === 'sort' && value === 'newest')) {
      next.delete(key)
    } else {
      next.set(key, value)
    }

    if (key === 'category') next.delete('categoryName')
    setSearchParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    return videos
      .filter((video) => [video.title, video.description, video.category_name].join(' ').toLowerCase().includes(query.toLowerCase()))
      .filter((video) => {
        if (category === 'all') return true
        return video.category_id === category || video.category_name?.toLowerCase() === category.toLowerCase()
      })
      .sort((a, b) => {
        if (sort === 'price') return Number(a.point_cost || a.price_cents || 0) - Number(b.point_cost || b.price_cents || 0)
        if (sort === 'name') return a.title.localeCompare(b.title)
        if (sort === 'views') return Number(b.view_count || 0) - Number(a.view_count || 0)
        if (sort === 'likes') return Number(b.like_count || 0) - Number(a.like_count || 0)
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [videos, query, category, sort])

  if (loading) return <Loader />

  return (
    <div className="page">
      <section className="section-heading">
        <span className="eyebrow">Browse</span>
        <h1>All Videos</h1>
        <p>Search, sort, and filter by category. Protected links stay hidden until access is verified.</p>
      </section>

      <section className="filters card">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            updateParam('q', e.target.value)
          }}
          placeholder="Search videos..."
        />

        <select value={category} onChange={(e) => updateParam('category', e.target.value)}>
          {categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        <select value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price">Lowest Points</option>
          <option value="name">Name</option>
          <option value="views">Most Viewed</option>
          <option value="likes">Most Liked</option>
        </select>
      </section>

      {filtered.length ? (
        <div className="video-grid">
          {filtered.map((video) => <VideoCard key={video.id} video={video} />)}
        </div>
      ) : (
        <EmptyState title="No videos found" text="Try another search, category, or sort option." />
      )}
    </div>
  )
}
