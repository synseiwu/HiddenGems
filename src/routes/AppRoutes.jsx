import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import Home from '../pages/Home'
import Videos from '../pages/Videos'
import VideoDetails from '../pages/VideoDetails'
import Library from '../pages/Library'
import Vip from '../pages/Vip'
import Points from '../pages/Points'
import About from '../pages/About'
import AccessInfo from '../pages/AccessInfo'
import PolicyPage from '../pages/PolicyPage'
import Account from '../pages/Account'
import Admin from '../pages/Admin'
import Forum from '../pages/Forum'
import AiStudio from '../pages/AiStudio'
import Messages from '../pages/Messages'
import { Login, Signup } from '../pages/Auth'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'access-info', element: <AccessInfo /> },
      { path: 'contact', element: <PolicyPage type="contact" /> },
      { path: 'privacy', element: <PolicyPage type="privacy" /> },
      { path: 'terms', element: <PolicyPage type="terms" /> },
      { path: 'refund-policy', element: <PolicyPage type="refunds" /> },
      { path: '2257-compliance', element: <PolicyPage type="compliance" /> },
      { path: 'login', element: <Login /> },
      { path: 'signup', element: <Signup /> },
      { path: 'videos', element: <ProtectedRoute><Videos /></ProtectedRoute> },
      { path: 'videos/:id', element: <ProtectedRoute><VideoDetails /></ProtectedRoute> },
      { path: 'vip', element: <ProtectedRoute><Vip /></ProtectedRoute> },
      { path: 'points', element: <ProtectedRoute><Points /></ProtectedRoute> },
      { path: 'buy-points', element: <ProtectedRoute><Points /></ProtectedRoute> },
      { path: 'library', element: <ProtectedRoute><Library /></ProtectedRoute> },
      { path: 'forum', element: <ProtectedRoute><Forum /></ProtectedRoute> },
      { path: 'messages', element: <ProtectedRoute><Messages /></ProtectedRoute> },
      { path: 'ai-studio', element: <ProtectedRoute><AiStudio /></ProtectedRoute> },
      { path: 'account', element: <ProtectedRoute><Account /></ProtectedRoute> },
      { path: 'admin', element: <ProtectedRoute adminOnly><Admin /></ProtectedRoute> }
    ]
  }
])

export default function AppRoutes() {
  return <RouterProvider router={router} />
}
