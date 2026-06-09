import { supabase } from './supabase'

export const VIP_RANKS = {
  none: 0,
  free: 0,
  points: 0,
  paid: 0,
  vip: 1,
  supervip: 2,
  ultravip: 3,
  admin_only: 99
}

export function getAccessRank(accessType) {
  return VIP_RANKS[accessType] ?? 0
}

export function getAccessLabel(accessType) {
  const labels = {
    free: 'Free',
    points: 'Points',
    paid: 'Points',
    vip: 'VIP',
    supervip: 'Super VIP',
    ultravip: 'Ultra VIP',
    admin_only: 'Admin Only'
  }
  return labels[accessType] || accessType || 'Points'
}

export function isVipAccessType(accessType) {
  return ['vip', 'supervip', 'ultravip', 'admin_only'].includes(accessType)
}

export async function getCurrentProfile(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) return null
  return data
}

export async function getWallet() {
  if (!supabase) return { points_balance: 0 }
  const { data, error } = await supabase.rpc('get_my_wallet')
  if (error) return { points_balance: 0 }
  return data?.[0] || { points_balance: 0 }
}

export async function claimStarterBonus() {
  if (!supabase) return { granted: false, points_balance: 0 }
  const { data, error } = await supabase.rpc('claim_starter_bonus')
  if (error) {
    console.warn('Starter bonus check failed:', error.message)
    return { granted: false, points_balance: 0 }
  }
  const result = data?.[0] || { granted: false, points_balance: 0 }
  if (result.granted) window.dispatchEvent(new Event('wallet:refresh'))
  return result
}

export async function listPointPackages() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('point_packages')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listPointPackagesAdmin() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('point_packages')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function savePointPackage(pointPackage) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    name: pointPackage.name?.trim(),
    description: pointPackage.description?.trim() || null,
    points_amount: Number(pointPackage.points_amount || 0),
    price_cents: Number(pointPackage.price_cents || 0),
    stripe_price_id: pointPackage.stripe_price_id?.trim() || null,
    active: Boolean(pointPackage.active),
    sort_order: Number(pointPackage.sort_order || 0)
  }
  if (!payload.name) throw new Error('Package name is required.')
  if (payload.points_amount <= 0) throw new Error('Points amount must be greater than 0.')
  if (payload.price_cents <= 0) throw new Error('Price must be greater than 0.')

  const query = pointPackage.id
    ? supabase.from('point_packages').update(payload).eq('id', pointPackage.id).select().single()
    : supabase.from('point_packages').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function listVipTiers(includeInactive = false) {
  if (!supabase) return []
  let query = supabase.from('vip_tiers').select('*').order('tier_rank', { ascending: true })
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveVipTier(tier) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    tier_key: tier.tier_key?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: tier.name?.trim(),
    description: tier.description?.trim() || null,
    price_cents: Number(tier.price_cents || 0),
    stripe_price_id: tier.stripe_price_id?.trim() || null,
    tier_rank: Number(tier.tier_rank || 1),
    active: Boolean(tier.active),
    sort_order: Number(tier.sort_order || tier.tier_rank || 1),
    features: Array.isArray(tier.features)
      ? tier.features
      : String(tier.features || '').split('\n').map((item) => item.trim()).filter(Boolean)
  }

  if (!payload.tier_key) throw new Error('Tier key is required, for example vip or supervip.')
  if (!payload.name) throw new Error('Tier name is required.')
  if (payload.tier_rank < 1) throw new Error('Tier rank must be at least 1.')

  const { data, error } = await supabase
    .from('vip_tiers')
    .upsert(payload, { onConflict: 'tier_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listPublishedVideos() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('videos_safe')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getVideoDetails(videoId) {
  if (!supabase) return null
  const { data, error } = await supabase.from('videos_safe').select('*').eq('id', videoId).single()
  if (error) throw error
  return data
}

export async function getUnlockedVideo(videoId) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_unlocked_video', { target_video_id: videoId })
  if (error) throw error
  return data?.[0] || null
}

export async function listLibrary() {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('get_my_library')
  if (error) throw error
  return data || []
}

export async function listAdminVideos() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('videos')
    .select('*, categories(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((video) => ({ ...video, category_name: video.categories?.name }))
}

export async function listCategories() {
  if (!supabase) return []
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data || []
}

export async function saveCategory(category) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    name: category.name?.trim(),
    description: category.description?.trim() || null
  }
  if (!payload.name) throw new Error('Category name is required.')

  const query = category.id
    ? supabase.from('categories').update(payload).eq('id', category.id).select().single()
    : supabase.from('categories').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteCategory(categoryId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('categories').delete().eq('id', categoryId)
  if (error) throw error
}

export async function createVipCheckoutSession(tierKey = 'vip') {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Please log in first.')

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { mode: 'vip', tierKey },
    headers: { Authorization: `Bearer ${token}` }
  })

  if (error) throw new Error(error.message || 'Unable to create Stripe checkout session.')
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('Checkout session did not return a Stripe URL.')
  return data.url
}

export async function createPointsCheckoutSession(packageId) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Please log in first.')

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { mode: 'points', packageId },
    headers: { Authorization: `Bearer ${token}` }
  })

  if (error) throw new Error(error.message || 'Unable to open point pack checkout.')
  if (data?.error) throw new Error(data.error)
  if (!data?.url) throw new Error('Checkout session did not return a Stripe URL.')
  return data.url
}

export async function unlockVideoWithPoints(videoId) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Please log in first.')

  const { data, error } = await supabase.functions.invoke('unlock-video-with-points', {
    body: { videoId },
    headers: { Authorization: `Bearer ${token}` }
  })

  if (error) throw new Error(error.message || 'Unable to unlock video.')
  if (data?.error) throw new Error(data.error)
  window.dispatchEvent(new Event('wallet:refresh'))
  return data
}

export async function saveVideo(video) {
  const payload = {
    title: video.title?.trim(),
    description: video.description?.trim() || '',
    category_id: video.category_id || null,
    point_cost: Number(video.point_cost ?? video.price_cents ?? 0),
    price_cents: Number(video.point_cost ?? video.price_cents ?? 0),
    thumbnail_url: video.thumbnail_url?.trim() || null,
    preview_url: video.preview_url?.trim() || null,
    external_video_link: video.external_video_link?.trim(),
    access_type: video.access_type || 'points',
    published: Boolean(video.published)
  }

  if (!payload.title) throw new Error('Title is required.')
  if (!payload.external_video_link) throw new Error('External video link is required.')

  const query = video.id
    ? supabase.from('videos').update(payload).eq('id', video.id).select().single()
    : supabase.from('videos').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteVideo(videoId) {
  const { error } = await supabase.from('videos').delete().eq('id', videoId)
  if (error) throw error
}

export async function listAdminProfiles() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role,vip_status,subscription_tier,vip_rank,created_at,updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function adminAdjustUserPoints(userId, amount, description = 'Admin point adjustment') {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_adjust_user_points', {
    target_user_id: userId,
    adjustment_amount: Number(amount),
    adjustment_description: description
  })
  if (error) throw error
  window.dispatchEvent(new Event('wallet:refresh'))
  return data
}

export async function listAdminSecurityOverview() {
  if (!supabase) return { purchases: [], transactions: [], subscriptions: [], securityEvents: [] }
  const [purchases, transactions, subscriptions, securityEvents] = await Promise.all([
    supabase.from('purchases').select('*, profiles(email), videos(title)').order('purchased_at', { ascending: false }).limit(10),
    supabase.from('point_transactions').select('*, profiles(email), videos(title)').order('created_at', { ascending: false }).limit(10),
    supabase.from('vip_subscriptions').select('*, profiles(email), vip_tiers(name,tier_rank)').order('started_at', { ascending: false }).limit(10),
    supabase.from('security_events').select('*').order('created_at', { ascending: false }).limit(10)
  ])

  for (const result of [purchases, transactions, subscriptions, securityEvents]) {
    if (result.error) throw result.error
  }

  return {
    purchases: purchases.data || [],
    transactions: transactions.data || [],
    subscriptions: subscriptions.data || [],
    securityEvents: securityEvents.data || []
  }
}


// Daily rewards, comments, reactions, and forum

export async function claimDailyLoginReward() {
  if (!supabase) return { granted: false, points_balance: 0, amount: 0 }
  const { data, error } = await supabase.rpc('claim_daily_login_reward')
  if (error) {
    console.warn('Daily login reward failed:', error.message)
    return { granted: false, points_balance: 0, amount: 0 }
  }
  const result = data?.[0] || { granted: false, points_balance: 0, amount: 0 }
  if (result.granted) window.dispatchEvent(new Event('wallet:refresh'))
  return result
}

export async function getRewardSettings() {
  if (!supabase) return null
  const { data, error } = await supabase.from('reward_settings').select('*').eq('id', true).single()
  if (error) throw error
  return data
}

export async function saveRewardSettings(settings) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    id: true,
    rewards_enabled: Boolean(settings.rewards_enabled),
    daily_user_points: Number(settings.daily_user_points || 0),
    daily_vip_points: Number(settings.daily_vip_points || 0),
    daily_supervip_points: Number(settings.daily_supervip_points || 0),
    daily_ultravip_points: Number(settings.daily_ultravip_points || 0),
    admin_daily_rewards_enabled: Boolean(settings.admin_daily_rewards_enabled),
    admin_daily_points: Number(settings.admin_daily_points || 0),
    comments_enabled: Boolean(settings.comments_enabled),
    comment_rewards_enabled: Boolean(settings.comment_rewards_enabled),
    comment_reward_points: Number(settings.comment_reward_points || 0),
    min_comment_seconds: Number(settings.min_comment_seconds || 0),
    require_comment_approval: Boolean(settings.require_comment_approval),
    forum_enabled: Boolean(settings.forum_enabled),
    daily_reward_message: settings.daily_reward_message || 'Daily reward claimed!',
    comment_reward_message: settings.comment_reward_message || 'Thanks for commenting!'
  }

  const { data, error } = await supabase
    .from('reward_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listVideoComments(videoId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('video_comments')
    .select('id, video_id, user_id, body, approved, created_at, profiles(email, role)')
    .eq('video_id', videoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function submitVideoComment(videoId, body) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const cleanBody = String(body || '').trim()
  if (!cleanBody) throw new Error('Comment cannot be empty.')
  const { data, error } = await supabase.rpc('submit_video_comment', {
    target_video_id: videoId,
    comment_body: cleanBody
  })
  if (error) throw error
  const result = data?.[0] || { reward_granted: false }
  if (result.reward_granted) window.dispatchEvent(new Event('wallet:refresh'))
  return result
}

export async function deleteVideoComment(commentId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('video_comments').delete().eq('id', commentId)
  if (error) throw error
}

export async function getVideoReactionSummary(videoId) {
  if (!supabase) return { likes: 0, dislikes: 0, my_reaction: null }
  const { data, error } = await supabase.rpc('get_video_reaction_summary', { target_video_id: videoId })
  if (error) throw error
  return data?.[0] || { likes: 0, dislikes: 0, my_reaction: null }
}

export async function setVideoReaction(videoId, reactionType) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('set_video_reaction', {
    target_video_id: videoId,
    reaction_value: reactionType
  })
  if (error) throw error
  return data?.[0] || null
}

export async function listForumPosts() {
  if (!supabase) return []
  const settings = await getRewardSettings().catch(() => null)
  if (settings && settings.forum_enabled === false) return []
  const { data, error } = await supabase
    .from('forum_posts')
    .select('id, user_id, title, body, category, pinned, created_at, updated_at, profiles(email, role)')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createForumPost(post) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData?.user?.id
  if (!userId) throw new Error('Please log in first.')

  const payload = {
    user_id: userId,
    title: String(post.title || '').trim(),
    body: String(post.body || '').trim(),
    category: post.category || 'General Discussion'
  }
  if (!payload.title) throw new Error('Post title is required.')
  if (!payload.body) throw new Error('Post body is required.')
  const { data, error } = await supabase.from('forum_posts').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteForumPost(postId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('forum_posts').delete().eq('id', postId)
  if (error) throw error
}

export async function listForumReplies(postId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('forum_replies')
    .select('id, post_id, user_id, body, created_at, profiles(email, role)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createForumReply(postId, body) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData?.user?.id
  if (!userId) throw new Error('Please log in first.')

  const cleanBody = String(body || '').trim()
  if (!cleanBody) throw new Error('Reply cannot be empty.')
  const { data, error } = await supabase
    .from('forum_replies')
    .insert({ post_id: postId, user_id: userId, body: cleanBody })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteForumReply(replyId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('forum_replies').delete().eq('id', replyId)
  if (error) throw error
}

export async function listAdminCommunityOverview() {
  if (!supabase) return { comments: [], forumPosts: [], forumReplies: [] }
  const [comments, forumPosts, forumReplies] = await Promise.all([
    supabase.from('video_comments').select('id, body, approved, created_at, profiles(email), videos(title)').order('created_at', { ascending: false }).limit(10),
    supabase.from('forum_posts').select('id, title, category, created_at, profiles(email)').order('created_at', { ascending: false }).limit(10),
    supabase.from('forum_replies').select('id, body, created_at, forum_posts(title), profiles(email)').order('created_at', { ascending: false }).limit(10)
  ])

  if (comments.error) throw comments.error
  if (forumPosts.error) throw forumPosts.error
  if (forumReplies.error) throw forumReplies.error

  return {
    comments: comments.data || [],
    forumPosts: forumPosts.data || [],
    forumReplies: forumReplies.data || []
  }
}
