# Hidden Gems AI-First Session Switch Fix

This patch makes AI Studio the real main site again and keeps Hidden Gems hidden unless the Access Info switch is clicked.

## What this fixes

- AI Studio is forced as the default public mode.
- Hidden Gems no longer appears just because Supabase global settings were accidentally switched.
- Hidden Gems only appears when someone deliberately clicks the Access Info switch.
- The Access Info switch now uses browser session mode only. It does not update the global database/site mode.
- Clicking `Enter Hidden Gems` sends the visitor to the Hidden Gems homepage for that browser session.
- Clicking `Open AI Studio` sends the visitor to `/ai-studio`.
- Adds spacing fixes so the Hidden Gems homepage cards do not touch if someone enters that mode.

## Changed files

- src/lib/api.js
- src/hooks/useSiteMode.js
- src/components/ModeSwitchPopout.jsx
- src/components/Layout.jsx
- src/styles/home-spacing-fix.css
- supabase/migrations/022_force_ai_first_session_only_switch.sql

## Deploy steps

### 1. Run SQL in Supabase

Run:

supabase/migrations/022_force_ai_first_session_only_switch.sql

It should show:

site_mode = ai_studio
ai_studio_public_mode = true

### 2. Replace files and build

```bash
npm run build
git add .
git commit -m "Force AI-first mode and session-only Hidden Gems switch"
git push
```

### 3. Clear old browser override

After Vercel deploys, refresh with Ctrl + Shift + R.

If your browser is still stuck on Hidden Gems, open DevTools Console and run:

```js
sessionStorage.removeItem('hidden_gems_site_mode_override')
localStorage.removeItem('hidden_gems_site_mode_override')
location.href = '/'
```

## Test

- Incognito `/` should show AI Studio.
- Header should say AI Studio.
- Hidden Gems should not show unless Access Info switch is clicked.
- `/access-info` should show the discreet switch if enabled.
- Enter Hidden Gems should go to Hidden Gems for that browser session only.
- Open AI Studio should go to `/ai-studio`.
