import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function cleanPriceId(value: unknown) {
  return String(value || '').trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const siteUrl = Deno.env.get('SITE_URL') || 'https://hiddengems.space'
    const fallbackVipPriceId = cleanPriceId(Deno.env.get('VIP_STRIPE_PRICE_ID'))

    if (!stripeSecretKey) return jsonResponse({ error: 'Missing STRIPE_SECRET_KEY' }, 500)
    if (!supabaseUrl) return jsonResponse({ error: 'Missing SUPABASE_URL' }, 500)
    if (!serviceKey) return jsonResponse({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing auth header' }, 401)

    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || '').trim().toLowerCase()
    const packageId = body.packageId || body.package_id || null
    const videoId = body.videoId || body.video_id || null
    const tierKey = String(body.tierKey || body.tier_key || 'vip').trim().toLowerCase()

    const supabase = createClient(supabaseUrl, serviceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)

    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const user = userData.user
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })

    let priceId = ''
    let checkoutMode: Stripe.Checkout.SessionCreateParams.Mode = 'payment'
    let successPath = '/points?checkout=success'
    let cancelPath = '/points'
    const metadata: Record<string, string> = {
      user_id: user.id,
      mode: mode || 'unknown',
    }

    const isVipCheckout = ['vip', 'subscription', 'tier', 'vip_tier'].includes(mode) || Boolean(body.tierKey || body.tier_key)

    if (isVipCheckout) {
      checkoutMode = 'subscription'
      metadata.mode = 'vip'
      metadata.tier_key = tierKey
      successPath = '/vip?checkout=success'
      cancelPath = '/vip'

      const { data: tier, error: tierError } = await supabase
        .from('vip_tiers')
        .select('tier_key, name, stripe_price_id, active')
        .eq('tier_key', tierKey)
        .eq('active', true)
        .maybeSingle()

      if (tierError) {
        return jsonResponse({ error: `VIP tier lookup failed: ${tierError.message}` }, 400)
      }

      priceId = cleanPriceId(tier?.stripe_price_id)

      // Backward-compatible fallback for older one-tier VIP setups.
      if (!priceId && tierKey === 'vip') priceId = fallbackVipPriceId

      if (!priceId) {
        return jsonResponse({
          error: `No Stripe price ID found for VIP tier "${tierKey}". Check Admin Panel → VIP tiers.`,
        }, 400)
      }
    } else if (packageId) {
      checkoutMode = 'payment'
      metadata.mode = 'points'
      metadata.package_id = String(packageId)
      successPath = '/points?checkout=success'
      cancelPath = '/points'

      const { data: pack, error: packError } = await supabase
        .from('point_packages')
        .select('id, name, stripe_price_id, active')
        .eq('id', packageId)
        .eq('active', true)
        .maybeSingle()

      if (packError) {
        return jsonResponse({ error: `Point package lookup failed: ${packError.message}` }, 400)
      }

      priceId = cleanPriceId(pack?.stripe_price_id)

      if (!priceId) {
        return jsonResponse({
          error: 'No Stripe price ID found for this point package. Check Admin Panel → Point Packages.',
        }, 400)
      }
    } else if (videoId) {
      // Kept as a safe explicit error because this site currently unlocks videos with points.
      // If you later add direct Stripe-per-video checkout, patch this block to load a video price ID.
      return jsonResponse({
        error: 'Direct video checkout is not configured. Use point unlocks or point packages.',
      }, 400)
    } else {
      return jsonResponse({
        error: 'Invalid checkout request. Missing tierKey, packageId, or supported checkout mode.',
      }, 400)
    }

    if (!priceId.startsWith('price_')) {
      return jsonResponse({
        error: `Invalid Stripe Price ID "${priceId}". It must start with price_.`,
      }, 400)
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: checkoutMode,
      customer_email: user.email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}${successPath}`,
      cancel_url: `${siteUrl}${cancelPath}`,
      metadata,
      allow_promotion_codes: true,
    }

    if (checkoutMode === 'subscription') {
      sessionParams.subscription_data = { metadata }
    } else {
      sessionParams.payment_intent_data = { metadata }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return jsonResponse({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('create-checkout-session error:', message)
    return jsonResponse({ error: message }, 400)
  }
})
