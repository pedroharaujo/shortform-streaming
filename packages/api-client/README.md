# @shortform/api-client

Fetch-based TypeScript client generated from `docs/api/openapi.yaml`.

## Do not edit generated output

`src/generated/` is produced by `pnpm contract:generate` (OpenAPI from Django, then `openapi-typescript`). Never edit those files by hand. Change Django views, serializers, or `backend/config/spectacular.py`, then regenerate.

Hand-maintained surface is only `src/index.ts`, which wraps `openapi-fetch` for React Native.

## Regenerate

From the repository root:

```shell
pnpm contract:generate
```

Or separately:

```shell
pnpm contract:generate:schema
pnpm contract:generate:client
```

`pnpm contract:check` regenerates and fails if git reports a diff or untracked generated files.

## Usage

```ts
import { createApiClient } from '@shortform/api-client';

const api = createApiClient({ baseUrl: 'http://127.0.0.1:8000' });
const { data, error, response } = await api.GET('/health/live');
```
