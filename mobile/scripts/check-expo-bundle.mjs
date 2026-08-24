/**
 * Produce Android and iOS JavaScript bundles with `expo export` and assert
 * that both platform outputs exist. This is a production JS check only: it
 * does not compile native Android/iOS projects or invoke EAS.
 *
 * Public environment fixtures match `scripts/check-expo-config.mjs`.
 */

import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXPO_CLI = createRequire(import.meta.url).resolve('expo/bin/cli');

const REQUIRED_ENVIRONMENT = {
  EXPO_PUBLIC_API_ENVIRONMENT: 'local',
  EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:8000',
  EXPO_PUBLIC_CATALOG_TERRITORY: 'FR',
};

const BUNDLE_EXTENSIONS = new Set(['.js', '.hbc']);

function baseEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_')),
  );
}

function fail(message) {
  process.stderr.write(`Expo bundle check failed: ${message}\n`);
  process.exitCode = 1;
}

function walkFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        stack.push(fullPath);
      } else if (stats.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function hasPlatformBundle(files, outputRoot, platform) {
  const platformMarker = `${path.sep}${platform}${path.sep}`;
  return files.some((filePath) => {
    const relative = filePath.slice(outputRoot.length);
    const extension = path.extname(filePath);
    return (
      BUNDLE_EXTENSIONS.has(extension) &&
      (relative.includes(platformMarker) || relative.includes(`${path.sep}${platform}.`))
    );
  });
}

const outputDir = mkdtempSync(path.join(tmpdir(), 'shortform-expo-export-'));

try {
  const result = spawnSync(
    process.execPath,
    [EXPO_CLI, 'export', '--platform', 'android', '--platform', 'ios', '--output-dir', outputDir],
    {
      cwd: MOBILE_ROOT,
      encoding: 'utf8',
      env: { ...baseEnvironment(), ...REQUIRED_ENVIRONMENT },
    },
  );

  if (result.status !== 0) {
    fail(`expo export exited with ${result.status}.\n${result.stderr ?? ''}${result.stdout ?? ''}`);
  } else {
    const files = walkFiles(outputDir);
    const androidOk = hasPlatformBundle(files, outputDir, 'android');
    const iosOk = hasPlatformBundle(files, outputDir, 'ios');
    if (!androidOk || !iosOk) {
      const listing = files
        .map((filePath) => path.relative(outputDir, filePath))
        .sort()
        .join('\n');
      fail(
        `expo export did not produce Android and iOS JavaScript bundles.\n` +
          `android=${androidOk} ios=${iosOk}\n${listing}`,
      );
    } else {
      process.stdout.write(
        'Expo production JavaScript bundles written for android and ios; ' +
          'native compile and EAS were not invoked.\n',
      );
    }
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
