/**
 * Mobile catalog outcomes mapped through the generated OpenAPI client.
 *
 * HTTP paths and JSON bodies come from `@shortform/api-client`. These types
 * describe client-side mapping (timeout, unreachable, 404-as-not-found) that
 * is not a second HTTP contract. Monetization lock state is omitted (P2-T03);
 * 404 is not-found, never locked.
 */

import type { components } from '@shortform/api-client';

export const CATALOG_LANGUAGE = 'en';

export type CatalogPlatform = 'ios' | 'android';

export type CatalogHome = components['schemas']['CatalogHome'];
export type CatalogRail = components['schemas']['CatalogRail'];
export type CatalogSeriesCard = components['schemas']['CatalogSeriesCard'];
export type CatalogSeriesDetail = components['schemas']['CatalogSeriesDetail'];
export type CatalogSeason = components['schemas']['CatalogSeason'];
export type CatalogEpisodeSummary = components['schemas']['CatalogEpisodeSummary'];
export type CatalogEpisodeDetail = components['schemas']['CatalogEpisodeDetail'];
export type ErrorEnvelope = components['schemas']['ErrorEnvelope'];

export type CatalogRequestOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | {
      readonly outcome: 'error';
      readonly httpStatus: number;
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'not-found';
      readonly httpStatus: 404;
      readonly code: string;
      readonly message: string;
    }
  | { readonly outcome: 'unreachable'; readonly reason: string };

export interface CatalogClient {
  getHome(): Promise<CatalogRequestOutcome<CatalogHome>>;
  getSeries(publicId: string): Promise<CatalogRequestOutcome<CatalogSeriesDetail>>;
  getEpisode(publicId: string): Promise<CatalogRequestOutcome<CatalogEpisodeDetail>>;
}

export class CatalogPlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogPlatformError';
  }
}
