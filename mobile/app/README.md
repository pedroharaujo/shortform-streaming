# Expo Router

Expo Router file-based routes. `index.tsx` is Home: it wires the catalog client to
`HomeCatalogScreen`. Series detail lives at `series/[id]`, the non-playback selected
episode at `episodes/[id]`, the P1-T03 health screen at `health`, and isolated
email/password sign-in at `sign-in`. Home is not a login wall.

Keep routes thin. Feature UI and data access live under `src/features` and `src/api`.
