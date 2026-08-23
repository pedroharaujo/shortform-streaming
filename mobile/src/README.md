# Mobile source

Strict TypeScript sources for the Expo app.

| Path               | Role                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `api/health/`      | Temporary typed client for `GET /health/live` and `GET /health/ready` (replaced by P1-T04) |
| `config/`          | Environment selection re-export and Expo manifest reads                                    |
| `features/health/` | Backend availability screen and hook                                                       |

Add `components` and `analytics` when those features exist. Tests sit next to the modules they cover (`*.test.ts` / `*.test.tsx`).
