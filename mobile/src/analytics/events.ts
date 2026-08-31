export const ANALYTICS_EVENT_NAMES = [
  'app_open',
  'sign_up',
  'login',
  'account_deleted',
  'home_viewed',
  'series_impression',
  'series_opened',
  'episode_started',
  'episode_progress',
  'episode_completed',
  'playback_error',
  'locked_episode_viewed',
  'offer_presented',
  'offer_selected',
  'rewarded_ad_loaded',
  'rewarded_ad_started',
  'rewarded_ad_completed',
  'reward_granted',
  'reward_failed',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsPlatform = 'android' | 'ios';
export type AccessMethod = 'free' | 'rewarded_ad';

export interface CommonAnalyticsProperties {
  readonly session_id: string;
  readonly app_version: string;
  readonly app_build: string;
  readonly platform: AnalyticsPlatform;
  readonly locale: string;
  readonly occurred_at: string;
  readonly country?: string;
}

interface EpisodeProperties {
  readonly series_id: string;
  readonly episode_id: string;
  readonly season_number: number;
  readonly episode_number: number;
}

interface OfferProperties extends EpisodeProperties {
  readonly access_method: 'rewarded_ad';
}

interface DeletedAccountAnalyticsProperties {
  readonly occurred_at: string;
  readonly deletion_status: 'completed' | 'provider_cleanup_pending';
}

export interface AnalyticsEventProperties {
  readonly app_open: CommonAnalyticsProperties & {
    readonly launch_reason: 'cold' | 'foreground' | 'deep_link';
    readonly campaign?: string;
    readonly ad_set?: string;
    readonly creative?: string;
    readonly source?: string;
    readonly medium?: string;
    readonly deep_link_target?: string;
  };
  readonly sign_up: CommonAnalyticsProperties & { readonly method: 'password' | 'google' };
  readonly login: CommonAnalyticsProperties & { readonly method: 'password' | 'google' };
  readonly account_deleted: DeletedAccountAnalyticsProperties;
  readonly home_viewed: CommonAnalyticsProperties;
  readonly series_impression: CommonAnalyticsProperties & {
    readonly series_id: string;
    readonly position: number;
  };
  readonly series_opened: CommonAnalyticsProperties & { readonly series_id: string };
  readonly episode_started: CommonAnalyticsProperties &
    EpisodeProperties & {
      readonly access_method: AccessMethod;
      readonly start_position_seconds: number;
    };
  readonly episode_progress: CommonAnalyticsProperties &
    EpisodeProperties & {
      readonly position_seconds: number;
      readonly duration_seconds: number;
    };
  readonly episode_completed: CommonAnalyticsProperties &
    EpisodeProperties & { readonly duration_seconds: number };
  readonly playback_error: CommonAnalyticsProperties & {
    readonly episode_id?: string;
    readonly error_code: string;
    readonly playback_phase: 'authorize' | 'load' | 'play' | 'progress';
  };
  readonly locked_episode_viewed: CommonAnalyticsProperties &
    EpisodeProperties & {
      readonly lock_reason: 'reward_required' | 'unavailable' | 'ineligible';
    };
  readonly offer_presented: CommonAnalyticsProperties & OfferProperties;
  readonly offer_selected: CommonAnalyticsProperties & OfferProperties;
  readonly rewarded_ad_loaded: CommonAnalyticsProperties & OfferProperties;
  readonly rewarded_ad_started: CommonAnalyticsProperties & OfferProperties;
  readonly rewarded_ad_completed: CommonAnalyticsProperties & OfferProperties;
  readonly reward_granted: CommonAnalyticsProperties &
    EpisodeProperties & { readonly grant_source: 'admob_ssv' };
  readonly reward_failed: CommonAnalyticsProperties &
    EpisodeProperties & {
      readonly failure_stage: 'offer' | 'load' | 'present' | 'verify';
      readonly error_code: string;
    };
}

type StringFormat =
  | 'opaque'
  | 'safe_token'
  | 'version'
  | 'locale'
  | 'country'
  | 'iso_datetime'
  | 'internal_route'
  | 'error_code';

export type AnalyticsPropertyRule =
  | {
      readonly kind: 'string';
      readonly format: StringFormat;
      readonly optional?: true;
      readonly allowed?: readonly string[];
    }
  | {
      readonly kind: 'number';
      readonly min: number;
      readonly max: number;
      readonly integer?: true;
      readonly optional?: true;
    };

export type AnalyticsEventSchema = Readonly<Record<string, AnalyticsPropertyRule>>;

const commonSchema = {
  session_id: { kind: 'string', format: 'opaque' },
  app_version: { kind: 'string', format: 'version' },
  app_build: { kind: 'string', format: 'version' },
  platform: { kind: 'string', format: 'safe_token', allowed: ['android', 'ios'] },
  locale: { kind: 'string', format: 'locale' },
  occurred_at: { kind: 'string', format: 'iso_datetime' },
  country: { kind: 'string', format: 'country', optional: true },
} as const satisfies AnalyticsEventSchema;

const episodeSchema = {
  series_id: { kind: 'string', format: 'opaque' },
  episode_id: { kind: 'string', format: 'opaque' },
  season_number: { kind: 'number', min: 1, max: 10_000, integer: true },
  episode_number: { kind: 'number', min: 1, max: 100_000, integer: true },
} as const satisfies AnalyticsEventSchema;

const offerSchema = {
  ...episodeSchema,
  access_method: { kind: 'string', format: 'safe_token', allowed: ['rewarded_ad'] },
} as const satisfies AnalyticsEventSchema;

export const ANALYTICS_EVENT_SCHEMAS = {
  app_open: {
    ...commonSchema,
    launch_reason: {
      kind: 'string',
      format: 'safe_token',
      allowed: ['cold', 'foreground', 'deep_link'],
    },
    campaign: { kind: 'string', format: 'safe_token', optional: true },
    ad_set: { kind: 'string', format: 'safe_token', optional: true },
    creative: { kind: 'string', format: 'safe_token', optional: true },
    source: { kind: 'string', format: 'safe_token', optional: true },
    medium: { kind: 'string', format: 'safe_token', optional: true },
    deep_link_target: { kind: 'string', format: 'internal_route', optional: true },
  },
  sign_up: {
    ...commonSchema,
    method: { kind: 'string', format: 'safe_token', allowed: ['password', 'google'] },
  },
  login: {
    ...commonSchema,
    method: { kind: 'string', format: 'safe_token', allowed: ['password', 'google'] },
  },
  account_deleted: {
    occurred_at: { kind: 'string', format: 'iso_datetime' },
    deletion_status: {
      kind: 'string',
      format: 'safe_token',
      allowed: ['completed', 'provider_cleanup_pending'],
    },
  },
  home_viewed: { ...commonSchema },
  series_impression: {
    ...commonSchema,
    series_id: { kind: 'string', format: 'opaque' },
    position: { kind: 'number', min: 0, max: 100_000, integer: true },
  },
  series_opened: {
    ...commonSchema,
    series_id: { kind: 'string', format: 'opaque' },
  },
  episode_started: {
    ...commonSchema,
    ...episodeSchema,
    access_method: {
      kind: 'string',
      format: 'safe_token',
      allowed: ['free', 'rewarded_ad'],
    },
    start_position_seconds: { kind: 'number', min: 0, max: 86_400 },
  },
  episode_progress: {
    ...commonSchema,
    ...episodeSchema,
    position_seconds: { kind: 'number', min: 0, max: 86_400 },
    duration_seconds: { kind: 'number', min: 0, max: 86_400 },
  },
  episode_completed: {
    ...commonSchema,
    ...episodeSchema,
    duration_seconds: { kind: 'number', min: 0, max: 86_400 },
  },
  playback_error: {
    ...commonSchema,
    episode_id: { kind: 'string', format: 'opaque', optional: true },
    error_code: { kind: 'string', format: 'error_code' },
    playback_phase: {
      kind: 'string',
      format: 'safe_token',
      allowed: ['authorize', 'load', 'play', 'progress'],
    },
  },
  locked_episode_viewed: {
    ...commonSchema,
    ...episodeSchema,
    lock_reason: {
      kind: 'string',
      format: 'safe_token',
      allowed: ['reward_required', 'unavailable', 'ineligible'],
    },
  },
  offer_presented: { ...commonSchema, ...offerSchema },
  offer_selected: { ...commonSchema, ...offerSchema },
  rewarded_ad_loaded: { ...commonSchema, ...offerSchema },
  rewarded_ad_started: { ...commonSchema, ...offerSchema },
  rewarded_ad_completed: { ...commonSchema, ...offerSchema },
  reward_granted: {
    ...commonSchema,
    ...episodeSchema,
    grant_source: { kind: 'string', format: 'safe_token', allowed: ['admob_ssv'] },
  },
  reward_failed: {
    ...commonSchema,
    ...episodeSchema,
    failure_stage: {
      kind: 'string',
      format: 'safe_token',
      allowed: ['offer', 'load', 'present', 'verify'],
    },
    error_code: { kind: 'string', format: 'error_code' },
  },
} as const satisfies Record<AnalyticsEventName, AnalyticsEventSchema>;

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_SCHEMAS, value);
}

function validStringFormat(format: StringFormat, value: string): boolean {
  switch (format) {
    case 'opaque':
      return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
    case 'safe_token':
      return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
    case 'version':
      return /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,31}$/.test(value);
    case 'locale':
      return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value);
    case 'country':
      return /^[A-Z]{2}$/.test(value);
    case 'iso_datetime':
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
      if (Number.isNaN(Date.parse(value))) return false;
      const normalized = new Date(value).toISOString();
      return value === normalized || value === normalized.replace('.000Z', 'Z');
    case 'internal_route':
      return /^\/[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$/.test(value);
    case 'error_code':
      return /^[a-z][a-z0-9_]{0,63}$/.test(value);
  }
}

export function isValidAnalyticsProperty(rule: AnalyticsPropertyRule, value: unknown): boolean {
  if (rule.kind === 'number') {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= rule.min &&
      value <= rule.max &&
      (rule.integer !== true || Number.isInteger(value))
    );
  }
  return (
    typeof value === 'string' &&
    validStringFormat(rule.format, value) &&
    (rule.allowed === undefined || rule.allowed.includes(value))
  );
}
