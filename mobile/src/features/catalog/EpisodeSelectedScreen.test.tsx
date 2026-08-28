import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogRequestOutcome,
} from '../../api/catalog/types';
import { EpisodeSelectedScreen } from './EpisodeSelectedScreen';

const harborEpisode: CatalogEpisodeDetail = {
  id: 'ep_harbor_1',
  title: 'Harbor Lights · Episode 1',
  synopsis: 'Synthetic episode synopsis.',
  duration_seconds: 90,
  order: 1,
  series_id: 'ser_harbor',
  season_number: 1,
};

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderEpisodeScreen(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>
    ),
  });
}

function stubEpisodeClient(episode: CatalogRequestOutcome<CatalogEpisodeDetail>): CatalogClient {
  return {
    getHome: async () => ({ outcome: 'ok', data: { rails: [] } }),
    getSeries: async () => ({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    }),
    getEpisode: async () => episode,
  };
}

function expectNoFreeOrLockedBadges(view: Awaited<ReturnType<typeof renderEpisodeScreen>>): void {
  expect(view.queryAllByText('Free')).toHaveLength(0);
  expect(view.queryAllByText('Locked')).toHaveLength(0);
  expect(view.queryAllByText(/^Free$/i)).toHaveLength(0);
  expect(view.queryAllByText(/^Locked$/i)).toHaveLength(0);
}

describe('EpisodeSelectedScreen', () => {
  it('shows the selected listed episode without playback', async () => {
    const view = await renderEpisodeScreen(
      <EpisodeSelectedScreen
        client={stubEpisodeClient({ outcome: 'ok', data: harborEpisode })}
        episodeId="ep_harbor_1"
        onBack={() => {}}
        onPlay={() => {}}
      />,
    );

    expect(await view.findByTestId('episode-selected')).toBeTruthy();
    expect(view.getByText('Selected episode')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 1')).toBeTruthy();
    expect(view.getByText('Synthetic episode synopsis.')).toBeTruthy();
    expect(view.getByLabelText('Play')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
  });

  it('shows not-found for an ineligible episode, not a locked state', async () => {
    const view = await renderEpisodeScreen(
      <EpisodeSelectedScreen
        client={stubEpisodeClient({
          outcome: 'not-found',
          httpStatus: 404,
          code: 'not_found',
          message: 'Resource not found.',
        })}
        episodeId="ep_missing"
        onBack={() => {}}
        onPlay={() => {}}
      />,
    );

    expect(await view.findByTestId('episode-selected-not-found')).toBeTruthy();
    expect(view.getByText('This episode is not available.')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
    expect(view.queryByTestId('episode-selected')).toBeNull();
  });
});
