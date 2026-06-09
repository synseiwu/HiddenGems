import { useEffect, useMemo, useState } from 'react'
import {
  deleteHomepageShowcaseRow,
  duplicateHomepageShowcaseRow,
  listCategories,
  listHomepageShowcaseRowsAdmin,
  saveHomepageShowcaseRow,
  setHomepageShowcaseRowCategories
} from '../lib/api'
import Loader from './Loader'

const emptyRow = {
  title: '',
  subtitle: '',
  layout_type: 'horizontal',
  sort_order: 1,
  max_items: 8,
  sort_mode: 'newest',
  active: true,
  category_ids: []
}

export default function AdminHomepageShowcasePanel() {
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyRow)
  const [categorySearch, setCategorySearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const [rowData, categoryData] = await Promise.all([
      listHomepageShowcaseRowsAdmin(),
      listCategories()
    ])
    setRows(rowData)
    setCategories(categoryData)
    setLoading(false)
  }

  useEffect(() => {
    load().catch((err) => {
      setMessage(err.message)
      setLoading(false)
    })
  }, [])

  const filteredCategories = useMemo(() => {
    const search = categorySearch.toLowerCase()
    return categories.filter((category) => [category.name, category.description].join(' ').toLowerCase().includes(search))
  }, [categories, categorySearch])

  function toggleCategory(categoryId) {
    setForm((prev) => {
      const ids = prev.category_ids || []
      return ids.includes(categoryId)
        ? { ...prev, category_ids: ids.filter((id) => id !== categoryId) }
        : { ...prev, category_ids: [...ids, categoryId] }
    })
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const saved = await saveHomepageShowcaseRow(form)
      await setHomepageShowcaseRowCategories(saved.id, form.category_ids || [])
      setForm(emptyRow)
      await load()
      setMessage('Homepage showcase row saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  function editRow(row) {
    setForm({
      ...row,
      category_ids: row.category_ids || []
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function removeRow(rowId) {
    if (!confirm('Delete this homepage showcase row?')) return
    setBusy(true)
    try {
      await deleteHomepageShowcaseRow(rowId)
      await load()
      setMessage('Showcase row deleted.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function duplicateRow(rowId) {
    setBusy(true)
    try {
      await duplicateHomepageShowcaseRow(rowId)
      await load()
      setMessage('Showcase row duplicated.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function quickMove(row, direction) {
    const targetOrder = Number(row.sort_order || 0) + direction
    setBusy(true)
    try {
      await saveHomepageShowcaseRow({ ...row, sort_order: Math.max(1, targetOrder) })
      await load()
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-settings-grid">
      <form className="card admin-form" onSubmit={submit}>
        <span className="eyebrow">Homepage</span>
        <h2>{form.id ? 'Edit Showcase Row' : 'Create Showcase Row'}</h2>

        <label>
          Row Title
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="New Releases, VIP Vault, Creator Picks..." required />
        </label>

        <label>
          Optional Subtitle
          <textarea value={form.subtitle || ''} onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Short description shown under this homepage row." />
        </label>

        <div className="form-grid-2">
          <label>
            Layout Style
            <select value={form.layout_type} onChange={(e) => setForm((p) => ({ ...p, layout_type: e.target.value }))}>
              <option value="horizontal">Horizontal Scroll</option>
              <option value="grid">Grid</option>
              <option value="featured">Featured Large Cards</option>
              <option value="compact">Compact Row</option>
            </select>
          </label>

          <label>
            Sort Order
            <input type="number" min="1" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </label>

          <label>
            Max Videos
            <input type="number" min="1" max="24" value={form.max_items} onChange={(e) => setForm((p) => ({ ...p, max_items: e.target.value }))} />
          </label>

          <label>
            Video Sort
            <select value={form.sort_mode} onChange={(e) => setForm((p) => ({ ...p, sort_mode: e.target.value }))}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="most_liked">Most Liked</option>
              <option value="most_commented">Most Commented</option>
            </select>
          </label>
        </div>

        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
          Row Active
        </label>

        <div className="category-picker">
          <div className="split-line">
            <h3>Select Categories</h3>
            <small>{(form.category_ids || []).length ? `${(form.category_ids || []).length} selected` : 'All categories / recent uploads'}</small>
          </div>
          <p className="tiny-note">Leave this empty to showcase recently uploaded videos from all categories.</p>
          <button
            type="button"
            className="ghost-button full"
            onClick={() => setForm((p) => ({
              ...p,
              title: 'Recently Uploaded',
              subtitle: 'Fresh videos added to Hidden Gems.',
              layout_type: 'horizontal',
              sort_order: 1,
              max_items: 10,
              sort_mode: 'newest',
              active: true,
              category_ids: []
            }))}
          >
            Use Recently Uploaded preset
          </button>
          <input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Search categories..." />

          <div className="category-choice-list">
            {filteredCategories.map((category) => {
              const selected = (form.category_ids || []).includes(category.id)
              return (
                <button
                  type="button"
                  key={category.id}
                  className={selected ? 'category-choice selected' : 'category-choice'}
                  onClick={() => toggleCategory(category.id)}
                >
                  <strong>{category.name}</strong>
                  <small>{category.published_count ?? 0} published videos</small>
                </button>
              )
            })}
          </div>
        </div>

        <button className="button full" disabled={busy}>{busy ? 'Saving...' : 'Save Showcase Row'}</button>
        {form.id && <button type="button" className="ghost-button full" onClick={() => setForm(emptyRow)}>Cancel Edit</button>}
        {message && <p className="notice-text">{message}</p>}
      </form>

      <div className="card admin-list">
        <div className="split-line">
          <div>
            <span className="eyebrow">Live homepage rows</span>
            <h2>Showcase Layout</h2>
          </div>
          <button className="ghost-button" onClick={load} disabled={busy}>Refresh</button>
        </div>

        {rows.length ? rows.map((row) => (
          <article className="admin-row admin-row-wide showcase-admin-row" key={row.id}>
            <div>
              <h3>{row.title} <small>#{row.sort_order}</small></h3>
              <small>
                {row.active ? 'Active' : 'Hidden'} · {row.layout_type} · {row.max_items} max · {(row.category_names || []).join(', ') || 'No categories'}
              </small>
              {row.categories_without_published?.length ? (
                <small className="warning-text">Warning: {row.categories_without_published.join(', ')} has no published videos.</small>
              ) : null}
            </div>
            <div className="row-actions">
              <button className="ghost-button" onClick={() => quickMove(row, -1)} disabled={busy}>↑</button>
              <button className="ghost-button" onClick={() => quickMove(row, 1)} disabled={busy}>↓</button>
              <button className="ghost-button" onClick={() => editRow(row)}>Edit</button>
              <button className="ghost-button" onClick={() => duplicateRow(row.id)} disabled={busy}>Duplicate</button>
              <button className="danger-button" onClick={() => removeRow(row.id)} disabled={busy}>Delete</button>
            </div>
          </article>
        )) : (
          <div className="empty-state-inline">
            <h3>No showcase rows yet</h3>
            <p>Create your first homepage row to control what appears under the hero section.</p>
          </div>
        )}
      </div>
    </section>
  )
}
