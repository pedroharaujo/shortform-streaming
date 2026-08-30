/**
 * Mobile catalog outcomes mapped through the generated OpenAPI client.
 *
 * HTTP paths and JSON bodies come from `@shortform/api-client`. Monetization
 * lock state is omitted (P2-T03); 404 is not-found, never locked.
 */

import type { components } from '@shortform/api-client';

import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

/** OpenAPI `X-Platform` values. The ads-only client always sends `android` (D-027). */
export type CatalogPlatform = 'ios' | 'android';

export type CatalogHome = components['schemas']['CatalogHome'];
export type CatalogRail = components['schemas']['CatalogRail'];
export type CatalogSeriesCard = components['schemas']['CatalogSeriesCard'];
export type CatalogSeriesDetail = components['schemas']['CatalogSeriesDetail'];
export type CatalogSeason = components['schemas']['CatalogSeason'];
export type CatalogEpisodeSummary = components['schemas']['CatalogEpisodeSummary'];
export type CatalogEpisodeDetail = components['schemas']['CatalogEpisodeDetail'];

export type CatalogRequestOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | EnvelopeOutcome<'error'>
  | EnvelopeOutcome<'not-found'>
  | UnreachableOutcome;

export interface CatalogClient {
  getHome(): Promise<CatalogRequestOutcome<CatalogHome>>;
  getSeries(publicId: string): Promise<CatalogRequestOutcome<CatalogSeriesDetail>>;
  getEpisode(publicId: string): Promise<CatalogRequestOutcome<CatalogEpisodeDetail>>;
}
