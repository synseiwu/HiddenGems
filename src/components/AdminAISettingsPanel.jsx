import { useEffect, useState } from 'react'
import { Bot, Save } from 'lucide-react'
import Loader from './Loader'
import { getAISettingsAdmin, saveAISettingsAdmin } from '../lib/api'
import '../styles/ai-studio.css'

const fallbackSettings = {
  enabled: true,
  admin_free: true,
  model: 'gpt-4.1-mini',
  points_per_message: 25,
  max_output_tokens: 900,
  system_prompt: 'You are Hidden Gems AI Studio, a helpful assistant inside the Hidden Gems platform. Be useful, clear, and safe.'
}

export default function AdminAISettingsPanel() {
  const [settings, setSettings] = useState(fallbackSettings)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getAISettingsAdmin()
      .then((data) => setSettings({ ...fallbackSettings, ...(data || {}) }))
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false))
  }, [])

  function setField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      await saveAISettingsAdmin(settings)
      setMessage('AI Studio settings saved.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-site-controls ai-admin-panel">
      <form className="card admin-form" onSubmit={submit}>
        <span className="eyebrow">AI Studio</span>
        <h2><Bot size={26} /> Internal AI Settings</h2>
        <p className="muted">
          Control the embedded Hidden Gems AI Studio. Your OpenAI API key stays in Supabase secrets and never goes in browser code.
        </p>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.enabled)}
            onChange={(e) => setField('enabled', e.target.checked)}
          />
          AI Studio enabled
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(settings.admin_free)}
            onChange={(e) => setField('admin_free', e.target.checked)}
          />
          Admins can test AI without spending points
        </label>

        <div className="content-editor-grid">
          <label>
            OpenAI model
            <input
              value={settings.model || ''}
              onChange={(e) => setField('model', e.target.value)}
              placeholder="gpt-4.1-mini"
            />
          </label>

          <label>
            Points per message
            <input
              type="number"
              min="0"
              value={settings.points_per_message || 0}
              onChange={(e) => setField('points_per_message', Number(e.target.value))}
            />
          </label>

          <label>
            Max output tokens
            <input
              type="number"
              min="50"
              max="4000"
              value={settings.max_output_tokens || 900}
              onChange={(e) => setField('max_output_tokens', Number(e.target.value))}
            />
          </label>
        </div>

        <label>
          System prompt
          <textarea
            value={settings.system_prompt || ''}
            onChange={(e) => setField('system_prompt', e.target.value)}
            placeholder="Tell the AI how to behave..."
          />
        </label>

        <button className="button full" disabled={busy}>
          <Save size={16} />
          {busy ? 'Saving...' : 'Save AI Settings'}
        </button>

        {message && <p className="notice-text">{message}</p>}
      </form>
    </section>
  )
}
