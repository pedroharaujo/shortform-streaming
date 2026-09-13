"""Read a Cloud Run service JSON description and emit its unique candidate target."""

from __future__ import annotations

import json
import re
import sys


def resolve_candidate(service: object) -> tuple[str, str]:
    if not isinstance(service, dict) or not isinstance(service.get("status"), dict):
        raise ValueError("Missing service status.")
    traffic = service["status"].get("traffic")
    if not isinstance(traffic, list) or not all(isinstance(row, dict) for row in traffic):
        raise ValueError("Missing service traffic.")
    candidates = [row for row in traffic if row.get("tag") == "candidate"]
    if len(candidates) != 1:
        raise ValueError("Expected exactly one candidate traffic target.")
    revision = candidates[0].get("revisionName")
    url = candidates[0].get("url")
    if not isinstance(revision, str) or not re.fullmatch(r"[a-z][a-z0-9-]*[a-z0-9]", revision):
        raise ValueError("Candidate revision is missing or invalid.")
    # Values enter shell fields, GitHub environment lines, and gcloud env overrides.
    # Only an HTTPS Cloud Run origin is valid; paths and separators are not accepted.
    if not isinstance(url, str) or not re.fullmatch(
        r"https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.run\.app", url
    ):
        raise ValueError("Candidate URL is missing or invalid.")
    return revision, url


def main() -> int:
    try:
        revision, url = resolve_candidate(json.load(sys.stdin))
    except (ValueError, TypeError):
        # A service description can include runtime configuration; never echo it.
        print("Cannot resolve a unique, valid Cloud Run candidate.", file=sys.stderr)
        return 1
    print(revision, url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
