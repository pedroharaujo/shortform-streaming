export interface CampaignAttribution {
  readonly campaign?: string;
  readonly adSet?: string;
  readonly creative?: string;
  readonly source?: string;
  readonly medium?: string;
}

export interface CampaignDeepLink {
  readonly seriesId: string;
  readonly target: string;
  readonly attribution: CampaignAttribution;
}

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const SERIES_ROUTE = 'series';

function safeToken(value: string | null): string | undefined {
  return value !== null && SAFE_TOKEN.test(value) ? value : undefined;
}

function readCanonicalParameter(url: URL, canonical: string, alias?: string): string | undefined {
  const canonicalValues = url.searchParams.getAll(canonical);
  const aliasValues = alias === undefined ? [] : url.searchParams.getAll(alias);
  const values = [...canonicalValues, ...aliasValues];
  if (values.length !== 1) return undefined;
  return safeToken(values[0] ?? null);
}

function seriesSegments(url: URL): readonly string[] | null {
  const pathname = url.pathname.split('/').filter(Boolean);
  if (url.hostname === SERIES_ROUTE) return [SERIES_ROUTE, ...pathname];
  if (url.hostname === '' || url.hostname === 'app') return pathname;
  return null;
}

function parseUrl(path: string): URL | null {
  if (path.length === 0 || path.length > 2_048) return null;
  try {
    const parsed = new URL(path, 'shortform://app');
    return parsed.protocol === 'shortform:' ? parsed : null;
  } catch {
    return null;
  }
}

export function isCampaignSeriesLink(path: string): boolean {
  if (path.length > 2_048) {
    return (
      path.startsWith('/series') ||
      path.startsWith('shortform://series') ||
      path.startsWith('shortform:///series')
    );
  }
  const url = parseUrl(path);
  const segments = url === null ? null : seriesSegments(url);
  return segments?.[0] === SERIES_ROUTE;
}

export function parseCampaignDeepLink(path: string): CampaignDeepLink | null {
  const url = parseUrl(path);
  if (url === null || url.hash !== '' || url.username !== '' || url.password !== '') return null;
  const segments = seriesSegments(url);
  if (segments === null || segments.length !== 2 || segments[0] !== SERIES_ROUTE) return null;
  const seriesId = safeToken(segments[1] ?? null);
  if (seriesId === undefined) return null;
  const campaign = readCanonicalParameter(url, 'campaign', 'utm_campaign');
  const adSet = readCanonicalParameter(url, 'ad_set');
  const creative = readCanonicalParameter(url, 'creative');
  const source = readCanonicalParameter(url, 'source', 'utm_source');
  const medium = readCanonicalParameter(url, 'medium', 'utm_medium');

  return {
    seriesId,
    target: `/series/${seriesId}`,
    attribution: {
      ...(campaign === undefined ? {} : { campaign }),
      ...(adSet === undefined ? {} : { adSet }),
      ...(creative === undefined ? {} : { creative }),
      ...(source === undefined ? {} : { source }),
      ...(medium === undefined ? {} : { medium }),
    },
  };
}

export function campaignLandingPath(link: CampaignDeepLink): string {
  return `/campaign?series_id=${encodeURIComponent(link.seriesId)}`;
}
