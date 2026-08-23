/**
 * Hand-written request/response types for the backend health endpoints.
 *
 * TEMPORARY: P1-T04 replaces this module with the OpenAPI-generated client in
 * `packages/api-client`. Do not grow this surface beyond the health probes.
 */

/** Response body of `GET /health/live` and `GET /health/ready`. */
export interface HealthResponseBody {
  readonly status: string;
}

export type HealthProbeName = 'liveness' | 'readiness';

export type HealthProbeResult =
  | { readonly outcome: 'available'; readonly probe: HealthProbeName; readonly status: string }
  | {
      readonly outcome: 'unavailable';
      readonly probe: HealthProbeName;
      readonly httpStatus: number;
      readonly status: string;
    }
  | { readonly outcome: 'unreachable'; readonly probe: HealthProbeName; readonly reason: string };

export interface BackendHealthSnapshot {
  readonly liveness: HealthProbeResult;
  readonly readiness: HealthProbeResult;
}

export interface HealthClient {
  probe(name: HealthProbeName): Promise<HealthProbeResult>;
  probeAll(): Promise<BackendHealthSnapshot>;
}
