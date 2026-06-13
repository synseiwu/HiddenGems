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

  // The root/homepage should always load AI Studio first.
  // Public Hidden Gems access can still happen from /about through the switch button.
  if (window.location.pathname === '/' || window.location.pathname === '') {
    window.sessionStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
    window.localStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
    return ''
  }

  const value = window.sessionStorage.getItem(SITE_MODE_OVERRIDE_KEY)
  return value === 'ai_studio' || value === 'hidden_gems' ? value : ''
}

export function setLocalSiteModeOverride(mode) {
  if (typeof window === 'undefined') return
  if (mode === 'ai_studio' || mode === 'hidden_gems') {
    window.sessionStorage.setItem(SITE_MODE_OVERRIDE_KEY, mode)
  } else {
    window.sessionStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  }

  // Clean up older persistent overrides so returning visitors do not bypass AI-first mode.
  window.localStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  window.dispatchEvent(new Event('hidden-gems:site-mode-refresh'))
}

export function clearLocalSiteModeOverride() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  window.localStorage.removeItem(SITE_MODE_OVERRIDE_KEY)
  window.dispatchEvent(new Event('hidden-gems:site-mode-refresh'))
}

export function applyPublicSiteModeOverride(settings = {}) {
  const override = getLocalSiteModeOverride()

  if (!override || !settings.show_public_mode_switch) return settings

  return {
    ...settings,
    site_mode: override,
    ai_studio_public_mode: override === 'ai_studio'
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
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { prompt, conversationId: conversationId || null }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  window.dispatchEvent(new Event('wallet:refresh'))
  return data
}
