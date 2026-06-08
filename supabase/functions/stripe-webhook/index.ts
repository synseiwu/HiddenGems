import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

async function findTierByPrice(supabase: any, priceId: string | null | undefined) {
  if (!priceId) return null
  const { data } = await supabase
    .from('vip_tiers')
    .select('tier_key,tier_rank,stripe_price_id')
    .eq('stripe_price_id', priceId)
    .maybeSingle()
  return data
}

async function applySubscriptionStatus(supabase: any, subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {}
  const userId = metadata.user_id
  const priceId = subscription.items?.data?.[0]?.price?.id || metadata.stripe_price_id
  const tier = metadata.vip_tier
    ? { tier_key: metadata.vip_tier, tier_rank: Number(metadata.vip_rank || 1), stripe_price_id: priceId }
    : await findTierByPrice(supabase, priceId)

  if (!userId || !tier) return

  const activeStatuses = ['active', 'trialing']
  const isActive = activeStatuses.includes(subscription.status)
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null

  await supabase.from('vip_subscriptions').upsert({
    user_id: userId,
    status: subscription.status,
    tier_key: tier.tier_key,
    stripe_price_id: priceId,
    stripe_subscription_id: subscription.id,
    current_period_end: periodEnd,
    renews_at: periodEnd,
    expires_at: isActive ? null : new Date().toISOString()
  }, { onConflict: 'stripe_subscription_id' })

  await supabase.from('profiles').update({
    vip_status: isActive,
    subscription_tier: isActive ? tier.tier_key : 'none',
    vip_rank: isActive ? Number(tier.tier_rank || 1) : 0,
    updated_at: new Date().toISOString()
  }).eq('id', userId)
}

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' })
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Missing Stripe signature or webhook secret', { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const mode = session.metadata?.mode
      const userId = session.metadata?.user_id

      if (!userId) throw new Error('Missing user_id metadata')

      if (mode === 'points') {
        const packageId = session.metadata?.point_package_id
        const pointsAmount = Number(session.metadata?.points_amount || 0)

        if (!packageId || pointsAmount <= 0) throw new Error('Missing point package metadata')

        const { data: existing } = await supabase
          .from('point_transactions')
          .select('id')
          .eq('stripe_session_id', session.id)
          .maybeSingle()

        if (!existing) {
          await supabase.from('user_wallets').upsert({ user_id: userId }, { onConflict: 'user_id' })
          const { data: wallet } = await supabase.from('user_wallets').select('points_balance').eq('user_id', userId).single()
          await supabase.from('user_wallets').update({
            points_balance: Number(wallet?.points_balance || 0) + pointsAmount,
            updated_at: new Date().toISOString()
          }).eq('user_id', userId)

          await supabase.from('point_transactions').insert({
            user_id: userId,
            amount: pointsAmount,
            transaction_type: 'purchase',
            description: `Purchased ${pointsAmount} points`,
            point_package_id: packageId,
            stripe_session_id: session.id
          })
        }
      }

      if (mode === 'vip' && typeof session.subscription === 'string') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        await applySubscriptionStatus(supabase, subscription)
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription
      await applySubscriptionStatus(supabase, subscription)
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    await supabase.from('security_events').insert({
      event_type: 'webhook_error',
      details: { message: err.message, stripe_event: event.type }
    }).catch(() => null)

    return new Response(`Webhook handler failed: ${err.message}`, { status: 500 })
  }
})
