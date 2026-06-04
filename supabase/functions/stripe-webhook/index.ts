import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

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

      if (mode === 'vip') {
        await supabase.from('vip_subscriptions').upsert({
          user_id: userId,
          status: 'active',
          stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          stripe_session_id: session.id,
          started_at: new Date().toISOString()
        }, { onConflict: 'stripe_session_id' })

        await supabase.from('profiles').update({ vip_status: true, updated_at: new Date().toISOString() }).eq('id', userId)
      }

      if (mode === 'points') {
        const packageId = session.metadata?.point_package_id
        if (!packageId) throw new Error('Missing point_package_id metadata')

        const { data: pack, error: packError } = await supabase
          .from('point_packages')
          .select('id,points_amount,name')
          .eq('id', packageId)
          .single()

        if (packError || !pack) throw new Error('Point package not found')

        const { error: transactionError } = await supabase.from('point_transactions').insert({
          user_id: userId,
          amount: pack.points_amount,
          transaction_type: 'purchase',
          description: `Purchased ${pack.name}`,
          point_package_id: pack.id,
          stripe_session_id: session.id
        })

        // Unique violation means this webhook was already processed, so do not add points twice.
        if (transactionError && transactionError.code !== '23505') throw transactionError

        if (!transactionError) {
          await supabase.from('user_wallets').upsert({ user_id: userId, points_balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })
          const { data: wallet } = await supabase.from('user_wallets').select('points_balance').eq('user_id', userId).single()
          await supabase
            .from('user_wallets')
            .update({
              points_balance: Number(wallet?.points_balance || 0) + Number(pack.points_amount),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const { data } = await supabase
        .from('vip_subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

      if (data?.user_id) {
        await supabase.from('vip_subscriptions').update({ status: 'cancelled', expires_at: new Date().toISOString() }).eq('stripe_subscription_id', subscription.id)
        await supabase.from('profiles').update({ vip_status: false, updated_at: new Date().toISOString() }).eq('id', data.user_id)
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(`Webhook handler failed: ${err.message}`, { status: 500 })
  }
})
