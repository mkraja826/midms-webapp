# DMS Pilot Release Checklist

Use this checklist before moving the dental clinic app from Expo Go testing to a clinic pilot or Play Store internal test.

## 1. Local safety checks

Run from the project root on the `pilot-safe-android-cleanup` branch:

```powershell
git pull origin pilot-safe-android-cleanup
git status
npx tsc --noEmit
```

Expected result:

- Branch is `pilot-safe-android-cleanup`
- Working tree is clean
- TypeScript passes
- No unwanted `.gitignore` changes

## 2. Core clinic workflow QA

Test with a real or test clinic account:

- Login restores session after app close and reopen
- Add patient works
- Search patient works
- Quick check-in works
- OP fee collection works
- Waiting queue updates
- Doctor can open waiting patient
- Doctor can add visit
- Visit history appears in patient profile
- Patient moves from waiting to completed
- Prescription upload works
- X-ray upload works
- Before/after photo upload works
- Gallery opens files correctly
- Pending payment collection works
- Billing tab reflects payment status
- Follow-up booking works
- WhatsApp reminder opens correctly
- Staff invite and staff onboarding work
- Logout and login again work

## 3. Follow-up appointment slots

Allowed follow-up slots in Add Visit:

- 11:00 AM
- 11:30 AM
- 12:00 PM
- 12:30 PM
- 01:00 PM
- 01:30 PM
- 05:00 PM
- 05:30 PM
- 06:00 PM
- 06:30 PM
- 07:00 PM
- 07:30 PM

No other follow-up slots should appear.

## 4. Reception desk speed test

Receptionist should be able to do this flow quickly:

1. Search or add patient
2. Collect OP fee
3. Send patient to doctor queue
4. Open pending payment if needed
5. Book follow-up if doctor asks
6. Send WhatsApp reminder

Record any step that takes too many taps or feels confusing.

## 5. Doctor speed test

Doctor should be able to do this flow quickly:

1. Open waiting queue
2. Select complaint group
3. Add treatment cost only if needed
4. Upload prescription/X-ray/photo later if needed
5. Book follow-up only inside clinic time slots
6. Save visit and complete queue

Record any field the doctor does not want to type.

## 6. Owner/admin review

Owner should verify:

- Today revenue
- Pending amount
- Completed count
- Waiting count
- OP fee collection
- X-ray fee collection
- Medication/treatment fee collection
- Staff list and roles
- Subscription screen wording

## 7. Play Store internal testing preparation

Before creating a Play Store internal test:

- Final app name confirmed
- App icon finalized
- Splash screen finalized
- Privacy policy published on a public URL
- Test login instructions written
- Screenshots captured from Android device
- App category selected
- Data safety answers prepared
- Internal testers added in Play Console

## 8. Pilot rule

During pilot, do not add new features unless a real clinic workflow is blocked.

Fix only:

- Crashes
- Payment mistakes
- Wrong patient history
- Upload failures
- Login/session issues
- Appointment/follow-up issues
- Staff access issues
