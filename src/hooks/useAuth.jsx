import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { claimDailyLoginReward, claimStarterBonus, getCurrentProfile } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rewardNotice, setRewardNotice] = useState(null)
  const rewardCheckedRef = useRef(new Set())

  async function hydrate(nextUser) {
    setUser(nextUser)

    if (!nextUser) {
      setProfile(null)
      setRewardNotice(null)
      setLoading(false)
      return
    }

    if (!rewardCheckedRef.current.has(nextUser.id)) {
      rewardCheckedRef.current.add(nextUser.id)

      const starterResult = await claimStarterBonus()
      const dailyResult = await claimDailyLoginReward()

      if (starterResult?.granted) {
        setRewardNotice({
          title: 'Starter Bonus',
          message: `You received ${Number(starterResult.amount || 300)} free starter points!`,
          points: Number(starterResult.amount || 300),
          balance: Number(starterResult.points_balance || 300),
          cta: 'Buy More Points',
          to: '/points'
        })
      } else if (dailyResult?.granted) {
        setRewardNotice({
          title: 'Daily Reward',
          message: `Daily reward claimed! You received ${Number(dailyResult.amount || 0)} points.`,
          points: Number(dailyResult.amount || 0),
          balance: Number(dailyResult.points_balance || 0),
          cta: 'Buy More Points',
          to: '/points'
        })
      }
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
    () => {
      const vipRank = Number(profile?.vip_rank || (profile?.vip_status ? 1 : 0))
      return {
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        isVip: vipRank >= 1 || Boolean(profile?.vip_status),
        vipTier: profile?.subscription_tier || (profile?.vip_status ? 'vip' : 'none'),
        vipRank,
        rewardNotice,
        showRewardNotice: setRewardNotice,
        clearRewardNotice: () => setRewardNotice(null),
        refreshProfile: () => user && hydrate(user),
        signOut: () => supabase?.auth.signOut()
      }
    },
    [user, profile, loading, rewardNotice]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
