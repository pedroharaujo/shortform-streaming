import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync } from 'expo-crypto';

import {
  ANALYTICS_EVENT_SCHEMAS,
  isAnalyticsEventName,
  isValidAnalyticsProperty,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from './events';

export interface AnalyticsEnvelope<Name extends AnalyticsEventName = AnalyticsEventName> {
  readonly event_id: string;
  readonly name: Name;
  readonly properties: Readonly<Record<string, string | number>>;
}

export interface AnalyticsSink {
  send(event: AnalyticsEnvelope): Promise<void>;
}

export type AnalyticsLogResult =
  | { readonly outcome: 'accepted'; readonly eventId: string }
  | {
      readonly outcome: 'dropped';
      readonly reason: 'collection_disabled' | 'invalid_contract' | 'sink_unavailable';
    };

export class AnalyticsContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsContractError';
  }
}

export interface AnalyticsClient {
  log<Name extends AnalyticsEventName>(
    name: Name,
    logicalEventKey: string,
    properties: AnalyticsEventProperties[Name],
  ): Promise<AnalyticsLogResult>;
}

const NOOP_SINK: AnalyticsSink = Object.freeze({
  async send(): Promise<void> {},
});

function defaultMode(): 'development' | 'production' {
  return __DEV__ ? 'development' : 'production';
}

function fail(
  mode: 'development' | 'production',
  message: string,
): { readonly outcome: 'dropped'; readonly reason: 'invalid_contract' } {
  if (mode === 'development') throw new AnalyticsContractError(message);
  return { outcome: 'dropped', reason: 'invalid_contract' };
}

function validLogicalEventKey(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value);
}

async function eventId(name: AnalyticsEventName, logicalEventKey: string): Promise<string> {
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `shortform-analytics-v1:${name}:${logicalEventKey}`,
    { encoding: CryptoEncoding.HEX },
  );
  return `evt_${digest.slice(0, 32)}`;
}

function sanitize(
  name: AnalyticsEventName,
  properties: object,
  mode: 'development' | 'production',
):
  | { readonly valid: true; readonly properties: Readonly<Record<string, string | number>> }
  | { readonly valid: false; readonly result: AnalyticsLogResult } {
  const schema = ANALYTICS_EVENT_SCHEMAS[name];
  const supplied = new Map(Object.entries(properties));
  const sanitized: Record<string, string | number> = {};

  for (const key of supplied.keys()) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      if (mode === 'development') {
        throw new AnalyticsContractError(`Unknown property ${key} for event ${name}.`);
      }
      supplied.delete(key);
    }
  }

  for (const [key, rule] of Object.entries(schema)) {
    const value = supplied.get(key);
    if (value === undefined) {
      if (rule.optional === true) continue;
      return {
        valid: false,
        result: fail(mode, `Missing required property ${key} for event ${name}.`),
      };
    }
    if (!isValidAnalyticsProperty(rule, value)) {
      if (rule.optional === true && mode === 'production') continue;
      return {
        valid: false,
        result: fail(mode, `Invalid property ${key} for event ${name}.`),
      };
    }
    sanitized[key] = value as string | number;
  }

  return { valid: true, properties: Object.freeze(sanitized) };
}

export function createAnalyticsClient(options?: {
  readonly enabled?: boolean;
  readonly mode?: 'development' | 'production';
  readonly sink?: AnalyticsSink;
}): AnalyticsClient {
  const enabled = options?.enabled ?? false;
  const mode = options?.mode ?? defaultMode();
  const sink = options?.sink ?? NOOP_SINK;

  return {
    async log<Name extends AnalyticsEventName>(
      name: Name,
      logicalEventKey: string,
      properties: AnalyticsEventProperties[Name],
    ): Promise<AnalyticsLogResult> {
      if (!isAnalyticsEventName(name)) return fail(mode, `Unknown analytics event ${name}.`);
      if (!validLogicalEventKey(logicalEventKey)) {
        return fail(mode, 'Invalid logical analytics event key.');
      }
      const clean = sanitize(name, properties, mode);
      if (!clean.valid) return clean.result;
      if (!enabled) return { outcome: 'dropped', reason: 'collection_disabled' };
      try {
        const identifier = await eventId(name, logicalEventKey);
        await sink.send(
          Object.freeze({
            event_id: identifier,
            name,
            properties: clean.properties,
          }) as AnalyticsEnvelope,
        );
        return { outcome: 'accepted', eventId: identifier };
      } catch {
        return { outcome: 'dropped', reason: 'sink_unavailable' };
      }
    },
  };
}
