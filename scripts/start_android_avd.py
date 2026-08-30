"""Start an Android AVD without opening Android Studio.

The emulator must be a detached process. A foreground `emulator -avd ...` child
of a terminal (or of Make) is killed when that session ends. Android Studio
only looked required because it starts the AVD detached.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
from collections.abc import Sequence
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from android_jdk import prepare_android_env  # noqa: E402
from run_mobile_android import (  # noqa: E402
    adb_has_emulator_serial,
    adb_has_ready_device,
    device_is_booted,
)

PREFERRED_AVDS = ("Pixel_9", "Pixel_8", "Pixel_7")
ADB_WAIT_SECONDS = 180
ADB_POLL_SECONDS = 2.0
CREATE_NEW_PROCESS_GROUP = 0x00000200
CREATE_NO_WINDOW = 0x08000000
CREATE_BREAKAWAY_FROM_JOB = 0x01000000


def emulator_binary(env: dict[str, str]) -> Path:
    sdk = Path(env.get("ANDROID_HOME") or env.get("ANDROID_SDK_ROOT") or "")
    candidates: list[Path] = []
    if sys.platform == "win32":
        # The `emulator`/`emulator.bat` wrappers open an extra console. Use the
        # GUI binary only.
        if sdk:
            candidates.append(sdk / "emulator" / "emulator.exe")
        local = env.get("LOCALAPPDATA", "").strip()
        if local:
            candidates.append(Path(local) / "Android" / "Sdk" / "emulator" / "emulator.exe")
    else:
        if sdk:
            candidates.append(sdk / "emulator" / "emulator")
        which = shutil.which("emulator", path=env.get("PATH"))
        if which:
            candidates.append(Path(which))
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "The Android emulator binary was not found. Install Android Studio once "
        "(SDK + an AVD). After that, `make start-avd` starts the AVD by itself."
    )


def list_avds(emulator: Path, env: dict[str, str]) -> list[str]:
    result = subprocess.run(
        [str(emulator), "-list-avds"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        raise FileNotFoundError(
            "Could not list AVDs. Create one in Android Studio Device Manager once, "
            "then use `make start-avd`."
        )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def choose_avd(available: Sequence[str], *, preferred: str | None = None) -> str:
    names = [name for name in available if name]
    if not names:
        raise FileNotFoundError(
            "No AVDs are installed. Create one in Android Studio Device Manager "
            "once (Pixel recommended). After that you do not need Studio to boot it."
        )
    if preferred:
        if preferred in names:
            return preferred
        raise FileNotFoundError(
            f"ANDROID_AVD={preferred} was not found. Available: {', '.join(names)}."
        )
    for name in PREFERRED_AVDS:
        if name in names:
            return name
    for name in names:
        if name.startswith("Pixel"):
            return name
    return names[0]


def _adb_output(env: dict[str, str]) -> str:
    adb = shutil.which("adb", path=env.get("PATH"))
    if adb is None:
        return ""
    result = subprocess.run(
        [adb, "devices"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    return f"{result.stdout}\n{result.stderr}"


def wait_for_ready_device(
    env: dict[str, str],
    *,
    timeout_seconds: int = ADB_WAIT_SECONDS,
    poll_seconds: float = ADB_POLL_SECONDS,
) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if device_is_booted(env):
            print("Android emulator is booted.", flush=True)
            return
        time.sleep(poll_seconds)
    raise FileNotFoundError(
        f"Timed out after {timeout_seconds}s waiting for the AVD to finish booting. "
        "Create a Pixel AVD in Android Studio Device Manager once, then retry "
        "`make start-avd`."
    )


def _popen_detached(emulator: Path, avd: str, env: dict[str, str]) -> None:
    args = [str(emulator), "-avd", avd]
    cwd = str(emulator.parent)
    if sys.platform == "win32":
        # CREATE_NO_WINDOW hides the emulator's console. Do not combine it with
        # DETACHED_PROCESS: Windows then ignores CREATE_NO_WINDOW and AllocConsole
        # opens a second terminal. BREAKAWAY_FROM_JOB keeps the AVD alive after
        # Make/Python exit.
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0
        subprocess.Popen(
            args,
            cwd=cwd,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            startupinfo=startupinfo,
            creationflags=(
                CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW | CREATE_BREAKAWAY_FROM_JOB
            ),
            close_fds=True,
        )
        return
    subprocess.Popen(
        args,
        cwd=cwd,
        env=env,
        start_new_session=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
    )


def main() -> int:
    try:
        env = prepare_android_env()
        devices = _adb_output(env)
        if device_is_booted(env):
            print("An Android emulator/device is already booted.")
            return 0
        if adb_has_emulator_serial(devices) or adb_has_ready_device(devices):
            print("An emulator is already registered with adb. Waiting for boot...", flush=True)
            wait_for_ready_device(env)
            return 0
        emulator = emulator_binary(env)
        available = list_avds(emulator, env)
        avd = choose_avd(available, preferred=env.get("ANDROID_AVD", "").strip() or None)
        print(f"Starting AVD {avd} (no Android Studio, no extra terminal)...", flush=True)
        _popen_detached(emulator, avd, env)
        wait_for_ready_device(env)
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
