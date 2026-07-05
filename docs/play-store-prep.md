# Play Store Preparation Guide

This file prepares the DMS app for Google Play internal testing and later production release.

## App listing draft

### App name

Dental Clinic Management System

Use the clinic/company brand name if you decide to release it under a branded product name.

### Short description

Mobile-first dental clinic app for patient visits, payments, prescriptions, X-rays, follow-ups, and staff workflow.

### Full description

Dental Clinic Management System is built for small and growing dental clinics that need a simple mobile-first workflow.

The app helps clinic teams manage daily patient check-ins, OP fee collection, doctor visit entries, prescription and X-ray uploads, pending payments, follow-up appointments, WhatsApp reminders, staff access, and owner-level revenue visibility.

The workflow is designed for real clinics:

- Receptionist registers or searches patients
- OP fee is collected during check-in
- Patient is sent to the doctor queue
- Doctor adds the visit and marks queue complete
- Prescription, X-ray, and before/after photos can be uploaded
- Follow-ups can be booked inside clinic time slots
- Pending payments and daily billing can be reviewed
- Owner can monitor revenue, staff, and clinic activity

This app is intended for clinic operations and record management. It does not provide medical diagnosis, medical advice, or emergency healthcare service.

## Suggested Play Store category

Medical or Productivity.

Use Medical only if the Play Console requirements are satisfied. Productivity may be simpler for early internal testing.

## Screenshots needed

Capture Android screenshots for:

1. Login screen
2. Owner dashboard
3. Reception quick check-in
4. Patient search
5. Patient profile
6. Add visit
7. Upload prescription/X-ray
8. Billing/pending payments
9. Appointments/follow-ups
10. Staff management

## Data safety notes

The app may collect or store:

- Name
- Phone number
- Age
- Clinic visit details
- Dental treatment notes
- Payment records
- Prescription images
- X-ray images
- Appointment details
- Staff account information

The app should not sell user data.

The app should explain that patient data is used only for clinic management and record keeping.

## Internal testing steps

1. Confirm TypeScript passes.
2. Confirm Expo Go pilot QA passes.
3. Create preview/internal test build only after final approval.
4. Upload app bundle to Play Console internal testing.
5. Add test users.
6. Test install from Play Store link.
7. Test login, session restore, clinic workflow, uploads, payments, reminders, and staff roles.

## Release warning

Do not publish to production until:

- Clinic pilot is stable
- Privacy policy URL is live
- Data safety form is accurate
- Real patient data handling is approved by the clinic owner
- Backup/export process is decided
