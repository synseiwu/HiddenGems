// Hidden Gems Stripe webhook fulfillment
// Verifies Stripe signatures, then writes verified VIP/video access to Supabase.
// Deploy with verify_jwt=false because Stripe cannot send a Supabase JWT.

import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ParsedReference = {
  kind: 'vip' | 'video' | 'unknown';
  userId: string;
  videoId: string;
};

const corsHeaders = {
  'Content-Type': 'application/json',
};

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_API_KEY') || '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!stripeSecretKey) console.error('Missing STRIPE_SECRET_KEY / STRIPE_API_KEY');
if (!webhookSecret) console.error('Missing STRIPE_WEBHOOK_SIGNING_SECRET');
if (!supabaseUrl) console.error('Missing SUPABASE_URL');
if (!serviceRoleKey) console.error('Missing SUPABASE_SERVICE_ROLE_KEY');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20',
});

// Required by Stripe signature verification in Supabase/Deno Edge Functions.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function parseClientReference(value: unknown): ParsedReference {
  const ref = String(value || '').trim();
  // Expected frontend formats:
  // hg_video:<videoId>:user:<userId>
  // hg_vip:user:<userId>
  const videoMatch = ref.match(/^hg_video:([^:]+):user:([0-9a-fA-F-]{20,})$/);
  if (videoMatch) return { kind: 'video', videoId: videoMatch[1], userId: videoMatch[2] };

  const vipMatch = ref.match(/^hg_vip:user:([0-9a-fA-F-]{20,})$/);
  if (vipMatch) return { kind: 'vip', videoId: '', userId: vipMatch[1] };

  return { kind: 'unknown', videoId: '', userId: '' };
}

function getString(value: unknown): string {
  return String(value || '').trim();
}

async function rememberStripeCustomer(params: { userId: string; email: string; customerId: string }) {
  if (!params.userId || !params.customerId) return;

  await adminClient.from('hg_stripe_customers').upsert({
    user_id: params.userId,
    email: params.email || null,
    stripe_customer_id: params.customerId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_customer_id' });

  // Optional compatibility if this column exists. Ignore if it does not.
  await adminClient.from('profiles').update({
    stripe_customer_id: params.customerId,
  }).eq('id', params.userId);
}

async function insertTransaction(params: {
  orderId: string;
  userId: string;
  email: string;
  kind: 'vip' | 'video';
  videoId?: string;
  amountCents: number;
  currency: string;
  status: string;
  rawPayload: unknown;
}) {
  const { error } = await adminClient.from('hg_payment_transactions').upsert({
    provider: 'stripe',
    order_id: params.orderId,
    user_id: params.userId,
    email: params.email || null,
    payment_kind: params.kind,
    pack_id: params.kind === 'video' ? params.videoId || null : null,
    amount_cents: Number.isFinite(params.amountCents) ? params.amountCents : 0,
    currency: params.currency || 'usd',
    vip_granted: params.kind === 'vip',
    status: params.status || 'completed',
    raw_payload: params.rawPayload,
  }, { onConflict: 'provider,order_id' });

  if (error) throw new Error(`Failed to record Stripe transaction: ${error.message}`);
}

async function grantVideoAccess(params: {
  userId: string;
  videoId: string;
  amountCents: number;
}) {
  if (!params.userId || !params.videoId) throw new Error('Missing user/video ID for video grant.');

  let titleSnapshot = 'Hidden Gems video';
  const videoResult = await adminClient
    .from('hg_videos')
    .select('title')
    .eq('id', params.videoId)
    .maybeSingle();
  if (videoResult.data?.title) titleSnapshot = String(videoResult.data.title);

  const profileResult = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', params.userId)
    .maybeSingle();

  const { error } = await adminClient.from('hg_video_purchases').upsert({
    user_id: params.userId,
    video_id: params.videoId,
    role_at_purchase: profileResult.data?.role || 'guest',
    title_snapshot: titleSnapshot,
    amount_paid_cents: Number.isFinite(params.amountCents) ? params.amountCents : 0,
    status: 'completed',
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,video_id' });

  if (error) throw new Error(`Failed to unlock video: ${error.message}`);
}

async function grantVipAccess(params: { userId: string; email: string }) {
  if (!params.userId) throw new Error('Missing user ID for VIP grant.');

  const profileResult = await adminClient
    .from('profiles')
    .select('role,email')
    .eq('id', params.userId)
    .maybeSingle();

  const currentRole = String(profileResult.data?.role || 'guest').toLowerCase();
  const role = currentRole === 'admin' ? 'admin' : 'vip';
  const email = params.email || profileResult.data?.email || null;

  const { error } = await adminClient.from('profiles').upsert({
    id: params.userId,
    email,
    is_vip: true,
    role,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) throw new Error(`Failed to grant VIP: ${error.message}`);
}

async function revokeVipForCustomer(customerId: string, rawPayload: unknown) {
  if (!customerId) return;

  const customerResult = await adminClient
    .from('hg_stripe_customers')
    .select('user_id,email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  const userId = customerResult.data?.user_id;
  if (!userId) return;

  const profileResult = await adminClient
    .from('profiles')
    .select('role,email')
    .eq('id', userId)
    .maybeSingle();

  // Never downgrade approved/admin accounts from the webhook.
  if (String(profileResult.data?.role || '').toLowerCase() === 'admin') return;

  await adminClient.from('hg_payment_transactions').insert({
    provider: 'stripe',
    order_id: `sub_cancel_${customerId}_${Date.now()}`,
    user_id: userId,
    email: customerResult.data?.email || profileResult.data?.email || null,
    payment_kind: 'subscription',
    amount_cents: 0,
    currency: 'usd',
    vip_granted: false,
    status: 'canceled',
    raw_payload: rawPayload,
  });

  const { error } = await adminClient
    .from('profiles')
    .update({ is_vip: false, role: 'guest', updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Failed to revoke VIP: ${error.message}`);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const parsed = parseClientReference(session.client_reference_id);
  const metadata = session.metadata || {};
  const kindFromMetadata = getString(metadata.kind || metadata.payment_kind || metadata.hg_kind).toLowerCase();
  const kind = parsed.kind !== 'unknown'
    ? parsed.kind
    : (kindFromMetadata === 'vip' || kindFromMetadata === 'subscription' ? 'vip' : 'video');

  const userId = parsed.userId || getString(metadata.user_id || metadata.userId || metadata.hg_user_id);
  const videoId = parsed.videoId || getString(metadata.video_id || metadata.videoId || metadata.hg_video_id);
  const email = getString(session.customer_details?.email || session.customer_email || metadata.email);
  const amountCents = Number(session.amount_total || 0);
  const currency = getString(session.currency || 'usd').toLowerCase();
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || '';

  if (!userId) throw new Error('Stripe session is missing Hidden Gems user ID. Make sure checkout starts from the signed-in site.');
  if (kind === 'video' && !videoId) throw new Error('Stripe video session is missing video ID.');

  if (customerId) await rememberStripeCustomer({ userId, email, customerId });

  // Insert transaction first so the existing database trigger can verify VIP grants.
  await insertTransaction({
    orderId: session.id,
    userId,
    email,
    kind,
    videoId,
    amountCents,
    currency,
    status: 'completed',
    rawPayload: session,
  });

  if (kind === 'vip') {
    await grantVipAccess({ userId, email });
    return { fulfilled: 'vip', userId };
  }

  await grantVideoAccess({ userId, videoId, amountCents });
  return { fulfilled: 'video', userId, videoId };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const signature = request.headers.get('Stripe-Signature');
  if (!signature) return json({ error: 'Missing Stripe-Signature header' }, 400);

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return json({ error: 'Invalid Stripe signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const result = await handleCheckoutCompleted(session);
        return json({ received: true, event: event.type, ...result });
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || '';
        await revokeVipForCustomer(customerId, subscription);
        return json({ received: true, event: event.type, customerId });
      }
      default:
        return json({ received: true, ignored: true, event: event.type });
    }
  } catch (error) {
    console.error('Stripe webhook fulfillment failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Webhook fulfillment failed' }, 500);
  }
});
