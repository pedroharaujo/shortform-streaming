from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from apps.accounts.models import AccountDeletion, UserProfile, deletion_fingerprint
from apps.accounts.profiles import lock_account_identity
from apps.accounts.verification import VerifiedToken


class ReauthenticationRequired(APIException):
    status_code = 403
    default_code = "reauthentication_required"
    default_detail = "Sign in again before deleting your account."
    envelope_message = default_detail


def request_account_deletion(verified: VerifiedToken) -> AccountDeletion:
    auth_time = verified.auth_time
    if auth_time is None or not 0 <= timezone.now().timestamp() - auth_time <= 300:
        raise ReauthenticationRequired()
    with transaction.atomic():
        lock_account_identity(verified.uid)
        record, _ = AccountDeletion.objects.get_or_create(
            uid_fingerprint=deletion_fingerprint(verified.uid),
            defaults={"firebase_uid": verified.uid},
        )
        # Every receipt is durable before provider I/O. CASCADE removes progress
        # and entitlements; no financial or push models exist in this slice.
        UserProfile.objects.filter(firebase_uid=verified.uid).delete()
    return record


def delete_firebase_user(uid: str) -> None:
    mode = settings.FIREBASE_AUTH_MODE
    if mode == "mock" and settings.DEBUG:
        return
    if mode != "admin":
        raise ImproperlyConfigured("Account deletion requires a supported Firebase mode.")
    import firebase_admin
    from firebase_admin import auth

    # Token verification initializes the default app for API requests. The retry
    # command runs in a fresh process and must initialize it independently.
    try:
        firebase_admin.get_app()
    except ValueError:
        project = str(settings.FIREBASE_PROJECT_ID).strip()
        if not project:
            raise ImproperlyConfigured("Firebase project configuration is required.") from None
        firebase_admin.initialize_app(options={"projectId": project, "httpTimeout": 10})
    try:
        auth.delete_user(uid)
    except auth.UserNotFoundError:
        pass


def process_account_deletion(public_id: str) -> AccountDeletion:
    # Serialize per receipt, including bounded provider I/O, so simultaneous
    # requests/workers cannot both process it. A crash leaves a retryable pending
    # receipt; Firebase's already-missing result converges on completion.
    with transaction.atomic():
        record = AccountDeletion.objects.select_for_update().get(public_id=public_id)
        if record.status == "completed":
            return record
        record.attempts += 1
        record.last_attempt_at = timezone.now()
        try:
            delete_firebase_user(record.firebase_uid)
        except Exception:
            # Never persist/log exception text, credentials, or provider payloads.
            record.save(update_fields=["attempts", "last_attempt_at"])
            return record
        record.status = "completed"
        record.completed_at = timezone.now()
        record.firebase_uid = ""
        record.save(
            update_fields=[
                "status",
                "completed_at",
                "firebase_uid",
                "attempts",
                "last_attempt_at",
            ]
        )
        return record
