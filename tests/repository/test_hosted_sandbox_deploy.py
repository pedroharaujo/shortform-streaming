from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
    "hosted_deploy", ROOT / "scripts/deploy_hosted_sandbox.py"
)
assert SPEC and SPEC.loader
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)

ENVIRONMENT = {
    "HOSTED_SANDBOX_SERVICE": "example-consumer",
    "CLOUD_RUN_SERVICE": "example-private",
    "IMAGE_DIGEST": "example.invalid/backend@sha256:" + "a" * 64,
    "GCP_REGION": "europe-west9",
    "GCP_PROJECT_ID": "example-only",
    "SMOKE_JOB": "example-smoke",
}


def service() -> dict:
    return {
        "metadata": {"annotations": {"run.googleapis.com/ingress": "internal"}},
        "spec": {
            "template": {
                "spec": {
                    "containers": [
                        {
                            "env": [
                                {"name": name, "value": value}
                                for name, value in {
                                    "DJANGO_SETTINGS_MODULE": "config.settings.hosted_sandbox",
                                    "COIN_PURCHASE_MODE": "revenuecat_sandbox",
                                    "COIN_SPENDING_MODE": "revenuecat_sandbox",
                                    "REVENUECAT_SANDBOX_WEBHOOK_ENABLED": "true",
                                    "REWARDED_ADS_MODE": "disabled",
                                    "FIREBASE_AUTH_MODE": "admin",
                                }.items()
                            ]
                        }
                    ]
                }
            }
        },
        "status": {
            "url": "https://example-consumer.run.app",
            "traffic": [
                {"revisionName": "example-old-001", "percent": 100},
                {
                    "revisionName": "example-candidate-002",
                    "tag": "candidate",
                    "url": "https://candidate-example.run.app",
                },
            ],
        },
    }


class HostedSandboxDeploymentTests(unittest.TestCase):
    def test_public_candidate_requires_external_anonymous_check(self) -> None:
        description = service()
        description["metadata"]["annotations"] = {
            "run.googleapis.com/ingress": "all",
            "run.googleapis.com/invoker-iam-disabled": "true",
        }
        with (
            patch.object(
                DEPLOY,
                "run_gcloud",
                side_effect=[json.dumps(description), "", json.dumps(description), ""],
            ),
            patch.object(
                DEPLOY, "check_public_origin", side_effect=ValueError("inaccessible")
            ) as check,
        ):
            with self.assertRaisesRegex(ValueError, "inaccessible"):
                DEPLOY.prepare(ENVIRONMENT)
            check.assert_called_once_with("https://candidate-example.run.app")

    def test_verifies_contract_and_checks_candidate_without_promoting(self) -> None:
        with patch.object(
            DEPLOY, "run_gcloud", side_effect=[json.dumps(service()), "", json.dumps(service()), ""]
        ) as call:
            revision, _ = DEPLOY.prepare(ENVIRONMENT)
        self.assertEqual(revision, "example-candidate-002")
        commands = [args.args[0] for args in call.call_args_list]
        self.assertIn("--no-traffic", commands[1])
        self.assertIn("--wait", commands[3])
        self.assertIn("CHECK_HOSTED_SANDBOX=true", commands[3][-1])
        self.assertFalse(any("update-traffic" in command for command in commands))

    def test_failed_boundary_check_does_not_return_a_promotable_candidate(self) -> None:
        with patch.object(
            DEPLOY,
            "run_gcloud",
            side_effect=[
                json.dumps(service()),
                "",
                json.dumps(service()),
                subprocess.CalledProcessError(1, "gcloud"),
            ],
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                DEPLOY.prepare(ENVIRONMENT)

    def test_wrong_service_or_unsafe_runtime_is_rejected_before_update(self) -> None:
        with patch.object(DEPLOY, "run_gcloud") as call:
            with self.assertRaises(ValueError):
                DEPLOY.prepare(
                    {**ENVIRONMENT, "HOSTED_SANDBOX_SERVICE": ENVIRONMENT["CLOUD_RUN_SERVICE"]}
                )
            call.assert_not_called()
        description = service()
        description["spec"]["template"]["spec"]["containers"][0]["env"][0]["value"] = (
            "config.settings.local"
        )
        with patch.object(DEPLOY, "run_gcloud", return_value=json.dumps(description)) as call:
            with self.assertRaises(ValueError):
                DEPLOY.prepare(ENVIRONMENT)
            self.assertEqual(call.call_count, 1)

    def test_workflow_promotes_only_after_both_services_have_passed_checks(self) -> None:
        workflow = (ROOT / ".github/workflows/deploy-staging.yml").read_text()
        check = workflow.index("- name: Prepare and check hosted sandbox candidate")
        self.assertLess(workflow.index("- name: Update and execute smoke job"), check)
        self.assertLess(check, workflow.index("- name: Promote revision"))
        self.assertLess(check, workflow.index("- name: Promote hosted sandbox revision"))

    def test_smoke_probes_staff_and_callback_without_application_credentials(self) -> None:
        source = (ROOT / "infra/environments/staging/main.tf").read_text()
        script = source.split("smoke_script = <<-PY\n", 1)[1].split("\nPY", 1)[0]
        requests = []

        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def read(self):
                return b"synthetic-identity-token"

        def request_result(request, **kwargs):
            from urllib.error import HTTPError

            requests.append(request)
            if "/admin/" in request.full_url or "/internal/" in request.full_url:
                raise HTTPError(request.full_url, 404, "Not Found", {}, None)
            if "/v1/purchases/revenuecat" in request.full_url:
                self.assertEqual(request.get_header("Content-type"), "application/json")
                self.assertIsNone(request.get_header("Authorization"))
                self.assertEqual(request.get_method(), "POST")
                raise HTTPError(request.full_url, 403, "Forbidden", {}, None)
            return Response()

        with (
            patch.dict(
                "os.environ",
                {
                    "SMOKE_AUDIENCE": "https://example.run.app",
                    "SMOKE_BASE_URL": "https://candidate.run.app",
                    "CHECK_HOSTED_SANDBOX": "true",
                    "FAIL_SMOKE": "false",
                },
            ),
            patch("urllib.request.urlopen", side_effect=request_result),
        ):
            exec(compile(script, "synthetic-smoke", "exec"), {})
        self.assertEqual(len(requests), 6)


if __name__ == "__main__":
    unittest.main()
