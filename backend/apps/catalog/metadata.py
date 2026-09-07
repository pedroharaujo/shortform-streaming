from __future__ import annotations

from apps.catalog.context import resolve_launch_context
from apps.catalog.models import Episode, Series


def catalog_metadata(item: Series | Episode) -> tuple[str, str] | None:
    """Direct English remains authoritative; other languages require complete rows."""
    context = resolve_launch_context()
    if context is None:
        return None
    if context.language == "en":
        return (item.title, item.synopsis) if item.title.strip() and item.synopsis.strip() else None
    if not item.pk:
        return None
    for translation in item.translations.all():
        if (
            translation.language == context.language
            and translation.title.strip()
            and translation.synopsis.strip()
        ):
            return translation.title, translation.synopsis
    return None
