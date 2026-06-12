import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { claimDailyLoginReward, claimStarterBonus, getCurrentProfile } from '../lib/api'

const AuthContext = createContext(null)

function localRewardDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildRewardNotice(starterResult, dailyResult) {
  const starterGranted = Boolean(starterResult?.granted)
  const dailyGranted = Boolean(dailyResult?.granted)

  if (!starterGranted && !dailyGranted) return null

  const starterAmount = starterGranted ? Number(starterResult?.amount || 300) : 0
  const dailyAmount = dailyGranted ? Number(dailyResult?.amount || 0) : 0
  const totalPoints = starterAmount + dailyAmount

  const finalBalance = Number(
    dailyResult?.points_balance ??
    starterResult?.points_balance ??
    totalPoints
  )

  if (starterGranted && dailyGranted) {
    return {
      title: 'Points Reward',
      message: `You received ${totalPoints} points!`,
      details: `Starter bonus: ${starterAmount} points • Daily login bonus: ${dailyAmount} points`,
      points: totalPoints,
      balance: finalBalance,
      cta: 'Buy More Points',
      to: '/points'
    }
  }

  if (starterGranted) {
    return {
      title: 'Starter Bonus',
      message: `You received ${starterAmount} free starter points!`,
      details: 'Welcome bonus added to your account.',
      points: starterAmount,
      balance: finalBalance,
      cta: 'Buy More Points',
      to: '/points'
    }
  }

  return {
    title: 'Daily Login Bonus',
    message: `Welcome back — you received ${dailyAmount} points!`,
    details: 'Come back tomorrow to claim your next daily reward.',
    points: dailyAmount,
    balance: finalBalance,
    cta: 'Buy More Points',
    to: '/points'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rewardNotice, setRewardNotice] = useState(null)
  const rewardCheckedRef = useRef(new Set())
  const activeUserRef = useRef(null)

  const checkRewardsForUser = useCallback(async (nextUser, options = {}) => {
    if (!nextUser) return null

    const todayKey = localRewardDateKey()
    const checkKey = `${nextUser.id}:${todayKey}`
    const force = Boolean(options.force)

    if (!force && rewardCheckedRef.current.has(checkKey)) return null
    rewardCheckedRef.current.add(checkKey)

    const starterResult = await claimStarterBonus()
    const dailyResult = await claimDailyLoginReward()

    const notice = buildRewardNotice(starterResult, dailyResult)

    if (notice) {
      setRewardNotice(notice)
      window.dispatchEvent(new Event('wallet:refresh'))
    }

    return notice
  }, [])

  async function hydrate(nextUser) {
    activeUserRef.current = nextUser
    setUser(nextUser)

    if (!nextUser) {
      setProfile(null)
      setRewardNotice(null)
      setLoading(false)
      return
    }

    try {
      await checkRewardsForUser(nextUser)
      setProfile(await getCurrentProfile(nextUser.id))
    } finally {
      setLoading(false)
    }
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
  }, [checkRewardsForUser])

  useEffect(() => {
    function checkNextDayReward() {
      const currentUser = activeUserRef.current
      if (!currentUser) return
      checkRewardsForUser(currentUser).catch(() => {})
    }

    window.addEventListener('focus', checkNextDayReward)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkNextDayReward()
    })

    return () => {
      window.removeEventListener('focus', checkNextDayReward)
    }
  }, [checkRewardsForUser])

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
