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
  safe_mode_enabled: false,
  site_mode: 'hidden_gems',
  ai_studio_public_mode: false,
  hide_hidden_gems_branding: true,
  hide_video_marketplace_in_ai_mode: true,
  show_admin_mode_switch: true,
  show_public_mode_switch: false
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
      setMessage('Site mode and visibility settings saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function quickMode(mode) {
    const next = {
      ...settings,
      site_mode: mode,
      ai_studio_public_mode: mode === 'ai_studio',
      disable_age_gate: mode === 'ai_studio' ? true : settings.disable_age_gate,
      hide_video_marketplace_in_ai_mode: true,
      hide_hidden_gems_branding: true,
      show_admin_mode_switch: true
    }

    setSettings(next)
    setBusy(true)
    setMessage('')
    try {
      await saveAdminSiteSettings(next)
      setMessage(mode === 'ai_studio' ? 'AI Studio public mode enabled.' : 'Hidden Gems mode restored.')
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

  const isAiMode = settings.site_mode === 'ai_studio' || settings.ai_studio_public_mode

  return (
    <section className="admin-site-controls">
      <form className="card admin-form safe-mode-card" onSubmit={submitSettings}>
        <span className="eyebrow">Site mode</span>
        <h2>Public Mode Controls</h2>
        <p className="muted">
          Switch the public-facing site between the normal Hidden Gems marketplace and the AI Studio landing experience.
          This does not delete videos, points, VIP tiers, users, comments, libraries, or admin data.
        </p>

        <div className="mode-toggle-grid">
          <button
            className={isAiMode ? 'ghost-button' : 'button'}
            type="button"
            disabled={busy}
            onClick={() => quickMode('hidden_gems')}
          >
            Hidden Gems Mode
          </button>
          <button
            className={isAiMode ? 'button' : 'ghost-button'}
            type="button"
            disabled={busy}
            onClick={() => quickMode('ai_studio')}
          >
            AI Studio Mode
          </button>
        </div>

        <label>
          Current public site mode
          <select value={settings.site_mode || 'hidden_gems'} onChange={(e) => setSetting('site_mode', e.target.value)}>
            <option value="hidden_gems">Hidden Gems</option>
            <option value="ai_studio">AI Studio</option>
          </select>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.ai_studio_public_mode)}
            onChange={(e) => setSetting('ai_studio_public_mode', e.target.checked)}
          />
          Enable AI Studio public mode
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.hide_hidden_gems_branding !== false}
            onChange={(e) => setSetting('hide_hidden_gems_branding', e.target.checked)}
          />
          Hide Hidden Gems branding/content while AI mode is active
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settings.hide_video_marketplace_in_ai_mode !== false}
            onChange={(e) => setSetting('hide_video_marketplace_in_ai_mode', e.target.checked)}
          />
          Hide video marketplace pages while AI mode is active
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.disable_age_gate)}
            onChange={(e) => setSetting('disable_age_gate', e.target.checked)}
          />
          Disable/hide the 18+ entry popup
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.hide_all_videos)}
            onChange={(e) => setSetting('hide_all_videos', e.target.checked)}
          />
          Hide all current videos from public pages
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.safe_mode_enabled)}
            onChange={(e) => setSetting('safe_mode_enabled', e.target.checked)}
          />
          Safe mode enabled
        </label>

        <hr />

        <label className="check">
          <input
            type="checkbox"
            checked={settings.show_admin_mode_switch !== false}
            onChange={(e) => setSetting('show_admin_mode_switch', e.target.checked)}
          />
          Show admin-only “Return to Hidden Gems” button in AI mode
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.show_public_mode_switch)}
            onChange={(e) => setSetting('show_public_mode_switch', e.target.checked)}
          />
          Show public mode switch button to guests/users
        </label>

        <button className="button full" disabled={busy}>{busy ? 'Saving...' : 'Save Mode Settings'}</button>
        {message && <p className="notice-text">{message}</p>}
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
      </div>
    </section>
  )
}
