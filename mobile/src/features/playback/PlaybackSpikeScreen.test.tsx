import type { ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type {
  PlaybackAuthorizeResponse,
  PlaybackClient,
  PlaybackRequestOutcome,
} from '../../api/playback/types';
import { PlaybackSpikeScreen } from './PlaybackSpikeScreen';

jest.mock('expo-video', () => jest.requireActual('./expoVideoTestMock'));

const authorized: PlaybackAuthorizeResponse = {
  playback_url: 'https://video.example.test/hls/asset/playlist.m3u8?sig=synthetic',
  expires_at: '2026-08-25T12:10:00Z',
};

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderSpike(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
    ),
  });
}

function stubClient(result: PlaybackRequestOutcome<PlaybackAuthorizeResponse>): PlaybackClient {
  return {
    authorize: async () => result,
  };
}

describe('PlaybackSpikeScreen', () => {
  it('shows a loading state before authorize resolves', async () => {
    const pending: PlaybackClient = {
      authorize: () => new Promise(() => {}),
    };

    const view = await renderSpike(
      <PlaybackSpikeScreen client={pending} episodeId="ep_harbor_1" />,
    );

    expect(view.getByTestId('playback-spike-loading')).toBeTruthy();
    expect(view.getByLabelText('Loading playback')).toBeTruthy();
    expect(view.queryByTestId('playback-spike-video')).toBeNull();
  });

  it('shows an error and retries authorize', async () => {
    let calls = 0;
    const client: PlaybackClient = {
      authorize: async () => {
        calls += 1;
        return {
          outcome: 'error',
          httpStatus: 400,
          code: 'invalid_request_context',
          message: 'Catalog context is invalid.',
        };
      },
    };

    const view = await renderSpike(<PlaybackSpikeScreen client={client} episodeId="ep_harbor_1" />);

    expect(await view.findByTestId('playback-spike-error')).toBeTruthy();
    expect(view.getByText('Catalog context is invalid.')).toBeTruthy();
    expect(calls).toBe(1);

    await fireEvent.press(view.getByTestId('playback-spike-retry'));
    expect(await view.findByTestId('playback-spike-error')).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('wires the authorized HLS URL into expo-video', async () => {
    const view = await renderSpike(
      <PlaybackSpikeScreen
        client={stubClient({ outcome: 'ok', data: authorized })}
        episodeId="ep_harbor_1"
      />,
    );

    expect(await view.findByTestId('playback-spike-loaded')).toBeTruthy();
    expect(view.getByTestId('playback-spike-video')).toBeTruthy();
    expect(view.getByTestId('playback-spike-video-uri')).toHaveTextContent(authorized.playback_url);
    expect(view.queryByTestId('playback-spike-loading')).toBeNull();
  });
});
