# AI Studio About-Only Switch + Functionality Fix

This patch fixes three issues:

1. The Hidden Gems / AI Studio switch button showing on pages other than About.
2. AI Studio chat layout boxes being misaligned.
3. AI Studio not functioning because `public.ai_conversations` is missing from Supabase.

## Changed files

- src/components/ModeSwitchPopout.jsx
- src/pages/AiStudio.jsx
- src/styles/ai-studio.css
- supabase/migrations/021_ai_studio_functionality_repair.sql

## What changes

### Mode switch
- The mode switch button now appears only on `/about`.
- It never appears on Home, AI Studio chat, Points, Account, Admin, etc.
- It still follows the Admin Panel visibility toggles.

### AI Studio page
- Removes the top `Admin: Return to Hidden Gems` switch from the AI Studio chat page.
- Cleans up the AI Studio chat layout.
- Fixes card sizing, spacing, prompt area, and mobile stacking.

### Supabase
- Creates/repairs:
  - ai_settings
  - ai_conversations
  - ai_messages
  - ai_usage_logs
  - ai_settings_public
  - RLS policies
- Reloads Supabase/PostgREST schema cache.

## Deploy steps

### 1. Run SQL

Run this in Supabase SQL Editor:

supabase/migrations/021_ai_studio_functionality_repair.sql

Expected output should include:
- ai_conversations_exists = public.ai_conversations
- ai_messages_exists = public.ai_messages
- ai_settings_exists = public.ai_settings

### 2. Replace files and build

```bash
npm run build
git add .
git commit -m "Fix AI Studio switch placement and chat functionality"
git push
```

## Test

- Open `/ai-studio`: no bottom switch button should appear.
- Open `/about`: switch button should appear after scrolling if enabled.
- Send a test AI message.
- Confirm no schema cache/table error appears.
