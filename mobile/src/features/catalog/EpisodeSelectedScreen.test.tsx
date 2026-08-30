import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogRequestOutcome,
} from '../../api/catalog/types';
import { expectNoFreeOrLockedBadges, renderWithSafeArea } from '../../testUtils';
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
    const view = await renderWithSafeArea(
      <EpisodeSelectedScreen
        client={stubEpisodeClient({ outcome: 'ok', data: harborEpisode })}
        episodeId="ep_harbor_1"
        onBack={() => {}}
        onPlay={() => {}}
      />,
    );

    expect(await view.findByTestId('episode-selected')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 1')).toBeTruthy();
    expect(view.getByLabelText('Play')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
  });

  it('shows not-found for an ineligible episode, not a locked state', async () => {
    const view = await renderWithSafeArea(
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
    expectNoFreeOrLockedBadges(view);
    expect(view.queryByTestId('episode-selected')).toBeNull();
  });
});
