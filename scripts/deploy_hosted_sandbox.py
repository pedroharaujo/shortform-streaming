"""Prepare and verify the opt-in consumer sandbox; never promote traffic here."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from collections.abc import Mapping, Sequence
from pathlib import Path
from urllib.parse import urlsplit

from resolve_cloud_run_candidate import resolve_candidate


def run_gcloud(arguments: Sequence[str]) -> str:
    # A service description contains configuration: only emit normalized fields.
    result = subprocess.run(["gcloud", *arguments], capture_output=True, text=True, check=True)
    return result.stdout


def verify_service(service: dict[str, object]) -> str:
    spec = service["spec"]
    assert isinstance(spec, dict)
    template = spec["template"]
    assert isinstance(template, dict)
    template_spec = template["spec"]
    assert isinstance(template_spec, dict)
    containers = template_spec["containers"]
    assert isinstance(containers, list) and len(containers) == 1
    environment = {row["name"]: row.get("value") for row in containers[0].get("env", [])}
    expected = {
        "DJANGO_SETTINGS_MODULE": "config.settings.hosted_sandbox",
        "COIN_PURCHASE_MODE": "revenuecat_sandbox",
        "COIN_SPENDING_MODE": "revenuecat_sandbox",
        "REVENUECAT_SANDBOX_WEBHOOK_ENABLED": "true",
        "REWARDED_ADS_MODE": "disabled",
        "FIREBASE_AUTH_MODE": "admin",
    }
    if any(environment.get(name) != value for name, value in expected.items()):
        raise ValueError("Hosted sandbox configuration does not match the release contract.")
    status = service["status"]
    assert isinstance(status, dict)
    origin = status["url"]
    # Same validation as tagged URLs; never pass untrusted delimiters to gcloud overrides.
    if not isinstance(origin, str) or not re.fullmatch(
        r"https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.run\.app", origin
    ):
        raise ValueError("Invalid Cloud Run origin.")
    return origin


def is_public(service: dict) -> bool:
    annotations = service.get("metadata", {}).get("annotations", {})
    ingress = annotations.get("run.googleapis.com/ingress")
    public_invocation = annotations.get("run.googleapis.com/invoker-iam-disabled", "false")
    if ingress == "all" and public_invocation == "true":
        return True
    if ingress == "internal" and public_invocation == "false":
        return False
    raise ValueError(
        "Hosted sandbox ingress and invocation policy do not match either approved topology."
    )


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_public_origin(origin: str) -> None:
    """Run on the external CI runner without Google or application credentials."""
    opener = urllib.request.build_opener(NoRedirect)
    checks = (
        ("/health/ready", "GET", (200,)),
        ("/admin/", "GET", (404,)),
        ("/internal/staff-masters/1", "GET", (404,)),
        ("/v1/catalog/home", "GET", (401,)),
        ("/v1/purchases/revenuecat", "POST", (401, 403)),
    )
    for path, method, expected in checks:
        request = urllib.request.Request(
            origin + path,
            method=method,
            data=b"{}" if method == "POST" else None,
            headers={"Content-Type": "application/json"},
        )
        try:
            with opener.open(request, timeout=15) as response:
                status = response.status
                if path == "/health/ready" and json.loads(response.read(128)) != {"status": "ok"}:
                    raise ValueError("Unexpected public readiness response.")
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()
        if status not in expected:
            raise ValueError("Public consumer boundary check failed.")


def prepare(environment: Mapping[str, str]) -> tuple[str, str]:
    service_name = environment["HOSTED_SANDBOX_SERVICE"]
    if service_name == environment["CLOUD_RUN_SERVICE"] or not re.fullmatch(
        r"[a-z][a-z0-9-]{0,47}", service_name
    ):
        raise ValueError("Hosted consumer and private staff services must be distinct.")
    image = environment["IMAGE_DIGEST"]
    if not re.search(r"@sha256:[a-f0-9]{64}$", image):
        raise ValueError("An immutable image digest is required.")
    scope = ["--region=" + environment["GCP_REGION"], "--project=" + environment["GCP_PROJECT_ID"]]
    describe = ["run", "services", "describe", service_name, *scope, "--format=json"]
    current = json.loads(run_gcloud(describe))
    origin = verify_service(current)
    public = is_public(current)
    run_gcloud(
        [
            "run",
            "services",
            "update",
            service_name,
            "--image=" + image,
            "--no-traffic",
            "--tag=candidate",
            *scope,
        ]
    )
    candidate = json.loads(run_gcloud(describe))
    verify_service(candidate)
    if is_public(candidate) != public:
        raise ValueError("Consumer access policy changed during deployment.")
    revision, candidate_url = resolve_candidate(candidate)
    # Same isolated HTTP-only job already updated to IMAGE_DIGEST by the workflow.
    run_gcloud(
        [
            "run",
            "jobs",
            "execute",
            environment["SMOKE_JOB"],
            "--wait",
            *scope,
            "--update-env-vars=SMOKE_BASE_URL="
            + candidate_url
            + ",SMOKE_AUDIENCE="
            + origin
            + ",CHECK_HOSTED_SANDBOX=true,FAIL_SMOKE=false",
        ]
    )
    if public:
        check_public_origin(candidate_url)
    return revision, candidate_url


def main() -> int:
    try:
        revision, url = prepare(os.environ)
        with Path(os.environ["GITHUB_ENV"]).open("a", encoding="utf-8") as output:
            output.write(f"HOSTED_SANDBOX_CANDIDATE={revision}\n")
        print(f"Verified consumer sandbox candidate: {revision} ({urlsplit(url).hostname})")
    except (
        AssertionError,
        KeyError,
        TypeError,
        ValueError,
        OSError,
        subprocess.CalledProcessError,
    ):
        print(
            "Hosted sandbox preparation failed; no sandbox traffic was promoted. "
            "Inspect the scoped Cloud Run job status privately.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
