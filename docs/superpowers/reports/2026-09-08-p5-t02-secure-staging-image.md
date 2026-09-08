# P5-T02 / P5-T03 secure staging image evidence

The first real staging image scan failed the existing Trivy HIGH/CRITICAL
gate: 60 Debian system findings and two vulnerable copies vendored inside
the runtime's unused pip installation. The application lockfile already
contained the patched msgpack version. Refreshing Bookworm did not change
the image; a Trixie probe still had 54 system findings without listed fixes.

The replacement uses the official Python 3.14 Alpine 3.24 image, applies the
available libuuid update, and removes unused runtime pip/ensurepip. The
locked application environment and non-root migration/web entrypoints remain.
No scanner exclusions or severity changes were introduced.

The same container also includes Supabase's public CA certificate so the
approved private staging login can use hostname-verified TLS. The database
URL and both new credentials are stored only in staging Secret Manager.
This is a container prerequisite for the live checks in PR #146 / issue #101;
it does not complete secret rotation or authorize production activation.

## Validation

- `docker build -f backend/Dockerfile -t shortform-backend:pr146-secure .`
  passed, including collectstatic. Validated image digest:
  `sha256:ecfc43c59e925d4624cb84d2c1654c0c3c5929d28d0666765f4168d8aa19c846`.
- Trivy 0.70.0, `image --input <exported-image> --severity HIGH,CRITICAL
  --exit-code 1 --no-progress --format json`: exit 0, zero vulnerability
  findings and zero secrets. The scan used an exported image and a dedicated
  cache, with no Docker control-socket access. Alpine 3.24 was absent from
  the scanner's embedded EOL list; its Alpine vulnerability repository was
  successfully scanned. No unsupported-scan result was counted as a pass.
- All 491 backend tests passed with zero skips in a test-only layer built
  from the exact image, adding locked development dependencies. PostgreSQL
  17.6 used a temporary local internal Docker network and generated fixtures.
- Production entrypoints passed: migrate completes; Gunicorn serves exact
  live/ready JSON, Admin login HTML and Admin CSS. PostgreSQL stop returns
  ready 503 / live 200; restart returns ready 200. SIGTERM exits cleanly in
  0.803 seconds. The outage drill used a stable local hostname mapping:
  DNS-failure timing was not proven.
- `python -m unittest discover -s tests/repository -p test_foundation.py`:
  all four container/repository contract tests passed. The full repository
  foundation subsequently passed all 51 tests, safety scan and governance.
- The actual Cloud Run migration execution `shortform-migrate-nwhb5` passed
  using the same scanned image, numeric vault references and restricted
  private-schema login. Post-check: 37 private application tables, zero public
  tables, and no schema access for anon/authenticated/authenticator.
- Independent review found no blocking security issue. The Compose image
  selector was corrected so inspection, migration and web checks select the
  same image instead of accidentally checking a stale default tag.

## Limits

Alpine uses musl rather than glibc. Native imports and the complete backend
suite passed; Google CRC32C uses its Python fallback, with unmeasured
performance impact. Client-to-Supabase-pooler TLS was verified with the
bundled CA and `verify-full`; this does not assert TLS on Supabase's separate
managed internal pooler-to-Postgres connection.

These are local and explicitly authorized staging results, not evidence of
the GitHub deployment workflow, live purchases/video/providers, secret
rotation, mobile-device acceptance or production readiness.
