/**
 * Health probes mapped through the generated OpenAPI client.
 *
 * Probe outcomes (timeout, unreachable, unknown JSON) are mobile-specific and
 * are not part of the OpenAPI document. HTTP paths and success/error bodies
 * come from `@shortform/api-client`.
 */

import { createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, describeFailure, withTimeout } from '../http';
import type {
  BackendHealthSnapshot,
  HealthClient,
  HealthProbeName,
  HealthProbeResult,
  HealthResponseBody,
} from './types';

const PROBE_PATHS = {
  liveness: '/health/live',
  readiness: '/health/ready',
} as const satisfies Record<HealthProbeName, '/health/live' | '/health/ready'>;

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

function parseStatus(rawBody: string): string {
  try {
    return readStatus(JSON.parse(rawBody) as unknown);
  } catch {
    return UNKNOWN_STATUS;
  }
}

export function createHealthClient(options: HealthClientOptions): HealthClient {
  const { baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const api = createOpenApiClient({
    baseUrl,
    fetchImplementation: options.fetchImplementation,
  });

  async function probe(name: HealthProbeName): Promise<HealthProbeResult> {
    try {
      const { data, error, response } = await withTimeout(timeoutMs, (signal) =>
        api.GET(PROBE_PATHS[name], {
          headers: { Accept: 'application/json' },
          parseAs: 'text',
          signal,
        }),
      );

      const status =
        typeof data === 'string' || typeof error === 'string'
          ? parseStatus(typeof data === 'string' ? data : (error as string))
          : readStatus(data ?? error);

      if (!response.ok) {
        return { outcome: 'unavailable', probe: name, httpStatus: response.status, status };
      }
      return { outcome: 'available', probe: name, status };
    } catch (error: unknown) {
      return { outcome: 'unreachable', probe: name, reason: describeFailure(error) };
    }
  }

  async function probeAll(): Promise<BackendHealthSnapshot> {
    const [liveness, readiness] = await Promise.all([probe('liveness'), probe('readiness')]);
    return { liveness, readiness };
  }

  return { probe, probeAll };
}
