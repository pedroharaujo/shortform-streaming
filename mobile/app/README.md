# Expo Router

Expo Router file-based routes. `index.tsx` is the first screen: it wires the temporary health client to `BackendHealthScreen` so a development build can show local API liveness and readiness.

Keep routes thin. Feature UI and data access live under `src/features` and `src/api`.
