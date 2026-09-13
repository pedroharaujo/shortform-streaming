# Database certificate authority

P5-T02 / P5-T03: `supabase-ca.crt` is Supabase's public database CA
certificate, not a private key or an application credential. It is copied
into the application image at `/app/backend/certs/supabase-ca.crt`.

Source: the existing project's Database Settings > Download certificate,
which links to [Supabase's certificate](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt).
Downloaded on 2026-09-08. SHA-256:
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.

The private staging database URL selects `sslmode=verify-full` and
`sslrootcert=/app/backend/certs/supabase-ca.crt`. This verifies both the CA
and the pooler's hostname. The certificate is not installed into the
image's global trust store and does not alter other providers' TLS checks.
Follow [Supabase's connection guidance](https://supabase.com/docs/guides/database/psql)
when replacing the public CA and verify a real connection before deployment.

Keep connection URLs, database passwords and private keys in Secret Manager.
