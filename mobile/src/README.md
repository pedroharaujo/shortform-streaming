# Mobile source

Strict TypeScript sources for the Expo app.

| Path                | Role                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `api/catalog/`      | Thin catalog wrapper over `@shortform/api-client` (`GET /v1/catalog/home`, series, episodes)     |
| `api/health/`       | Thin health-probe wrapper over `@shortform/api-client` (`GET /health/live`, `GET /health/ready`) |
| `config/`           | Environment selection re-export and Expo manifest reads                                          |
| `features/catalog/` | Home rails, series detail, episode-selected screens, artwork fallback                            |
| `features/health/`  | Backend availability screen and hook                                                             |

Add `components` and `analytics` when those features exist. Tests sit next to the modules they cover (`*.test.ts` / `*.test.tsx`).
