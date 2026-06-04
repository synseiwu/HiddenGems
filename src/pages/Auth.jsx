import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Login() {
  return <AuthForm mode="login" />
}

export function Signup() {
  return <AuthForm mode="signup" />
}

function AuthForm({ mode }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const action = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })
    const { error } = await action
    setBusy(false)
    if (error) return setMessage(error.message)
    navigate('/account')
  }

  return (
    <div className="page auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <span className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create account'}</span>
        <h1>{mode === 'login' ? 'Login' : 'Sign Up'}</h1>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="button full" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}</button>
        {message && <p className="error-text">{message}</p>}
        <p>
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <Link to={mode === 'login' ? '/signup' : '/login'}>{mode === 'login' ? 'Sign up' : 'Login'}</Link>
        </p>
      </form>
    </div>
  )
}
