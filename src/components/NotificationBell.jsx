import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getUnreadMessageCount } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/site-messages.css'

export default function NotificationBell({ onClick }) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  async function refresh() {
    if (!user) {
      setCount(0)
      return
    }

    const nextCount = await getUnreadMessageCount().catch(() => 0)
    setCount(nextCount)
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
  }, [user])

  if (!user) return null

  return (
    <Link className="notification-bell" to="/messages" onClick={onClick} aria-label={`Messages${count ? `, ${count} unread` : ''}`}>
      <Bell size={18} />
      {count > 0 && <span>{count > 99 ? '99+' : count}</span>}
    </Link>
  )
}
