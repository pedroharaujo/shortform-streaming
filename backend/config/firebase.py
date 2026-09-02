from __future__ import annotations

from threading import Lock
from typing import Any

from django.conf import settings

_app_lock = Lock()


class FirebaseAdminUnavailable(Exception):
    """Firebase Admin could not be initialized without exposing provider details."""


def get_firebase_admin_app() -> Any:
    """Return the default Firebase Admin app, initializing it exactly once.

    Authentication and App Check share this boundary so simultaneous first
    requests cannot race two independent ``initialize_app`` calls.
    """
    project_id = str(getattr(settings, "FIREBASE_PROJECT_ID", "")).strip()
    if not project_id:
        raise FirebaseAdminUnavailable

    try:
        import firebase_admin
    except ImportError as exc:
        raise FirebaseAdminUnavailable from exc

    with _app_lock:
        try:
            return firebase_admin.get_app()
        except ValueError:
            try:
                return firebase_admin.initialize_app(
                    options={"projectId": project_id, "httpTimeout": 10}
                )
            except Exception as exc:
                raise FirebaseAdminUnavailable from exc
