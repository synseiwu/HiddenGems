import { useEffect, useMemo, useState } from 'react'
import {
  adminCreateMessage,
  adminDeleteMessage,
  adminListMessages,
  adminUpdateMessage
} from '../lib/api'
import Loader from './Loader'
import '../styles/site-messages.css'

const emptyForm = {
  title: '',
  body: '',
  message_type: 'announcement',
  priority: 'normal',
  audience: 'all',
  active: true,
  popup_enabled: true,
  requires_acknowledgement: false,
  show_once: true,
  expires_at: ''
}

export default function AdminMessagesPanel() {
  const [messages, setMessages] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    const data = await adminListMessages().catch(() => [])
    setMessages(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return messages
    if (filter === 'active') return messages.filter((message) => message.active)
    if (filter === 'inactive') return messages.filter((message) => !message.active)
    return messages.filter((message) => message.priority === filter || message.message_type === filter || message.audience === filter)
  }, [messages, filter])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function editMessage(message) {
    setForm({
      ...message,
      expires_at: message.expires_at ? message.expires_at.slice(0, 16) : ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setNotice('')

    try {
      if (form.id) {
        await adminUpdateMessage(form.id, form)
        setNotice('Message updated.')
      } else {
        await adminCreateMessage(form)
        setNotice('Message sent.')
      }

      setForm(emptyForm)
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(message) {
    setBusy(true)
    try {
      await adminUpdateMessage(message.id, { ...message, active: !message.active })
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this message?')) return
    setBusy(true)
    try {
      await adminDeleteMessage(id)
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-message-panel">
      <form className="card admin-message-form" onSubmit={submit}>
        <span className="eyebrow">Site Messages</span>
        <h2>{form.id ? 'Edit Message' : 'Create New Message'}</h2>

        <div className="admin-message-grid">
          <label>Title<input value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label>
          <label>Type<select value={form.message_type} onChange={(e) => setField('message_type', e.target.value)}>
            <option value="announcement">Announcement</option>
            <option value="update">Update</option>
            <option value="warning">Warning</option>
            <option value="support">Support Notice</option>
            <option value="promotion">Promotion</option>
            <option value="system">System Notice</option>
          </select></label>
          <label>Priority<select value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select></label>
          <label>Audience<select value={form.audience} onChange={(e) => setField('audience', e.target.value)}>
            <option value="all">All logged-in users</option>
            <option value="authenticated">Authenticated users</option>
            <option value="vip">VIP and higher</option>
            <option value="supervip">Super VIP and higher</option>
            <option value="ultravip">Ultra VIP and higher</option>
            <option value="admins">Admins only</option>
          </select></label>
        </div>

        <label>Message body<textarea value={form.body} onChange={(e) => setField('body', e.target.value)} required rows="6" /></label>

        <div className="admin-message-grid toggles">
          <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} /> Active</label>
          <label className="check"><input type="checkbox" checked={form.popup_enabled} onChange={(e) => setField('popup_enabled', e.target.checked)} /> Show as popup</label>
          <label className="check"><input type="checkbox" checked={form.requires_acknowledgement} onChange={(e) => setField('requires_acknowledgement', e.target.checked)} /> Requires acknowledgement</label>
          <label className="check"><input type="checkbox" checked={form.show_once} onChange={(e) => setField('show_once', e.target.checked)} /> Show once</label>
        </div>

        <label>Expiration date/time optional<input type="datetime-local" value={form.expires_at || ''} onChange={(e) => setField('expires_at', e.target.value)} /></label>

        <div className="actions">
          <button className="button" disabled={busy}>{busy ? 'Saving...' : form.id ? 'Update Message' : 'Send Message'}</button>
          {form.id && <button className="ghost-button" type="button" onClick={() => setForm(emptyForm)}>Cancel Edit</button>}
        </div>

        {notice && <p className="notice-text">{notice}</p>}
      </form>

      <div className="card admin-message-list">
        <div className="split-line">
          <div>
            <span className="eyebrow">Inbox System</span>
            <h2>Sent Messages</h2>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="urgent">Urgent</option>
            <option value="important">Important</option>
            <option value="announcement">Announcements</option>
            <option value="admins">Admins</option>
            <option value="vip">VIP</option>
          </select>
        </div>

        <div className="site-message-list">
          {filtered.length ? filtered.map((message) => (
            <article className="site-message-card" key={message.id}>
              <div>
                <span className={`message-pill priority-${message.priority}`}>{message.priority}</span>
                <span className="message-pill">{message.message_type}</span>
                <span className="message-pill">{message.audience}</span>
              </div>
              <h3>{message.title}</h3>
              <p>{message.body}</p>
              <small>
                {message.active ? 'Active' : 'Inactive'} · Reads {message.stats?.read_count || 0} · Acknowledged {message.stats?.acknowledged_count || 0} · Dismissed {message.stats?.dismissed_count || 0}
              </small>
              <div className="actions">
                <button className="ghost-button" onClick={() => editMessage(message)}>Edit</button>
                <button className="ghost-button" onClick={() => toggleActive(message)}>{message.active ? 'Deactivate' : 'Activate'}</button>
                <button className="danger-button" onClick={() => remove(message.id)}>Delete</button>
              </div>
            </article>
          )) : <p className="muted">No messages found.</p>}
        </div>
      </div>
    </section>
  )
}
