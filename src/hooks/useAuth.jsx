import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { claimStarterBonus, getCurrentProfile } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const starterCheckedRef = useRef(new Set())

  async function hydrate(nextUser) {
    setUser(nextUser)

    if (!nextUser) {
      setProfile(null)
      setLoading(false)
      return
    }

    if (!starterCheckedRef.current.has(nextUser.id)) {
      starterCheckedRef.current.add(nextUser.id)
      await claimStarterBonus()
    }

    setProfile(await getCurrentProfile(nextUser.id))
    setLoading(false)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getUser().then(({ data }) => hydrate(data.user || null))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session?.user || null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      isVip: Boolean(profile?.vip_status),
      refreshProfile: () => user && hydrate(user),
      signOut: () => supabase?.auth.signOut()
    }),
    [user, profile, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
