import type { AnalyticsClient, AnalyticsLogResult } from './client';
import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  AnalyticsPlatform,
  CommonAnalyticsProperties,
} from './events';

export type ContextualAnalyticsEventName = Exclude<AnalyticsEventName, 'account_deleted'>;

export type ContextualAnalyticsProperties<Name extends ContextualAnalyticsEventName> = Omit<
  AnalyticsEventProperties[Name],
  keyof CommonAnalyticsProperties
>;

export interface AnalyticsRuntime {
  logOnce<Name extends ContextualAnalyticsEventName>(
    name: Name,
    logicalEventKey: string,
    properties: ContextualAnalyticsProperties<Name>,
  ): Promise<AnalyticsLogResult>;
}

export interface AccountAnalyticsRuntime extends AnalyticsRuntime {
  logAccountDeletionOnce(
    logicalEventKey: string,
    deletionStatus: 'completed' | 'provider_cleanup_pending',
  ): Promise<AnalyticsLogResult>;
}

export interface AnalyticsRuntimeContext {
  readonly appVersion: string;
  readonly appBuild: string;
  readonly platform: AnalyticsPlatform;
  readonly locale: string;
  readonly country?: string;
  readonly now: () => Date;
}

export function createAnalyticsRuntime(options: {
  readonly client: AnalyticsClient;
  readonly sessionId: string;
  readonly context: AnalyticsRuntimeContext;
}): AccountAnalyticsRuntime {
  const { client, context, sessionId } = options;
  const accepted = new Map<string, AnalyticsLogResult>();
  const inFlight = new Map<string, Promise<AnalyticsLogResult>>();

  return {
    logOnce<Name extends ContextualAnalyticsEventName>(
      name: Name,
      logicalEventKey: string,
      properties: ContextualAnalyticsProperties<Name>,
    ): Promise<AnalyticsLogResult> {
      const eventKey = `${sessionId}:${logicalEventKey}`;
      const deduplicationKey = `${name}:${eventKey}`;
      const previous = accepted.get(deduplicationKey);
      if (previous !== undefined) return Promise.resolve(previous);
      const pending = inFlight.get(deduplicationKey);
      if (pending !== undefined) return pending;

      const common: CommonAnalyticsProperties = {
        session_id: sessionId,
        app_version: context.appVersion,
        app_build: context.appBuild,
        platform: context.platform,
        locale: context.locale,
        occurred_at: context.now().toISOString(),
        ...(context.country === undefined ? {} : { country: context.country }),
      };
      const operation = client
        .log(name, eventKey, {
          ...common,
          ...properties,
        } as AnalyticsEventProperties[Name])
        .then((result) => {
          if (result.outcome === 'accepted') accepted.set(deduplicationKey, result);
          return result;
        })
        .finally(() => inFlight.delete(deduplicationKey));
      inFlight.set(deduplicationKey, operation);
      return operation;
    },
    logAccountDeletionOnce(logicalEventKey, deletionStatus): Promise<AnalyticsLogResult> {
      const eventKey = `deletion:${logicalEventKey}`;
      const deduplicationKey = `account_deleted:${eventKey}`;
      const previous = accepted.get(deduplicationKey);
      if (previous !== undefined) return Promise.resolve(previous);
      const pending = inFlight.get(deduplicationKey);
      if (pending !== undefined) return pending;

      const operation = client
        .log('account_deleted', eventKey, {
          occurred_at: context.now().toISOString(),
          deletion_status: deletionStatus,
        })
        .then((result) => {
          if (result.outcome === 'accepted') accepted.set(deduplicationKey, result);
          return result;
        })
        .finally(() => inFlight.delete(deduplicationKey));
      inFlight.set(deduplicationKey, operation);
      return operation;
    },
  };
}
