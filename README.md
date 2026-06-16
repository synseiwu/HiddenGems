# Username DM Search + 100 Point Rewards Patch

This patch adds usernames so DMs are easier, plus two one-time 100 point rewards.

## What it adds

- Username creation prompt after login for users without a username
- 100 point bonus after creating a username
- Username display on Account page
- DM user search by username
- Admin DM search by username or email
- Admin settings for username prompt, rewards, and DM search
- 100 point one-time bonus after entering Hidden Gems through Access Info
- System DM notifications for both rewards

## Changed files

- src/lib/api.js
- src/components/Layout.jsx
- src/components/UsernamePrompt.jsx
- src/components/UsernameAccountCard.jsx
- src/components/ModeSwitchPopout.jsx
- src/components/AdminMessagesPanel.jsx
- src/pages/Messages.jsx
- src/pages/Account.jsx
- src/styles/username-rewards.css
- supabase/migrations/025_username_dm_rewards.sql

## Run SQL first

Run this in Supabase SQL Editor:

supabase/migrations/025_username_dm_rewards.sql

Expected output includes:

- user_reward_flags
- profiles.username columns ready
- username rewards ready

## Deploy

Replace the files, then run:

```bash
npm run build
git add .
git commit -m "Add usernames and reward bonuses"
git push
```

## Test checklist

- Login with an account that has no username
- Username prompt appears
- Invalid username shows error
- Duplicate username shows error
- Valid username saves
- 100 points are added once
- Username appears on Account page
- DM search finds users by username
- Admin DM search finds users by username/email
- Go to /access-info and click Enter Hidden Gems
- 100 point access bonus is added once
- Switching back and forth does not give more points
- Reward messages appear in inbox/DMs as system messages
- AI Studio remains the default public site
