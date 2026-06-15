# Hidden Gems / AI Studio Site Messages + Verified Access Popup Patch

This patch adds a site-wide messaging/inbox system and a verified-account welcome popup.

## What it adds

### Admin messaging system
- Admin Panel section: `Site Messages`
- Admins can create, edit, activate/deactivate, and delete messages
- Message options:
  - type
  - priority
  - audience
  - popup enabled
  - requires acknowledgement
  - show once
  - expiration date
- Basic read/acknowledge/dismiss stats

### User inbox
- Header notification bell
- `/messages` inbox route
- Unread count badge
- Read, acknowledge, and dismiss actions

### Popups
- Verified-account welcome popup after login
- Admin message popup support
- Popups are centered and do not intentionally overlap the daily reward popup

### Access Info update
- Explains AI Studio is the main site
- Explains Hidden Gems access through `/access-info`
- Explains same account and points wallet work on both sides

## Preserved behavior

- AI Studio remains the main public site
- Hidden Gems access remains through `/access-info`
- Same accounts, points wallet, roles, rewards, pricing, and Stripe setup
- No Edge Function changes

## Changed files

- src/lib/api.js
- src/components/Layout.jsx
- src/components/NotificationBell.jsx
- src/components/VerifiedAccessPopup.jsx
- src/components/MessagePopupCenter.jsx
- src/components/AdminMessagesPanel.jsx
- src/pages/Messages.jsx
- src/pages/AccessInfo.jsx
- src/pages/Admin.jsx
- src/routes/AppRoutes.jsx
- src/styles/site-messages.css
- supabase/migrations/023_site_messages_onboarding.sql

## Deploy steps

### 1. Run SQL

Run this in Supabase SQL Editor:

supabase/migrations/023_site_messages_onboarding.sql

Expected output should show:
- public.site_messages
- public.site_message_reads
- public.user_onboarding_status

### 2. Replace files

Replace the changed files in your project.

### 3. Build and push

```bash
npm run build
git add .
git commit -m "Add site messages and verified access popup"
git push
```

## Testing checklist

### Verified account popup
- Create a fresh account
- Verify email
- Log back in
- Welcome popup appears
- Open Access Info button works
- Continue to AI Studio button works
- Popup does not show again after closing

### Messaging
- Login as admin
- Go to Admin Panel → Site Messages
- Create an active message with popup enabled
- Login as test user
- Notification bell shows unread count
- `/messages` shows the message
- User can read, acknowledge, and dismiss
- Admin can deactivate/delete message

### AI-first behavior
- Incognito `/` opens AI Studio
- Hidden Gems does not show unless `/access-info` switch is clicked
- Switch only appears on `/access-info`
