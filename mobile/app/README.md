# Expo Router

Expo Router file-based routes. `index.tsx` is Home: it wires the catalog client to
`HomeCatalogScreen`. Series detail lives at `series/[id]`, the non-playback selected
episode at `episodes/[id]`, the P1-T03 health screen at `health`, and isolated
email/password sign-in at `sign-in`. Home is not a login wall. Ads-only MVP is
Android / Google Play (D-027); `/sign-in` offers email/password and Google, not Apple.

Keep routes thin. Feature UI and data access live under `src/features` and `src/api`.
