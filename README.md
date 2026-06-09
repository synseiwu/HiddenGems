# Hidden Gems create-checkout-session VIP Tier Patch

Changed file only:
- supabase/functions/create-checkout-session/index.ts

What this fixes:
- The checkout function now reads VIP/Super VIP/Ultra VIP prices from `public.vip_tiers`.
- Supports:
  - `tierKey: "vip"`
  - `tierKey: "supervip"`
  - `tierKey: "ultravip"`
- Keeps backward compatibility with `VIP_STRIPE_PRICE_ID` for regular VIP only.
- Keeps point package checkout using `point_packages.stripe_price_id`.
- Returns clearer error messages instead of a generic 400.

How to deploy:
1. Replace:
   supabase/functions/create-checkout-session/index.ts

2. From your project root, run:
   npx supabase@latest functions deploy create-checkout-session --project-ref fdorjxsfljtdlsogivom

3. Refresh the site and test:
   - VIP
   - Super VIP
   - Ultra VIP

No SQL migration is required for this patch.
