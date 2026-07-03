# Staff Invite Email Setup

The app now creates a staff invite and calls a Supabase Edge Function named `send-staff-invite-email`.

## 1. Deploy the Edge Function

```powershell
npx.cmd supabase functions deploy send-staff-invite-email
```

If Supabase CLI is not linked yet:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Add Email Secrets

This function uses Resend.

```powershell
npx.cmd supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
npx.cmd supabase secrets set INVITE_FROM_EMAIL="DMS <onboarding@yourdomain.com>"
npx.cmd supabase secrets set APP_NAME="DMS"
npx.cmd supabase secrets set APP_URL="Download/open the DMS app"
```

For quick testing, Resend allows `onboarding@resend.dev`, but production should use a verified domain.

## 3. Test

1. Log in as clinic owner.
2. Open Staff Management.
3. Add staff with name, email, and role.
4. The invite row is saved and an email is sent.

If email fails, the invite remains saved and the app shows the provider error.
