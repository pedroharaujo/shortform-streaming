import type { CatalogSeason } from '../../api/catalog/types';

export const COMPLETION_RATIO = 0.95;
export const PROGRESS_THROTTLE_MS = 10_000;

export function clampResumePosition(positionSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) {
    return 0;
  }
  if (durationSeconds <= 0) {
    return 0;
  }
  if (positionSeconds < 0) {
    return 0;
  }
  if (positionSeconds > durationSeconds) {
    return durationSeconds;
  }
  return Math.floor(positionSeconds);
}

export function isCompleteByPosition(positionSeconds: number, durationSeconds: number): boolean {
  if (durationSeconds <= 0) {
    return false;
  }
  return positionSeconds >= durationSeconds * COMPLETION_RATIO;
}

export function resumePlaybackPosition(positionSeconds: number, durationSeconds: number): number {
  if (isCompleteByPosition(positionSeconds, durationSeconds)) {
    return 0;
  }
  return clampResumePosition(positionSeconds, durationSeconds);
}

export function shouldSkipProgressPut(
  previous: { readonly positionSeconds: number; readonly completed: boolean } | null,
  next: { readonly positionSeconds: number; readonly completed: boolean },
): boolean {
  if (previous === null) {
    return false;
  }
  return previous.positionSeconds === next.positionSeconds && previous.completed === next.completed;
}

export function nextOpaqueEpisodeId(
  seasons: readonly CatalogSeason[],
  currentEpisodeId: string,
): string | null {
  const orderedIds = seasons.flatMap((season) => season.episodes.map((episode) => episode.id));
  const index = orderedIds.indexOf(currentEpisodeId);
  if (index < 0 || index + 1 >= orderedIds.length) {
    return null;
  }
  return orderedIds[index + 1] ?? null;
}
