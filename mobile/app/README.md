# Expo Router

Expo Router file-based routes. `index.tsx` is Home and wires the catalog client to
`HomeCatalogScreen`. Series detail lives at `series/[id]`, selected episodes at
`episodes/[id]`, and Google Sign-In at `sign-in`. Home is not a login wall. The
ads-only MVP is Android / Google Play (D-027).

Keep routes thin. Feature UI and data access live under `src/features` and `src/api`.
