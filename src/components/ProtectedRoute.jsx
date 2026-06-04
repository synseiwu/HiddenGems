import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Loader from './Loader'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/account" replace />
  return children
}
