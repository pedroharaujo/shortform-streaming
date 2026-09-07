"""Small, bounded snapshots of editorial policy inputs, written under catalog locks."""

from typing import Any

from django.http import HttpRequest

from apps.catalog.models import EditorialAccessRevision, Episode, Series


def policy_snapshot(obj: Any) -> dict[str, Any]:
    fields: tuple[str, ...]
    if isinstance(obj, Episode):
        fields = ("access_mode", "coin_price", "order")
    elif isinstance(obj, Series):
        fields = ("free_episode_count", "rewarded_ads_enabled")
    else:
        return {}
    return {field: getattr(obj, field) for field in fields}


def record_policy_revision(request: HttpRequest, obj: Any, before: dict[str, Any]) -> None:
    after = policy_snapshot(obj)
    if not after or before == after:
        return
    from apps.entitlements.policy import resolve_episode_policy

    EditorialAccessRevision.objects.create(
        series=obj.series if isinstance(obj, Episode) else obj,
        episode=obj if isinstance(obj, Episode) else None,
        actor_id=request.user.pk,
        before=before,
        after=after,
        policy_version=resolve_episode_policy(obj).version if isinstance(obj, Episode) else "",
    )
