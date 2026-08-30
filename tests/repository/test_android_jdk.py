from __future__ import annotations

import os
import stat
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"


def _load_android_jdk():  # type: ignore[no-untyped-def]
    import sys

    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    import android_jdk

    return android_jdk


class ParseJavaMajorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.android_jdk = _load_android_jdk()

    def test_parses_oracle_java_8(self) -> None:
        text = 'java version "1.8.0_491"\nJava(TM) SE Runtime Environment'
        self.assertEqual(self.android_jdk.parse_java_major(text), 8)

    def test_parses_openjdk_21(self) -> None:
        text = 'openjdk version "21.0.8" 2025-07-15\nOpenJDK Runtime Environment'
        self.assertEqual(self.android_jdk.parse_java_major(text), 21)

    def test_parses_java_17(self) -> None:
        self.assertEqual(self.android_jdk.parse_java_major('openjdk version "17.0.12"'), 17)


class FindJavaHomeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.android_jdk = _load_android_jdk()

    def _install_stub(self, home: Path, version_line: str) -> Path:
        bindir = home / "bin"
        bindir.mkdir(parents=True)
        if os.name == "nt":
            script = bindir / "java.cmd"
            script.write_text(f"@echo {version_line} 1>&2\r\n", encoding="utf-8")
        else:
            script = bindir / "java"
            script.write_text(f"#!/bin/sh\necho '{version_line}' >&2\n", encoding="utf-8")
            script.chmod(script.stat().st_mode | stat.S_IEXEC)
        return home

    def test_skips_java_8_and_selects_21(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            java8 = self._install_stub(root / "jdk8", 'java version "1.8.0_491"')
            java21 = self._install_stub(root / "jdk21", 'openjdk version "21.0.8"')
            chosen = self.android_jdk.find_java_home(candidates=[java8, java21])
            self.assertEqual(chosen, java21)

    def test_rejects_only_java_8(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as raw:
            java8 = self._install_stub(Path(raw) / "jdk8", 'java version "1.8.0_491"')
            with self.assertRaises(FileNotFoundError) as raised:
                self.android_jdk.find_java_home(candidates=[java8])
            message = str(raised.exception)
            self.assertIn("JDK 17+", message)
            self.assertIn("Java 8", message)


def _load_start_android_avd():  # type: ignore[no-untyped-def]
    import sys

    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    import start_android_avd

    return start_android_avd


class ChooseAvdTests(unittest.TestCase):
    def setUp(self) -> None:
        self.starter = _load_start_android_avd()

    def test_prefers_pixel_9(self) -> None:
        chosen = self.starter.choose_avd(["Medium_Phone_API_36.1", "Pixel_9"])
        self.assertEqual(chosen, "Pixel_9")

    def test_honors_preferred_override(self) -> None:
        chosen = self.starter.choose_avd(
            ["Medium_Phone_API_36.1", "Pixel_9"],
            preferred="Medium_Phone_API_36.1",
        )
        self.assertEqual(chosen, "Medium_Phone_API_36.1")


def _load_run_mobile_android():  # type: ignore[no-untyped-def]
    import sys

    if str(SCRIPTS) not in sys.path:
        sys.path.insert(0, str(SCRIPTS))
    import run_mobile_android

    return run_mobile_android


class AdbDevicesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runner = _load_run_mobile_android()

    def test_ready_emulator_line(self) -> None:
        output = "List of devices attached\nemulator-5554\tdevice\n"
        self.assertTrue(self.runner.adb_has_ready_device(output))

    def test_empty_or_offline_is_not_ready(self) -> None:
        self.assertFalse(self.runner.adb_has_ready_device("List of devices attached\n"))
        self.assertFalse(
            self.runner.adb_has_ready_device("List of devices attached\nemulator-5554\toffline\n")
        )

    def test_offline_emulator_is_still_registered(self) -> None:
        output = "List of devices attached\nemulator-5554\toffline\n"
        self.assertTrue(self.runner.adb_has_emulator_serial(output))
        self.assertFalse(self.runner.adb_has_ready_device(output))

    def test_boot_completed_prop(self) -> None:
        self.assertTrue(self.runner.adb_boot_completed("1\n"))
        self.assertFalse(self.runner.adb_boot_completed(""))
        self.assertFalse(self.runner.adb_boot_completed("0\n"))


if __name__ == "__main__":
    unittest.main()
