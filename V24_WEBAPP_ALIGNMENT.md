# CapDent Web App — v18 → v24 Alignment

## Product boundary

- `app.capdent.in` = daily-use CapDent Web App for owner, head doctor, working doctor and receptionist.
- `capdent.in/portal/` = owner/head-doctor Clinic Admin for analytics, audit, corrections, reports and database administration.
- Android remains in `mkraja826/dms_clinic` and is not modified by this project.
- Web and Android must use the same production Supabase clinic records and RLS model. Do not create a parallel database model.
- Browser UX should preserve CapDent workflows but adapt navigation, layouts, uploads and notifications for desktop/tablet/mobile browser use instead of cloning Android screen-for-screen.

## Baseline

The web app is currently aligned mainly with CapDent v18. Existing scope includes:

- Email/password login
- Google OAuth
- Clinic-owner signup
- Employee signup and invite flow
- Browser auth callback / password reset
- Role-aware dashboards
- Patients, patient profiles and patient registration
- Appointments
- Waiting-room Reschedule and Completed actions
- Visits and clinical files
- Payments / billing
- Staff/profile/settings routes
- Gallery route
- Realtime support where enabled
- Cloudflare Worker deployment at `app.capdent.in`

## Target v24 browser parity

### Milestone 1 — App Login + shell hardening

- Rename the public context to **CapDent App Login / Daily Clinic Workspace** so it is not confused with Clinic Admin.
- Preserve email/password and Google OAuth.
- Preserve clinic-owner and employee onboarding.
- Validate session restore, logout, auth callback, password reset and nested-route refresh.
- Add browser-oriented responsive shell/navigation for owner, doctor and receptionist.
- Keep role and clinic routing driven by the existing Supabase profile.

### Milestone 2 — Daily dashboard parity

- Owner/head doctor: waiting, ongoing, completed, collections, dues, appointments and follow-ups.
- Doctor: assigned/current patients, visits, treatment progress and clinical shortcuts.
- Receptionist: check-in, waiting queue, appointments, patient search and collections.
- Realtime queue refresh between browser windows and Android.
- Respect clinic currency and clinic opening/closing times.

### Milestone 3 — Patient + appointment workflow

- Fast patient search by name, phone and patient code.
- Add patient and edit allowed patient details.
- Patient history timeline.
- Walk-in / appointment check-in.
- Waiting and ongoing state transitions.
- Reschedule with clinic-hour validation.
- Completed flow consistent with Android v24 semantics.

### Milestone 4 — Clinical v24

- Add Visit browser workflow.
- Diagnosis, treatment, notes, sitting/progress and next-appointment data.
- Graphical dental chart.
- Age-aware primary/permanent chart selection using the same rules/data model as Android v24.
- Append clinical chart entries rather than destructively rewriting history.
- Preserve clinic currency in visit billing.

### Milestone 5 — Gallery + files

- Clinic and patient gallery views.
- Before photo, after photo, X-ray, prescription, report and other categories.
- Camera/file upload adapted for browser capabilities.
- Signed private-storage previews.
- Search/filter by patient, phone, file name and file type.
- Reuse the existing production `files` table/storage model.
- Do not permanently delete clinical storage from routine UI.

### Milestone 6 — Payments + invoices

- Record treatment/consultation payments using existing production tables.
- Show invoice total, paid and due consistently with Android.
- Reception workflow stays operational; owner corrections remain primarily in Clinic Admin.
- Respect corrected/void/refund semantics introduced by the owner portal so web totals never count invalid payments as revenue.
- Display clinic currency everywhere.

### Milestone 7 — v24 platform adaptations

- Subscription: read and honor clinic entitlement/status; do not duplicate Android Google Play purchase flows in the browser.
- Notifications: keep Android Expo push-token behavior untouched. Add browser-safe realtime/in-app notification UX first; Web Push can be a separate later milestone.
- Show feature availability based on shared clinic configuration such as tooth chart, patient photos and payment notification settings.

### Milestone 8 — release hardening

- TypeScript clean.
- Expo web export clean.
- Authenticated browser tests for each role.
- Desktop, tablet and mobile-browser responsive tests.
- Nested-route refresh test through Cloudflare SPA fallback.
- Supabase/RLS compatibility test against safe demo clinic only.
- No mutation of BG Reddy Dental Clinic during testing.
- No Android source changes.
- Deploy only after the complete browser release suite passes.

## Release principle

Do not attempt one large v18 → v24 rewrite. Ship each milestone through an isolated PR, validate shared Supabase compatibility, and keep `main` deployable after every merge.
