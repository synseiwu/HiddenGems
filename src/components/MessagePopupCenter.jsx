import { Megaphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { acknowledgeMessage, dismissMessage, listPopupMessages, markMessageRead } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/site-messages.css'

export default function MessagePopupCenter() {
  const { user, rewardNotice } = useAuth()
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)

  const message = messages[0]

  async function refresh() {
    if (!user || rewardNotice) {
      setMessages([])
      return
    }

    const data = await listPopupMessages().catch(() => [])
    setMessages(data)
  }

  useEffect(() => {
    refresh()

    function handleRefresh() {
      refresh()
    }

    window.addEventListener('site-messages:refresh', handleRefresh)
    window.addEventListener('focus', handleRefresh)

    return () => {
      window.removeEventListener('site-messages:refresh', handleRefresh)
      window.removeEventListener('focus', handleRefresh)
    }
  }, [user, rewardNotice])

  useEffect(() => {
    if (!message) return

    function onKeyDown(event) {
      if (event.key === 'Escape' && !message.requires_acknowledgement) close('dismiss')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [message])

  if (!user || rewardNotice || !message) return null

  async function close(action = 'read') {
    setBusy(true)

    try {
      if (action === 'ack') {
        await acknowledgeMessage(message.id)
      } else if (action === 'dismiss') {
        await dismissMessage(message.id)
      } else {
        await markMessageRead(message.id)
      }
    } finally {
      setBusy(false)
      setMessages((prev) => prev.slice(1))
    }
  }

  return (
    <div className="site-popup-backdrop" role="dialog" aria-modal="true" aria-label="Site message">
      <section className={`card site-popup-card message-priority-${message.priority || 'normal'}`}>
        {!message.requires_acknowledgement && (
          <button className="site-popup-close" type="button" onClick={() => close('dismiss')} aria-label="Dismiss message">
            <X size={18} />
          </button>
        )}

        <div className="site-popup-icon">
          <Megaphone size={34} />
        </div>

        <span className="eyebrow">{message.message_type || 'Announcement'} · {message.priority || 'normal'}</span>
        <h2>{message.title}</h2>
        <p>{message.body}</p>

        <div className="site-popup-actions">
          {message.requires_acknowledgement ? (
            <button className="button full" type="button" onClick={() => close('ack')} disabled={busy}>
              {busy ? 'Saving...' : 'Acknowledge'}
            </button>
          ) : (
            <>
              <button className="button full" type="button" onClick={() => close('read')} disabled={busy}>
                {busy ? 'Saving...' : 'Mark Read'}
              </button>
              <button className="ghost-button full" type="button" onClick={() => close('dismiss')} disabled={busy}>
                Dismiss
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
