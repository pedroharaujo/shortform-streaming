# Mobile source

| Path                                  | Role                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `api/createAppClients.ts`             | Android API clients using the single configured backend URL              |
| `api/context.ts`                      | OpenAPI fetch wrapper and optional Bearer header                         |
| `api/catalog/`                        | Anonymous fixed-market catalog reads                                     |
| `api/playback/`                       | Playback authorization                                                   |
| `api/progress/`                       | Watch progress                                                           |
| `api/rewards/`                        | Reward offers, intents, and status                                       |
| `api/me/`, `api/account/`             | Verified profile, preferences, and deletion                              |
| `auth/`                               | Email/password + Google Jest/native Firebase boundary and session holder |
| `analytics/`                          | Consent-gated launch/auth/playback/reward outcome events                 |
| `localization/`                       | Typed English MVP interface copy and provider                            |
| `ui/`                                 | Semantic visual and accessibility-size tokens                            |
| `features/catalog/`                   | Home, series, and episode screens                                        |
| `features/playback/`                  | Product player                                                           |
| `features/rewards/`                   | AdMob reward flow                                                        |
| `features/auth/`, `features/account/` | Email/password + Google sign-in and account controls                     |

Tests sit beside the modules they cover. API shapes come from the generated
OpenAPI client; do not recreate request or response types by hand.
