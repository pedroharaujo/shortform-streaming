# Android test coin checkout implementation

**Goal:** Complete the development implementation of the Google Play test
coin-purchase journey under #164 / P3-T03/P3-T04/P3-T06.

**Architecture:** Existing Django verifier and ledger, a bounded fingerprint
recovery endpoint, RevenueCat native adapter, existing session-aware coordinator,
and a wallet-linked coin screen. See the companion approved-scope specification.

**Tech stack:** Django/DRF, generated OpenAPI client, Expo/React Native,
react-native-purchases 10.9.1, Expo SecureStore/Crypto.

## Global constraints

- Production purchases remain disabled. Native checkout requires local Android
  development configuration and verified Google Play license-test setup.
- Server verification alone grants coins; raw provider payloads and order IDs
  are never persisted or logged by application code.
- Unknown attempts remain blocking; exact matched evidence alone resolves them.
- Preserve current account ownership, rights and entitlement checks.
- Work in this checkout on the existing branch; no extra worktrees.

## Tasks

1. Backend recovery: test bounded authenticated owner purchase lookup, exact
   fingerprint matching and existing verifier reuse; implement endpoint and
   regenerate OpenAPI/client. No schema changes. Independent backend agent.
2. Native adapter and public config: install vetted SDK; test identity and
   cancellation projection; default disabled, reject unsafe environments.
3. Coordinator: enable real sandbox API sync, add version-2 fingerprint markers
   and safe compare/update, test restart/account-switch/credit behavior.
4. Coin screen: server pack quantities, store prices, verification/retry/support
   states, return to wallet or selected episode. Preserve purchase history.
5. Validate relevant backend/mobile/contract/config gates and Android native
   build; independently review the combined changes. Record real provider and
   device checks as deferred when unavailable, never as passed.
6. Publish a reviewable PR and update #164 with concrete implementation and
   remaining external setup. Check generated videos separately through normal
   readiness and playback gates.
