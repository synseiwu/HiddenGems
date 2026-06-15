import { useEffect, useState } from 'react'
import { CheckCircle2, Inbox, MailOpen, X } from 'lucide-react'
import {
  acknowledgeMessage,
  dismissMessage,
  listUserMessages,
  markMessageRead
} from '../lib/api'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import '../styles/site-messages.css'

export default function Messages() {
  const [messages, setMessages] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    const data = await listUserMessages().catch(() => [])
    setMessages(data)
    if (!selected && data.length) setSelected(data[0])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openMessage(message) {
    setSelected(message)
    if (!message.is_read) {
      await markMessageRead(message.id).catch(() => {})
      await load()
    }
  }

  async function acknowledgeSelected() {
    if (!selected) return
    setBusy(true)
    setNotice('')

    try {
      await acknowledgeMessage(selected.id)
      setNotice('Message acknowledged.')
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function dismissSelected() {
    if (!selected) return
    setBusy(true)
    setNotice('')

    try {
      await dismissMessage(selected.id)
      setNotice('Message dismissed.')
      setSelected(null)
      await load()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />

  if (!messages.length) {
    return (
      <div className="page narrow">
        <EmptyState title="No messages" text="Admin announcements and site messages will appear here." />
      </div>
    )
  }

  return (
    <div className="page messages-page">
      <section className="section-heading">
        <span className="eyebrow">Inbox</span>
        <h1>Messages</h1>
        <p>Read announcements, support notices, updates, and important account messages.</p>
      </section>

      <section className="messages-layout">
        <aside className="card message-inbox-list">
          {messages.map((message) => (
            <button
              key={message.id}
              type="button"
              className={selected?.id === message.id ? 'message-inbox-item active' : 'message-inbox-item'}
              onClick={() => openMessage(message)}
            >
              <span>{message.is_read ? <MailOpen size={16} /> : <Inbox size={16} />}</span>
              <strong>{message.title}</strong>
              <small>{message.message_type} · {message.priority}</small>
              {!message.is_read && <em>Unread</em>}
            </button>
          ))}
        </aside>

        <main className="card message-reader">
          {selected ? (
            <>
              <div className="split-line">
                <div>
                  <span className={`message-pill priority-${selected.priority}`}>{selected.priority}</span>
                  <span className="message-pill">{selected.message_type}</span>
                </div>
                <small>{new Date(selected.created_at).toLocaleString()}</small>
              </div>

              <h2>{selected.title}</h2>
              <p>{selected.body}</p>

              {selected.requires_acknowledgement && !selected.is_acknowledged && (
                <div className="message-required-box">
                  <CheckCircle2 size={20} />
                  This message requires acknowledgement.
                </div>
              )}

              {notice && <p className="notice-text">{notice}</p>}

              <div className="actions">
                {selected.requires_acknowledgement && !selected.is_acknowledged && (
                  <button className="button" onClick={acknowledgeSelected} disabled={busy}>
                    {busy ? 'Saving...' : 'Acknowledge'}
                  </button>
                )}
                <button className="ghost-button" onClick={() => markMessageRead(selected.id).then(load)} disabled={busy}>
                  Mark Read
                </button>
                <button className="ghost-button" onClick={dismissSelected} disabled={busy}>
                  <X size={16} />
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <EmptyState title="Choose a message" text="Select a message from your inbox." />
          )}
        </main>
      </section>
    </div>
  )
}
