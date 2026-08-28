from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

STAGING_WORKFLOW = ROOT / ".github/workflows/deploy-staging.yml"
PRODUCTION_WORKFLOW = ROOT / ".github/workflows/deploy-production.yml"
STAGING_MAIN = ROOT / "infra/environments/staging/main.tf"
STAGING_IAM = ROOT / "infra/environments/staging/iam.tf"
STAGING_VARS = ROOT / "infra/environments/staging/variables.tf"
STAGING_OUTPUTS = ROOT / "infra/environments/staging/outputs.tf"
STAGING_EXAMPLE = ROOT / "infra/environments/staging/staging.tfvars.example"
WIF_MAIN = ROOT / "infra/modules/github_wif/main.tf"
CLOUD_RUN_MAIN = ROOT / "infra/modules/cloud_run/main.tf"
CLOUD_RUN_VARS = ROOT / "infra/modules/cloud_run/variables.tf"
CLOUD_RUN_JOB_MAIN = ROOT / "infra/modules/cloud_run_job/main.tf"
CLOUD_RUN_JOB_VARS = ROOT / "infra/modules/cloud_run_job/variables.tf"

PINNED_ACTIONS = (
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    "google-github-actions/auth@c200f3691d83b41bf9bbd8638997a462592937ed # v2.1.13",
    "google-github-actions/setup-gcloud@e427ad8a34f8676edf47cf7d7925499adf3eb74f # v2.2.1",
    "aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0",
)

REQUIRED_EMPTY_VARS = (
    "WIF_PROVIDER",
    "WIF_SERVICE_ACCOUNT",
    "GCP_PROJECT_ID",
    "GCP_REGION",
    "ARTIFACT_REGISTRY_REPOSITORY",
    "CLOUD_RUN_SERVICE",
    "MIGRATE_JOB",
    "SMOKE_JOB",
)

DEPLOY_STEP_NAMES = (
    "Check out repository",
    "Fail closed when required vars are empty",
    "Authenticate to Google Cloud",
    "Set up gcloud",
    "Build image",
    "Scan image with Trivy",
    "Configure Artifact Registry docker auth",
    "Push image digest",
    "Update and execute migrate job",
    "Update Cloud Run service with no traffic",
    "Execute smoke job",
    "Promote revision",
)

FORBIDDEN_DEPLOY_ROLES = (
    "roles/owner",
    "roles/editor",
    "roles/iam.securityAdmin",
    "roles/secretmanager.admin",
    "roles/storage.admin",
)

REAL_REPO = "pedroharaujo/shortform-streaming"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _on_section(workflow: str) -> str:
    match = re.search(r"(?ms)^on:\n(.*?)(?=^permissions:)", workflow)
    if match is None:
        raise AssertionError("workflow is missing an on: block before permissions:")
    return match.group(1)


def _header_and_jobs(workflow: str) -> tuple[str, str]:
    parts = workflow.split("\njobs:\n", 1)
    if len(parts) != 2:
        raise AssertionError("workflow is missing a jobs: block")
    return parts[0], parts[1]


def _step_names(workflow: str) -> list[str]:
    return re.findall(r"^\s+- name: (.+?)\s*$", workflow, re.MULTILINE)


def _step_body(workflow: str, name: str) -> str:
    pattern = rf"(?ms)^\s+- name: {re.escape(name)}\n(.*?)(?=^\s+- name: |\Z)"
    match = re.search(pattern, workflow)
    if match is None:
        raise AssertionError(f"missing step {name!r}")
    return match.group(1)


def _infra_tf_texts() -> dict[Path, str]:
    return {path: path.read_text(encoding="utf-8") for path in sorted(ROOT.glob("infra/**/*.tf"))}


def _concat(*paths: Path) -> str:
    return "\n".join(_read(path) for path in paths if path.is_file())


class DeployTrustTests(unittest.TestCase):
    def test_deploy_workflows_exist_and_share_trust_rails(self) -> None:
        for path in (STAGING_WORKFLOW, PRODUCTION_WORKFLOW):
            with self.subTest(path=str(path.relative_to(ROOT))):
                self.assertTrue(path.is_file(), msg=path)
                workflow = _read(path)
                header, jobs = _header_and_jobs(workflow)
                on_section = _on_section(workflow)

                self.assertIn("permissions:\n  contents: read", header)
                self.assertNotIn("id-token", header)
                self.assertIn("contents: read", jobs)
                self.assertIn("id-token: write", jobs)
                self.assertNotIn("pull_request_target", workflow)
                self.assertNotIn("workflow_call", workflow)
                self.assertNotRegex(on_section, r"(?m)^\s+pull_request:")
                self.assertIn("cancel-in-progress: false", workflow)
                self.assertIn("${{ vars.WIF_PROVIDER }}", workflow)
                self.assertIn("${{ vars.WIF_SERVICE_ACCOUNT }}", workflow)
                self.assertNotIn("${{ secrets.", workflow)
                self.assertNotIn("credentials_json", workflow)
                self.assertNotIn("GCP_SA_KEY", workflow)
                self.assertNotIn("GOOGLE_CREDENTIALS", workflow)
                self.assertNotIn("docker/login-action", workflow)
                self.assertIsNone(re.search(r"docker\s+login", workflow))
                self.assertIn("gcloud auth configure-docker", workflow)
                self.assertNotIn("tofu apply", workflow)
                self.assertNotIn("terraform apply", workflow)
                self.assertIn("persist-credentials: false", workflow)
                self.assertNotIn("google-github-actions/deploy-cloudrun", workflow)
                self.assertNotIn("ALWAYS_RUN", workflow)
                self.assertNotIn("expo-doctor", workflow)
                for pin in PINNED_ACTIONS:
                    self.assertIn(f"uses: {pin}", workflow)
                self.assertIn("severity: HIGH,CRITICAL", workflow)
                self.assertIn("exit-code: '1'", workflow)

                names = _step_names(workflow)
                indexes = []
                for expected in DEPLOY_STEP_NAMES:
                    self.assertIn(expected, names, msg=expected)
                    indexes.append(names.index(expected))
                self.assertEqual(indexes, sorted(indexes))

                fail_closed = _step_body(workflow, "Fail closed when required vars are empty")
                for var_name in REQUIRED_EMPTY_VARS:
                    self.assertIn(var_name, fail_closed)

                checkout = _step_body(workflow, "Check out repository")
                self.assertIn("persist-credentials: false", checkout)

                auth = _step_body(workflow, "Authenticate to Google Cloud")
                self.assertIn("${{ vars.WIF_PROVIDER }}", auth)
                self.assertIn("${{ vars.WIF_SERVICE_ACCOUNT }}", auth)

                trivy = _step_body(workflow, "Scan image with Trivy")
                self.assertIn("severity: HIGH,CRITICAL", trivy)
                self.assertIn("exit-code: '1'", trivy)

                docker_auth = _step_body(
                    workflow, "Configure Artifact Registry docker auth"
                )
                self.assertIn("gcloud auth configure-docker", docker_auth)

                push = _step_body(workflow, "Push image digest")
                self.assertIn("docker push", push)

                migrate = _step_body(workflow, "Update and execute migrate job")
                self.assertIn("gcloud run jobs update", migrate)
                self.assertIn("gcloud run jobs execute", migrate)
                self.assertIn("--wait", migrate)

                no_traffic = _step_body(
                    workflow, "Update Cloud Run service with no traffic"
                )
                self.assertIn("gcloud run services update", no_traffic)
                self.assertIn("--no-traffic", no_traffic)

                smoke = _step_body(workflow, "Execute smoke job")
                self.assertIn("SMOKE_BASE_URL", smoke)
                self.assertIn("FAIL_SMOKE", smoke)
                self.assertIn("inputs.fail_smoke", smoke)
                self.assertIn("gcloud run jobs execute", smoke)

                promote = _step_body(workflow, "Promote revision")
                self.assertIn("gcloud run services update-traffic", promote)
                self.assertGreater(
                    names.index("Promote revision"),
                    names.index("Execute smoke job"),
                )

    def test_staging_workflow_triggers_and_fail_smoke(self) -> None:
        workflow = _read(STAGING_WORKFLOW)
        on_section = _on_section(workflow)
        self.assertIn("push:", on_section)
        self.assertIn("branches: [main]", on_section)
        self.assertIn("workflow_dispatch:", on_section)
        self.assertIn("fail_smoke:", on_section)
        self.assertIn("type: boolean", on_section)
        self.assertIn("default: false", on_section)
        self.assertIn("environment: staging", workflow)
        self.assertIn("group: deploy-staging", workflow)
        self.assertNotIn("environment: production", workflow)
        smoke = _step_body(workflow, "Execute smoke job")
        self.assertIn("inputs.fail_smoke", smoke)
        self.assertIn("FAIL_SMOKE", smoke)

    def test_production_workflow_is_dispatch_only_gated_pipeline(self) -> None:
        workflow = _read(PRODUCTION_WORKFLOW)
        on_section = _on_section(workflow)
        self.assertIn("workflow_dispatch:", on_section)
        self.assertNotIn("push:", on_section)
        self.assertIn("environment: production", workflow)
        self.assertIn("group: deploy-production", workflow)
        self.assertNotIn("environment: staging", workflow)
        self.assertIn("gcloud run jobs update", workflow)
        self.assertIn("gcloud run services update-traffic", workflow)

    def test_wif_module_uses_exact_oidc_attribute_condition(self) -> None:
        text = _read(WIF_MAIN)
        self.assertIn('issuer_uri = "https://token.actions.githubusercontent.com"', text)
        self.assertIn("assertion.repository ==", text)
        self.assertIn("assertion.ref ==", text)
        self.assertIn("assertion.environment ==", text)
        self.assertNotIn("startsWith", text)
        self.assertNotIn("allowed_audiences", text)
        self.assertIn('workload_identity_pool_id = "github-actions"', text)
        self.assertIn('workload_identity_pool_provider_id = "github"', text)

    def test_example_tfvars_uses_placeholder_repository(self) -> None:
        example = _read(STAGING_EXAMPLE)
        self.assertIn("example-org/example-repo", example)
        self.assertNotIn(REAL_REPO, example)

    def test_committed_tf_omits_real_repository_name(self) -> None:
        for path, text in _infra_tf_texts().items():
            with self.subTest(path=str(path.relative_to(ROOT))):
                self.assertNotIn(REAL_REPO, text)

    def test_deploy_sa_has_least_privilege_bindings(self) -> None:
        iam = _read(STAGING_IAM)
        self.assertIn('resource "google_service_account" "deploy"', iam)
        self.assertIn("shortform-deploy", iam)
        self.assertIn("roles/artifactregistry.writer", iam)
        self.assertIn("roles/run.developer", iam)
        self.assertIn("roles/iam.serviceAccountUser", iam)
        self.assertIn("roles/iam.workloadIdentityUser", iam)
        self.assertIn("principalSet://iam.googleapis.com/", iam)
        self.assertIn("attribute.repository/", iam)
        for role in FORBIDDEN_DEPLOY_ROLES:
            with self.subTest(role=role):
                self.assertIsNone(
                    re.search(rf'role\s*=\s*"{re.escape(role)}"', iam),
                    msg=role,
                )
        self.assertNotIn("roles/secretmanager.secretAccessor", iam.split('resource "google_service_account" "deploy"')[-1])
        self.assertNotIn("roles/iam.serviceAccountTokenCreator", iam)
        self.assertNotIn("roles/run.admin", iam)

    def test_runtime_sa_is_not_wif_and_gains_service_invoker(self) -> None:
        iam = _read(STAGING_IAM)
        self.assertIn('resource "google_service_account" "runtime"', iam)
        self.assertIn("roles/run.invoker", iam)
        self.assertIn("google_service_account.runtime", iam)
        runtime_block = iam.split('resource "google_service_account" "runtime"', 1)[1]
        runtime_block = runtime_block.split("resource ", 1)[0]
        self.assertNotIn("workloadIdentity", runtime_block)
        self.assertNotIn("principalSet://", runtime_block)

    def test_required_services_include_wif_apis(self) -> None:
        main = _read(STAGING_MAIN)
        self.assertIn("iamcredentials.googleapis.com", main)
        self.assertIn("sts.googleapis.com", main)
        for api in (
            "transcoder.googleapis.com",
            "dns.googleapis.com",
            "sqladmin.googleapis.com",
            "cloudtasks.googleapis.com",
            "cloudscheduler.googleapis.com",
            "compute.googleapis.com",
        ):
            self.assertNotIn(api, main)

    def test_cloud_run_module_port_probes_and_ci_owned_image(self) -> None:
        text = _read(CLOUD_RUN_MAIN)
        self.assertIn("container_port = 8080", text)
        self.assertIn("/health/ready", text)
        self.assertIn("/health/live", text)
        self.assertIn("X-Forwarded-Proto", text)
        self.assertIn("https", text)
        self.assertIn("ignore_changes", text)
        self.assertIn("template[0].containers[0].image", text)
        self.assertNotRegex(text, r'name\s*=\s*"PORT"')
        self.assertNotIn("CONN_MAX_AGE", text)
        self.assertNotIn("GUNICORN", text)
        self.assertIn("DJANGO_SETTINGS_MODULE", text)
        self.assertIn("DJANGO_ALLOWED_HOSTS", text)
        self.assertIn("FIREBASE_PROJECT_ID", text)
        self.assertIn("django-secret-key", text)
        self.assertIn("database-url", text)
        self.assertIn("INGRESS_TRAFFIC_INTERNAL_ONLY", _read(CLOUD_RUN_VARS))
        self.assertIn("invoker_iam_disabled = false", text)

    def test_migrate_and_smoke_jobs_are_defined(self) -> None:
        staging = _concat(STAGING_MAIN, ROOT / "infra/environments/staging/wif.tf")
        job_module = _concat(CLOUD_RUN_JOB_MAIN, CLOUD_RUN_JOB_VARS)
        combined = staging + "\n" + job_module
        self.assertRegex(combined, r'args\s*=\s*\["migrate"\]')
        self.assertRegex(combined, r"max_retries\s*=\s*0")
        self.assertIn(
            "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity",
            combined,
        )
        self.assertIn("SMOKE_BASE_URL", combined)
        self.assertIn("Bearer", combined)
        self.assertIn("X-Forwarded-Proto", combined)
        self.assertIn("/health/ready", combined)
        self.assertIn("/health/live", combined)
        self.assertIn("FAIL_SMOKE", combined)
        self.assertIn("Metadata-Flavor", combined)
        self.assertIn("service_account = var.runtime_service_account_email", job_module)
        self.assertIn("ignore_changes", job_module)

    def test_secret_ids_default_includes_django_and_database(self) -> None:
        variables = _read(STAGING_VARS)
        match = re.search(
            r'variable "secret_ids"\s*\{(.*?)^\}',
            variables,
            re.DOTALL | re.MULTILINE,
        )
        self.assertIsNotNone(match)
        block = match.group(1)
        self.assertIn("bunny-stream-api-key", block)
        self.assertIn("django-secret-key", block)
        self.assertIn("database-url", block)

    def test_bunny_env_only_when_video_provider_is_bunny(self) -> None:
        texts = [
            _read(CLOUD_RUN_MAIN),
            _read(CLOUD_RUN_VARS),
            _read(CLOUD_RUN_JOB_MAIN) if CLOUD_RUN_JOB_MAIN.is_file() else "",
            _read(CLOUD_RUN_JOB_VARS) if CLOUD_RUN_JOB_VARS.is_file() else "",
            _read(STAGING_MAIN),
            _read(STAGING_VARS),
        ]
        combined = "\n".join(texts)
        self.assertRegex(
            combined,
            r'variable "video_provider"[\s\S]*?default\s*=\s*""',
        )
        self.assertIn('var.video_provider == "bunny"', combined)
        for needle in ("VIDEO_PROVIDER", "BUNNY_STREAM", "bunny-stream"):
            for path in (CLOUD_RUN_MAIN, CLOUD_RUN_JOB_MAIN):
                if not path.is_file():
                    continue
                text = _read(path)
                if needle in text:
                    self.assertIn('var.video_provider == "bunny"', text)

    def test_staging_outputs_map_to_github_environment_vars(self) -> None:
        outputs = _read(STAGING_OUTPUTS)
        for name in (
            "wif_provider_name",
            "deploy_service_account_email",
            "project_id",
            "region",
            "artifact_registry_repository_id",
            "cloud_run_service_name",
            "migrate_job_name",
            "smoke_job_name",
        ):
            self.assertIn(f'output "{name}"', outputs)
        self.assertIn("WIF_PROVIDER", outputs)
        self.assertIn("WIF_SERVICE_ACCOUNT", outputs)


if __name__ == "__main__":
    unittest.main()
