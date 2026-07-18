# CapDent Web Update Summary

Branch: `capdent-web-fixes-2026-07-18`

## Updated

- CapDent web branding and Expo static web configuration.
- Browser-sized login layout.
- Browser-origin email verification and password-reset redirects.
- Environment setup helper with mobile `.env` reuse.
- Support preparation for Supabase publishable keys and browser auth storage.
- Cloudflare Pages setup and testing documentation.

## Required validation

```powershell
npm install
npm run setup:web
npm run typecheck
npm run build:web
npm run web:clear
```

Test login, signup verification, password reset, image upload, nested-route refresh, and realtime updates before merging to `main`.
