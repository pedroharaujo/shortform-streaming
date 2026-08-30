import type { ReactElement } from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import { PlayerScreen } from './PlayerScreen';

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
  original_language: 'en',
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

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const missingProgress: ProgressRequestOutcome = {
  outcome: 'not-found',
  httpStatus: 404,
  code: 'not_found',
  message: 'Resource not found.',
};

function renderPlayer(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
    ),
  });
}

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
      playback_url: GRANTED_URI,
      expires_at: '2026-08-28T12:10:00Z',
    },
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

function visibleHasSecrets(view: Awaited<ReturnType<typeof renderPlayer>>): void {
  expect(view.queryByText(GRANTED_URI)).toBeNull();
  expect(view.queryByText(/https:\/\//)).toBeNull();
  expect(view.queryByText(/token=/)).toBeNull();
  expect(view.queryByLabelText(GRANTED_URI)).toBeNull();
}

describe('PlayerScreen', () => {
  it('plays a granted episode without displaying the playback URI', async () => {
    const view = await renderPlayer(
      <PlayerScreen
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
  });

  it('resumes GET progress at 12s and treats GET 404 as start, not unavailable', async () => {
    const resumed = await renderPlayer(
      <PlayerScreen
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

    const missing = await renderPlayer(
      <PlayerScreen
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
    const view = await renderPlayer(
      <PlayerScreen
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
    const view = await renderPlayer(
      <PlayerScreen
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
    const view = await renderPlayer(
      <PlayerScreen
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
    const put = jest.fn(async (episodeId: string, body: WatchProgressWrite) =>
      okPut(episodeId, body),
    );
    const view = await renderPlayer(
      <PlayerScreen
        catalog={stubCatalog(grantedNextSeries)}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback(authorize)}
        progress={stubProgress({ put })}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    const user = userEvent.setup();
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
    const view = await renderPlayer(
      <PlayerScreen
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

  it('shows lock reasons for a locked next episode and does not keep a next URI', async () => {
    const authorize = jest.fn(async (id: string): Promise<PlaybackRequestOutcome> => {
      if (id === 'ep_harbor_6') {
        return { outcome: 'locked', lockReasons: ['login_required'] };
      }
      return grantedAuthorize(id);
    });
    const view = await renderPlayer(
      <PlayerScreen
        catalog={stubCatalog()}
        episodeId="ep_harbor_1"
        onClose={() => {}}
        playback={stubPlayback(authorize)}
        progress={stubProgress()}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(view.getByTestId('player-simulate-end'));
    expect(await view.findByTestId('player-locked')).toBeTruthy();
    expect(view.getByText('login_required')).toBeTruthy();
    expect(view.queryByTestId('player-loaded')).toBeNull();
    expect(view.queryByTestId('player-video')).toBeNull();
    visibleHasSecrets(view);
    expect(view.queryAllByText(/^Free$/i)).toHaveLength(0);
    expect(view.queryAllByText(/^Locked$/i)).toHaveLength(0);
  });

  it('uses static error copy without host or query tokens', async () => {
    const view = await renderPlayer(
      <PlayerScreen
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
  });
});
