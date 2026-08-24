# Expo Router

Expo Router file-based routes. `index.tsx` is Home: it wires the catalog client to
`HomeCatalogScreen`. Series detail lives at `series/[id]`, the non-playback selected
episode at `episodes/[id]`, and the P1-T03 health screen at `health`.

Keep routes thin. Feature UI and data access live under `src/features` and `src/api`.
