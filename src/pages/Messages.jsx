import { useEffect, useState } from 'react'
import { Archive, CheckCircle2, Inbox, MailOpen, MessageSquarePlus, Send, X } from 'lucide-react'
import {
  acknowledgeMessage,
  archiveDmConversation,
  createDmConversation,
  dismissMessage,
  getDmConversation,
  listDmConversations,
  listUserMessages,
  markDmConversationRead,
  markMessageRead,
  searchUsersForDm,
  sendDmMessage
} from '../lib/api'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import '../styles/site-messages.css'
import '../styles/site-dms.css'

export default function Messages() {
  const [tab, setTab] = useState('dms')
  const [announcements, setAnnouncements] = useState([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState('')
  const [thread, setThread] = useState([])
  const [reply, setReply] = useState('')
  const [newRecipientQuery, setNewRecipientQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [newMessageBody, setNewMessageBody] = useState('')
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const activeConversation = conversations.find((conversation) => conversation.conversation_id === selectedConversation)

  async function load() {
    setLoading(true)
    const [dmData, announcementData] = await Promise.all([
      listDmConversations().catch(() => []),
      listUserMessages().catch(() => [])
    ])
    setConversations(dmData)
    setAnnouncements(announcementData)
    if (!selectedConversation && dmData.length) await openConversation(dmData[0].conversation_id, false)
    if (!selectedAnnouncement && announcementData.length) setSelectedAnnouncement(announcementData[0])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openConversation(conversationId, shouldReloadList = true) {
    setSelectedConversation(conversationId)
    setNotice('')
    const data = await getDmConversation(conversationId)
    setThread(data.messages || [])
    await markDmConversationRead(conversationId).catch(() => {})
    if (shouldReloadList) setConversations(await listDmConversations().catch(() => []))
  }

  async function sendReply(e) {
    e.preventDefault()
    if (!selectedConversation || !reply.trim()) return
    setBusy(true)
    setNotice('')
    try {
      await sendDmMessage(selectedConversation, reply)
      setReply('')
      await openConversation(selectedConversation)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function searchRecipients(query) {
    setNewRecipientQuery(query)
    if (query.trim().length < 2) {
      setUserResults([])
      return
    }
    setUserResults(await searchUsersForDm(query).catch(() => []))
  }

  async function startConversation(userId) {
    if (!newMessageBody.trim()) {
      setNotice('Write a message first.')
      return
    }
    setBusy(true)
    setNotice('')
    try {
      const conversation = await createDmConversation(userId, newMessageBody)
      setShowNewMessage(false)
      setNewRecipientQuery('')
      setUserResults([])
      setNewMessageBody('')
      await load()
      await openConversation(conversation.id)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function archiveSelected() {
    if (!selectedConversation) return
    setBusy(true)
    try {
      await archiveDmConversation(selectedConversation)
      setSelectedConversation('')
      setThread([])
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function openAnnouncement(message) {
    setSelectedAnnouncement(message)
    if (!message.is_read) {
      await markMessageRead(message.id).catch(() => {})
      setAnnouncements(await listUserMessages().catch(() => []))
    }
  }

  async function acknowledgeSelectedAnnouncement() {
    if (!selectedAnnouncement) return
    setBusy(true)
    try {
      await acknowledgeMessage(selectedAnnouncement.id)
      setAnnouncements(await listUserMessages().catch(() => []))
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function dismissSelectedAnnouncement() {
    if (!selectedAnnouncement) return
    setBusy(true)
    try {
      await dismissMessage(selectedAnnouncement.id)
      setSelectedAnnouncement(null)
      setAnnouncements(await listUserMessages().catch(() => []))
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="page messages-page">
      <section className="section-heading">
        <span className="eyebrow">Inbox</span>
        <h1>Messages</h1>
        <p>Read direct messages, admin broadcasts, and official announcements.</p>
      </section>

      <div className="message-tabs">
        <button className={tab === 'dms' ? 'active' : ''} onClick={() => setTab('dms')}>DMs</button>
        <button className={tab === 'announcements' ? 'active' : ''} onClick={() => setTab('announcements')}>Announcements</button>
      </div>

      {tab === 'dms' ? (
        <section className="dm-layout">
          <aside className="card dm-sidebar">
            <button className="button full" type="button" onClick={() => setShowNewMessage((value) => !value)}>
              <MessageSquarePlus size={16} /> New Message
            </button>

            {showNewMessage && (
              <div className="dm-new-card">
                <label>Search by username<input value={newRecipientQuery} onChange={(e) => searchRecipients(e.target.value)} placeholder="type a username..." /></label>
                <label>Message<textarea value={newMessageBody} onChange={(e) => setNewMessageBody(e.target.value)} placeholder="Write your message..." rows="4" /></label>
                <div className="dm-user-results">
                  {userResults.map((user) => (
                    <button key={user.id} type="button" onClick={() => startConversation(user.id)} disabled={busy}>
                      <strong>{user.display_name || (user.username ? `@${user.username}` : user.email)}</strong><small>{user.username ? `@${user.username}` : user.role || 'user'}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="dm-conversation-list">
              {conversations.length ? conversations.map((conversation) => (
                <button key={conversation.conversation_id} type="button" className={selectedConversation === conversation.conversation_id ? 'dm-conversation active' : 'dm-conversation'} onClick={() => openConversation(conversation.conversation_id)}>
                  <strong>{conversation.display_title || conversation.other_participant_email || 'Conversation'}</strong>
                  <span>{conversation.last_message_body || 'No messages yet'}</span>
                  <small>{new Date(conversation.updated_at).toLocaleString()}</small>
                  {Number(conversation.unread_count || 0) > 0 && <em>{conversation.unread_count}</em>}
                </button>
              )) : <p className="muted">No DMs yet.</p>}
            </div>
          </aside>

          <main className="card dm-thread-panel">
            {activeConversation ? (
              <>
                <div className="split-line">
                  <div><span className="eyebrow">Conversation</span><h2>{activeConversation.display_title || activeConversation.other_participant_email || 'DM'}</h2></div>
                  <button className="ghost-button" onClick={archiveSelected} disabled={busy}><Archive size={16} /> Archive</button>
                </div>
                <div className="dm-thread">
                  {thread.map((message) => (
                    <article className={`dm-message ${message.sender_label ? 'admin' : ''}`} key={message.id}>
                      <span>{message.sender_label || 'User'}</span><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small>
                    </article>
                  ))}
                </div>
                {notice && <p className="notice-text">{notice}</p>}
                <form className="dm-reply-form" onSubmit={sendReply}>
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply..." rows="3" />
                  <button className="button" disabled={busy || !reply.trim()}><Send size={16} /> Send</button>
                </form>
              </>
            ) : <EmptyState title="Choose a conversation" text="Select a DM or start a new message." />}
          </main>
        </section>
      ) : (
        <section className="messages-layout">
          <aside className="card message-inbox-list">
            {announcements.length ? announcements.map((message) => (
              <button key={message.id} type="button" className={selectedAnnouncement?.id === message.id ? 'message-inbox-item active' : 'message-inbox-item'} onClick={() => openAnnouncement(message)}>
                <span>{message.is_read ? <MailOpen size={16} /> : <Inbox size={16} />}</span>
                <strong>{message.title}</strong>
                <small>{message.message_type} · {message.priority}</small>
                {!message.is_read && <em>Unread</em>}
              </button>
            )) : <p className="muted">No announcements.</p>}
          </aside>
          <main className="card message-reader">
            {selectedAnnouncement ? (
              <>
                <div className="split-line"><div><span className={`message-pill priority-${selectedAnnouncement.priority}`}>{selectedAnnouncement.priority}</span><span className="message-pill">{selectedAnnouncement.message_type}</span></div><small>{new Date(selectedAnnouncement.created_at).toLocaleString()}</small></div>
                <h2>{selectedAnnouncement.title}</h2>
                <p>{selectedAnnouncement.body}</p>
                {selectedAnnouncement.requires_acknowledgement && !selectedAnnouncement.is_acknowledged && <div className="message-required-box"><CheckCircle2 size={20} /> This message requires acknowledgement.</div>}
                {notice && <p className="notice-text">{notice}</p>}
                <div className="actions">
                  {selectedAnnouncement.requires_acknowledgement && !selectedAnnouncement.is_acknowledged && <button className="button" onClick={acknowledgeSelectedAnnouncement} disabled={busy}>Acknowledge</button>}
                  <button className="ghost-button" onClick={() => markMessageRead(selectedAnnouncement.id).then(load)} disabled={busy}>Mark Read</button>
                  <button className="ghost-button" onClick={dismissSelectedAnnouncement} disabled={busy}><X size={16} /> Dismiss</button>
                </div>
              </>
            ) : <EmptyState title="Choose an announcement" text="Select an announcement from the list." />}
          </main>
        </section>
      )}
    </div>
  )
}
