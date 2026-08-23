/**
 * Minimal typed client for the backend health endpoints.
 *
 * TEMPORARY: P1-T04 introduces the OpenAPI-generated client in
 * `packages/api-client` and this module is deleted at that point. It exists now
 * only to prove mobile-to-backend connectivity (plan task P1-T03).
 */

import type {
  BackendHealthSnapshot,
  HealthClient,
  HealthProbeName,
  HealthProbeResult,
  HealthResponseBody,
} from './types';

const PROBE_PATHS: Readonly<Record<HealthProbeName, string>> = {
  liveness: '/health/live',
  readiness: '/health/ready',
};

const DEFAULT_TIMEOUT_MS = 5_000;
const UNKNOWN_STATUS = 'unknown';

export interface HealthClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

function readStatus(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const { status } = payload as Partial<HealthResponseBody>;
    if (typeof status === 'string' && status !== '') {
      return status;
    }
  }
  return UNKNOWN_STATUS;
}

function describeFailure(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'timeout';
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'network request failed';
}

export function createHealthClient(options: HealthClientOptions): HealthClient {
  const { baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const performRequest = options.fetchImplementation ?? fetch;

  async function probe(name: HealthProbeName): Promise<HealthProbeResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await performRequest(`${baseUrl}${PROBE_PATHS[name]}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      let status = UNKNOWN_STATUS;
      try {
        status = readStatus(await response.json());
      } catch {
        status = UNKNOWN_STATUS;
      }

      if (!response.ok) {
        return { outcome: 'unavailable', probe: name, httpStatus: response.status, status };
      }
      return { outcome: 'available', probe: name, status };
    } catch (error: unknown) {
      return { outcome: 'unreachable', probe: name, reason: describeFailure(error) };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function probeAll(): Promise<BackendHealthSnapshot> {
    const [liveness, readiness] = await Promise.all([probe('liveness'), probe('readiness')]);
    return { liveness, readiness };
  }

  return { probe, probeAll };
}
