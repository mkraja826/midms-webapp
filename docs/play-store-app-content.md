# Play Store App Content Checklist

Use this while filling Play Console App Content before internal testing.

## Privacy policy

Status: Needed before release.

Add a live public URL for the privacy policy. The current draft is in `docs/privacy-policy-draft.md`.

Also keep an in-app privacy help screen available at:

```txt
/settings/privacy
```

## Data Safety form

Declare only what the app actually collects and stores.

For this DMS app, review these categories carefully:

- Personal details
- Contact details
- App account details
- Clinic record details
- Uploaded images and documents
- Payment and billing records
- App activity if analytics are added later
- Device identifiers only if SDKs collect them

## Account removal

Status: Needs final public request URL before release.

For the pilot, the in-app screen says staff can ask the clinic owner or support contact to remove login access.

Before public release, add:

- Support email
- Public request URL
- Clear wording about what can be removed
- Clear wording about what records may remain for clinic record keeping

## App access for reviewers

Prepare reviewer access details:

- Owner test login
- Doctor test login
- Receptionist test login
- Steps to reach main screens
- Notes about email verification or invite code if enabled

## Ads

If there are no ads, declare No Ads.

## Target audience

Recommended pilot target: adult clinic staff.

## Content rating

Complete the questionnaire honestly based on the app content and audience.

## Medical / clinic disclaimer

Add this in store description and policy pages:

```txt
This app is for clinic workflow and record keeping only. It does not provide diagnosis, treatment advice, or emergency service.
```

## Payment declaration

For pilot, keep subscription/payment enforcement informational only.

Before selling digital subscriptions inside the app, review Play billing requirements.

## Permissions

Keep permission wording aligned across app config, privacy policy, and Play Console.

Current expected permissions:

- Camera access for capturing clinic images
- Photo access for selecting existing clinic images/documents
