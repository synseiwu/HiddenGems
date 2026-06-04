import { supabase } from './supabase'

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
  const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
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

export async function createVipCheckoutSession() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Please log in first.')

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { mode: 'vip' },
    headers: { Authorization: `Bearer ${token}` }
  })

  if (error) throw new Error(error.message || 'Unable to create Stripe checkout session.')
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
  window.dispatchEvent(new Event('wallet:refresh'))
  return data
}

export async function saveVideo(video) {
  const payload = {
    title: video.title,
    description: video.description,
    category_id: video.category_id || null,
    point_cost: Number(video.point_cost ?? video.price_cents ?? 0),
    price_cents: Number(video.point_cost ?? video.price_cents ?? 0),
    thumbnail_url: video.thumbnail_url,
    preview_url: video.preview_url || null,
    external_video_link: video.external_video_link,
    access_type: video.access_type,
    published: Boolean(video.published)
  }

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
