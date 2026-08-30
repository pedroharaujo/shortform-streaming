from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

FFMPEG_CANDIDATES = ("/c/ffmpeg/bin/ffmpeg", "ffmpeg")

VERTICAL_WIDTH = 1080
VERTICAL_HEIGHT = 1920
CLIP_SECONDS = 3


def resolve_ffmpeg() -> str:
    for candidate in FFMPEG_CANDIDATES:
        if candidate == "ffmpeg":
            found = shutil.which("ffmpeg")
            if found:
                return found
            continue
        path = Path(candidate)
        if path.is_file():
            return str(path)
    raise FileNotFoundError("ffmpeg is required to generate spike test media")


def _webvtt_timestamp(seconds: int) -> str:
    bounded = max(0, seconds)
    hours, remainder = divmod(bounded, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.000"


def write_sidecar_captions(path: Path, *, duration_seconds: int = CLIP_SECONDS) -> None:
    cue_end = max(1, duration_seconds)
    path.write_text(
        f"WEBVTT\n\n00:00:00.000 --> {_webvtt_timestamp(cue_end)}\nSynthetic generated caption.\n",
        encoding="utf-8",
    )


def generate_vertical_test_media(
    directory: Path,
    *,
    duration_seconds: int = CLIP_SECONDS,
) -> tuple[Path, Path]:
    """Create a short 9:16 color/sine clip and a VTT sidecar. Generated only."""
    seconds = max(1, int(duration_seconds))
    ffmpeg = resolve_ffmpeg()
    video_path = directory / "spike-vertical.mp4"
    captions_path = directory / "spike-captions.vtt"
    command = [
        ffmpeg,
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=blue:s={VERTICAL_WIDTH}x{VERTICAL_HEIGHT}:d={seconds}",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=1000:duration={seconds}",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        str(video_path),
    ]
    subprocess.run(command, check=True, capture_output=True)
    write_sidecar_captions(captions_path, duration_seconds=seconds)
    return video_path, captions_path
