# Native session restoration

Issue #171; P2-T01 and the first Android journey under D-036. Reuse the accepted
Firebase identity architecture. The app must restore its persisted native account
after process restart and refresh expired tokens without treating token rotation
as an account switch.

Before account-dependent routes render, resolve the initial Firebase auth state
after attaching the existing local Auth emulator when appropriate. Restore only
the same current native user, with the initial application revision unchanged.
Initial null, failure or a bounded startup timeout allows anonymous browsing;
late callbacks must not overwrite a subsequent manual sign-in or sign-out.
Keep default analytics consent denied; restoring credentials does not itself
grant consent or emit a new login event.

Manual sign-in, reauthentication and deletion remain authoritative. Do not have
a general token-change listener repeatedly call setAuthSession. Token refresh
must not increment the purchase/account session revision. A native sign-out
invalidates an existing app session and clears consent. A delayed callback cannot
resurrect it. Stop/unmount and React strict-mode remount must not duplicate owners
or leave unresolved startup state.

Device cleanup is idempotent when Firebase confirms there is no current user.
Always call native sign-out: its JavaScript user cache may lag native state. Only
the exact `auth/no-current-user` result with an empty current-user cache counts as
completed cleanup; other failures remain visible and retryable.

Bind native credentials to their native user in ephemeral application memory.
Both initial restoration and native manual AuthOutcome sessions carry this
binding. Do not persist or log it. This prevents a request belonging to account A
from using account B's refreshed token during an SDK account transition.

Wrap only app backend API fetches. A request without Authorization stays
anonymous, including the catalog. For an authenticated request, require its
incoming credential to match the current application session; capture session
revision and owner before any asynchronous work. Refresh via Firebase's normal
token-result flow and require the subject from that same result to match the
captured owner. A JavaScript User object alone does not bind the native SDK token
request to that user. Verify the same native/app owner and revision afterward, and
recheck immediately before the underlying network call, including after App
Check token retrieval. A stale request, account switch, sign-out, token failure
or invalid token sends no network request and exposes only a generic error.
Never add auth to an anonymous request or automatically retry a mutation.

Keep tokens out of new storage, logs and analytics. Preserve request headers,
body, cancellation signal and Request-object behavior. Preserve the existing
mock/Jest native import boundary. No backend contract or native dependency
change is required.

Prove initial user/null/timeout behavior, delayed restoration/session races,
native sign-out, same-owner token refresh, stale-header and changed-owner
rejection, and sign-out during App Check before dispatch. Existing manual login,
deletion and checkout tests must continue passing. Validate app restart with the
generated local test account on the emulator, then independently review and
merge only after required checks pass. Google-account entry and genuine store
purchase evidence remain separate requirements.
