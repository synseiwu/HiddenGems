import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCombinedUnreadCount } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/site-dms.css'

export default function NotificationBell({ onClick }) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  async function refresh() {
    if (!user) {
      setCount(0)
      return
    }
    setCount(await getCombinedUnreadCount().catch(() => 0))
  }

  useEffect(() => {
    refresh()
    window.addEventListener('site-messages:refresh', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('site-messages:refresh', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [user])

  if (!user) return null

  return (
    <Link className="notification-bell" to="/messages" onClick={onClick} aria-label={`Inbox${count ? `, ${count} unread` : ''}`}>
      <Bell size={18} />
      {count > 0 && <span>{count > 99 ? '99+' : count}</span>}
    </Link>
  )
}
