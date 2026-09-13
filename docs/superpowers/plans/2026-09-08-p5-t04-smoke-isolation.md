# P5-T04 / #101 smoke isolation implementation

Scope and acceptance: [design](../specs/2026-09-08-p5-t04-smoke-isolation.md).
Use this checkout and the root task's branch; no worktrees, commits or cloud
operations from the implementer. Other issue work may be dirty concurrently.

1. Reproduce unnecessary secret injection with mocked OpenTofu plans.
2. Add the default-compatible no-Django module option and dedicated smoke IAM.
3. Verify default/Bunny configuration, module opt-out, IAM boundaries and runtime
   identity collision rejection. Update deployment and rotation runbooks.
4. Hand the owned diff to the root task for independent review and PR handling.

## Evidence (2026-09-08)

Failing-first run: default smoke had two secret references; Bunny smoke had four.
The new zero-secret assertions failed with `7 passed, 2 failed` before the fix.

OpenTofu 1.11.14 and locked Google provider 6.50.0. Commands requiring provider
execution used a new temporary data directory, in PowerShell:

```powershell
$env:TF_DATA_DIR = Join-Path $env:TEMP 'shortform-smoke-tofu-20260908'
tofu -chdir=infra/environments/staging init -backend=false -input=false -lockfile=readonly
tofu -chdir=infra/environments/staging validate -no-color
tofu -chdir=infra/environments/staging test -no-color
```

Initialization and validation passed; all 11 mocked runs passed. No live plan or
apply was run. The first documented init command without a fresh data directory
attempted to reuse a previously initialized remote backend; sandbox network
restrictions denied that attempt and no remote state was returned. Subsequent
checks used only the fresh temporary cache. Runbooks now warn against reusing
the live backend cache for credential-free checks.

Additional checks:

- `tofu fmt -check -recursive infra`: passed.
- `python -m unittest discover -s tests/repository -p test_deploy_trust.py`:
  15 tests passed.
- `python scripts/check_repository_foundation.py`: passed, including the secret
  scanner, all 51 repository tests and AI governance validation.
- `python scripts/validate_ai_governance.py`: passed.
- `git diff --check` restricted to the owned files: passed.

The scanner initially flagged the literal assignment of a Secret Manager name
as a potential value. Retaining the existing `format("%s", "django-secret-key")`
name-expression convention resolved that false positive without weakening the
scanner or adding an exemption. No usable secret was involved.

The root reviewer independently inspected tests, IAM, module behavior and runbooks;
reran all 11 mocked OpenTofu tests and the repository foundation gate successfully.
No blocking local correctness, security or compatibility finding remained. The live
effective-IAM, deployed-template, old execution drain and candidate smoke / failed
smoke checks remain open; they are not covered by D-029. No complete #101 rotation
claim follows from these local tests. See the updated rotation runbook for the
remaining consumer isolation, version authorization, overlap and revocation gates.
