# Hidden Gems / AI Studio DM Inbox + No Popup Patch

This patch removes the large verified-account welcome popup and adds a real DM inbox system while keeping announcements separate.

## What changes

### Removes the big popup
- `VerifiedAccessPopup` is no longer rendered in `Layout.jsx`.
- The welcome information becomes an inbox-only announcement instead of a big popup.
- The wording is safer and cleaner:
  "Your account is active. AI Studio is the main platform. For platform access details, open Access Info from the footer or account menu."

### Adds DMs
Users can:
- open `/messages`
- use the `DMs` tab
- start a DM by searching another user's email
- reply to conversations
- archive a conversation
- see unread badges

Admins can:
- send a DM to one user
- broadcast a DM to all users or a role group
- manage announcements separately
- change messaging settings

## Changed files

- src/lib/api.js
- src/components/Layout.jsx
- src/components/NotificationBell.jsx
- src/components/AdminMessagesPanel.jsx
- src/pages/Messages.jsx
- src/styles/site-dms.css
- supabase/migrations/024_dm_inbox_no_popup.sql

## Step 1: Run SQL first

Run this in Supabase SQL Editor:

supabase/migrations/024_dm_inbox_no_popup.sql

Expected output:
- public.dm_conversations
- public.dm_participants
- public.dm_messages
- public.messaging_settings

## Step 2: Replace files and build

```bash
npm run build
```

If it passes:

```bash
git add .
git commit -m "Add DM inbox and remove verified popup"
git push
```

## Test checklist

- The big Welcome to AI Studio popup no longer appears.
- `/messages` has DMs and Announcements tabs.
- Admin Panel → Site Messages has DM Center, Announcements, and Settings tabs.
- Admin can send a DM to one user.
- Admin can broadcast a DM to everyone.
- User can open and reply to a DM.
- Notification bell unread count updates.
- Welcome to AI Studio appears as an inbox announcement, not a popup.
- AI Studio remains the default public site.
