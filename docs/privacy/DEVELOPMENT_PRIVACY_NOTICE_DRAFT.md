# Shortform Streaming (Development): privacy notice

**DRAFT — NOT ACTIVE. Do not use this document as the AdMob policy URL yet.**
Completion is deferred to release issue #98 under D-028; this draft does not
block MVP coding or P3-T07 development acceptance.
The operator/contact fields and the publication checks in
`../runbooks/development-privacy-setup.md` must be completed first. This draft
describes a restricted development test, not the planned public app. It is not
a legal compliance certificate.

**Operator responsible for this test:** {{OPERATOR_PUBLIC_NAME}}

**Privacy contact:** {{MONITORED_PRIVACY_CONTACT}}

**Effective date:** {{ACTIVATION_DATE}}

## What this notice covers

Shortform Streaming (Development) is an unpublished Android development app.
This test is operated by the developer on an Android emulator, using a synthetic
Google identity in the local Auth emulator and generated video. It checks whether a completed
rewarded test ad can unlock one episode after server verification. There are no
public participants, payments or live advertising in this test. Do not enter a
real account or invite other people under this notice.

Synthetic accounts do not make every connection anonymous. Consent requests,
test advertisements and video delivery contact external providers.

## Information handled during the test

- **Local account and viewing state:** synthetic Google sign-in is
  handled by a Firebase Authentication emulator on the development computer.
  The local app database holds an account identifier, profile identifier,
  language/country settings, ads/analytics preferences and timestamps. It can
  also store episode progress, linked to an account or a random guest identifier
  saved on the device. The guest identifier is not a hardware serial number.
- **Reward verification:** the app server creates an episode-specific intent
  with random verification references, expiry and test context. The ad SDK sends
  these references to Google; the integration does not use the account's email
  or Firebase identifier as the ad's verification references. A valid callback
  can produce a transaction reference, grant time and episode entitlement.
  Client completion alone cannot unlock the episode.
- **Google consent and ads:** Google receives consent requests and choices.
  Once Google's consent system permits an ad request, the app requests a
  non-personalized test ad with emulator test-device configuration. Google's
  advertising SDK documentation describes network/IP information, ad
  interactions, diagnostics and device/account identifiers. Test mode and
  non-personalized requests are not a promise of zero processing. This notice
  does not claim to have measured every field transmitted by the installed SDK.
- **Video delivery:** Bunny Stream delivers generated media through expiring
  access URLs. Its infrastructure receives the connection and media-request
  information necessary to deliver those requests. Account passwords and
  reward-verification references are not added to video URLs by this app.
- **Callback transport:** ngrok carries Google's signed verification request
  to a restricted local endpoint. It necessarily processes that request in
  transit even when capture is disabled. Request capture and exports are off
  for this test; cloud connection/path/status metadata has separate retention.

No app Firebase Analytics or Crashlytics integration is active in this test.
This does not describe Google's own SDK diagnostics. The app reads whether it
is running on an emulator; its Android dependencies declare advertising-related
permissions. We do not claim the build has no permissions or identifiers.

## Purposes, choices and legal bases

The local state supports the requested playback/unlock experiment and prevents
duplicate or forged rewards. The development proposal relies on the operator's
legitimate interest in testing and securing this functionality, using synthetic
application data and limiting access to the developer. Optional advertising
storage and consent-dependent processing rely on the choices collected through
Google's consent form where consent is required. These bases and the restricted
scope must be confirmed before this draft becomes active; they are not a basis
for collecting data from public testers.

Watching an ad is optional. Declining the reward offer leaves the locked episode
locked; free content remains available subject to eligibility. Use **Do not
consent** or **Manage options** in Google's form. Depending on Google's decision
and applicable settings, refusal may permit limited ads or prevent an ad; it
does not promise that no network request occurs.

Use **Ad privacy choices** to manage Google's consent options. Turning the
account's ads preference off blocks new reward attempts, but does not itself
change Google's consent record. Withdrawing consent does not invalidate earlier
lawful processing. No advertising profile is built by our application code.
Reward eligibility is checked automatically; it affects only the test episode
unlock, not a credit, employment or comparable decision.

## Who receives information and where

Access to the local test database is limited to the developer. External services
used by this experiment are Google UMP/AdMob, Bunny Stream and ngrok. The Google
consent form identifies the configured advertising partners and their purposes;
the absence of mediation does not establish that only Google can receive data.
The actual form and partner list must be reviewed before starting the test.

These providers operate internationally. This setup does not guarantee that all
processing stays in France or the EU. Provider terms describe their transfer
mechanisms and retention practices; the operator must check which apply to this
test before activation. No specific contract, EU-only location or transfer
safeguard is certified by this draft. Opening a repository-hosted copy of this
notice also connects to GitHub under GitHub's privacy terms.

- [Google privacy policy](https://policies.google.com/privacy)
- [How Google uses information from apps using its services](https://policies.google.com/technologies/partner-sites)
- [Bunny privacy and data policy](https://bunny.net/privacy/)
- [ngrok privacy policy](https://ngrok.com/privacy) and [data processing agreement](https://ngrok.com/dpa)
- [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

## Retention and deletion

**Proposed development closeout rule:** keep dedicated local test state only for
conducting and reproducing this validation. Clear it when the test is completed
or abandoned, and no later than seven days after its final attempt. This is a
manual operator procedure, not an existing automatic deletion feature. It covers
the dedicated account/progress/reward database, deletion receipts, emulator
account/device state and any private test exports. Keep only redacted engineering
results, with no account or provider identifiers, in the public repository.

The app's account-deletion action removes the local profile, authenticated
progress, rewards and entitlements. Provider account cleanup can require retries;
a pseudonymous deletion receipt remains, and the identity needed for retries
remains until cleanup succeeds. Guest progress is separate. Account deletion does
not erase provider records or instantly invalidate previously issued video URLs.
The full development closeout procedure covers the remaining local test state.

A reward intent's 15-minute expiry limits redemption; it is not a database
deletion deadline. Stopping the temporary server also does not delete data.
The last verified ngrok configuration retained cloud metadata for one day; this
must be checked again before each session. Google and Bunny retention follows
their applicable service settings and policies, not the local closeout deadline.
We do not promise immediate erasure of every provider copy.

## Your rights and contact

Contact the operator above to request access, correction, erasure, restriction,
objection or portability where applicable, or to raise a privacy question. There
is no working in-app export feature in this development build; requests require
manual handling. Do not post personal information in a public GitHub issue.
You can also [contact or complain to the CNIL](https://www.cnil.fr/fr/plaintes)
or your competent data-protection authority. Before changing this test's scope
or opening the app to others, the operator must update the notice and applicable
privacy controls.
