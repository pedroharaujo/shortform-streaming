"""Build and install the Android development client with a JDK 17+ on PATH.

Do not export JAVA_HOME by hand. Recreating the Python venv does not change
Gradle's JVM; this wrapper selects Android Studio's JBR (or another 17+ JDK)
and then runs `expo run:android`.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))

from android_jdk import prepare_android_env  # noqa: E402

MOBILE = ROOT / "mobile"
GOOGLE_SERVICES = MOBILE / "google-services.json"
MOBILE_ENV = MOBILE / ".env"


def _require_file(path: Path, message: str) -> None:
    if not path.is_file():
        raise FileNotFoundError(message)


def adb_has_ready_device(devices_output: str) -> bool:
    """True when `adb devices` lists at least one fully connected device."""
    for line in devices_output.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[-1] == "device":
            return True
    return False


def adb_has_emulator_serial(devices_output: str) -> bool:
    """True when adb lists an emulator, including offline/booting."""
    for line in devices_output.splitlines():
        parts = line.split()
        if parts and parts[0].startswith("emulator-"):
            return True
    return False


def adb_boot_completed(boot_prop: str) -> bool:
    return boot_prop.strip() == "1"


def _adb_devices_output(env: dict[str, str]) -> str:
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


def _adb_boot_prop(env: dict[str, str]) -> str:
    adb = shutil.which("adb", path=env.get("PATH"))
    if adb is None:
        return ""
    try:
        result = subprocess.run(
            [adb, "shell", "getprop", "sys.boot_completed"],
            check=False,
            capture_output=True,
            text=True,
            env=env,
            timeout=8,
        )
    except (subprocess.TimeoutExpired, OSError):
        return ""
    return result.stdout


def device_is_booted(env: dict[str, str]) -> bool:
    output = _adb_devices_output(env)
    return adb_has_ready_device(output) and adb_boot_completed(_adb_boot_prop(env))


def _require_ready_emulator(env: dict[str, str]) -> None:
    adb = shutil.which("adb", path=env.get("PATH"))
    if adb is None:
        raise FileNotFoundError(
            "adb was not found. Install the Android SDK once, then run `make start-avd`."
        )
    if not device_is_booted(env):
        raise FileNotFoundError(
            "No booted Android emulator/device. `make emulate` starts the AVD first; "
            "wait until the phone home screen is up if this still fails."
        )


def _pnpm_executable(env: dict[str, str]) -> str:
    found = shutil.which("pnpm", path=env.get("PATH"))
    if found:
        return found
    raise FileNotFoundError(
        "pnpm was not found. Enable Corepack (corepack enable) or install pnpm, "
        "then re-run from the repository root."
    )


def main() -> int:
    try:
        env = prepare_android_env()
        _require_file(
            MOBILE_ENV,
            "mobile/.env is missing. Copy EXPO_PUBLIC_API_ENVIRONMENT, "
            "EXPO_PUBLIC_API_BASE_URL, and EXPO_PUBLIC_CATALOG_TERRITORY from "
            ".env.example into mobile/.env (gitignored).",
        )
        _require_file(
            GOOGLE_SERVICES,
            "mobile/google-services.json is missing (gitignored). Native Android "
            "compile needs a local copy next to mobile/app.config.ts. Do not commit it.",
        )
        _require_ready_emulator(env)
        pnpm = _pnpm_executable(env)
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 1

    print(f"Using JAVA_HOME={env['JAVA_HOME']}", flush=True)
    result = subprocess.run(
        [pnpm, "exec", "expo", "run:android"],
        cwd=MOBILE,
        env=env,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
