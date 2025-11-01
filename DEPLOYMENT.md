# Deployment Guide: Coming Soon ↔️ Live Mode

This guide explains how to toggle between "Coming Soon" mode and "Live" mode with a single environment variable change.

---

## 🌐 URL Structure

**English (Default Language):**
- English URLs don't show the `/en` prefix
- Examples: `usnthen.com`, `usnthen.com/create`, `usnthen.com/dashboard`

**Other Languages:**
- All other languages show their locale prefix
- Examples: `usnthen.com/de`, `usnthen.com/fr/create`, `usnthen.com/es/dashboard`

---

## 🚀 Quick Toggle: Coming Soon ↔️ Live

### Option 1: Using Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Find or add `NEXT_PUBLIC_COMING_SOON_MODE`
4. Set the value:
   - `true` = Coming Soon page (hides all app functionality)
   - `false` = Live mode (full app available)
5. Click **Save**
6. Vercel will automatically redeploy

**⏱️ Time: ~2 minutes (including automatic redeployment)**

---

### Option 2: Using Vercel CLI

```bash
# Set to Coming Soon mode
vercel env add NEXT_PUBLIC_COMING_SOON_MODE production
# Enter: true

# Set to Live mode
vercel env rm NEXT_PUBLIC_COMING_SOON_MODE production
# Or change to: false

# Trigger redeployment
vercel --prod
```

---

### Option 3: Using .env.local (Local Development)

Add to your `.env.local` file:

```bash
# Coming Soon Mode
NEXT_PUBLIC_COMING_SOON_MODE=true   # Show coming soon page only
# NEXT_PUBLIC_COMING_SOON_MODE=false  # Show full app (live mode)
```

Then restart your dev server:
```bash
npm run dev
```

---

## 📋 What Each Mode Does

### Coming Soon Mode (`NEXT_PUBLIC_COMING_SOON_MODE=true`)

✅ **Shows:**
- Beautiful coming soon page at all routes
- Email waitlist signup form
- Feature highlights
- Multi-language support

❌ **Hides:**
- Main landing page with full features
- `/create` - Book creation wizard
- `/dashboard` - User dashboard
- `/order/*` - Order pages
- All other app functionality

🔓 **Still Accessible:**
- API routes (for testing)
- Static files
- Development tools

---

### Live Mode (`NEXT_PUBLIC_COMING_SOON_MODE=false` or unset)

✅ **Shows:**
- Full landing page with all features
- Complete app functionality
- All routes accessible
- Book creation wizard
- User dashboard
- Order processing

---

## 🛠️ Technical Details

### How It Works

1. **Environment Variable**: `NEXT_PUBLIC_COMING_SOON_MODE`
   - The `NEXT_PUBLIC_` prefix makes it available in the browser
   - Checked in middleware and page components

2. **Middleware**: `/middleware.ts`
   - Intercepts all requests
   - Redirects to home if in coming soon mode
   - Allows API routes through

3. **Page Routing**: `/app/[locale]/page.tsx`
   - Conditionally renders coming soon page or landing page
   - Based on environment variable

---

## 📝 Step-by-Step: Going Live

### When You're Ready to Launch:

1. **Update Environment Variable in Vercel:**
   - Dashboard → Settings → Environment Variables
   - Set `NEXT_PUBLIC_COMING_SOON_MODE` to `false`
   - OR delete the variable entirely
   - Save changes

2. **Vercel Auto-Deploys:**
   - Wait ~2-3 minutes for automatic redeployment
   - Monitor deployment status in Vercel dashboard

3. **Verify:**
   - Visit your production URL
   - Confirm full app is visible
   - Test key features:
     - Create book flow
     - Dashboard access
     - All routes work

4. **Done!** 🎉
   - Your app is now live to the public

---

## 🔄 Going Back to Coming Soon Mode

If you need to take the app offline temporarily:

1. Set `NEXT_PUBLIC_COMING_SOON_MODE` to `true` in Vercel
2. Wait for auto-redeployment (~2-3 minutes)
3. Coming soon page is now showing again

---

## 🧪 Testing Locally

### Test Coming Soon Mode:
```bash
# Add to .env.local
NEXT_PUBLIC_COMING_SOON_MODE=true

# Restart dev server
npm run dev

# Visit http://localhost:3000 (English - no /en prefix)
# Should show coming soon page

# Try to visit http://localhost:3000/create
# Should redirect to http://localhost:3000
```

### Test Live Mode:
```bash
# Change in .env.local
NEXT_PUBLIC_COMING_SOON_MODE=false

# Restart dev server
npm run dev

# Visit http://localhost:3000 (English - no /en prefix)
# Should show full landing page

# Visit http://localhost:3000/create
# Should show book creation wizard
```

---

## 📦 File Structure

### Key Files for Coming Soon Mode:

```
/app/[locale]/
├── page.tsx                    # Main page (conditional: landing OR coming soon)
├── coming-soon/
│   └── page.tsx               # Coming soon page component
└── landing/
    └── page.tsx               # Original landing page component

/middleware.ts                  # Route protection and redirects
/DEPLOYMENT.md                  # This file (documentation)
```

---

## 🐛 Troubleshooting

### Issue: Changes not reflecting in production
**Solution:**
- Wait for Vercel redeployment to complete (~2-3 minutes)
- Check Vercel dashboard for deployment status
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

### Issue: Still seeing coming soon page after setting to false
**Solution:**
- Verify environment variable is set to exactly `false` (not `"false"`)
- OR delete the variable entirely
- Clear browser cache
- Check Vercel deployment logs

### Issue: API routes not working
**Solution:**
- API routes should always work in both modes
- Check Vercel function logs
- Verify environment variables for API keys are set

---

## 📞 Quick Reference Commands

```bash
# Local Development
npm run dev                      # Start dev server
npm run build                    # Test production build

# Vercel Deployment
vercel                           # Deploy to preview
vercel --prod                    # Deploy to production
vercel env ls                    # List environment variables
vercel logs                      # View deployment logs

# Git
git status                       # Check changes
git add .                        # Stage all changes
git commit -m "message"          # Commit changes
git push                         # Push to trigger Vercel deploy
```

---

## ✅ Pre-Launch Checklist

Before going live, ensure:

- [ ] All environment variables are set in Vercel production
- [ ] API keys are configured (OpenAI, Stripe, Supabase, etc.)
- [ ] Test book creation flow works end-to-end
- [ ] Payment integration is tested
- [ ] Error handling is working
- [ ] Analytics/monitoring is set up
- [ ] Email collection endpoint is configured (if keeping waitlist)
- [ ] All 6 languages are tested
- [ ] Mobile responsiveness is verified
- [ ] Performance is acceptable (Lighthouse score)

---

## 🎯 Simple Command for Later

**To Enable Coming Soon Mode:**
```
Set NEXT_PUBLIC_COMING_SOON_MODE=true in Vercel
```

**To Go Live:**
```
Set NEXT_PUBLIC_COMING_SOON_MODE=false in Vercel
```

That's it! 🚀
