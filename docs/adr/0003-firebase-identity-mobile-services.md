# ADR 0003: Firebase for Identity and Mobile Platform Services

- **Status:** Accepted
- **Date:** 2026-08-23

## Context

The product needs mobile authentication, analytics, crash/performance reporting, remote configuration, experiments, push, and app-attestation signals. Building these systems would delay validation.

## Decision

Use Firebase Authentication, Analytics, Remote Config, A/B Testing, Crashlytics, Performance Monitoring, Cloud Messaging, and App Check. Use native-compatible packages in Expo development builds.

Django verifies Firebase ID tokens and owns profiles and authorization. The mobile app never selects a backend user ID. Firebase analytics is not a financial ledger.

### MVP timing (2026-08-27)

The ADR remains accepted. **MVP-facing:** Authentication, Analytics (typed events), Crashlytics, and App Check. **Deferred to P7:** Cloud Messaging (FCM) and Remote Config A/B Testing. Performance Monitoring may land with the MVP observability slice or wait for P7; it is not a launch blocker.

## Consequences

- Provider configuration must be isolated by environment.
- Consent, privacy declarations, identity linking, and deletion propagation require explicit implementation.
- Firebase outages need safe local defaults and user messaging.
- Native modules mean Expo Go is not a supported development target.

## Reconsider when

Pricing, region, compliance, reliability, or portability requirements exceed the benefits, using the provider boundaries defined in application code.
