import { useEffect, useMemo, useState } from 'react'
import {
  getAdminSiteSettings,
  listAdminPageContent,
  resetPageContent,
  saveAdminSiteSettings,
  savePageContent
} from '../lib/api'
import { defaultPageContent, pageContentToRows } from '../lib/defaultPageContent'
import Loader from './Loader'
import '../styles/site-content-admin.css'

const defaultSettings = {
  hide_all_videos: false,
  disable_age_gate: false,
  safe_mode_enabled: false
}

function buildRows(pageKey, savedRows) {
  const defaultRows = pageContentToRows().filter((row) => row.page_key === pageKey)
  const savedMap = new Map((savedRows || []).map((row) => [`${row.page_key}:${row.section_key}`, row]))
  return defaultRows.map((row) => ({ ...row, ...(savedMap.get(`${row.page_key}:${row.section_key}`) || {}) }))
}

export default function AdminSiteControlsPanel() {
  const pageOptions = useMemo(() => Object.entries(defaultPageContent).map(([key, value]) => ({ key, label: value.label })), [])
  const [settings, setSettings] = useState(defaultSettings)
  const [pageKey, setPageKey] = useState(pageOptions[0]?.key || 'home')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load(selectedPage = pageKey) {
    setLoading(true)
    const [settingsData, savedContent] = await Promise.all([
      getAdminSiteSettings().catch(() => defaultSettings),
      listAdminPageContent(selectedPage).catch(() => [])
    ])
    setSettings({ ...defaultSettings, ...settingsData })
    setRows(buildRows(selectedPage, savedContent))
    setLoading(false)
  }

  useEffect(() => { load(pageKey) }, [pageKey])

  function setSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  function setRowField(sectionKey, field, value) {
    setRows((prev) => prev.map((row) => row.section_key === sectionKey ? { ...row, [field]: value } : row))
  }

  async function submitSettings(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveAdminSiteSettings(settings)
      setMessage('Site visibility settings saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitSection(row) {
    setBusy(true)
    setMessage('')
    try {
      await savePageContent(row)
      setMessage(`${row.page_label || row.page_key} / ${row.section_key} saved.`)
      await load(pageKey)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetSection(row) {
    setBusy(true)
    setMessage('')
    try {
      await resetPageContent(row.page_key, row.section_key)
      setMessage(`${row.section_key} reset to default text.`)
      await load(pageKey)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-site-controls">
      <form className="card admin-form safe-mode-card" onSubmit={submitSettings}>
        <span className="eyebrow">Site mode</span>
        <h2>Content Visibility Controls</h2>
        <p className="muted">
          Use this when you need the site live without showing current video content. It does not delete videos.
        </p>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.hide_all_videos}
            onChange={(e) => setSetting('hide_all_videos', e.target.checked)}
          />
          Hide all current videos from public pages
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.disable_age_gate}
            onChange={(e) => setSetting('disable_age_gate', e.target.checked)}
          />
          Disable/hide the 18+ entry popup
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.safe_mode_enabled}
            onChange={(e) => setSetting('safe_mode_enabled', e.target.checked)}
          />
          Safe mode enabled
        </label>

        <button className="button full" disabled={busy}>{busy ? 'Saving...' : 'Save Visibility Settings'}</button>
      </form>

      <div className="card admin-list page-content-manager">
        <div className="split-line page-content-heading">
          <div>
            <span className="eyebrow">Text editor</span>
            <h2>Page Content Manager</h2>
            <p>Edit page text safely. The layout uses fixed card padding and wrapping so longer text will not break boxes.</p>
          </div>
          <label>
            Page
            <select value={pageKey} onChange={(e) => setPageKey(e.target.value)}>
              {pageOptions.map((page) => <option key={page.key} value={page.key}>{page.label}</option>)}
            </select>
          </label>
        </div>

        <div className="page-content-sections">
          {rows.map((row) => (
            <article className="page-content-editor card" key={`${row.page_key}-${row.section_key}`}>
              <div className="split-line">
                <div>
                  <span className="eyebrow">{row.page_label || row.page_key}</span>
                  <h3>{row.section_key.replaceAll('_', ' ')}</h3>
                </div>
                <label className="check compact-check">
                  <input
                    type="checkbox"
                    checked={Boolean(row.active)}
                    onChange={(e) => setRowField(row.section_key, 'active', e.target.checked)}
                  />
                  Active
                </label>
              </div>

              <div className="content-editor-grid">
                <label>Eyebrow<input value={row.eyebrow || ''} onChange={(e) => setRowField(row.section_key, 'eyebrow', e.target.value)} /></label>
                <label>Title<input value={row.title || ''} onChange={(e) => setRowField(row.section_key, 'title', e.target.value)} /></label>
                <label>Subtitle<input value={row.subtitle || ''} onChange={(e) => setRowField(row.section_key, 'subtitle', e.target.value)} /></label>
                <label>Button Text<input value={row.button_text || ''} onChange={(e) => setRowField(row.section_key, 'button_text', e.target.value)} /></label>
              </div>

              <label>Body / Paragraphs
                <textarea
                  value={row.body || ''}
                  onChange={(e) => setRowField(row.section_key, 'body', e.target.value)}
                  placeholder="Use blank lines between paragraphs."
                />
              </label>

              <div className="page-content-preview">
                <span className="eyebrow">{row.eyebrow}</span>
                <h4>{row.title || 'Untitled section'}</h4>
                {row.subtitle && <p>{row.subtitle}</p>}
                {(row.body || '').split('\n\n').filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>

              <div className="actions">
                <button className="button" type="button" disabled={busy} onClick={() => submitSection(row)}>Save Section</button>
                <button className="ghost-button" type="button" disabled={busy} onClick={() => resetSection(row)}>Reset Default</button>
              </div>
            </article>
          ))}
        </div>

        {message && <p className="notice-text">{message}</p>}
      </div>
    </section>
  )
}
