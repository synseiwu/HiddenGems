import { useEffect, useMemo, useState } from 'react'
import {
  adminBroadcastDm,
  adminCreateMessage,
  adminDeleteMessage,
  adminListMessages,
  adminSaveMessagingSettings,
  adminSearchUsersForDm,
  adminSendDmToUser,
  adminUpdateMessage,
  getMessagingSettings
} from '../lib/api'
import Loader from './Loader'
import '../styles/site-messages.css'
import '../styles/site-dms.css'

const emptyForm = {
  title: '',
  body: '',
  message_type: 'announcement',
  priority: 'normal',
  audience: 'all',
  active: true,
  popup_enabled: false,
  requires_acknowledgement: false,
  show_once: true,
  expires_at: ''
}

export default function AdminMessagesPanel() {
  const [activeTab, setActiveTab] = useState('dms')
  const [messages, setMessages] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [settings, setSettings] = useState(null)
  const [filter, setFilter] = useState('all')
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [dmBody, setDmBody] = useState('')
  const [broadcast, setBroadcast] = useState({ title: 'Admin Broadcast', body: '', audience: 'all' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    const [messageData, settingsData] = await Promise.all([
      adminListMessages().catch(() => []),
      getMessagingSettings().catch(() => null)
    ])
    setMessages(messageData)
    setSettings(settingsData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return messages
    if (filter === 'active') return messages.filter((message) => message.active)
    if (filter === 'inactive') return messages.filter((message) => !message.active)
    return messages.filter((message) => message.priority === filter || message.message_type === filter || message.audience === filter)
  }, [messages, filter])

  function setField(key, value) { setForm((prev) => ({ ...prev, [key]: value })) }
  function setSetting(key, value) { setSettings((prev) => ({ ...(prev || {}), [key]: value })) }

  async function saveSettings() {
    setBusy(true); setNotice('')
    try {
      await adminSaveMessagingSettings(settings)
      setNotice('Messaging settings saved.')
      await load()
    } catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  async function searchUsers(query) {
    setUserQuery(query)
    if (query.trim().length < 2) { setUserResults([]); return }
    setUserResults(await adminSearchUsersForDm(query).catch(() => []))
  }

  async function sendSingleDm() {
    if (!selectedUser) { setNotice('Choose a user first.'); return }
    setBusy(true); setNotice('')
    try {
      await adminSendDmToUser(selectedUser.id, dmBody)
      setDmBody(''); setSelectedUser(null); setUserQuery(''); setUserResults([])
      setNotice('Admin DM sent.')
    } catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  async function sendBroadcast() {
    setBusy(true); setNotice('')
    try {
      const result = await adminBroadcastDm(broadcast)
      setBroadcast({ title: 'Admin Broadcast', body: '', audience: 'all' })
      setNotice(`Broadcast sent to ${result.sent} user(s).`)
    } catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  function editMessage(message) {
    setForm({ ...message, expires_at: message.expires_at ? message.expires_at.slice(0, 16) : '' })
    setActiveTab('announcements')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitAnnouncement(e) {
    e.preventDefault()
    setBusy(true); setNotice('')
    try {
      if (form.id) { await adminUpdateMessage(form.id, form); setNotice('Announcement updated.') }
      else { await adminCreateMessage(form); setNotice('Announcement sent.') }
      setForm(emptyForm)
      await load()
    } catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  async function toggleActive(message) {
    setBusy(true)
    try { await adminUpdateMessage(message.id, { ...message, active: !message.active }); await load() }
    catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  async function remove(id) {
    if (!confirm('Delete this announcement?')) return
    setBusy(true)
    try { await adminDeleteMessage(id); await load() }
    catch (err) { setNotice(err.message) } finally { setBusy(false) }
  }

  if (loading) return <Loader />

  return (
    <section className="admin-message-panel">
      <div className="message-tabs">
        <button className={activeTab === 'dms' ? 'active' : ''} onClick={() => setActiveTab('dms')}>DM Center</button>
        <button className={activeTab === 'announcements' ? 'active' : ''} onClick={() => setActiveTab('announcements')}>Announcements</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Settings</button>
      </div>
      {notice && <p className="notice-text">{notice}</p>}

      {activeTab === 'dms' && (
        <section className="admin-dm-grid">
          <div className="card admin-message-form">
            <span className="eyebrow">Admin DM</span><h2>Send DM to one user</h2>
            <label>Search user by username or email<input value={userQuery} onChange={(e) => searchUsers(e.target.value)} placeholder="type username or email..." /></label>
            <div className="dm-user-results admin-search-results">
              {userResults.map((user) => (
                <button key={user.id} type="button" onClick={() => setSelectedUser(user)} className={selectedUser?.id === user.id ? 'selected' : ''}>
                  <strong>{user.display_name || (user.username ? `@${user.username}` : user.email)}</strong><small>{user.email ? user.email : user.role || 'user'} · rank {user.vip_rank || 0}</small>
                </button>
              ))}
            </div>
            {selectedUser && <p className="notice-text">Selected: {selectedUser.email}</p>}
            <label>Message<textarea value={dmBody} onChange={(e) => setDmBody(e.target.value)} rows="6" placeholder="Write the admin DM..." /></label>
            <button className="button" onClick={sendSingleDm} disabled={busy}>{busy ? 'Sending...' : 'Send DM'}</button>
          </div>

          <div className="card admin-message-form">
            <span className="eyebrow">Broadcast DM</span><h2>DM everyone or a role</h2>
            <label>Title<input value={broadcast.title} onChange={(e) => setBroadcast((prev) => ({ ...prev, title: e.target.value }))} /></label>
            <label>Audience<select value={broadcast.audience} onChange={(e) => setBroadcast((prev) => ({ ...prev, audience: e.target.value }))}>
              <option value="all">All users</option><option value="vip">VIP and higher</option><option value="supervip">Super VIP and higher</option><option value="ultravip">Ultra VIP and higher</option><option value="admins">Admins only</option>
            </select></label>
            <label>Message<textarea value={broadcast.body} onChange={(e) => setBroadcast((prev) => ({ ...prev, body: e.target.value }))} rows="6" placeholder="Write the broadcast DM..." /></label>
            <button className="button" onClick={sendBroadcast} disabled={busy}>{busy ? 'Sending...' : 'Broadcast DM'}</button>
          </div>
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="card admin-message-form">
          <span className="eyebrow">Messaging Settings</span><h2>DM and announcement controls</h2>
          <div className="admin-message-grid toggles">
            <label className="check"><input type="checkbox" checked={settings?.enable_user_dms !== false} onChange={(e) => setSetting('enable_user_dms', e.target.checked)} /> Enable DMs</label>
            <label className="check"><input type="checkbox" checked={settings?.allow_user_to_user_dms !== false} onChange={(e) => setSetting('allow_user_to_user_dms', e.target.checked)} /> User-to-user DMs</label>
            <label className="check"><input type="checkbox" checked={settings?.allow_users_to_reply_to_admin_messages !== false} onChange={(e) => setSetting('allow_users_to_reply_to_admin_messages', e.target.checked)} /> Replies to admin DMs</label>
            <label className="check"><input type="checkbox" checked={settings?.dm_unread_badge_enabled !== false} onChange={(e) => setSetting('dm_unread_badge_enabled', e.target.checked)} /> Unread badge</label>
            <label className="check"><input type="checkbox" checked={Boolean(settings?.announcements_popup_enabled)} onChange={(e) => setSetting('announcements_popup_enabled', e.target.checked)} /> Announcement popups</label>
            <label className="check"><input type="checkbox" checked={settings?.onboarding_message_enabled !== false} onChange={(e) => setSetting('onboarding_message_enabled', e.target.checked)} /> Welcome inbox message</label>
          </div>
          
          <div className="settings-subsection">
            <span className="eyebrow">Username and rewards</span>
            <div className="admin-message-grid toggles">
              <label className="check"><input type="checkbox" checked={settings?.require_username_on_login !== false} onChange={(e) => setSetting('require_username_on_login', e.target.checked)} /> Require username prompt</label>
              <label className="check"><input type="checkbox" checked={Boolean(settings?.allow_username_skip)} onChange={(e) => setSetting('allow_username_skip', e.target.checked)} /> Allow skip</label>
              <label className="check"><input type="checkbox" checked={settings?.username_bonus_enabled !== false} onChange={(e) => setSetting('username_bonus_enabled', e.target.checked)} /> Username bonus</label>
              <label className="check"><input type="checkbox" checked={settings?.hidden_gems_access_bonus_enabled !== false} onChange={(e) => setSetting('hidden_gems_access_bonus_enabled', e.target.checked)} /> Access bonus</label>
              <label className="check"><input type="checkbox" checked={settings?.allow_dm_search_by_username !== false} onChange={(e) => setSetting('allow_dm_search_by_username', e.target.checked)} /> Username search</label>
              <label className="check"><input type="checkbox" checked={Boolean(settings?.allow_dm_search_by_email)} onChange={(e) => setSetting('allow_dm_search_by_email', e.target.checked)} /> Email search</label>
              <label className="check"><input type="checkbox" checked={Boolean(settings?.allow_username_changes)} onChange={(e) => setSetting('allow_username_changes', e.target.checked)} /> Username changes</label>
            </div>
            <div className="admin-message-grid">
              <label>Username bonus points<input type="number" min="0" value={settings?.username_bonus_points || 100} onChange={(e) => setSetting('username_bonus_points', Number(e.target.value || 0))} /></label>
              <label>Hidden Gems access bonus<input type="number" min="0" value={settings?.hidden_gems_access_bonus_points || 100} onChange={(e) => setSetting('hidden_gems_access_bonus_points', Number(e.target.value || 0))} /></label>
              <label>Username cooldown days<input type="number" min="0" value={settings?.username_change_cooldown_days || 30} onChange={(e) => setSetting('username_change_cooldown_days', Number(e.target.value || 0))} /></label>
            </div>
          </div>

          <button className="button" onClick={saveSettings} disabled={busy}>{busy ? 'Saving...' : 'Save Settings'}</button>
        
        </section>
      )}

      {activeTab === 'announcements' && (
        <>
          <form className="card admin-message-form" onSubmit={submitAnnouncement}>
            <span className="eyebrow">Announcements</span><h2>{form.id ? 'Edit Announcement' : 'Create Announcement'}</h2>
            <div className="admin-message-grid">
              <label>Title<input value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label>
              <label>Type<select value={form.message_type} onChange={(e) => setField('message_type', e.target.value)}><option value="announcement">Announcement</option><option value="update">Update</option><option value="warning">Warning</option><option value="support">Support Notice</option><option value="promotion">Promotion</option><option value="system">System Notice</option></select></label>
              <label>Priority<select value={form.priority} onChange={(e) => setField('priority', e.target.value)}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label>
              <label>Audience<select value={form.audience} onChange={(e) => setField('audience', e.target.value)}><option value="all">All logged-in users</option><option value="authenticated">Authenticated users</option><option value="vip">VIP and higher</option><option value="supervip">Super VIP and higher</option><option value="ultravip">Ultra VIP and higher</option><option value="admins">Admins only</option></select></label>
            </div>
            <label>Message body<textarea value={form.body} onChange={(e) => setField('body', e.target.value)} required rows="6" /></label>
            <div className="admin-message-grid toggles">
              <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} /> Active</label>
              <label className="check"><input type="checkbox" checked={form.popup_enabled} onChange={(e) => setField('popup_enabled', e.target.checked)} /> Show as popup</label>
              <label className="check"><input type="checkbox" checked={form.requires_acknowledgement} onChange={(e) => setField('requires_acknowledgement', e.target.checked)} /> Requires acknowledgement</label>
              <label className="check"><input type="checkbox" checked={form.show_once} onChange={(e) => setField('show_once', e.target.checked)} /> Show once</label>
            </div>
            <label>Expiration date/time optional<input type="datetime-local" value={form.expires_at || ''} onChange={(e) => setField('expires_at', e.target.value)} /></label>
            <div className="actions"><button className="button" disabled={busy}>{busy ? 'Saving...' : form.id ? 'Update Announcement' : 'Send Announcement'}</button>{form.id && <button className="ghost-button" type="button" onClick={() => setForm(emptyForm)}>Cancel Edit</button>}</div>
          </form>

          <div className="card admin-message-list">
            <div className="split-line"><div><span className="eyebrow">Official Notices</span><h2>Sent Announcements</h2></div><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="urgent">Urgent</option><option value="important">Important</option><option value="announcement">Announcements</option><option value="admins">Admins</option><option value="vip">VIP</option></select></div>
            <div className="site-message-list">
              {filtered.length ? filtered.map((message) => (
                <article className="site-message-card" key={message.id}>
                  <div><span className={`message-pill priority-${message.priority}`}>{message.priority}</span><span className="message-pill">{message.message_type}</span><span className="message-pill">{message.audience}</span></div>
                  <h3>{message.title}</h3><p>{message.body}</p><small>{message.active ? 'Active' : 'Inactive'} · Reads {message.stats?.read_count || 0} · Acknowledged {message.stats?.acknowledged_count || 0} · Dismissed {message.stats?.dismissed_count || 0}</small>
                  <div className="actions"><button className="ghost-button" type="button" onClick={() => editMessage(message)}>Edit</button><button className="ghost-button" type="button" onClick={() => toggleActive(message)}>{message.active ? 'Deactivate' : 'Activate'}</button><button className="danger-button" type="button" onClick={() => remove(message.id)}>Delete</button></div>
                </article>
              )) : <p className="muted">No announcements found.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
