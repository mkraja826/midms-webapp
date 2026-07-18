# CapDent Web App

Browser and PWA version of CapDent for clinic owners, doctors, and receptionists.

The Android project remains in `mkraja826/dms_clinic`. This repository is reserved for browser-specific development and deployment.

## Local setup

```powershell
cd C:\capdent-web
npm install
npm run setup:web
npm run web:clear
```

`npm run setup:web` behaves safely:

- It preserves an existing `.env` file.
- It automatically copies `C:\dms\.env` when the mobile project is beside this repository.
- Otherwise it creates `.env` from `.env.example` and asks for the missing public Supabase values.

Required variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Optional variables:

```text
EXPO_PUBLIC_AUTH_CALLBACK_URL
EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL
EXPO_PUBLIC_ENABLE_REALTIME
EXPO_PUBLIC_UPLOAD_PROVIDER
EXPO_PUBLIC_UPLOAD_STRICT_R2
```

For local development, authentication automatically uses the current browser origin, for example:

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

## Cloudflare Pages

Use these settings:

```text
Framework preset: None
Build command: npm run build:web
Build output directory: dist
Root directory: /
Node version: 22
```

Add the required Supabase values under Cloudflare Pages → Settings → Environment variables. Expo public variables are embedded during the build, so redeploy after changing them.

Add the production URLs to Supabase Authentication → URL Configuration:

```text
https://YOUR-WEB-DOMAIN/auth/callback
https://YOUR-WEB-DOMAIN/auth/reset-password
```

The repository includes `public/_redirects` so Expo Router routes continue working after browser refreshes.

## Current web scope

- Email and password authentication.
- Browser-compatible verification and password-reset links.
- Role-aware owner, doctor, and receptionist dashboards.
- Patient registration, search, profile, visits, treatments, and files.
- Appointments, waiting queue, invoices, payments, and pending dues.
- Supabase Realtime updates where enabled.
- Static Cloudflare Pages deployment.

## Web-specific testing checklist

Before deployment, test:

1. Login and logout.
2. New owner email verification.
3. Forgot-password link in the browser.
4. Owner, doctor, and receptionist routing.
5. Patient image and document upload.
6. Browser refresh on nested routes.
7. Realtime waiting-room updates in two browser windows.
8. Mobile-browser layout.

Native-only functions should be adapted in this repository without changing the Android source.
