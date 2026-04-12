Hidden Gems launch checklist

Payment flow
- Customer-facing points purchases and VIP checkout now go through the Supabase Edge Function and PayPal flow.
- The points store no longer grants points directly on the storefront.
- Manual point grants are separated into the admin portal for the real admin account only.

Before testing
1. In Supabase Edge Function secrets, keep all PayPal values in the same environment:
   - Sandbox testing: PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com and sandbox Client ID/Secret
   - Live launch: PAYPAL_BASE_URL=https://api-m.paypal.com and live Client ID/Secret
2. Confirm SITE_URL matches your deployed domain.
3. Confirm the hg-paypal-checkout function is deployed.
4. Confirm config.js uses the publishable Supabase key, not the service role key.

Recommended test order
1. Sign in as a guest account and buy a points pack.
2. Verify success.html returns to the site and wallet updates on that same user.
3. Buy VIP and verify the account becomes VIP.
4. Sign in as the admin account and confirm:
   - the storefront still shows Buy with PayPal
   - manual point grants only appear in admin.html
   - admin can already open any video without buying it

Launch switch
- Stay on sandbox until all tests pass.
- Switch to live only when the base URL, Client ID, and Secret are all changed together.
