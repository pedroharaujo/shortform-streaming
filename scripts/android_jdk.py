"""Locate a JDK 17+ for Android Gradle without requiring per-session JAVA_HOME.

Oracle Java 8 and Conda often sit earlier on PATH than Android Studio's JBR.
This module prefers a real 17+ home (Studio JBR first) and never selects 8.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

MIN_JAVA_MAJOR = 17

_VERSION_PATTERNS = (
    re.compile(r'version "(?P<major>\d+)\.(?P<minor>\d+)'),
    re.compile(r'version "(?P<major>\d+)"'),
)


def parse_java_major(version_output: str) -> int | None:
    """Return the Java major version from `java -version` text, or None."""
    for line in version_output.splitlines():
        match = _VERSION_PATTERNS[0].search(line) or _VERSION_PATTERNS[1].search(line)
        if match is None:
            continue
        major = int(match.group("major"))
        minor = int(match.group("minor")) if "minor" in match.groupdict() and match.group("minor") else 0
        if major == 1:
            return minor
        return major
    return None


def java_executable(home: Path) -> Path | None:
    bindir = home / "bin"
    for name in ("java.exe", "java.cmd", "java.bat", "java"):
        candidate = bindir / name
        if candidate.is_file():
            return candidate
    return None


def java_major_for_home(home: Path) -> int | None:
    executable = java_executable(home)
    if executable is None:
        return None
    result = subprocess.run(
        [str(executable), "-version"],
        check=False,
        capture_output=True,
        text=True,
    )
    return parse_java_major(f"{result.stderr}\n{result.stdout}")


def candidate_java_homes(environ: Mapping[str, str] | None = None) -> list[Path]:
    env = os.environ if environ is None else environ
    homes: list[Path] = []

    configured = env.get("JAVA_HOME", "").strip()
    if configured:
        homes.append(Path(configured))

    if sys.platform == "win32":
        homes.append(Path(r"C:\Program Files\Android\Android Studio\jbr"))
        local_app_data = env.get("LOCALAPPDATA", "").strip()
        if local_app_data:
            homes.append(
                Path(local_app_data) / "Programs" / "Android" / "Android Studio" / "jbr"
            )
        program_files = env.get("ProgramFiles", r"C:\Program Files")
        java_root = Path(program_files) / "Java"
        if java_root.is_dir():
            homes.extend(sorted(java_root.glob("jdk-*")))
    elif sys.platform == "darwin":
        homes.append(Path("/Applications/Android Studio.app/Contents/jbr/Contents/Home"))
    else:
        homes.append(Path.home() / "android-studio" / "jbr")
        homes.append(Path("/opt/android-studio/jbr"))

    which_java = shutil.which("java", path=env.get("PATH"))
    if which_java:
        homes.append(Path(which_java).resolve().parent.parent)

    unique: list[Path] = []
    seen: set[Path] = set()
    for home in homes:
        resolved = home
        if resolved in seen:
            continue
        seen.add(resolved)
        unique.append(resolved)
    return unique


def find_java_home(
    *,
    environ: Mapping[str, str] | None = None,
    candidates: Sequence[Path] | None = None,
) -> Path:
    homes = list(candidates) if candidates is not None else candidate_java_homes(environ)
    rejected: list[str] = []
    for home in homes:
        major = java_major_for_home(home)
        if major is None:
            continue
        if major >= MIN_JAVA_MAJOR:
            return home
        rejected.append(f"{home} (Java {major})")
    details = "; ".join(rejected) if rejected else "no JDK found"
    raise FileNotFoundError(
        "Android Gradle needs JDK 17+. Install Android Studio (it includes JBR 17+) "
        f"or set JAVA_HOME to a 17+ JDK. Checked: {details}."
    )


def prepare_android_env(environ: Mapping[str, str] | None = None) -> dict[str, str]:
    """Return an env mapping with JAVA_HOME and PATH pinned to JDK 17+."""
    env = dict(os.environ if environ is None else environ)
    java_home = find_java_home(environ=env)
    env["JAVA_HOME"] = str(java_home)
    prepend = [str(java_home / "bin"), str(Path.home() / ".local" / "bin")]
    existing = env.get("PATH", "")
    env["PATH"] = os.pathsep.join([*prepend, existing]) if existing else os.pathsep.join(prepend)

    if not env.get("ANDROID_HOME", "").strip() and not env.get("ANDROID_SDK_ROOT", "").strip():
        sdk_candidates = []
        if sys.platform == "win32":
            local_app_data = env.get("LOCALAPPDATA", "").strip()
            if local_app_data:
                sdk_candidates.append(Path(local_app_data) / "Android" / "Sdk")
        elif sys.platform == "darwin":
            sdk_candidates.append(Path.home() / "Library" / "Android" / "sdk")
        else:
            sdk_candidates.append(Path.home() / "Android" / "Sdk")
        for sdk in sdk_candidates:
            if (sdk / "platform-tools").is_dir() or (sdk / "emulator").is_dir():
                env["ANDROID_HOME"] = str(sdk)
                env["ANDROID_SDK_ROOT"] = str(sdk)
                env["PATH"] = os.pathsep.join(
                    [str(sdk / "platform-tools"), str(sdk / "emulator"), env["PATH"]]
                )
                break
    return env
