import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './hooks/useAuth'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </React.StrictMode>
)
