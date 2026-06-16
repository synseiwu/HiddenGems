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
  const settings = await getPublicSiteSettings()
  if (shouldHideHiddenGemsContent(settings)) return []
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
  const settings = await getPublicSiteSettings()
  if (shouldHideHiddenGemsContent(settings)) throw new Error('Video content is temporarily unavailable.')
  const { data, error } = await supabase.from('videos_safe').select('*').eq('id', videoId).single()
  if (error) throw error
  return data
}

export async function getUnlockedVideo(videoId) {
  if (!supabase) return null
  const settings = await getPublicSiteSettings()
  if (shouldHideHiddenGemsContent(settings)) return null
  const { data, error } = await supabase.rpc('get_unlocked_video', { target_video_id: videoId })
  if (error) throw error
  return data?.[0] || null
}

export async function listLibrary() {
  if (!supabase) return []
  const settings = await getPublicSiteSettings()
  if (shouldHideHiddenGemsContent(settings)) return []
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
  const { data, error } = await supabase.from('category_video_counts').select('*').order('name')
  if (error) {
    const fallback = await supabase.from('categories').select('*').order('name')
    if (fallback.error) throw fallback.error
    return fallback.data || []
  }
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
    .from('video_comments_public')
    .select('*')
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
    .from('forum_posts_public')
    .select('*')
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
    .from('forum_replies_public')
    .select('*')
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
    supabase.from('video_comments_public').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('forum_posts_public').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('forum_replies_public').select('*').order('created_at', { ascending: false }).limit(10)
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


// Homepage showcase rows and admin homepage controls

export async function listHomepageShowcaseRowsAdmin() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('homepage_showcase_rows_admin')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listHomepageShowcaseRows() {
  if (!supabase) return []
  const settings = await getPublicSiteSettings()
  if (shouldHideHiddenGemsContent(settings)) return []
  const { data, error } = await supabase
    .from('homepage_showcase_rows_public')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function saveHomepageShowcaseRow(row) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const payload = {
    title: String(row.title || '').trim(),
    subtitle: String(row.subtitle || '').trim() || null,
    layout_type: row.layout_type || 'horizontal',
    sort_order: Number(row.sort_order || 1),
    max_items: Number(row.max_items || 8),
    active: Boolean(row.active),
    sort_mode: row.sort_mode || 'newest'
  }

  if (!payload.title) throw new Error('Row title is required.')
  if (payload.max_items < 1) throw new Error('Max items must be at least 1.')

  const query = row.id
    ? supabase.from('homepage_showcase_rows').update(payload).eq('id', row.id).select().single()
    : supabase.from('homepage_showcase_rows').insert(payload).select().single()

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function deleteHomepageShowcaseRow(rowId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('homepage_showcase_rows').delete().eq('id', rowId)
  if (error) throw error
}

export async function setHomepageShowcaseRowCategories(rowId, categoryIds) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const cleanIds = [...new Set((categoryIds || []).filter(Boolean))]

  const { error: deleteError } = await supabase
    .from('homepage_showcase_row_categories')
    .delete()
    .eq('row_id', rowId)

  if (deleteError) throw deleteError

  if (!cleanIds.length) return []

  const payload = cleanIds.map((categoryId, index) => ({
    row_id: rowId,
    category_id: categoryId,
    sort_order: index + 1
  }))

  const { data, error } = await supabase
    .from('homepage_showcase_row_categories')
    .insert(payload)
    .select()

  if (error) throw error
  return data || []
}

export async function duplicateHomepageShowcaseRow(rowId) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const rows = await listHomepageShowcaseRowsAdmin()
  const existing = rows.find((row) => row.id === rowId)
  if (!existing) throw new Error('Showcase row not found.')

  const created = await saveHomepageShowcaseRow({
    ...existing,
    id: undefined,
    title: `${existing.title} Copy`,
    sort_order: Number(existing.sort_order || 0) + 1
  })

  await setHomepageShowcaseRowCategories(created.id, existing.category_ids || [])
  return created
}


// Video engagement stats, views, and admin controls

export function formatStatCount(value) {
  const count = Number(value || 0)
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
  return String(count)
}

export async function trackVideoView(videoId) {
  if (!supabase || !videoId) return { tracked: false }
  const { data, error } = await supabase.rpc('track_video_view', { target_video_id: videoId })
  if (error) {
    console.warn('View tracking failed:', error.message)
    return { tracked: false }
  }
  return data?.[0] || { tracked: false }
}

export async function getEngagementSettings() {
  if (!supabase) return null
  const { data, error } = await supabase.from('engagement_settings').select('*').eq('id', true).single()
  if (error) throw error
  return data
}

export async function saveEngagementSettings(settings) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    id: true,
    show_likes: Boolean(settings.show_likes),
    show_dislikes: Boolean(settings.show_dislikes),
    show_views: Boolean(settings.show_views),
    show_comments: Boolean(settings.show_comments),
    show_stats_on_cards: Boolean(settings.show_stats_on_cards),
    show_stats_on_details: Boolean(settings.show_stats_on_details),
    show_stats_on_homepage: Boolean(settings.show_stats_on_homepage),
    view_tracking_enabled: Boolean(settings.view_tracking_enabled),
    view_cooldown_minutes: Number(settings.view_cooldown_minutes || 60),
    compact_counts: Boolean(settings.compact_counts)
  }

  const { data, error } = await supabase
    .from('engagement_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listAdminVideoStats() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('admin_video_stats')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function adminSetVideoViewCount(videoId, viewCount) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_set_video_view_count', {
    target_video_id: videoId,
    new_view_count: Number(viewCount || 0)
  })
  if (error) throw error
  return data?.[0] || null
}

export async function adminAdjustVideoViewCount(videoId, adjustment) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_adjust_video_view_count', {
    target_video_id: videoId,
    adjustment_amount: Number(adjustment || 0)
  })
  if (error) throw error
  return data?.[0] || null
}


export async function adminSetVideoEngagementStats(videoId, stats) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_set_video_engagement_stats', {
    target_video_id: videoId,
    new_like_count: Number(stats.like_count || 0),
    new_dislike_count: Number(stats.dislike_count || 0),
    new_view_count: Number(stats.view_count || 0)
  })
  if (error) throw error
  return data?.[0] || null
}

export async function adminAdjustVideoEngagementStat(videoId, statName, adjustment) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_adjust_video_engagement_stat', {
    target_video_id: videoId,
    stat_name: statName,
    adjustment_amount: Number(adjustment || 0)
  })
  if (error) throw error
  return data?.[0] || null
}

export function categorySlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}


// Global site settings + editable page content

const DEFAULT_SITE_SETTINGS = {
  hide_all_videos: false,
  disable_age_gate: true,
  safe_mode_enabled: false,
  site_mode: 'ai_studio',
  ai_studio_public_mode: true,
  hide_hidden_gems_branding: true,
  hide_video_marketplace_in_ai_mode: true,
  show_admin_mode_switch: true,
  show_public_mode_switch: false
}



const SITE_MODE_OVERRIDE_KEY = 'hidden_gems_site_mode_override'

export function getLocalSiteModeOverride() {
  if (typeof window === 'undefined') return ''

  // Only a deliberate click should reveal Hidden Gems.
  // Store this per browser tab/session so the main site naturally returns to AI Studio later.
  window.localStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  const value = window.sessionStorage.getItem(SITE_MODE_OVERRIDE_KEY)

  return value === 'hidden_gems' || value === 'ai_studio' ? value : ''
}

export function setLocalSiteModeOverride(mode) {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(SITE_MODE_OVERRIDE_KEY)

  if (mode === 'hidden_gems' || mode === 'ai_studio') {
    window.sessionStorage.setItem(SITE_MODE_OVERRIDE_KEY, mode)
  } else {
    window.sessionStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  }

  window.dispatchEvent(new Event('hidden-gems:site-mode-refresh'))
}

export function clearLocalSiteModeOverride() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  window.sessionStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  window.dispatchEvent(new Event('hidden-gems:site-mode-refresh'))
}

export function applyPublicSiteModeOverride(settings = {}) {
  const override = getLocalSiteModeOverride()

  if (override === 'hidden_gems') {
    return {
      ...settings,
      site_mode: 'hidden_gems',
      ai_studio_public_mode: false
    }
  }

  // AI Studio is the public/default site from now on.
  // Supabase can still store Hidden Gems settings, but the frontend starts AI-first unless the user/session deliberately switched.
  return {
    ...settings,
    site_mode: 'ai_studio',
    ai_studio_public_mode: true,
    disable_age_gate: true,
    hide_hidden_gems_branding: true,
    hide_video_marketplace_in_ai_mode: true
  }
}

export function isAIStudioMode(settings = {}) {
  return settings.site_mode === 'ai_studio' || Boolean(settings.ai_studio_public_mode)
}

export function shouldHideHiddenGemsContent(settings = {}) {
  return Boolean(
    settings.hide_all_videos ||
    settings.safe_mode_enabled ||
    (isAIStudioMode(settings) && settings.hide_video_marketplace_in_ai_mode)
  )
}

export async function getPublicSiteSettings() {
  if (!supabase) return DEFAULT_SITE_SETTINGS
  const { data, error } = await supabase
    .from('site_settings_public')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error || !data) return applyPublicSiteModeOverride(DEFAULT_SITE_SETTINGS)
  return applyPublicSiteModeOverride({ ...DEFAULT_SITE_SETTINGS, ...data })
}

export async function getAdminSiteSettings() {
  if (!supabase) return DEFAULT_SITE_SETTINGS
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error || !data) return applyPublicSiteModeOverride(DEFAULT_SITE_SETTINGS)
  return applyPublicSiteModeOverride({ ...DEFAULT_SITE_SETTINGS, ...data })
}

export async function saveAdminSiteSettings(settings) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    id: true,
    key: 'global',
    hide_all_videos: Boolean(settings.hide_all_videos),
    disable_age_gate: Boolean(settings.disable_age_gate),
    safe_mode_enabled: Boolean(settings.safe_mode_enabled),
    site_mode: settings.site_mode === 'ai_studio' ? 'ai_studio' : 'hidden_gems',
    ai_studio_public_mode: Boolean(settings.ai_studio_public_mode),
    hide_hidden_gems_branding: settings.hide_hidden_gems_branding !== false,
    hide_video_marketplace_in_ai_mode: settings.hide_video_marketplace_in_ai_mode !== false,
    show_admin_mode_switch: settings.show_admin_mode_switch !== false,
    show_public_mode_switch: Boolean(settings.show_public_mode_switch),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSitePageContent(pageKey) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('site_page_content_public')
    .select('*')
    .eq('page_key', pageKey)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) return []
  return data || []
}

export async function listAdminPageContent(pageKey = '') {
  if (!supabase) return []
  let query = supabase
    .from('site_page_content')
    .select('*')
    .order('page_key', { ascending: true })
    .order('sort_order', { ascending: true })
  if (pageKey) query = query.eq('page_key', pageKey)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function savePageContent(section) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    page_key: section.page_key,
    section_key: section.section_key,
    content_type: section.content_type || 'section',
    title: String(section.title || '').trim(),
    subtitle: String(section.subtitle || '').trim(),
    eyebrow: String(section.eyebrow || '').trim(),
    body: String(section.body || '').trim(),
    button_text: String(section.button_text || '').trim(),
    sort_order: Number(section.sort_order || 1),
    active: Boolean(section.active),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('site_page_content')
    .upsert(payload, { onConflict: 'page_key,section_key' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function resetPageContent(pageKey, sectionKey) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('site_page_content')
    .delete()
    .eq('page_key', pageKey)
    .eq('section_key', sectionKey)
  if (error) throw error
  return true
}


// AI Studio

export async function getAISettings() {
  if (!supabase) return { enabled: false, model: 'gpt-4.1-mini', points_per_message: 25, max_output_tokens: 900 }
  const { data, error } = await supabase
    .from('ai_settings_public')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error || !data) return { enabled: false, model: 'gpt-4.1-mini', points_per_message: 25, max_output_tokens: 900 }
  return data
}

export async function getAISettingsAdmin() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveAISettingsAdmin(settings) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const payload = {
    id: true,
    enabled: Boolean(settings.enabled),
    admin_free: Boolean(settings.admin_free),
    model: String(settings.model || 'gpt-4.1-mini').trim(),
    points_per_message: Number(settings.points_per_message || 0),
    max_output_tokens: Number(settings.max_output_tokens || 900),
    system_prompt: String(settings.system_prompt || '').trim() || 'You are Hidden Gems AI Studio, a helpful assistant inside the Hidden Gems platform. Be useful, clear, and safe.',
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('ai_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listAIConversations() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listAIMessages(conversationId) {
  if (!supabase || !conversationId) return []
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function sendAIMessage({ prompt, conversationId }) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase frontend environment variables.')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error(sessionError.message)

  const accessToken = sessionData?.session?.access_token
  if (!accessToken) throw new Error('Please log in before using AI Studio.')

  let response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, conversationId: conversationId || null })
    })
  } catch (err) {
    throw new Error(`Could not reach the AI server: ${err.message}`)
  }

  const text = await response.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      text ||
      `AI function failed with status ${response.status}. Check Supabase Edge Function logs.`
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)

  window.dispatchEvent(new Event('wallet:refresh'))
  return data
}


function normalizeMessagePayload(payload = {}) {
  return {
    title: payload.title?.trim(),
    body: payload.body?.trim(),
    message_type: payload.message_type || 'announcement',
    priority: payload.priority || 'normal',
    audience: payload.audience || 'all',
    active: payload.active !== false,
    popup_enabled: Boolean(payload.popup_enabled),
    requires_acknowledgement: Boolean(payload.requires_acknowledgement),
    show_once: payload.show_once !== false,
    expires_at: payload.expires_at || null
  }
}

function audienceRankForProfile(profile = {}) {
  const role = profile.role || 'user'
  const vipRank = Number(profile.vip_rank || 0)
  if (role === 'admin') return { role, vipRank, tier: 'admin' }
  if (vipRank >= 3 || profile.subscription_tier === 'ultravip') return { role, vipRank, tier: 'ultravip' }
  if (vipRank >= 2 || profile.subscription_tier === 'supervip') return { role, vipRank, tier: 'supervip' }
  if (vipRank >= 1 || profile.vip_status || profile.subscription_tier === 'vip') return { role, vipRank, tier: 'vip' }
  return { role, vipRank, tier: 'user' }
}

function messageMatchesAudience(message, profile = {}) {
  const audience = message?.audience || 'all'
  const { role, tier } = audienceRankForProfile(profile)

  if (audience === 'all' || audience === 'authenticated' || audience === 'users') return true
  if (audience === 'admins') return role === 'admin'
  if (audience === 'vip') return ['vip', 'supervip', 'ultravip', 'admin'].includes(tier)
  if (audience === 'supervip') return ['supervip', 'ultravip', 'admin'].includes(tier)
  if (audience === 'ultravip') return ['ultravip', 'admin'].includes(tier)

  return true
}

async function getAuthUserOrThrow() {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  const user = data?.user
  if (!user) throw new Error('Please log in first.')
  return user
}

export async function listUserMessages() {
  if (!supabase) return []

  const user = await getAuthUserOrThrow()
  const profile = await getCurrentProfile(user.id)

  const now = new Date().toISOString()
  const { data: messages, error: messageError } = await supabase
    .from('site_messages')
    .select('*')
    .eq('active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (messageError) throw messageError

  const filteredMessages = (messages || []).filter((message) => messageMatchesAudience(message, profile))

  if (!filteredMessages.length) return []

  const messageIds = filteredMessages.map((message) => message.id)

  const { data: reads, error: readError } = await supabase
    .from('site_message_reads')
    .select('*')
    .eq('user_id', user.id)
    .in('message_id', messageIds)

  if (readError) throw readError

  const readMap = new Map((reads || []).map((read) => [read.message_id, read]))

  return filteredMessages.map((message) => ({
    ...message,
    read: readMap.get(message.id) || null,
    is_read: Boolean(readMap.get(message.id)?.read_at),
    is_acknowledged: Boolean(readMap.get(message.id)?.acknowledged_at),
    is_dismissed: Boolean(readMap.get(message.id)?.dismissed_at)
  })).filter((message) => !message.is_dismissed)
}

export async function listPopupMessages() {
  const messages = await listUserMessages()
  return messages.filter((message) => {
    if (!message.popup_enabled) return false
    if (message.requires_acknowledgement && !message.is_acknowledged) return true
    if (message.show_once && message.is_read) return false
    return !message.is_read
  })
}

export async function getUnreadMessageCount() {
  const messages = await listUserMessages().catch(() => [])
  return messages.filter((message) => !message.is_read || (message.requires_acknowledgement && !message.is_acknowledged)).length
}

export async function markMessageRead(messageId) {
  const user = await getAuthUserOrThrow()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('site_message_reads')
    .upsert({
      message_id: messageId,
      user_id: user.id,
      read_at: now
    }, { onConflict: 'message_id,user_id' })
    .select()
    .single()

  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function acknowledgeMessage(messageId) {
  const user = await getAuthUserOrThrow()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('site_message_reads')
    .upsert({
      message_id: messageId,
      user_id: user.id,
      read_at: now,
      acknowledged_at: now
    }, { onConflict: 'message_id,user_id' })
    .select()
    .single()

  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function dismissMessage(messageId) {
  const user = await getAuthUserOrThrow()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('site_message_reads')
    .upsert({
      message_id: messageId,
      user_id: user.id,
      read_at: now,
      dismissed_at: now
    }, { onConflict: 'message_id,user_id' })
    .select()
    .single()

  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function adminListMessages() {
  if (!supabase) return []

  const { data: messages, error } = await supabase
    .from('site_messages')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const { data: reads, error: readsError } = await supabase
    .from('site_message_reads')
    .select('message_id, read_at, acknowledged_at, dismissed_at')

  if (readsError) throw readsError

  const stats = new Map()
  ;(reads || []).forEach((read) => {
    const current = stats.get(read.message_id) || { read_count: 0, acknowledged_count: 0, dismissed_count: 0 }
    if (read.read_at) current.read_count += 1
    if (read.acknowledged_at) current.acknowledged_count += 1
    if (read.dismissed_at) current.dismissed_count += 1
    stats.set(read.message_id, current)
  })

  return (messages || []).map((message) => ({
    ...message,
    stats: stats.get(message.id) || { read_count: 0, acknowledged_count: 0, dismissed_count: 0 }
  }))
}

export async function adminCreateMessage(payload) {
  const user = await getAuthUserOrThrow()
  const clean = normalizeMessagePayload(payload)
  if (!clean.title) throw new Error('Message title is required.')
  if (!clean.body) throw new Error('Message body is required.')

  const { data, error } = await supabase
    .from('site_messages')
    .insert({
      ...clean,
      created_by: user.id
    })
    .select()
    .single()

  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function adminUpdateMessage(id, payload) {
  if (!id) throw new Error('Message ID is required.')
  const clean = normalizeMessagePayload(payload)
  if (!clean.title) throw new Error('Message title is required.')
  if (!clean.body) throw new Error('Message body is required.')

  const { data, error } = await supabase
    .from('site_messages')
    .update(clean)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function adminDeleteMessage(id) {
  if (!id) throw new Error('Message ID is required.')
  const { error } = await supabase.from('site_messages').delete().eq('id', id)
  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return true
}

export async function getUserOnboardingStatus() {
  if (!supabase) return { verified_access_popup_seen: true }

  const user = await getAuthUserOrThrow()

  const { data, error } = await supabase
    .from('user_onboarding_status')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error

  return data || {
    user_id: user.id,
    verified_access_popup_seen: false,
    verified_access_popup_seen_at: null
  }
}

export async function markVerifiedAccessPopupSeen() {
  const user = await getAuthUserOrThrow()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_onboarding_status')
    .upsert({
      user_id: user.id,
      verified_access_popup_seen: true,
      verified_access_popup_seen_at: now,
      updated_at: now
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getMessagingSettings() {
  if (!supabase) return { enable_user_dms: true, allow_user_to_user_dms: true, allow_users_to_reply_to_admin_messages: true, dm_unread_badge_enabled: true, onboarding_message_enabled: true, require_username_on_login: true, allow_username_skip: false, username_bonus_enabled: true, username_bonus_points: 100, hidden_gems_access_bonus_enabled: true, hidden_gems_access_bonus_points: 100, allow_dm_search_by_email: false, allow_dm_search_by_username: true, allow_username_changes: false, username_change_cooldown_days: 30 }
  const { data, error } = await supabase.from('messaging_settings').select('*').eq('id', true).maybeSingle()
  if (error) return { enable_user_dms: true, allow_user_to_user_dms: true, allow_users_to_reply_to_admin_messages: true, dm_unread_badge_enabled: true, onboarding_message_enabled: true, require_username_on_login: true, allow_username_skip: false, username_bonus_enabled: true, username_bonus_points: 100, hidden_gems_access_bonus_enabled: true, hidden_gems_access_bonus_points: 100, allow_dm_search_by_email: false, allow_dm_search_by_username: true, allow_username_changes: false, username_change_cooldown_days: 30 }
  return data || { enable_user_dms: true, allow_user_to_user_dms: true, allow_users_to_reply_to_admin_messages: true, dm_unread_badge_enabled: true, onboarding_message_enabled: true, require_username_on_login: true, allow_username_skip: false, username_bonus_enabled: true, username_bonus_points: 100, hidden_gems_access_bonus_enabled: true, hidden_gems_access_bonus_points: 100, allow_dm_search_by_email: false, allow_dm_search_by_username: true, allow_username_changes: false, username_change_cooldown_days: 30 }
}

export async function adminSaveMessagingSettings(payload = {}) {
  const user = await getAuthUserOrThrow()
  const { data, error } = await supabase.from('messaging_settings').upsert({
    id: true,
    enable_user_dms: payload.enable_user_dms !== false,
    allow_user_to_user_dms: payload.allow_user_to_user_dms !== false,
    allow_users_to_reply_to_admin_messages: payload.allow_users_to_reply_to_admin_messages !== false,
    dm_unread_badge_enabled: payload.dm_unread_badge_enabled !== false,
    announcements_popup_enabled: Boolean(payload.announcements_popup_enabled),
    onboarding_message_enabled: payload.onboarding_message_enabled !== false,
    onboarding_message_as_inbox_only: true,
    require_username_on_login: payload.require_username_on_login !== false,
    allow_username_skip: Boolean(payload.allow_username_skip),
    username_bonus_enabled: payload.username_bonus_enabled !== false,
    username_bonus_points: Number(payload.username_bonus_points || 100),
    hidden_gems_access_bonus_enabled: payload.hidden_gems_access_bonus_enabled !== false,
    hidden_gems_access_bonus_points: Number(payload.hidden_gems_access_bonus_points || 100),
    allow_dm_search_by_email: Boolean(payload.allow_dm_search_by_email),
    allow_dm_search_by_username: payload.allow_dm_search_by_username !== false,
    allow_username_changes: Boolean(payload.allow_username_changes),
    username_change_cooldown_days: Number(payload.username_change_cooldown_days || 30),
    updated_by: user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' }).select().single()
  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function adminSearchUsersForDm(query = '') {
  if (!supabase) return []
  const cleanQuery = query.trim()

  let request = supabase
    .from('messaging_user_directory')
    .select('id, email, username, username_normalized, display_name, role, vip_rank, subscription_tier')
    .order('display_name', { ascending: true })
    .limit(25)

  if (cleanQuery) {
    request = request.or(`username.ilike.%${cleanQuery}%,username_normalized.ilike.%${normalizeUsernameInput(cleanQuery)}%,email.ilike.%${cleanQuery}%`)
  }

  const { data, error } = await request
  if (error) throw error
  return data || []
}

export async function searchUsersForDm(query = '') {
  const settings = await getMessagingSettings()
  if (!settings.enable_user_dms || !settings.allow_user_to_user_dms) return []

  const cleanQuery = query.trim()
  if (cleanQuery.length < 2) return []

  let filters = []
  if (settings.allow_dm_search_by_username !== false) {
    filters.push(`username.ilike.%${cleanQuery}%`)
    filters.push(`username_normalized.ilike.%${normalizeUsernameInput(cleanQuery)}%`)
  }
  if (settings.allow_dm_search_by_email) {
    filters.push(`email.ilike.%${cleanQuery}%`)
  }

  if (!filters.length) return []

  const { data, error } = await supabase
    .from('messaging_user_directory')
    .select('id, username, username_normalized, display_name, role, vip_rank, subscription_tier')
    .or(filters.join(','))
    .order('display_name', { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

export async function listDmConversations() {
  const user = await getAuthUserOrThrow()
  const { data, error } = await supabase.from('dm_conversations_for_user').select('*').eq('viewer_user_id', user.id).order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getDmConversation(conversationId) {
  if (!conversationId) return { conversation: null, messages: [] }
  const { data: conversation, error: conversationError } = await supabase.from('dm_conversations').select('*').eq('id', conversationId).single()
  if (conversationError) throw conversationError
  const { data: messages, error: messagesError } = await supabase.from('dm_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
  if (messagesError) throw messagesError
  return { conversation, messages: messages || [] }
}

export async function createDmConversation(recipientUserId, body) {
  const user = await getAuthUserOrThrow()
  const settings = await getMessagingSettings()
  if (!settings.enable_user_dms || !settings.allow_user_to_user_dms) throw new Error('User DMs are currently disabled.')
  const cleanBody = body.trim()
  if (!recipientUserId) throw new Error('Choose a recipient.')
  if (!cleanBody) throw new Error('Message body is required.')
  if (recipientUserId === user.id) throw new Error('You cannot message yourself.')
  const { data: conversation, error: conversationError } = await supabase.from('dm_conversations').insert({ created_by: user.id, conversation_type: 'direct', title: null, is_system: false }).select().single()
  if (conversationError) throw conversationError
  const { error: participantsError } = await supabase.from('dm_participants').insert([
    { conversation_id: conversation.id, user_id: user.id, role: 'member', last_read_at: new Date().toISOString() },
    { conversation_id: conversation.id, user_id: recipientUserId, role: 'member' }
  ])
  if (participantsError) throw participantsError
  await sendDmMessage(conversation.id, cleanBody)
  window.dispatchEvent(new Event('site-messages:refresh'))
  return conversation
}

export async function sendDmMessage(conversationId, body) {
  const user = await getAuthUserOrThrow()
  const cleanBody = body.trim()
  if (!conversationId) throw new Error('Conversation ID is required.')
  if (!cleanBody) throw new Error('Message body is required.')
  const { data, error } = await supabase.from('dm_messages').insert({ conversation_id: conversationId, sender_id: user.id, sender_label: null, body: cleanBody, message_kind: 'user' }).select().single()
  if (error) throw error
  await supabase.from('dm_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
  await markDmConversationRead(conversationId).catch(() => {})
  window.dispatchEvent(new Event('site-messages:refresh'))
  return data
}

export async function markDmConversationRead(conversationId) {
  const user = await getAuthUserOrThrow()
  const { error } = await supabase.from('dm_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', user.id)
  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return true
}

export async function archiveDmConversation(conversationId) {
  const user = await getAuthUserOrThrow()
  const { error } = await supabase.from('dm_participants').update({ archived_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', user.id)
  if (error) throw error
  window.dispatchEvent(new Event('site-messages:refresh'))
  return true
}

export async function getDmUnreadCount() {
  const conversations = await listDmConversations().catch(() => [])
  return conversations.reduce((sum, conversation) => sum + Number(conversation.unread_count || 0), 0)
}

export async function getCombinedUnreadCount() {
  const [announcementCount, dmCount] = await Promise.all([getUnreadMessageCount().catch(() => 0), getDmUnreadCount().catch(() => 0)])
  return Number(announcementCount || 0) + Number(dmCount || 0)
}

export async function adminSendDmToUser(userId, body) {
  const admin = await getAuthUserOrThrow()
  const cleanBody = body.trim()
  if (!userId) throw new Error('Choose a user.')
  if (!cleanBody) throw new Error('Message body is required.')
  const { data: conversation, error: conversationError } = await supabase.from('dm_conversations').insert({ created_by: admin.id, conversation_type: 'admin_direct', title: 'Admin Message', is_system: true }).select().single()
  if (conversationError) throw conversationError
  const { error: participantsError } = await supabase.from('dm_participants').insert([
    { conversation_id: conversation.id, user_id: admin.id, role: 'admin', last_read_at: new Date().toISOString() },
    { conversation_id: conversation.id, user_id: userId, role: 'member' }
  ])
  if (participantsError) throw participantsError
  const { data: message, error: messageError } = await supabase.from('dm_messages').insert({ conversation_id: conversation.id, sender_id: admin.id, sender_label: 'Admin', body: cleanBody, message_kind: 'admin' }).select().single()
  if (messageError) throw messageError
  window.dispatchEvent(new Event('site-messages:refresh'))
  return { conversation, message }
}

export async function adminBroadcastDm(payload = {}) {
  const admin = await getAuthUserOrThrow()
  const audience = payload.audience || 'all'
  const body = payload.body?.trim()
  const title = payload.title?.trim() || 'Admin Broadcast'
  if (!body) throw new Error('Broadcast body is required.')
  const { data: users, error: usersError } = await supabase.from('messaging_user_directory').select('id,email,role,vip_rank,subscription_tier').neq('id', admin.id).limit(1000)
  if (usersError) throw usersError
  const recipients = (users || []).filter((row) => {
    if (audience === 'all' || audience === 'users' || audience === 'authenticated') return true
    if (audience === 'admins') return row.role === 'admin'
    if (audience === 'vip') return Number(row.vip_rank || 0) >= 1 || row.role === 'admin'
    if (audience === 'supervip') return Number(row.vip_rank || 0) >= 2 || row.role === 'admin'
    if (audience === 'ultravip') return Number(row.vip_rank || 0) >= 3 || row.role === 'admin'
    return true
  })
  let sent = 0
  for (const recipient of recipients) {
    const { data: conversation, error: conversationError } = await supabase.from('dm_conversations').insert({ created_by: admin.id, conversation_type: 'broadcast', title, is_system: true }).select().single()
    if (conversationError) throw conversationError
    const { error: participantsError } = await supabase.from('dm_participants').insert([
      { conversation_id: conversation.id, user_id: admin.id, role: 'admin', last_read_at: new Date().toISOString() },
      { conversation_id: conversation.id, user_id: recipient.id, role: 'member' }
    ])
    if (participantsError) throw participantsError
    const { error: messageError } = await supabase.from('dm_messages').insert({ conversation_id: conversation.id, sender_id: admin.id, sender_label: 'Admin', body, message_kind: 'broadcast' })
    if (messageError) throw messageError
    sent += 1
  }
  window.dispatchEvent(new Event('site-messages:refresh'))
  return { sent }
}

export function normalizeUsernameInput(username = '') {
  return username.trim().toLowerCase()
}

export async function getUsernameSettings() {
  const settings = await getMessagingSettings().catch(() => ({}))
  return {
    require_username_on_login: settings.require_username_on_login !== false,
    allow_username_skip: Boolean(settings.allow_username_skip),
    username_bonus_enabled: settings.username_bonus_enabled !== false,
    username_bonus_points: Number(settings.username_bonus_points || 100),
    hidden_gems_access_bonus_enabled: settings.hidden_gems_access_bonus_enabled !== false,
    hidden_gems_access_bonus_points: Number(settings.hidden_gems_access_bonus_points || 100),
    allow_dm_search_by_email: Boolean(settings.allow_dm_search_by_email),
    allow_dm_search_by_username: settings.allow_dm_search_by_username !== false,
    allow_username_changes: Boolean(settings.allow_username_changes),
    username_change_cooldown_days: Number(settings.username_change_cooldown_days || 30)
  }
}

export async function adminSaveUsernameSettings(payload = {}) {
  const current = await getMessagingSettings().catch(() => ({}))
  return adminSaveMessagingSettings({
    ...current,
    require_username_on_login: payload.require_username_on_login !== false,
    allow_username_skip: Boolean(payload.allow_username_skip),
    username_bonus_enabled: payload.username_bonus_enabled !== false,
    username_bonus_points: Number(payload.username_bonus_points || 100),
    hidden_gems_access_bonus_enabled: payload.hidden_gems_access_bonus_enabled !== false,
    hidden_gems_access_bonus_points: Number(payload.hidden_gems_access_bonus_points || 100),
    allow_dm_search_by_email: Boolean(payload.allow_dm_search_by_email),
    allow_dm_search_by_username: payload.allow_dm_search_by_username !== false,
    allow_username_changes: Boolean(payload.allow_username_changes),
    username_change_cooldown_days: Number(payload.username_change_cooldown_days || 30)
  })
}

export async function getUserRewardFlags() {
  if (!supabase) return null
  const user = await getAuthUserOrThrow()
  const { data, error } = await supabase
    .from('user_reward_flags')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return null
  return data
}

export async function getUsernameStatus() {
  if (!supabase) return { username: '', username_normalized: '', has_username: false }
  const user = await getAuthUserOrThrow()
  const [profile, flags, settings] = await Promise.all([
    getCurrentProfile(user.id),
    getUserRewardFlags().catch(() => null),
    getUsernameSettings().catch(() => ({}))
  ])

  return {
    user_id: user.id,
    email: user.email,
    username: profile?.username || '',
    username_normalized: profile?.username_normalized || '',
    username_created_at: profile?.username_created_at || null,
    has_username: Boolean(profile?.username_normalized),
    username_bonus_claimed: Boolean(flags?.username_bonus_claimed),
    hidden_gems_access_bonus_claimed: Boolean(flags?.hidden_gems_access_bonus_claimed),
    settings
  }
}

export async function checkUsernameAvailable(username) {
  const normalized = normalizeUsernameInput(username)
  if (!/^[a-z0-9_.]{3,24}$/.test(normalized)) {
    return { available: false, reason: 'Use 3-24 characters: letters, numbers, underscores, or dots.' }
  }

  const { data, error } = await supabase
    .from('messaging_user_directory')
    .select('id')
    .eq('username_normalized', normalized)
    .maybeSingle()

  if (error) return { available: false, reason: error.message }
  return { available: !data, reason: data ? 'Username is already taken.' : '' }
}

export async function createUsername(username) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('create_username', { username_input: username })
  if (error) throw error
  const result = data?.[0] || data || {}
  window.dispatchEvent(new Event('wallet:refresh'))
  window.dispatchEvent(new Event('site-messages:refresh'))
  window.dispatchEvent(new Event('profile:refresh'))
  return result
}

export async function updateUsername(username) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('update_username', { username_input: username })
  if (error) throw error
  const result = data?.[0] || data || {}
  window.dispatchEvent(new Event('profile:refresh'))
  return result
}

export async function claimHiddenGemsAccessBonus() {
  if (!supabase) return { granted: false, points_balance: 0, amount: 0 }
  const { data, error } = await supabase.rpc('claim_hidden_gems_access_bonus')
  if (error) throw error
  const result = data?.[0] || data || { granted: false, points_balance: 0, amount: 0 }
  if (result.granted) {
    window.dispatchEvent(new Event('wallet:refresh'))
    window.dispatchEvent(new Event('site-messages:refresh'))
  }
  return result
}

export async function searchDmUsers(query = '') {
  const clean = query.trim()
  if (clean.length < 2) return []
  return searchUsersForDm(clean)
}

