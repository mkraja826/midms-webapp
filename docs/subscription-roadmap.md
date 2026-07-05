# Subscription and Paid Version Roadmap

This roadmap prepares the DMS app for a future paid clinic version without forcing payment logic into the current pilot.

## Current pilot rule

Do not block the pilot clinic with payment enforcement yet.

First priority:

- Stable clinic workflow
- Fast reception workflow
- Fast doctor workflow
- Reliable uploads
- Reliable billing records
- Reliable follow-up reminders

## Proposed pricing model

### Free trial

- First 3 months free trial for pilot clinics
- No payment enforcement during trial
- Let clinics build patient history and workflow dependency

### Free usage tier

- First 100 visits per month free

### Basic plan

- ₹799 per month after trial
- Good for small clinics
- Can include up to a defined visit limit later

### Visit-based option

- ₹20 per completed patient visit after free quota
- Use only after clinic workflow is stable and usage tracking is reliable

## What must exist before enforcing subscription

Before any payment enforcement:

1. Clinic usage tracking is accurate
2. Owner can see monthly visit count
3. Grace period exists
4. Clinic data is never locked suddenly
5. Export option exists
6. Support contact is visible
7. Payment gateway is legally set up
8. Refund/cancellation policy is written
9. Privacy policy is published
10. Terms of service is written

## Suggested subscription screen states

### Trial active

Show:

- Trial active
- Days remaining
- Monthly usage count
- Upgrade button optional

### Active subscription

Show:

- Current plan
- Renewal date
- Monthly visits
- Payment status

### Grace period

Show:

- Payment pending
- Grace days remaining
- Contact support
- Keep app usable for clinic safety

### Expired

Avoid blocking patient records immediately.

Allow:

- View patient history
- Export data
- Contact support

Restrict only new activity after a reasonable grace period.

## Payment gateway later

Possible India-friendly payment options:

- Razorpay
- PhonePe payment gateway
- Cashfree
- Manual UPI for early pilot

For early clinics, manual UPI + admin approval may be simpler than full automation.

## Legal/business notes

Before paid launch:

- Confirm business/company name
- Confirm invoice format
- Confirm GST requirements if applicable
- Confirm support email
- Publish privacy policy
- Publish terms and refund policy

## Implementation phases

### Phase 1: Pilot only

- Subscription screen is informational
- No enforcement
- Manual clinic approval

### Phase 2: Usage tracking

- Count monthly completed visits
- Show usage in owner dashboard
- Alert when usage crosses free tier

### Phase 3: Manual billing

- Owner sees amount due
- Manual UPI payment
- Admin marks clinic as active

### Phase 4: Automated billing

- Payment gateway integration
- Receipts
- Subscription renewal
- Grace period automation

## Important safety rule

Never block emergency access to patient history because of payment. At minimum, allow view/export/contact support even if subscription expires.
