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


def write_sidecar_captions(path: Path) -> None:
    path.write_text(
        "WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nSynthetic generated caption.\n",
        encoding="utf-8",
    )


def generate_vertical_test_media(directory: Path) -> tuple[Path, Path]:
    """Create a short 9:16 color/sine clip and a VTT sidecar. Generated only."""
    ffmpeg = resolve_ffmpeg()
    video_path = directory / "spike-vertical.mp4"
    captions_path = directory / "spike-captions.vtt"
    command = [
        ffmpeg,
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=blue:s={VERTICAL_WIDTH}x{VERTICAL_HEIGHT}:d={CLIP_SECONDS}",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=1000:duration={CLIP_SECONDS}",
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
    write_sidecar_captions(captions_path)
    return video_path, captions_path
