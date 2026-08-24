import { render, waitFor } from '@testing-library/react-native';

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

describe('EpisodeSelectedScreen', () => {
  it('shows the selected listed episode without playback', async () => {
    const view = await render(
      <EpisodeSelectedScreen
        client={stubEpisodeClient({ outcome: 'ok', data: harborEpisode })}
        episodeId="ep_harbor_1"
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(view.getByTestId('episode-selected')).toBeTruthy());
    expect(view.getByText('Selected episode')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 1')).toBeTruthy();
    expect(view.getByText('Synthetic episode synopsis.')).toBeTruthy();
    expect(view.queryByText(/free/i)).toBeNull();
    expect(view.queryByText(/locked/i)).toBeNull();
  });

  it('shows not-found for an ineligible episode, not a locked state', async () => {
    const view = await render(
      <EpisodeSelectedScreen
        client={stubEpisodeClient({
          outcome: 'not-found',
          httpStatus: 404,
          code: 'not_found',
          message: 'Resource not found.',
        })}
        episodeId="ep_missing"
        onBack={() => {}}
      />,
    );

    await waitFor(() => expect(view.getByTestId('episode-selected-not-found')).toBeTruthy());
    expect(view.getByText('This episode is not available.')).toBeTruthy();
    expect(view.queryByText(/locked/i)).toBeNull();
  });
});
