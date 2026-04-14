Hidden Gems launch notes

Current payment model
- Standard guest videos are sold as direct one-time purchases at $3, $5, or $7.
- VIP stays separate at $20 and unlocks VIP content plus download access.
- The old wallet/points flow is no longer the customer path.

What must be live in Supabase
1. The hg-paypal-checkout Edge Function must be redeployed from supabase/functions/hg-paypal-checkout/index.ts
2. Secrets must match the current PayPal mode:
   - PAYPAL_CLIENT_ID
   - PAYPAL_CLIENT_SECRET
   - PAYPAL_BASE_URL
   - SITE_URL
3. The hg_video_purchases table must already exist from the video SQL setup.

Testing order
1. Sign in with a guest account.
2. Open a guest video.
3. Click Buy Access and complete PayPal checkout.
4. success.html should capture the order and redirect back to the unlocked video.
5. Confirm the title appears in My Library.
6. Test VIP checkout separately.

Sandbox vs live
- Sandbox: https://api-m.sandbox.paypal.com with sandbox app credentials
- Live: https://api-m.paypal.com with live app credentials
- Do not mix sandbox keys with the live base URL.

Admin behavior
- Admin still bypasses paywalls and can open all videos.
- Guests should never receive free customer unlocks through the old wallet path.
