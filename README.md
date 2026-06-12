# Hidden Gems About Page Secret Link Patch

This patch adds a subtle secret link to the existing Hidden Gems `about.html` page.

## What changed

Added this low-key line to the About page:

> For creators who know where to look, enter The Lab.

Only `enter The Lab` is clickable.

## Current destination

The link points to:

https://ai.hiddengems.space

If your AI site is not deployed yet and you want to test locally, change that URL to:

http://localhost:5173/

## How to install

1. Go to your original Hidden Gems website folder.
2. Find the existing `about.html` file.
3. Back it up first by renaming it to `about.backup.html`.
4. Copy this patched `about.html` into the same folder.
5. Refresh/open `about.html` in your browser and test the secret link.

## Git commands

```bash
git add about.html
git commit -m "Add secret lab link to About page"
git push
```
