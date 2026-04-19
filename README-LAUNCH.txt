Hidden Gems launch notes

Current payment model
- Standard guest videos are sold as direct one-time purchases at $3, $5, or $7.
- VIP stays separate at $20 and unlocks VIP content plus download access.
- The old legacy purchase flow is no longer the customer path.

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
- Guests should never receive free customer unlocks through the old legacy purchase path.


Important fixes included in this pack
- The PayPal Edge Function now honors the siteUrl sent by the frontend, so PayPal can return to your real site even if SITE_URL was missing in Supabase secrets.
- Signup no longer hard-stops if the profile upsert warning appears, because the SQL now includes an auth.users trigger that auto-creates the profile row.
- The SQL now creates/fixes the profiles table and its policies if they were missing.

Recommended reset steps before testing again
1. In Supabase SQL Editor, run supabase-payments.sql first.
2. Then run supabase-hg-videos-live-ready.sql if you have not already run the latest video schema.
3. In Supabase Edge Functions, redeploy hg-paypal-checkout from supabase/functions/hg-paypal-checkout/index.ts.
4. Make sure these secrets exist for that function: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL, SITE_URL.
5. In your browser, sign out of Hidden Gems once, then clear old site data/local storage for the domain if you still see Invalid JWT.
6. Sign back in and test with one guest video purchase and one VIP purchase.

CLI deploy notes
- A supabase/config.toml template is included now so the project ref is already set.
- Typical flow:
  supabase login
  supabase link --project-ref netolzyxnifogojwwesq
  supabase secrets set PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_BASE_URL=https://api-m.paypal.com SITE_URL=https://hiddengems.space
  supabase functions deploy hg-paypal-checkout --no-verify-jwt
