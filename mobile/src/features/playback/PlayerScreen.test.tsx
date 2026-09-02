import { userEvent, waitFor } from '@testing-library/react-native';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import type { PlaybackClient, PlaybackRequestOutcome } from '../../api/playback/types';
import type {
  ProgressClient,
  ProgressRequestOutcome,
  WatchProgressWrite,
} from '../../api/progress/types';
import { englishMessages } from '../../localization/messages';
import { compactAndroidMetrics, renderWithSafeArea } from '../../testUtils';
import { minimumTouchTarget } from '../../ui/theme';
import { PlayerScreen } from './PlayerScreen';
import type { PlaybackAnalytics } from './playbackAnalytics';

const GRANTED_URI = 'https://video.example.test/hls/a/playlist.m3u8?token=secret';

jest.mock('./HlsVideoView');

const harborEpisode: CatalogEpisodeDetail = {
  id: 'ep_harbor_1',
  title: 'Harbor Lights · Episode 1',
  synopsis: 'Synthetic episode synopsis.',
  duration_seconds: 90,
  order: 1,
  series_id: 'ser_harbor',
  season_number: 1,
};

const harborSeries: CatalogSeriesDetail = {
  id: 'ser_harbor',
  title: 'Harbor Lights',
  synopsis: 'Synthetic FR-only English microdrama for local catalog tests.',
  artwork_url: null,
  genres: [],
  seasons: [
    {
      number: 1,
      episodes: [
        { id: 'ep_harbor_1', order: 1, duration_seconds: 90, title: 'One', synopsis: '' },
        { id: 'ep_harbor_6', order: 6, duration_seconds: 90, title: 'Six', synopsis: '' },
      ],
    },
  ],
};

const grantedNextSeries: CatalogSeriesDetail = {
  ...harborSeries,
  seasons: [
    {
      number: 1,
      episodes: [
        { id: 'ep_harbor_1', order: 1, duration_seconds: 90, title: 'One', synopsis: '' },
        { id: 'ep_harbor_2', order: 2, duration_seconds: 90, title: 'Two', synopsis: '' },
      ],
    },
  ],
};

const missingProgress: ProgressRequestOutcome = {
  outcome: 'not-found',
  httpStatus: 404,
  code: 'not_found',
  message: 'Resource not found.',
};

function stubCatalog(series: CatalogSeriesDetail = harborSeries): CatalogClient {
  return {
    getHome: async () => ({ outcome: 'ok', data: { rails: [] } }),
    getSeries: async () => ({ outcome: 'ok', data: series }),
    getEpisode: async (id: string) => {
      const match = series.seasons
        .flatMap((season) => season.episodes)
        .find((episode) => episode.id === id);
      return {
        outcome: 'ok',
        data: {
          ...harborEpisode,
          id,
          order: match?.order ?? harborEpisode.order,
          title: match ? `${series.title} · Episode ${match.order}` : harborEpisode.title,
        },
      };
    },
  };
}

function grantedAuthorize(_id: string): PlaybackRequestOutcome {
  return {
    outcome: 'ok',
    data: {
      decision: 'granted',
      access_method: 'free',
      playback_url: GRANTED_URI,
      expires_at: '2026-08-28T12:10:00Z',
    },
  };
}

function analyticsDouble(): jest.Mocked<PlaybackAnalytics> {
  return {
    recordStarted: jest.fn<
      ReturnType<PlaybackAnalytics['recordStarted']>,
      Parameters<PlaybackAnalytics['recordStarted']>
    >(async () => undefined),
    recordProgress: jest.fn<
      ReturnType<PlaybackAnalytics['recordProgress']>,
      Parameters<PlaybackAnalytics['recordProgress']>
    >(async () => undefined),
    recordLocked: jest.fn<
      ReturnType<PlaybackAnalytics['recordLocked']>,
      Parameters<PlaybackAnalytics['recordLocked']>
    >(async () => undefined),
    recordError: jest.fn<
      ReturnType<PlaybackAnalytics['recordError']>,
      Parameters<PlaybackAnalytics['recordError']>
    >(async () => undefined),
  };
}

function stubPlayback(
  authorize: (id: string) => Promise<PlaybackRequestOutcome> = async (id) => grantedAuthorize(id),
): PlaybackClient {
  return { authorize };
}

function okPut(episodeId: string, body: WatchProgressWrite): ProgressRequestOutcome {
  return {
    outcome: 'ok',
    data: {
      episode_id: episodeId,
      position_seconds: body.position_seconds,
      completed: body.completed ?? false,
      updated_at: '2026-08-28T12:00:00Z',
    },
  };
}

function stubProgress(options?: {
  readonly get?: ProgressRequestOutcome;
  readonly put?: ProgressClient['put'];
}): ProgressClient {
  return {
    get: async () => options?.get ?? missingProgress,
    put: options?.put ?? (async (episodeId, body) => okPut(episodeId, body)),
  };
}

function visibleHasSecrets(view: Awaited<ReturnType<typeof renderWithSafeArea>>): void {
  expect(view.queryByText(GRANTED_URI)).toBeNull();
  expect(view.queryByText(/https:\/\//)).toBeNull();
  expect(view.queryByText(/token=/)).toBeNull();
  expect(view.queryByLabelText(GRANTED_URI)).toBeNull();
}

describe('PlayerScreen', () => {
  it('plays a granted episode without displaying the playback URI', async () => {
    const analytics = analyticsDouble();
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analytics}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback()}
        progress={stubProgress()}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    expect(view.getByTestId('player-now-playing')).toHaveTextContent('Harbor Lights · Episode 1');
    expect(view.getByTestId('player-video')).toBeTruthy();
    expect(view.getByTestId('player-initial-position')).toHaveTextContent('0');
    visibleHasSecrets(view);
    expect(view.queryAllByText('Free')).toHaveLength(0);
    expect(view.queryAllByText('Locked')).toHaveLength(0);
    expect(analytics.recordStarted).not.toHaveBeenCalled();

    await userEvent.setup().press(view.getByTestId('player-simulate-start'));
    await waitFor(() =>
      expect(analytics.recordStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          accessMethod: 'free',
          episodeId: 'ep_harbor_1',
          startPositionSeconds: 0,
        }),
      ),
    );
  });

  it('resumes GET progress at 12s and treats GET 404 as start, not unavailable', async () => {
    const resumed = await renderWithSafeArea(
      <PlayerScreen
        analytics={analyticsDouble()}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback()}
        progress={stubProgress({
          get: {
            outcome: 'ok',
            data: {
              episode_id: 'ep_harbor_1',
              position_seconds: 12,
              completed: false,
              updated_at: '2026-08-28T12:00:00Z',
            },
          },
        })}
      />,
    );
    expect(await resumed.findByTestId('player-loaded')).toBeTruthy();
    expect(resumed.getByTestId('player-initial-position')).toHaveTextContent('12');
    expect(resumed.queryByTestId('player-error')).toBeNull();

    const missing = await renderWithSafeArea(
      <PlayerScreen
        analytics={analyticsDouble()}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback()}
        progress={stubProgress({ get: missingProgress })}
      />,
    );
    expect(await missing.findByTestId('player-loaded')).toBeTruthy();
    expect(missing.getByTestId('player-initial-position')).toHaveTextContent('0');
    expect(missing.queryByTestId('player-error')).toBeNull();
  });

  it('resumes a mid-rewatch even when completed is still sticky', async () => {
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analyticsDouble()}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback()}
        progress={stubProgress({
          get: {
            outcome: 'ok',
            data: {
              episode_id: 'ep_harbor_1',
              position_seconds: 12,
              completed: true,
              updated_at: '2026-08-28T12:00:00Z',
            },
          },
        })}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    expect(view.getByTestId('player-initial-position')).toHaveTextContent('12');
  });

  it('replays a completed episode from the start without autoplaying the next episode', async () => {
    const authorize = jest.fn(async (id: string) => grantedAuthorize(id));
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analyticsDouble()}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback(authorize)}
        progress={stubProgress({
          get: {
            outcome: 'ok',
            data: {
              episode_id: 'ep_harbor_1',
              position_seconds: 86,
              completed: true,
              updated_at: '2026-08-28T12:00:00Z',
            },
          },
        })}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    expect(view.getByTestId('player-initial-position')).toHaveTextContent('0');
    expect(view.queryByTestId('player-locked')).toBeNull();
    expect(authorize.mock.calls.map((call) => call[0])).toEqual(['ep_harbor_1']);
  });

  it('records 95% completion without changing episode', async () => {
    const authorize = jest.fn(async (id: string) => grantedAuthorize(id));
    const put = jest.fn(async (episodeId: string, body: WatchProgressWrite) =>
      okPut(episodeId, body),
    );
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analyticsDouble()}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback(authorize)}
        progress={stubProgress({ put })}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(view.getByTestId('player-simulate-near-complete'));
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(
        'ep_harbor_1',
        expect.objectContaining({ completed: true, position_seconds: 86 }),
      );
    });
    expect(view.getByTestId('player-loaded')).toBeTruthy();
    expect(view.getByTestId('player-initial-position')).toHaveTextContent('0');
    expect(view.queryByTestId('player-locked')).toBeNull();
    expect(authorize.mock.calls.map((call) => call[0])).toEqual(['ep_harbor_1']);
  });

  it('autoplays a granted next opaque id from true end and PUTs completed', async () => {
    const authorize = jest.fn(async (id: string) => grantedAuthorize(id));
    const analytics = analyticsDouble();
    const put = jest.fn(async (episodeId: string, body: WatchProgressWrite) =>
      okPut(episodeId, body),
    );
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analytics}
        catalog={stubCatalog(grantedNextSeries)}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback(authorize)}
        progress={stubProgress({ put })}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(view.getByTestId('player-simulate-start'));
    await user.press(view.getByTestId('player-simulate-end'));
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith('ep_harbor_1', expect.objectContaining({ completed: true }));
      expect(authorize.mock.calls.map((call) => call[0])).toEqual([
        'ep_harbor_1',
        'ep_harbor_2',
        'ep_harbor_2',
      ]);
    });
    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    expect(view.queryByTestId('player-locked')).toBeNull();
    expect(view.getByTestId('player-now-playing')).toHaveTextContent('Harbor Lights · Episode 2');
    await user.press(view.getByTestId('player-simulate-start'));
    await waitFor(() =>
      expect(analytics.recordStarted.mock.calls.map(([episode]) => episode.episodeId)).toEqual([
        'ep_harbor_1',
        'ep_harbor_2',
      ]),
    );
    expect(analytics.recordProgress).toHaveBeenCalledWith(
      expect.objectContaining({ episodeId: 'ep_harbor_1' }),
      90,
      true,
    );
    visibleHasSecrets(view);
  });

  it('retries a failed completed PUT on end', async () => {
    const put = jest.fn(async (episodeId: string, body: WatchProgressWrite) => {
      const completedAttempts = put.mock.calls.filter(([, payload]) => payload.completed).length;
      if (body.completed === true && completedAttempts === 1) {
        return {
          outcome: 'error' as const,
          httpStatus: 500,
          code: 'unknown',
          message: 'Progress request failed.',
        };
      }
      return okPut(episodeId, body);
    });
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analyticsDouble()}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback()}
        progress={stubProgress({ put })}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(view.getByTestId('player-simulate-end'));
    await waitFor(() => {
      const completedPuts = put.mock.calls.filter(([, payload]) => payload.completed === true);
      expect(completedPuts).toHaveLength(2);
      expect(completedPuts[0]?.[0]).toBe('ep_harbor_1');
      expect(completedPuts[1]?.[0]).toBe('ep_harbor_1');
    });
  });

  it('localizes a locked next episode without exposing server reasons on a compact screen', async () => {
    const onReward = jest.fn();
    const analytics = analyticsDouble();
    const longMessages = {
      ...englishMessages,
      playback: {
        ...englishMessages.playback,
        close: 'Close this episode player and return to the episode details',
        rewardRequired:
          'Watch a rewarded advertisement to unlock this episode before continuing playback.',
        viewReward: 'Review the rewarded-ad option for this selected episode',
      },
    };
    const authorize = jest.fn(async (id: string): Promise<PlaybackRequestOutcome> => {
      if (id === 'ep_harbor_6') {
        return { outcome: 'locked', lockReasons: ['login_required'] };
      }
      return grantedAuthorize(id);
    });
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analytics}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        onReward={onReward}
        playback={stubPlayback(authorize)}
        progress={stubProgress()}
      />,
      { messages: longMessages, metrics: compactAndroidMetrics },
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(view.getByTestId('player-simulate-end'));
    expect(await view.findByTestId('player-locked')).toBeTruthy();
    expect(view.getByTestId('player-locked')).toHaveProp('accessibilityLiveRegion', 'assertive');
    expect(view.getByText(longMessages.playback.rewardRequired)).toBeTruthy();
    expect(view.queryByText('login_required')).toBeNull();
    expect(view.getByLabelText(longMessages.playback.close)).toHaveStyle({
      minHeight: minimumTouchTarget,
      minWidth: minimumTouchTarget,
    });
    expect(view.getByLabelText(longMessages.playback.viewReward)).toHaveStyle({
      minHeight: minimumTouchTarget,
    });
    await user.press(view.getByLabelText(longMessages.playback.viewReward));
    expect(onReward).toHaveBeenCalledWith('ep_harbor_6');
    expect(view.queryByTestId('player-loaded')).toBeNull();
    expect(view.queryByTestId('player-video')).toBeNull();
    visibleHasSecrets(view);
    expect(view.queryAllByText(/^Free$/i)).toHaveLength(0);
    expect(view.queryAllByText(/^Locked$/i)).toHaveLength(0);
    await waitFor(() =>
      expect(analytics.recordLocked).toHaveBeenCalledWith(
        expect.objectContaining({ episodeId: 'ep_harbor_6' }),
        'reward_required',
      ),
    );
  });

  it('uses static error copy without host or query tokens', async () => {
    const analytics = analyticsDouble();
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analytics}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback(async () => ({
          outcome: 'error',
          httpStatus: 500,
          code: 'unknown',
          message: 'https://video.example.test/hls/a/playlist.m3u8?token=leak',
        }))}
        progress={stubProgress()}
      />,
    );

    expect(await view.findByTestId('player-error')).toBeTruthy();
    expect(view.getByText('Playback could not be started.')).toBeTruthy();
    visibleHasSecrets(view);
    expect(view.queryByText(/video\.example\.test/)).toBeNull();
    await waitFor(() =>
      expect(analytics.recordError).toHaveBeenCalledWith({
        episodeId: 'ep_harbor_1',
        code: 'authorize_failed',
        phase: 'authorize',
      }),
    );
  });

  it('turns a native video failure into static UI and a safe play-phase code', async () => {
    const analytics = analyticsDouble();
    const view = await renderWithSafeArea(
      <PlayerScreen
        analytics={analytics}
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback()}
        progress={stubProgress()}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    await userEvent.setup().press(view.getByTestId('player-simulate-error'));
    expect(await view.findByTestId('player-error')).toBeTruthy();
    expect(view.getByText('Playback could not be started.')).toBeTruthy();
    await waitFor(() =>
      expect(analytics.recordError).toHaveBeenCalledWith({
        episodeId: 'ep_harbor_1',
        code: 'video_playback_failed',
        phase: 'play',
      }),
    );
    visibleHasSecrets(view);
  });
});
