import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    const vipPriceId = Deno.env.get('VIP_STRIPE_PRICE_ID')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing auth header')

    const supabase = createClient(supabaseUrl, serviceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) throw new Error('Unauthorized')

    const { mode, packageId } = await req.json()
    const user = userData.user

    let line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    const metadata: Record<string, string> = { user_id: user.id, mode }
    let checkoutMode: Stripe.Checkout.SessionCreateParams.Mode = 'payment'
    let cancelPath = '/points'

    if (mode === 'vip') {
      if (!vipPriceId) throw new Error('VIP_STRIPE_PRICE_ID is not configured')
      line_items = [{ price: vipPriceId, quantity: 1 }]
      metadata.mode = 'vip'
      checkoutMode = 'subscription'
      cancelPath = '/vip'
    } else if (mode === 'points') {
      const { data: pack, error } = await supabase
        .from('point_packages')
        .select('id,name,points_amount,price_cents,stripe_price_id,active')
        .eq('id', packageId)
        .eq('active', true)
        .single()

      if (error || !pack) throw new Error('Point package not available')
      if (!pack.stripe_price_id) throw new Error('This point package is missing a Stripe Price ID')

      line_items = [{ price: pack.stripe_price_id, quantity: 1 }]
      metadata.mode = 'points'
      metadata.point_package_id = pack.id
      metadata.points_amount = String(pack.points_amount)
      cancelPath = '/points'
    } else {
      throw new Error('Unsupported checkout mode')
    }

    const session = await stripe.checkout.sessions.create({
      mode: checkoutMode,
      line_items,
      customer_email: user.email || undefined,
      success_url: `${siteUrl}/library?checkout=success`,
      cancel_url: `${siteUrl}${cancelPath}?checkout=cancelled`,
      metadata
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
