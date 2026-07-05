# Final Release Readiness

Use this checklist before moving from Expo Go testing to Play Store internal testing.

## Branch

Use `pilot-safe-android-cleanup`.

## Local commands

```powershell
git pull origin pilot-safe-android-cleanup
git status
npx tsc --noEmit
```

Expected:

- Working tree clean
- TypeScript passes
- No unplanned file changes

## App configuration review

Check:

- App name
- Package name
- Version and versionCode
- App icon
- Adaptive icon
- Splash screen
- Camera permission text
- Photo permission text
- Android permissions

## Clinic pilot checklist

Verify:

- Login
- Session restore after app reopen
- Patient creation
- Patient search
- OP fee collection
- Waiting queue
- Add visit
- Visit history
- File upload and gallery
- Pending payment collection
- Follow-up appointment
- Staff roles
- Owner revenue
- Clinic report

## Play Store assets

Prepare:

- App icon 512 x 512
- Feature graphic 1024 x 500
- Phone screenshots
- Privacy policy URL
- Short description
- Full description
- Test login instructions
- Support email
- Data safety answers

## Suggested screenshots

Capture:

1. Login
2. Owner dashboard
3. Clinic report
4. Reception check-in
5. Add visit
6. Patient profile
7. Upload file
8. Billing / pending payments
9. Appointments / reminders
10. Staff management

## Internal test release notes

```txt
Pilot internal test for Dental Clinic Management System. Includes patient check-in, OP fee collection, doctor waiting queue, add visit, prescriptions, X-rays, photo uploads, pending payments, follow-ups, staff access, owner dashboard, and clinic report.
```

## Final recommendation

First release should be Play Store internal testing only.

Public production release should happen only after the pilot clinic uses the app for a few working days without blocker issues.
