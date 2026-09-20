# Shortform Streaming: MVP privacy notice

**DRAFT — NOT AN EFFECTIVE OR APPROVED STORE PRIVACY POLICY.** This publicly
reviewable document describes the current coin-only Android MVP implementation
as of 20 September 2026. It is not a statement that the app is live or legally
approved. Items marked **Proposed** require review before this notice is
activated or submitted to Google Play.

**Operator:** Pedro Henrique Araujo Pinto, acting as an individual

**Privacy contact:** [pharaujo1094@gmail.com](mailto:pharaujo1094@gmail.com)

**Effective date:** to be set when the final notice is approved and published

## What the service does

Shortform Streaming is an Android app for browsing and watching short-form
series. People may browse and watch eligible free episodes without an account.
An account is required to buy coins, use coins to unlock episodes, and sync
progress and access across devices. The MVP does not show advertising or offer
rewarded-ad unlocks.

## Information we handle

- **Account and sign-in information.** Firebase Authentication handles the
  information used for email/password or Google sign-in. Our server receives a
  Firebase account identifier and stores it with an opaque profile identifier,
  account timestamps, English-language setting, optional country, and privacy
  preferences. Our application database does not store the sign-in email or
  password.
- **Viewing and access information.** We store the series and episode involved,
  playback position, completion state, timestamps, and episode entitlements.
  Guest progress is stored on the server and linked to a random app-generated
  identifier stored on the device; signed-in progress and entitlements are linked
  to the account. Clearing device storage alone does not erase server history.
- **Coin and purchase information.** Google Play and RevenueCat handle the store
  purchase flow. We process product and application identifiers, opaque purchase
  and transaction references or fingerprints, purchase status and reason,
  coins credited or spent, wallet and unlock references, episode reference,
  applicable offer version, and timestamps. We do not receive or store the
  full payment-card number. The server, rather than the app, decides coin
  balances and unlocks.
- **Analytics information.** If analytics is enabled and the user has opted in,
  Firebase Analytics can receive app opens, sign-up or login method, playback
  and completion events, lock and playback error events, app version/build,
  Android platform, language, optional country, event time, random session
  identifier, and opaque series, episode and account identifiers. Turning the
  preference off disables collection, clears the analytics user identifier and
  resets Firebase Analytics data held on the device. This does not claim to
  erase events already held by Google. Advertising analytics events remain
  dormant in the coin-only MVP.
- **Security, device and technical information.** The code supports Firebase App
  Check, but enforcement is currently disabled pending release verification; it
  must not be described as active protection until enabled and tested. Our
  service and its providers may
  process network and request information needed to connect, secure the service,
  diagnose errors and deliver video, such as IP address, request time and
  technical identifiers. The app stores a random guest identifier and pending
  purchase or unlock references in encrypted device storage. These references
  help recover an interrupted operation and do not contain a card number.
- **Support and privacy requests.** If a user emails us, Gmail processes the
  sender and recipient addresses, message headers, content, time and any
  attachment the user chooses to send. The app opens only an editable email
  draft after the user asks it to; it does not automatically attach credentials,
  receipts, account identifiers or diagnostics. A user may include an opaque
  support reference already shown on screen.

## Why we use information

The current purposes are to create and secure accounts; provide eligible video;
save progress; verify purchases; maintain the authoritative coin balance;
prevent duplicate credits or charges; grant and restore episode access; answer
support and privacy requests; detect abuse; maintain service reliability; and,
only after opt-in, understand use of the app.

**Proposed legal bases for review:** performance of the user contract for
accounts, playback, progress, purchases, coins and support needed to provide the
service; consent for optional Firebase Analytics; compliance with legal
obligations where a record must be kept; and the operator's legitimate interests
in service security, fraud prevention, reliable accounting and defending legal
claims. The final mapping, necessity assessment, balancing test and any
age-related consent requirements have not been approved. Declining optional
analytics does not prevent account, playback or coin features.

## Providers, recipients and international transfers

Information is available only to the operator and service providers that need
it for the purposes above, subject to appropriate access controls. The current
implementation can involve:

- Google Firebase for authentication, App Check and opted-in analytics;
- Google Play for Android distribution and coin purchases;
- RevenueCat for purchase validation and lifecycle information;
- Bunny Stream for token-protected video delivery; and
- Google Gmail for messages sent to the public support/privacy inbox.

The production database/hosting provider, public notice host, provider roles,
processing locations and contractual transfer safeguards are not yet approved.
Some providers may process information outside France or the European Economic
Area. No EU-only processing or particular transfer mechanism is promised by
this draft. We do not sell personal information. We may disclose information
when required by law or to protect users and the service, subject to legal
review.

## Retention and account deletion

The founder approved [discretionary retention defaults](MVP_RETENTION_DECISION.md)
on 2026-09-20: routine support mail for 12 months after closure, routine logs for
six months, backups for 35 days and opted-in analytics for 14 months from
collection, plus the account, guest-progress and deletion-receipt rules in that
decision. These are implementation targets, not verified current behavior or
an effective public retention promise. Provider lifecycles, financial-record
periods and applicable legal grounds still require confirmation before launch.

The in-app deletion flow requires recent reauthentication. It deletes the local
profile, signed-in watch progress and episode entitlements, and requests deletion
of the Firebase authentication user. If Firebase cleanup is temporarily
unavailable, the request remains pending for retry. A deletion receipt retains a
pseudonymous fingerprint and operational status; the raw Firebase identifier is
erased after provider cleanup completes.

Coin wallets, immutable ledger entries, purchase decisions/events and unlock or
cancellation receipts are currently detached from the profile rather than
deleted. They retain opaque identifiers and accounting facts but no copied
Firebase identifier. They remain restricted personal/accounting data and are
not claimed to be anonymous. The lawful grounds, exact fields, access rules and
retention period for this history are unresolved. Provider-side deletion and
retention for Google Play, RevenueCat, Firebase, Bunny and Gmail must also be
confirmed. Guest progress is separate from account deletion and requires a
documented deletion path before publication.

Google Play requires an in-app deletion path and a working external web resource
where a user can request deletion. The external resource and its final URL do
not yet exist and remain a release blocker.

## Choices and rights

Users can use eligible free content without an account, decide whether to create
an account, and turn optional analytics on or off. Purchase and coin features
require an account. Support email is optional, although we may need enough
information to identify and answer a request.

Depending on applicable law, users may request access, correction, deletion,
restriction or portability of their information, or object to processing. They
may withdraw consent for optional analytics at any time without affecting prior
processing. Email [pharaujo1094@gmail.com](mailto:pharaujo1094@gmail.com) to make
a request. Do not put personal or purchase information in a public GitHub issue.
Users may also complain to the [French data protection authority, the
CNIL](https://www.cnil.fr/fr/plaintes), or another competent authority.

## Security and changes

The implementation uses authenticated requests, encrypted transport outside
local development, restricted opaque references, short-lived playback
authorization and server-side purchase and entitlement checks. App Check
enforcement is implemented but currently disabled pending verification. No
system can promise absolute security.

The final notice must show its effective date and be updated when the purposes,
data, providers, recipients, transfers, retention, rights process or app
features materially change. Google Play also requires the published notice and
Data safety answers to match the exact released app and its SDK behavior.

## Drafting sources

This draft follows the transparency topics described by the
[CNIL](https://www.cnil.fr/fr/informer-les-personnes) and the
[Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).
Google Play's separate [account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111)
explains the required in-app and external deletion paths. These sources do not
replace legal review of the final service.
