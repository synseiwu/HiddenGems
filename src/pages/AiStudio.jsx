import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Gem, MessageSquarePlus, Send, Sparkles } from 'lucide-react'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { getAISettings, getPublicSiteSettings, getWallet, listAIConversations, listAIMessages, saveAdminSiteSettings, sendAIMessage } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/ai-studio.css'

export default function AiStudio() {
  const { user, isAdmin } = useAuth()
  const [settings, setSettings] = useState(null)
  const [wallet, setWallet] = useState({ points_balance: 0 })
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [siteSettings, setSiteSettings] = useState({ site_mode: 'hidden_gems', show_admin_mode_switch: true, show_public_mode_switch: false })
  const [modeMessage, setModeMessage] = useState('')

  const messageCost = useMemo(() => {
    if (!settings) return 0
    if (isAdmin) return 0
    return Number(settings.points_per_message || 0)
  }, [settings, isAdmin])

  async function refreshShell() {
    const [settingsData, walletData, conversationData, publicSettings] = await Promise.all([
      getAISettings(),
      user ? getWallet() : Promise.resolve({ points_balance: 0 }),
      user ? listAIConversations() : Promise.resolve([]),
      getPublicSiteSettings().catch(() => ({ site_mode: 'hidden_gems' }))
    ])

    setSettings(settingsData)
    setWallet(walletData)
    setConversations(conversationData)
    setSiteSettings(publicSettings)
  }

  useEffect(() => {
    refreshShell()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user])

  async function openConversation(id) {
    setConversationId(id)
    setError('')
    setMessages(await listAIMessages(id))
  }

  function startNewChat() {
    setConversationId('')
    setMessages([])
    setPrompt('')
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || busy) return

    setBusy(true)
    setError('')
    setPrompt('')

    const optimisticUserMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: cleanPrompt
    }

    setMessages((prev) => [...prev, optimisticUserMessage])

    try {
      const result = await sendAIMessage({ prompt: cleanPrompt, conversationId })
      const nextConversationId = result.conversation_id
      setConversationId(nextConversationId)

      const nextMessages = await listAIMessages(nextConversationId)
      setMessages(nextMessages)
      setWallet((prev) => ({ ...prev, points_balance: result.points_balance ?? prev.points_balance }))

      const nextConversations = await listAIConversations()
      setConversations(nextConversations)
    } catch (err) {
      setError(err.message)
      setMessages((prev) => prev.filter((message) => message.id !== optimisticUserMessage.id))
      setPrompt(cleanPrompt)
    } finally {
      setBusy(false)
    }
  }


  async function returnToHiddenGemsMode() {
    if (!isAdmin) return
    setModeMessage('')
    const next = { ...siteSettings, site_mode: 'hidden_gems', ai_studio_public_mode: false }
    try {
      await saveAdminSiteSettings(next)
      setSiteSettings(next)
      setModeMessage('Hidden Gems mode restored. Go to the homepage to view it.')
    } catch (err) {
      setModeMessage(err.message)
    }
  }

  if (loading) return <Loader />

  if (!settings?.enabled && !isAdmin) {
    return (
      <div className="page narrow">
        <EmptyState
          title="AI Studio is offline"
          text="AI Studio is currently disabled. Please check back later."
        />
      </div>
    )
  }

  return (
    <div className="page ai-studio-page">
      <section className="hero centered ai-studio-hero">
        <span className="eyebrow">Hidden Gems AI</span>
        <h1>AI Studio</h1>
        <p>Use Hidden Gems points to chat with an AI assistant inside your account.</p>
        <div className="ai-studio-pills">
          <span><Gem size={16} /> Balance: {wallet.points_balance ?? 0} points</span>
          <span><Sparkles size={16} /> Cost: {messageCost} points/message</span>
          <span><Bot size={16} /> Model: {settings?.model || 'AI'}</span>
        </div>

        {isAdmin && siteSettings.show_admin_mode_switch !== false && (
          <div className="actions centered-text">
            <button className="ghost-button" type="button" onClick={returnToHiddenGemsMode}>
              Admin: Return to Hidden Gems
            </button>
          </div>
        )}
        {!isAdmin && siteSettings.show_public_mode_switch && (
          <div className="actions centered-text">
            <Link className="ghost-button" to="/">Switch Mode</Link>
          </div>
        )}
        {modeMessage && <p className="notice-text">{modeMessage}</p>}
      </section>

      <section className="ai-studio-layout">
        <aside className="card ai-conversation-sidebar">
          <button className="button full" type="button" onClick={startNewChat}>
            <MessageSquarePlus size={16} />
            New Chat
          </button>

          <div className="ai-conversation-list">
            {conversations.length ? conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={conversation.id === conversationId ? 'ai-conversation active' : 'ai-conversation'}
                onClick={() => openConversation(conversation.id)}
              >
                <strong>{conversation.title}</strong>
                <span>{new Date(conversation.updated_at).toLocaleString()}</span>
              </button>
            )) : (
              <p className="muted">No chats yet. Start a new one.</p>
            )}
          </div>
        </aside>

        <main className="card ai-chat-panel">
          <div className="ai-message-list">
            {!messages.length && (
              <div className="ai-empty-chat">
                <Bot size={44} />
                <h2>Ask anything</h2>
                <p>Start a new AI chat. Your conversations are saved to your Hidden Gems account.</p>
              </div>
            )}

            {messages.map((message) => (
              <article className={`ai-message ${message.role}`} key={message.id}>
                <span>{message.role === 'assistant' ? 'AI Studio' : 'You'}</span>
                <p>{message.content}</p>
                {message.points_charged > 0 && <small>{message.points_charged} points used</small>}
              </article>
            ))}

            {busy && (
              <article className="ai-message assistant">
                <span>AI Studio</span>
                <p>Thinking...</p>
              </article>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}

          {!user ? (
            <div className="ai-login-card">
              <p>You need an account to use AI Studio.</p>
              <Link className="button" to="/login">Login</Link>
            </div>
          ) : (
            <form className="ai-prompt-form" onSubmit={submit}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Hidden Gems AI..."
                disabled={busy}
              />
              <button className="button" disabled={busy || !prompt.trim()}>
                <Send size={16} />
                {busy ? 'Sending...' : `Send${messageCost ? ` • ${messageCost} pts` : ''}`}
              </button>
            </form>
          )}
        </main>
      </section>
    </div>
  )
}
