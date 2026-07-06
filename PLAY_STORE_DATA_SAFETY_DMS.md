# DMS Play Console Data Safety Draft

App name: DMS - Dental Management System
Package: com.dms.clinic

Privacy Policy URL:
https://main.dms-legal.pages.dev/privacy.html

Delete Account URL:
https://main.dms-legal.pages.dev/delete-account.html

Terms URL:
https://main.dms-legal.pages.dev/terms.html

## Main Data Safety answers

### Does your app collect or share any of the required user data types?
Yes.

### Is all user data collected by your app encrypted in transit?
Yes.

Reason:
DMS sends data to backend services over secure network connections.

### Do you provide a way for users to request that their data is deleted?
Yes.

In-app path:
Owner Dashboard > Legal & Account > Delete Account & Data

Web URL:
https://main.dms-legal.pages.dev/delete-account.html

### Does your app share user data with third parties?
Recommended answer for current DMS:
No.

Reason:
DMS uses backend/service providers for app functionality. Data is not sold or shared for ads/marketing. If analytics, ads, Firebase Crashlytics, Sentry, or other SDKs are added later, this answer must be reviewed again.

## Data types to declare as collected

### Personal info

1. Name
Collected: Yes
Shared: No
Purpose: App functionality, Account management
Required/Optional: Required where used for clinic/staff/patient records

2. Email address
Collected: Yes
Shared: No
Purpose: App functionality, Account management, Developer communications
Required/Optional: Required for login/account support

3. User IDs
Collected: Yes
Shared: No
Purpose: App functionality, Account management, Fraud prevention/security/compliance
Required/Optional: Required

4. Phone number
Collected: Yes
Shared: No
Purpose: App functionality
Required/Optional: Required/optional depending on clinic workflow, used for patient contact and reminders

5. Other info
Collected: Yes
Shared: No
Purpose: App functionality
Examples: age, role, clinic details, staff role details
Required/Optional: Required/optional depending on workflow

### Health and fitness

1. Health info
Collected: Yes
Shared: No
Purpose: App functionality
Examples: medical history, dental complaints, visit details, prescription details, X-ray related records, treatment/follow-up records
Required/Optional: Required/optional depending on clinic workflow

### Photos and videos

1. Photos
Collected: Yes
Shared: No
Purpose: App functionality
Examples: prescription photos, X-ray photos, dental photos, before/after photos
Required/Optional: Optional

### Files and docs

1. Files and docs
Collected: Yes
Shared: No
Purpose: App functionality
Examples: prescription PDFs, X-ray files, uploaded patient/clinic documents
Required/Optional: Optional

### Financial info

1. Purchase history
Collected: Yes
Shared: No
Purpose: App functionality
Examples: OP fee, treatment charges, medication fee, pending payment records, payment history
Required/Optional: Required/optional depending on billing workflow

2. Other financial info
Collected: Yes
Shared: No
Purpose: App functionality
Examples: pending amount, paid amount, revenue totals, clinic payment records
Required/Optional: Required/optional depending on billing workflow

### App activity

1. Other user-generated content
Collected: Yes
Shared: No
Purpose: App functionality
Examples: visit notes, treatment entries, reminders, appointment notes, clinic workflow records
Required/Optional: Required/optional depending on workflow

2. Other actions
Collected: Yes
Shared: No
Purpose: App functionality, Fraud prevention/security/compliance
Examples: check-in actions, completed visits, staff actions, upload actions, payment collection actions
Required/Optional: Required/optional depending on workflow

## Data types to answer No unless added later

Location:
No.

Messages:
No.

Audio files:
No.

Calendar:
No, because DMS stores appointments inside the app, not the user's device calendar.

Contacts:
No, unless the app imports contacts from the phone contact book.

Web browsing:
No.

App info and performance:
No, unless crash reporting, diagnostics, analytics, or monitoring SDKs are added.

Device or other IDs:
No, unless SDKs are added that collect device IDs, advertising IDs, Firebase installation IDs, or similar identifiers.

## Purposes to select

Use these purposes where available:

- App functionality
- Account management
- Fraud prevention, security, and compliance
- Developer communications, only for email/support/account communication

Do not select unless added later:

- Advertising or marketing
- Personalization
- Analytics

## Notes before submission

1. If Google asks whether data is processed ephemerally, answer No for core DMS records because clinic data is stored.
2. If Google asks whether users can request data deletion, answer Yes.
3. If Google asks whether data is optional or required, account/login data is required. Prescription photos, X-rays, PDFs, and some clinic workflow details are optional because clinics upload them only when needed.
4. If any analytics, ads, crash reporting, or marketing SDK is added later, update this Data Safety form before release.
