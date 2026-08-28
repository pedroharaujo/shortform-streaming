import type { ReactElement } from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import type { PlaybackClient, PlaybackRequestOutcome } from '../../api/playback/types';
import type { ProgressClient, ProgressRequestOutcome } from '../../api/progress/types';
import { PlayerScreen } from './PlayerScreen';

const GRANTED_URI = 'https://video.example.test/hls/a/playlist.m3u8?token=secret';

jest.mock('./HlsVideoView', () => {
  const { createElement } = require('react') as typeof import('react');
  const { Pressable, Text, View } = require('react-native') as typeof import('react-native');
  return {
    HlsVideoView: ({ onEnded, testID }: { onEnded?: () => void; testID?: string }) =>
      createElement(
        View,
        { testID: testID ?? 'player-video' },
        createElement(
          Pressable,
          { onPress: () => onEnded?.(), testID: 'player-simulate-end' },
          createElement(Text, null, 'Simulate end'),
        ),
      ),
  };
});

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

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderPlayer(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
    ),
  });
}

function stubCatalog(): CatalogClient {
  return {
    getHome: async () => ({ outcome: 'ok', data: { rails: [] } }),
    getSeries: async () => ({ outcome: 'ok', data: harborSeries }),
    getEpisode: async () => ({ outcome: 'ok', data: harborEpisode }),
  };
}

function stubPlayback(authorize: (id: string) => Promise<PlaybackRequestOutcome>): PlaybackClient {
  return { authorize };
}

function stubProgress(
  outcome: ProgressRequestOutcome = {
    outcome: 'not-found',
    httpStatus: 404,
    code: 'not_found',
    message: 'Resource not found.',
  },
): ProgressClient {
  return {
    get: async () => outcome,
    put: async () => ({
      outcome: 'ok',
      data: {
        episode_id: 'ep_harbor_1',
        position_seconds: 90,
        completed: true,
        updated_at: '2026-08-28T12:00:00Z',
      },
    }),
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
        playback={stubPlayback(async () => ({
          outcome: 'ok',
          data: {
            decision: 'granted',
            playback_url: GRANTED_URI,
            expires_at: '2026-08-28T12:10:00Z',
          },
        }))}
        progress={stubProgress()}
      />,
    );

    expect(await view.findByTestId('player-loaded')).toBeTruthy();
    expect(view.getByTestId('player-video')).toBeTruthy();
    visibleHasSecrets(view);
    expect(view.queryAllByText('Free')).toHaveLength(0);
    expect(view.queryAllByText('Locked')).toHaveLength(0);
  });

  it('shows lock reasons for a locked next episode and does not keep a next URI', async () => {
    const authorize = jest.fn(async (id: string): Promise<PlaybackRequestOutcome> => {
      if (id === 'ep_harbor_6') {
        return { outcome: 'locked', lockReasons: ['login_required'] };
      }
      return {
        outcome: 'ok',
        data: {
          decision: 'granted',
          playback_url: GRANTED_URI,
          expires_at: '2026-08-28T12:10:00Z',
        },
      };
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
