# Coming Soon Mode

This project includes a toggleable "Coming Soon" mode that displays a beautiful landing page instead of the full website.

## Current Status

**Coming Soon Mode is currently ENABLED**

All routes redirect to the coming soon page with email signup.

## How to Toggle

### Option 1: Local Development (.env.local)

Edit the `.env.local` file:

```bash
# To ENABLE coming soon mode (show coming soon page)
NEXT_PUBLIC_COMING_SOON_MODE=true

# To DISABLE coming soon mode (show full website)
NEXT_PUBLIC_COMING_SOON_MODE=false
```

After changing, restart your dev server:
```bash
npm run dev
```

### Option 2: Vercel Deployment (Production)

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find or add `NEXT_PUBLIC_COMING_SOON_MODE`
5. Set value to:
   - `true` - Enable coming soon mode
   - `false` - Disable and show full website
6. Click **Save**
7. **Redeploy** your application for changes to take effect

## Quick Toggle on Vercel

**To go LIVE (disable coming soon):**
```
NEXT_PUBLIC_COMING_SOON_MODE=false
```

**To show COMING SOON page:**
```
NEXT_PUBLIC_COMING_SOON_MODE=true
```

## What Happens in Each Mode

### Coming Soon Mode (true)
- All routes redirect to `/coming-soon`
- Shows email signup form
- Playful, kid-friendly design
- Works in all languages

### Live Mode (false)
- Full website accessible
- All features available
- Users can create books, access dashboard, etc.

## Note

Make sure to set this environment variable in Vercel for it to take effect in production!
