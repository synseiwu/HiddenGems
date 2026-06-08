# Hidden Gems VIP Tiers + Admin Settings + Security Patch

Changed files only.

## Files included

- src/lib/api.js
- src/hooks/useAuth.jsx
- src/components/VideoCard.jsx
- src/pages/Admin.jsx
- src/pages/Vip.jsx
- src/pages/VideoDetails.jsx
- src/styles/global.css
- supabase/migrations/005_vip_tiers_admin_security.sql
- supabase/functions/create-checkout-session/index.ts
- supabase/functions/stripe-webhook/index.ts
- supabase/functions/unlock-video-with-points/index.ts

## What this adds

- Admin dropdown for Video Listings / Site Settings / Security Tools
- Admin-editable VIP tiers: VIP, Super VIP, Ultra VIP
- Admin-editable point packages and categories
- Video access types: Free, Points, VIP, Super VIP, Ultra VIP, Admin Only
- VIP tier comparison cards on the VIP page
- Stronger protected-link flow: full external links only come from verified RPC access checks
- Updated Stripe checkout function for tier-specific VIP subscriptions
- Updated webhook to sync subscription tier/rank from Stripe
- Admin point adjustment tool
- Recent unlocks, transactions, subscriptions, and security event visibility

## Supabase steps

1. Run `supabase/migrations/005_vip_tiers_admin_security.sql` in Supabase SQL Editor.
2. In Admin Panel → Site Settings, add Stripe Price IDs for each VIP tier you want active.
3. Redeploy functions:

```bash
npx supabase@latest functions deploy create-checkout-session --project-ref fdorjxsfljtdlsogivom
npx supabase@latest functions deploy stripe-webhook --project-ref fdorjxsfljtdlsogivom
npx supabase@latest functions deploy unlock-video-with-points --project-ref fdorjxsfljtdlsogivom
```

4. Make sure Stripe webhook listens to:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

## App deploy

```bash
npm run build
git add .
git commit -m "Add VIP tiers admin settings and security hardening"
git push
```
