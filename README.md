# DMS

Mobile-first Dental Management System built with React Native, Expo Router, TypeScript, and Supabase.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Create three Supabase Auth users for owner, doctor, and receptionist, then insert matching rows in `profiles` using the commented seed block in `supabase/schema.sql`.
5. Start the app with `npm start` and open it in Expo Go.

## V1 Workflows

- Email/password login and forgot password.
- Role-aware profile loading with clinic-scoped RLS.
- Register patients and store medical history notes.
- Search patients by name or phone.
- View patient profile, visits, treatments, invoices, and files.
- Add consultation notes, treatment cost, and invoice.
- Upload prescription and X-ray files to Supabase Storage.
- Create appointments and update appointment status.
- Add invoices, record payments, and view pending dues.
- Owner can view and create staff profile records.

## Storage

The SQL creates public Supabase Storage buckets:

- `prescriptions`
- `xrays`
- `patient-files`

Files are stored under `clinic_id/patient_id/timestamp-fileName`, and storage policies limit access by the logged-in user's clinic.
