from __future__ import annotations

from django.apps import AppConfig


class PlaybackConfig(AppConfig):
    default = True
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.playback"
    verbose_name = "Playback"

    def ready(self) -> None:
        from apps.playback import signals as _signals

        del _signals
