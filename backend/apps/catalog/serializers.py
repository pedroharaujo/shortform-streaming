from __future__ import annotations

from collections.abc import Mapping, Sequence

from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from apps.catalog.models import Episode, Season, Series


def series_artwork_url(series: Series) -> str | None:
    return series.artwork_url.strip() or None


@extend_schema_serializer(component_name="CatalogSeriesCard")
class CatalogSeriesCardSerializer(serializers.Serializer[Mapping[str, object]]):
    id = serializers.CharField(help_text="Opaque series public id.")
    title = serializers.CharField()
    synopsis = serializers.CharField()
    artwork_url = serializers.CharField(allow_null=True)


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


def serialize_series_card(series: Series) -> dict[str, object]:
    return {
        "id": series.public_id,
        "title": series.title,
        "synopsis": series.synopsis,
        "artwork_url": series_artwork_url(series),
    }


def serialize_episode_summary(episode: Episode) -> dict[str, object]:
    return {
        "id": episode.public_id,
        "order": episode.order,
        "duration_seconds": episode.duration_seconds,
        "title": episode.title,
        "synopsis": episode.synopsis,
    }


def serialize_series_detail(
    series: Series,
    episodes_by_season: Mapping[int, Sequence[Episode]],
    seasons: Sequence[Season],
) -> dict[str, object]:
    season_payload = [
        {
            "number": season.number,
            "episodes": [
                serialize_episode_summary(episode)
                for episode in episodes_by_season.get(season.number, ())
            ],
        }
        for season in seasons
        if episodes_by_season.get(season.number)
    ]
    return {
        **serialize_series_card(series),
        "genres": [genre.name for genre in series.genres.all()],
        "seasons": season_payload,
    }


def serialize_episode_detail(episode: Episode) -> dict[str, object]:
    return {
        **serialize_episode_summary(episode),
        "series_id": episode.series.public_id,
        "season_number": episode.season.number,
    }
