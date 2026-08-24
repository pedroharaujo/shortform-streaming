from __future__ import annotations

from collections.abc import Mapping, Sequence

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from apps.catalog.eligibility import CatalogRequestContext
from apps.catalog.models import REQUIRED_CATALOG_LANGUAGE, Episode, Season, Series


def localized_translation[T](
    translations: Sequence[T],
    *,
    requested: str,
    original: str,
    language_attr: str = "language",
) -> T | None:
    """Prefer X-Language, then original language, then English.

    Eligibility already required the request language to be in the rights grant.
    Missing translations fall back so a published English series still renders.
    """
    by_language: dict[str, T] = {}
    for item in translations:
        by_language[str(getattr(item, language_attr))] = item
    for language in (requested, original, REQUIRED_CATALOG_LANGUAGE):
        match = by_language.get(language)
        if match is not None:
            return match
    return None


def series_artwork_url(series: Series) -> str | None:
    return series.artwork_url.strip() or None


@extend_schema_serializer(component_name="CatalogSeriesCard")
class CatalogSeriesCardSerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.CharField(help_text="Opaque series public id.")
    title = serializers.CharField()
    synopsis = serializers.CharField()
    artwork_url = serializers.CharField(allow_null=True)
    original_language = serializers.CharField()


@extend_schema_serializer(component_name="CatalogRail")
class CatalogRailSerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.CharField()
    title = serializers.CharField()
    series = CatalogSeriesCardSerializer(many=True)


@extend_schema_serializer(component_name="CatalogHome")
class CatalogHomeSerializer(serializers.Serializer[Mapping[str, object]]):
    rails = CatalogRailSerializer(many=True)


@extend_schema_serializer(component_name="CatalogEpisodeSummary")
class CatalogEpisodeSummarySerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.CharField(help_text="Opaque episode public id.")
    order = serializers.IntegerField()
    duration_seconds = serializers.IntegerField()
    title = serializers.CharField()
    synopsis = serializers.CharField()


@extend_schema_serializer(component_name="CatalogSeason")
class CatalogSeasonSerializer(serializers.Serializer[Mapping[str, object]]):
    number = serializers.IntegerField()
    episodes = CatalogEpisodeSummarySerializer(many=True)


@extend_schema_serializer(component_name="CatalogSeriesDetail")
class CatalogSeriesDetailSerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.CharField()
    title = serializers.CharField()
    synopsis = serializers.CharField()
    artwork_url = serializers.CharField(allow_null=True)
    original_language = serializers.CharField()
    genres = serializers.ListField(child=serializers.CharField())
    seasons = CatalogSeasonSerializer(many=True)


@extend_schema_serializer(component_name="CatalogEpisodeDetail")
class CatalogEpisodeDetailSerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.CharField()
    title = serializers.CharField()
    synopsis = serializers.CharField()
    duration_seconds = serializers.IntegerField()
    order = serializers.IntegerField()
    series_id = serializers.CharField()
    season_number = serializers.IntegerField()


def serialize_series_card(series: Series, context: CatalogRequestContext) -> dict[str, object]:
    translation = localized_translation(
        list(series.translations.all()),
        requested=context.language,
        original=series.original_language,
    )
    title = translation.title if translation else ""
    synopsis = translation.synopsis if translation else ""
    return {
        "id": series.public_id,
        "title": title,
        "synopsis": synopsis,
        "artwork_url": series_artwork_url(series),
        "original_language": series.original_language,
    }


def serialize_episode_summary(
    episode: Episode, context: CatalogRequestContext
) -> dict[str, object]:
    translation = localized_translation(
        list(episode.translations.all()),
        requested=context.language,
        original=episode.series.original_language,
    )
    return {
        "id": episode.public_id,
        "order": episode.order,
        "duration_seconds": episode.duration_seconds,
        "title": translation.title if translation else "",
        "synopsis": translation.synopsis if translation else "",
    }


def serialize_series_detail(
    series: Series,
    context: CatalogRequestContext,
    episodes_by_season: Mapping[int, Sequence[Episode]],
    seasons: Sequence[Season],
) -> dict[str, object]:
    card = serialize_series_card(series, context)
    season_payload: list[dict[str, object]] = []
    for season in seasons:
        visible = episodes_by_season.get(season.number, ())
        if not visible:
            continue
        season_payload.append(
            {
                "number": season.number,
                "episodes": [serialize_episode_summary(episode, context) for episode in visible],
            }
        )
    return {
        **card,
        "genres": [genre.name for genre in series.genres.all()],
        "seasons": season_payload,
    }


def serialize_episode_detail(episode: Episode, context: CatalogRequestContext) -> dict[str, object]:
    summary = serialize_episode_summary(episode, context)
    return {
        **summary,
        "series_id": episode.series.public_id,
        "season_number": episode.season.number,
    }
