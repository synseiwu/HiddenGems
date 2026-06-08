import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Login() {
  return <AuthForm mode="login" />
}

export function Signup() {
  return <AuthForm mode="signup" />
}

function getFriendlyAuthMessage(errorMessage) {
  const message = String(errorMessage || '').toLowerCase()

  if (message.includes('email rate limit')) {
    return 'Too many signup emails were requested. Please wait about an hour before trying again, or contact support.'
  }

  if (message.includes('invalid login credentials')) {
    return 'Invalid login credentials. Please check your email and password, or reset your password if needed.'
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox/spam folder, then return here to log in.'
  }

  return errorMessage || 'Something went wrong. Please try again.'
}

function AuthForm({ mode }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode === 'login' && searchParams.get('confirmed')) {
      setMessage('Email confirmed! You can log in now.')
      setMessageType('success')
    } else if (mode === 'login' && searchParams.get('protected')) {
      setMessage('Please log in or create an account before viewing Hidden Gems video content.')
      setMessageType('success')
    }
  }, [mode, searchParams])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setMessageType('error')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)

      if (error) {
        setMessage(getFriendlyAuthMessage(error.message))
        setMessageType('error')
        return
      }

      navigate(searchParams.get('next') || '/account')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`
      }
    })

    setBusy(false)

    if (error) {
      setMessage(getFriendlyAuthMessage(error.message))
      setMessageType('error')
      return
    }

    if (data?.session) {
      navigate('/account')
      return
    }

    setMessage('Account created! Please check your email to confirm your account, then return to login. New users receive a one-time 300 point starter bonus after their first confirmed login.')
    setMessageType('success')
  }

  return (
    <div className="page auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <span className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create account'}</span>
        <h1>{mode === 'login' ? 'Login' : 'Sign Up'}</h1>

        <label>
          Email
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            minLength="6"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button className="button full" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
        </button>

        {message && (
          <p className={messageType === 'success' ? 'success-text' : 'error-text'}>
            {message}
          </p>
        )}

        <p>
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <Link to={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'Sign up' : 'Login'}</Link>
        </p>
      </form>
    </div>
  )
}
