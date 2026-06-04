import { useEffect, useMemo, useState } from 'react'
import { deleteCategory, deleteVideo, listAdminVideos, listCategories, saveCategory, saveVideo } from '../lib/api'
import { compressImage } from '../lib/image'
import { supabase } from '../lib/supabase'
import Loader from '../components/Loader'

const emptyForm = {
  title: '',
  description: '',
  category_id: '',
  point_cost: 300,
  thumbnail_url: '',
  preview_url: '',
  external_video_link: '',
  access_type: 'points',
  published: true
}

const emptyCategory = { name: '', description: '' }

export default function Admin() {
  const [videos, setVideos] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [categoryMessage, setCategoryMessage] = useState('')

  async function load() {
    const [v, c] = await Promise.all([listAdminVideos(), listCategories()])
    setVideos(v)
    setCategories(c)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => videos.filter((v) => [v.title, v.description, v.access_type].join(' ').toLowerCase().includes(query.toLowerCase())), [videos, query])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setCategoryField(key, value) {
    setCategoryForm((prev) => ({ ...prev, [key]: value }))
  }

  async function uploadThumb(file) {
    if (!file) return
    setBusy(true)
    setMessage('Compressing thumbnail...')
    try {
      const compressed = await compressImage(file)
      const path = `${crypto.randomUUID()}-${compressed.name}`
      const { error } = await supabase.storage.from('thumbnails').upload(path, compressed, {
        cacheControl: '31536000',
        upsert: false,
        contentType: 'image/webp'
      })
      if (error) throw error
      const { data } = supabase.storage.from('thumbnails').getPublicUrl(path)
      setField('thumbnail_url', data.publicUrl)
      setMessage('Thumbnail uploaded and optimized.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('Saving listing...')
    try {
      await saveVideo(form)
      setForm(emptyForm)
      await load()
      setMessage('Listing saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitCategory(e) {
    e.preventDefault()
    setCategoryBusy(true)
    setCategoryMessage('Saving category...')
    try {
      await saveCategory(categoryForm)
      setCategoryForm(emptyCategory)
      await load()
      setCategoryMessage('Category saved.')
    } catch (err) {
      setCategoryMessage(err.message)
    } finally {
      setCategoryBusy(false)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this listing?')) return
    await deleteVideo(id)
    await load()
  }

  async function removeCategory(id) {
    if (!confirm('Delete this category? Videos using it will move to No category.')) return
    setCategoryBusy(true)
    try {
      await deleteCategory(id)
      if (form.category_id === id) setField('category_id', '')
      await load()
      setCategoryMessage('Category deleted.')
    } catch (err) {
      setCategoryMessage(err.message)
    } finally {
      setCategoryBusy(false)
    }
  }

  function edit(video) {
    setForm({ ...video, point_cost: video.point_cost ?? video.price_cents ?? 0, preview_url: video.preview_url || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editCategory(category) {
    setCategoryForm(category)
  }

  if (loading) return <Loader />

  return (
    <div className="page admin-page">
      <section className="section-heading">
        <span className="eyebrow">Protected</span>
        <h1>Admin Panel</h1>
        <p>Add point-based listings, manage categories, upload optimized thumbnails, and protect external video links.</p>
      </section>

      <section className="admin-grid">
        <form className="card admin-form" onSubmit={submit}>
          <h2>{form.id ? 'Edit Listing' : 'Add New Listing'}</h2>
          <label>Title<input value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label>
          <label>Description<textarea value={form.description} onChange={(e) => setField('description', e.target.value)} required /></label>
          <label>Category<select value={form.category_id || ''} onChange={(e) => setField('category_id', e.target.value)}>
            <option value="">No category</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select></label>
          <label>Point Cost<input type="number" value={form.point_cost ?? 0} onChange={(e) => setField('point_cost', e.target.value)} min="0" /></label>
          <label>External Video Link<input value={form.external_video_link} onChange={(e) => setField('external_video_link', e.target.value)} required /></label>
          <label>Preview URL / Embed URL<input value={form.preview_url || ''} onChange={(e) => setField('preview_url', e.target.value)} placeholder="Optional PikPak/share preview link" /></label>
          <small className="field-help">Optional: paste a public preview/share URL if the provider allows embedding. If it blocks embeds, users can still open the preview in a new tab.</small>
          <label>Access Type<select value={form.access_type} onChange={(e) => setField('access_type', e.target.value)}>
            <option value="points">Points</option>
            <option value="vip">VIP</option>
            <option value="free">Free Preview</option>
          </select></label>
          <label>Thumbnail Upload<input type="file" accept="image/*" onChange={(e) => uploadThumb(e.target.files?.[0])} /></label>
          <label>Thumbnail URL<input value={form.thumbnail_url || ''} onChange={(e) => setField('thumbnail_url', e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setField('published', e.target.checked)} /> Published</label>
          <button className="button full" disabled={busy}>{busy ? 'Working...' : 'Save Listing'}</button>
          {form.id && <button type="button" className="ghost-button full" onClick={() => setForm(emptyForm)}>Cancel Edit</button>}
          {message && <p className="notice-text">{message}</p>}
        </form>

        <div className="card admin-list">
          <div className="split-line"><h2>Listings</h2><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search admin listings..." /></div>
          {filtered.map((video) => (
            <article className="admin-row" key={video.id}>
              <img src={video.thumbnail_url || '/placeholder.svg'} alt="" />
              <div>
                <h3>{video.title}</h3>
                <small>{video.access_type} · {video.point_cost ?? video.price_cents ?? 0} pts · {video.published ? 'Published' : 'Draft'}</small>
              </div>
              <button className="ghost-button" onClick={() => edit(video)}>Edit</button>
              <button className="danger-button" onClick={() => remove(video.id)}>Delete</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-grid category-admin-grid">
        <form className="card admin-form" onSubmit={submitCategory}>
          <h2>{categoryForm.id ? 'Edit Category' : 'Add Category'}</h2>
          <label>Category Name<input value={categoryForm.name || ''} onChange={(e) => setCategoryField('name', e.target.value)} required /></label>
          <label>Description<textarea value={categoryForm.description || ''} onChange={(e) => setCategoryField('description', e.target.value)} placeholder="Optional category description" /></label>
          <button className="button full" disabled={categoryBusy}>{categoryBusy ? 'Working...' : 'Save Category'}</button>
          {categoryForm.id && <button type="button" className="ghost-button full" onClick={() => setCategoryForm(emptyCategory)}>Cancel Edit</button>}
          {categoryMessage && <p className="notice-text">{categoryMessage}</p>}
        </form>

        <div className="card admin-list">
          <h2>Categories</h2>
          {categories.map((cat) => (
            <article className="admin-row category-row" key={cat.id}>
              <div>
                <h3>{cat.name}</h3>
                <small>{cat.description || 'No description'}</small>
              </div>
              <button className="ghost-button" onClick={() => editCategory(cat)}>Edit</button>
              <button className="danger-button" onClick={() => removeCategory(cat.id)}>Delete</button>
            </article>
          ))}
          {!categories.length && <p className="muted">No categories yet. Add one to organize your video drops.</p>}
        </div>
      </section>
    </div>
  )
}
