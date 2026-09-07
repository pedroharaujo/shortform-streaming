from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from django.db.models import Exists, Func, OuterRef, Q, QuerySet, TextField
from django.db.models.functions import Cast
from django.utils import timezone

from apps.catalog.context import (
    LANGUAGE,
    PLATFORM,
    STOREFRONT,
    TERRITORY,
    LaunchContext,
    resolve_launch_context,
    valid_scope,
)
from apps.catalog.models import ContentRight, Episode, PublicationStatus, Series
from apps.playback.models import MediaAsset, MediaAssetState


def _validated_arrays(
    queryset: QuerySet[Any], fields: dict[str, tuple[str, bool]]
) -> QuerySet[Any]:
    for field, (pattern, empty) in fields.items():
        contents = f"{pattern}(?:,{pattern})*"
        if empty:
            contents = f"(?:{contents})?"
        alias = f"validated_{field}"
        queryset = queryset.alias(**{alias: Cast(field, TextField())}).filter(
            **{f"{alias}__regex": rf"^\{{{contents}\}}$"}
        )
    return queryset


def matching_licensed_rights_q(now: datetime) -> Q:
    context = resolve_launch_context()
    if context is None:
        return Q(pk__in=[])
    return (
        Q(
            takedown=False,
            drm_required=False,
            promotional_clip_permission=True,
            free_access_permission=True,
            rewarded_ad_permission=True,
            coin_access_permission=True,
            paid_promotion_permission=True,
            licensor__regex=r"\S",
            contract_reference__regex=r"\S",
            revenue_share_rule_reference__regex=r"\S",
            starts_at__lte=now,
            territory_allowlist__contains=[context.country],
            platforms__contains=[context.platform],
            storefronts__contains=[context.storefront],
            languages__contains=[context.language],
        )
        & ~Q(territory_denylist__contains=[context.country])
        & (Q(ends_at__isnull=True) | Q(ends_at__gt=now))
    )


def _matching_rights(
    context: LaunchContext,
    now: datetime,
    source_languages: object,
    *,
    captions_language: str | None = None,
) -> QuerySet[ContentRight]:
    rights = (
        ContentRight.objects.filter(matching_licensed_rights_q(now))
        .filter(
            original_languages__contains=source_languages,
            languages__contains=source_languages,
        )
        .filter(
            Q(original_languages__contains=[context.language])
            | Q(subtitle_languages__contains=[context.language])
        )
    )
    if captions_language is not None:
        rights = rights.filter(
            subtitle_languages__contains=[captions_language],
            languages__contains=[captions_language],
        )
    return _validated_arrays(
        rights,
        {
            "territory_allowlist": (TERRITORY, False),
            "territory_denylist": (TERRITORY, True),
            "platforms": (PLATFORM, False),
            "storefronts": (STOREFRONT, False),
            "languages": (LANGUAGE, False),
            "original_languages": (LANGUAGE, False),
            "subtitle_languages": (LANGUAGE, True),
            "dub_languages": (LANGUAGE, True),
        },
    )


def series_is_admitted(
    series: Series,
    *,
    now: datetime | None = None,
    captions_language: str | None = None,
) -> bool:
    """Current rights admission, including drafts; publication and media are separate gates."""
    context = resolve_launch_context()
    if context is None or series.takedown:
        return False
    scopes = (
        (series.distribution_territories, TERRITORY, context.country),
        (series.distribution_platforms, PLATFORM, context.platform),
        (series.distribution_storefronts, STOREFRONT, context.storefront),
        (series.distribution_languages, LANGUAGE, context.language),
    )
    if any(
        not valid_scope(values, pattern) or selected not in values
        for values, pattern, selected in scopes
    ):
        return False
    if (
        not isinstance(series.original_language, str)
        or re.fullmatch(LANGUAGE, series.original_language) is None
    ):
        return False
    if captions_language is not None and (
        not isinstance(captions_language, str) or re.fullmatch(LANGUAGE, captions_language) is None
    ):
        return False
    if context.audience_segment is not None and (
        not series.pk or not series.content_segments.filter(slug=context.audience_segment).exists()
    ):
        return False
    if series.self_owned:
        return bool(series.provenance_reference.strip()) and series.promotional_use_approved
    instant = now if now is not None else timezone.now()
    return (
        bool(series.pk)
        and _matching_rights(
            context,
            instant,
            [series.original_language],
            captions_language=captions_language,
        )
        .filter(series_id=series.pk)
        .exists()
    )


def eligible_series_queryset(*, now: datetime | None = None) -> QuerySet[Series]:
    context = resolve_launch_context()
    if context is None:
        return Series.objects.none()
    instant = now if now is not None else timezone.now()
    source = Func(OuterRef("original_language"), template="ARRAY[%(expressions)s]")
    rights = _matching_rights(context, instant, source).filter(series_id=OuterRef("pk"))
    queryset = Series.objects.filter(
        publication_status=PublicationStatus.PUBLISHED,
        takedown=False,
        original_language__regex=rf"^{LANGUAGE}$",
        distribution_territories__contains=[context.country],
        distribution_platforms__contains=[context.platform],
        distribution_storefronts__contains=[context.storefront],
        distribution_languages__contains=[context.language],
    ).filter(
        Q(self_owned=True, promotional_use_approved=True, provenance_reference__regex=r"\S")
        | (Q(self_owned=False) & Exists(rights))
    )
    queryset = _validated_arrays(
        queryset,
        {
            "distribution_territories": (TERRITORY, False),
            "distribution_platforms": (PLATFORM, False),
            "distribution_storefronts": (STOREFRONT, False),
            "distribution_languages": (LANGUAGE, False),
        },
    )
    if context.audience_segment is not None:
        queryset = queryset.filter(content_segments__slug=context.audience_segment)
    if context.language == "en":
        queryset = queryset.filter(title__regex=r"\S", synopsis__regex=r"\S")
    else:
        queryset = queryset.filter(
            translations__language=context.language,
            translations__title__regex=r"\S",
            translations__synopsis__regex=r"\S",
        )
    return queryset.prefetch_related("translations").order_by("editorial_rank", "public_id")


def series_is_eligible(series: Series, *, now: datetime | None = None) -> bool:
    return (
        series.publication_status == PublicationStatus.PUBLISHED
        and eligible_series_queryset(now=now).filter(pk=series.pk).exists()
    )


def episode_window_is_open(episode: Episode, now: datetime) -> bool:
    if episode.window_starts_at is not None and now < episode.window_starts_at:
        return False
    return episode.window_ends_at is None or now < episode.window_ends_at


def eligible_episodes_for_series(
    series: Series, *, now: datetime | None = None
) -> QuerySet[Episode]:
    instant = now if now is not None else timezone.now()
    context = resolve_launch_context()
    if context is None or not series_is_eligible(series, now=instant):
        return Episode.objects.none()
    episodes = series.episodes.filter(
        publication_status=PublicationStatus.PUBLISHED,
    ).filter(
        Q(window_starts_at__isnull=True) | Q(window_starts_at__lte=instant),
        Q(window_ends_at__isnull=True) | Q(window_ends_at__gt=instant),
    )
    if context.language == "en":
        episodes = episodes.filter(title__regex=r"\S", synopsis__regex=r"\S")
    else:
        episodes = episodes.filter(
            translations__language=context.language,
            translations__title__regex=r"\S",
            translations__synopsis__regex=r"\S",
        )
    assets = admitted_media_assets(series, now=instant).filter(episode_id=OuterRef("pk"))
    return (
        episodes.filter(Exists(assets))
        .select_related("season")
        .prefetch_related("translations")
        .order_by("season__number", "order")
    )


def admitted_media_assets(series: Series, *, now: datetime | None = None) -> QuerySet[MediaAsset]:
    context = resolve_launch_context()
    instant = now if now is not None else timezone.now()
    if context is None or not series_is_admitted(series, now=instant):
        return MediaAsset.objects.none()
    # A READY asset must deliver the selected language; grants cannot invent alternate audio.
    assets = MediaAsset.objects.filter(
        episode__series=series,
        state=MediaAssetState.READY,
    )
    if context.language != series.original_language:
        assets = assets.filter(has_captions=True, captions_language=context.language)
    if not series.self_owned:
        rights = _matching_rights(context, instant, [series.original_language]).filter(
            series_id=series.pk
        )
        caption_rights = rights.filter(
            subtitle_languages__contains=Func(
                OuterRef("captions_language"), template="ARRAY[%(expressions)s]"
            ),
            languages__contains=Func(
                OuterRef("captions_language"), template="ARRAY[%(expressions)s]"
            ),
        )
        assets = assets.filter(Q(has_captions=False) | Exists(caption_rights))
    return assets


def episode_is_eligible(episode: Episode, *, now: datetime | None = None) -> bool:
    return (
        episode.publication_status == PublicationStatus.PUBLISHED
        and eligible_episodes_for_series(episode.series, now=now).filter(pk=episode.pk).exists()
    )
