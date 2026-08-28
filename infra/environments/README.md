# Infrastructure environments

Root-module compositions that wire `infra/modules` into isolated
environments with a remote GCS state backend. Never commit state,
credentials, local `*.tfvars`, or `backend.hcl`.

## Staging

`staging/` is the P5-T01 composition plus P5-T03 WIF/deploy wiring
(GitHub issues #70 / #71 / #81).

- Review with `tofu fmt -check` and `tofu validate` (`tofu init -backend=false`).
- Apply to the empty staging GCP project is **P5-T01-B / GitHub issue #71**.
  Follow `docs/runbooks/staging-apply.md`.
- CI deploy, GitHub Environments, and in-project smoke are
  `docs/runbooks/staging-deploy.md` (P5-T03 / #81). CI does not `tofu apply`.
- Public activation stays off (internal Cloud Run ingress, no `allUsers`, no DNS).
- D-020 is not decided (`region` has no default; no object age-delete).
- GCP video fallback modules (GCS HLS / Cloud CDN / Transcoder) are absent.
- Cloud Tasks, Cloud Scheduler, and DNS are deferred.

See `staging/README.md` for review commands and the apply runbook pointer.
