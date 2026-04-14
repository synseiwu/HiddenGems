import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dollarsFromCents(cents: number) {
  return (Math.max(0, Number(cents) || 0) / 100).toFixed(2);
}

async function getPaypalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") || "";
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
  const baseUrl = (Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com").replace(/\/$/, "");
  if (!clientId || !secret) throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in Supabase Edge Function secrets.");
  const auth = btoa(`${clientId}:${secret}`);
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || "Unable to get PayPal access token.");
  return { accessToken: data.access_token as string, baseUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Missing Supabase environment variables.");

    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "You must be signed in before checkout." }, 401);
    const user = userData.user;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const kind = String(body?.kind || "").trim();
    const videoId = String(body?.videoId || "").trim();
    const title = String(body?.title || "").trim();
    const amountCents = Math.max(0, Number(body?.amountCents || 0) || 0);
    const siteUrl = (Deno.env.get("SITE_URL") || `${new URL(req.url).origin}`).replace(/\/$/, "");
    const { accessToken, baseUrl } = await getPaypalAccessToken();

    if (action === "create") {
      const isVip = kind === "vip";
      const isVideo = kind === "video";
      if (!isVip && !isVideo) return json({ error: "Unsupported payment kind." }, 400);
      if (isVideo && (!videoId || amountCents <= 0)) return json({ error: "Video checkout is missing a video ID or price." }, 400);

      const amount = isVip ? "20.00" : dollarsFromCents(amountCents);
      const description = isVip ? "Hidden Gems VIP Membership" : `${title || "Hidden Gems video"} - direct access`;
      const customId = JSON.stringify({
        user_id: user.id,
        email: user.email,
        kind,
        video_id: videoId || null,
        title: title || null,
        amount_cents: isVideo ? amountCents : null,
      });
      const returnUrl = isVip ? `${siteUrl}/success.html?kind=vip` : `${siteUrl}/success.html?kind=video&id=${encodeURIComponent(videoId)}`;
      const cancelUrl = `${siteUrl}/cancel.html?kind=${encodeURIComponent(kind || "payment")}`;

      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            description,
            custom_id: customId,
            amount: { currency_code: "USD", value: amount },
          }],
          application_context: {
            brand_name: "Hidden Gems",
            user_action: "PAY_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) return json({ error: orderData?.message || "Unable to create PayPal order.", details: orderData }, 400);
      const approvalUrl = (orderData?.links || []).find((link: any) => link.rel === "approve")?.href;
      return json({ approvalUrl, orderId: orderData.id, kind, videoId });
    }

    if (action === "capture") {
      const orderId = String(body?.orderId || "").trim();
      if (!orderId) return json({ error: "Missing PayPal order ID." }, 400);

      const existing = await adminClient.from("hg_payment_transactions").select("order_id, vip_granted, payment_kind, pack_id").eq("order_id", orderId).maybeSingle();
      if (existing.data) {
        const profileResult = await adminClient.from("profiles").select("is_vip, role").eq("id", user.id).maybeSingle();
        return json({
          status: "already_captured",
          orderId,
          vipGranted: !!existing.data.vip_granted,
          role: profileResult.data?.role || "guest",
          videoUnlocked: existing.data.payment_kind === "video",
          videoId: existing.data.payment_kind === "video" ? String(existing.data.pack_id || "") : "",
        });
      }

      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const captureData = await captureResponse.json();
      if (!captureResponse.ok) return json({ error: captureData?.message || "Unable to capture PayPal order.", details: captureData }, 400);

      const purchaseUnit = captureData?.purchase_units?.[0] || {};
      let custom: any = {};
      try { custom = JSON.parse(String(purchaseUnit?.payments?.captures?.[0]?.custom_id || purchaseUnit?.custom_id || "{}")); } catch (_) {}
      if (!custom?.user_id || custom.user_id !== user.id) return json({ error: "This payment approval does not belong to the current signed-in user." }, 403);

      const isVip = custom.kind === "vip";
      const isVideo = custom.kind === "video";
      const purchasedVideoId = isVideo ? String(custom.video_id || "") : "";
      const amountValue = String(purchaseUnit?.payments?.captures?.[0]?.amount?.value || purchaseUnit?.amount?.value || "0");
      const amountCentsPaid = Math.round(Number(amountValue) * 100);

      const profileResult = await adminClient.from("profiles").select("is_vip, role, email").eq("id", user.id).maybeSingle();
      const currentProfile = profileResult.data || { is_vip: false, role: "guest", email: user.email };
      const updatedProfile = {
        id: user.id,
        email: user.email,
        is_vip: isVip ? true : !!currentProfile.is_vip,
        role: currentProfile.role === "admin" ? "admin" : (isVip || currentProfile.is_vip ? "vip" : "guest"),
      };

      const upsertProfile = await adminClient.from("profiles").upsert(updatedProfile).select("is_vip, role").single();
      if (upsertProfile.error) return json({ error: upsertProfile.error.message }, 400);

      if (isVideo && purchasedVideoId) {
        const purchaseInsert = await adminClient.from("hg_video_purchases").upsert({
          user_id: user.id,
          video_id: purchasedVideoId,
          role_at_purchase: currentProfile.role || "guest",
          title_snapshot: String(custom.title || "Hidden Gems video"),
          amount_paid_cents: amountCentsPaid,
          created_at: new Date().toISOString(),
        }, { onConflict: "user_id,video_id" });
        if (purchaseInsert.error) return json({ error: purchaseInsert.error.message }, 400);
      }

      const insertTx = await adminClient.from("hg_payment_transactions").insert({
        provider: "paypal",
        order_id: orderId,
        user_id: user.id,
        email: user.email,
        payment_kind: isVip ? "vip" : "video",
        pack_id: isVip ? null : purchasedVideoId,
        amount_cents: amountCentsPaid,
        currency: String(purchaseUnit?.payments?.captures?.[0]?.amount?.currency_code || purchaseUnit?.amount?.currency_code || "USD"),
        vip_granted: isVip,
        status: "captured",
        raw_payload: captureData,
      });
      if (insertTx.error) return json({ error: insertTx.error.message }, 400);

      return json({
        status: "captured",
        orderId,
        vipGranted: isVip,
        role: upsertProfile.data?.role || "guest",
        videoUnlocked: isVideo,
        videoId: purchasedVideoId,
        title: String(custom.title || ""),
      });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected checkout error." }, 500);
  }
});
