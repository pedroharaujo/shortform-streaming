# Mobile source

Strict TypeScript sources for the Expo app.

| Path                      | Role                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `api/createAppClients.ts` | Android app clients: catalog, playback, progress, me, health. Routes should use this file. |
| `api/context.ts`          | `X-Territory` / `X-Platform` / `X-Language` and the OpenAPI fetch wrapper                  |
| `api/catalog/`            | Anonymous catalog reads                                                                    |
| `api/playback/`           | Playback authorize                                                                         |
| `api/progress/`           | Watch progress                                                                             |
| `api/me/`                 | Authenticated `GET /v1/me`; Bearer ID token only                                           |
| `api/health/`             | `GET /health/live` and `GET /health/ready`                                                 |
| `auth/`                   | Jest mock vs native Firebase Auth + Google on Android                                      |
| `config/`                 | Environment selection and Expo manifest reads                                              |
| `features/catalog/`       | Home, series detail, episode-selected screens                                              |
| `features/auth/`          | Sign-in screen (email/password and Google)                                                 |
| `features/playback/`      | Product player and isolated HLS spike                                                      |
| `features/health/`        | Backend availability screen                                                                |

Tests sit next to the modules they cover (`*.test.ts` / `*.test.tsx`). Shared screen helpers live in `testUtils.tsx`.
