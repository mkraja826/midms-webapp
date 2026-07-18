# CapDent Web App

Browser and installable web-app version of CapDent for clinic owners, doctors, and reception teams.

This repository is dedicated to the CapDent browser application and Cloudflare deployment. The Android application is maintained separately.

## Local setup

```powershell
cd C:\capdent-web
npm install
npm run setup:web
npm run web:clear
```

`npm run setup:web` behaves safely:

- It preserves an existing `.env` file.
- It uses `CAPDENT_ENV_SOURCE` when an explicit CapDent environment file is supplied.
- It can read a sibling `capdent-mobile\.env` file.
- Otherwise it creates `.env` from `.env.example`.

Required browser variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The legacy anon key is still accepted for compatibility, but the publishable key is preferred.

Optional variables:

```text
EXPO_PUBLIC_AUTH_CALLBACK_URL
EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL
EXPO_PUBLIC_ENABLE_REALTIME
EXPO_PUBLIC_UPLOAD_PROVIDER
EXPO_PUBLIC_UPLOAD_STRICT_R2
```

For local development, authentication automatically uses the active browser origin:

```text
http://localhost:8081/auth/callback
http://localhost:8081/auth/reset-password
```

## Validate the web app

```powershell
npm run typecheck
npm run build:web
```

Or run both:

```powershell
npm run check:web
```

The static output is generated in:

```text
dist
```

## Cloudflare deployment

Use these settings:

```text
Framework preset: None
Build command: npm run build:web
Build output directory: dist
Root directory: /
Node version: 22
```

The deployment currently uses Wrangler to publish the generated `dist` assets. Add public Expo variables in Cloudflare when overriding the safe defaults from `.env.example`.

Add the production URLs to Supabase Authentication → URL Configuration:

```text
https://app.capdent.micirql.com/auth/callback
https://app.capdent.micirql.com/auth/reset-password
```

## Current web scope

- Email/password and Google authentication.
- Clinic-owner and employee signup flows.
- Browser-compatible verification and password-reset links.
- Role-aware owner, doctor, and receptionist dashboards.
- Patient registration, search, profiles, visits, clinical files, appointments, and payments.
- Supabase Realtime updates where enabled.
- CapDent-only splash, favicon, manifest, and installed-app identity.
- Static Cloudflare deployment.

## Testing checklist

Before production use, test:

1. Login, Google login, and logout.
2. New clinic-owner and employee email verification.
3. Forgot-password and reset-password links.
4. Owner, doctor, and receptionist routing.
5. Patient image and document uploads.
6. Browser refresh on nested static routes.
7. Realtime waiting-room updates in two browser windows.
8. Mobile-browser and installed-web-app layouts.
9. CapDent icon and splash after clearing an older installed shortcut.

Browser-specific changes belong in this repository and should not modify the Android project.
