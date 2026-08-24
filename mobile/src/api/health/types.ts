/**
 * Mobile probe outcomes for backend health endpoints.
 *
 * HTTP paths and JSON bodies come from `@shortform/api-client`. These types
 * describe client-side mapping (timeout, unreachable, unknown JSON) that is
 * not part of the OpenAPI document.
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
