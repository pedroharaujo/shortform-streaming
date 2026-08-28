# Infrastructure environments

Root-module compositions that wire `infra/modules` into isolated
environments with a remote GCS state backend. Never commit state,
credentials, local `*.tfvars`, or `backend.hcl`.

## Staging

`staging/` is the P5-T01-A reviewable composition (GitHub issue #70).

- Review with `tofu fmt -check` and `tofu validate` (`tofu init -backend=false`).
- **Do not apply** in this slice. Apply to an empty staging project is
  **P5-T01-B / GitHub issue #71**.
- Public activation stays off (internal Cloud Run ingress, no `allUsers`, no DNS).
- D-020 is not decided (`region` has no default; no object age-delete).
- GCP video fallback modules (GCS HLS / Cloud CDN / Transcoder) are absent.
- Cloud Tasks, Cloud Scheduler, and DNS are deferred.

See `staging/README.md` for commands and the apply follow-up.
