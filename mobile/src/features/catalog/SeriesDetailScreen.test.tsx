import type {
  CatalogClient,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import { expectNoFreeOrLockedBadges, renderWithSafeArea } from '../../testUtils';
import { SeriesDetailScreen } from './SeriesDetailScreen';

const harborLightsDetail: CatalogSeriesDetail = {
  id: 'ser_harbor',
  title: 'Harbor Lights',
  synopsis: 'Synthetic FR-only English microdrama for local catalog tests.',
  artwork_url: null,
  genres: [],
  seasons: [
    {
      number: 1,
      episodes: [
        {
          id: 'ep_harbor_1',
          order: 1,
          duration_seconds: 90,
          title: 'Harbor Lights · Episode 1',
          synopsis: 'Synthetic episode synopsis.',
        },
        {
          id: 'ep_harbor_6',
          order: 6,
          duration_seconds: 90,
          title: 'Harbor Lights · Episode 6',
          synopsis: 'Later listed episode.',
        },
      ],
    },
  ],
};

function stubSeriesClient(series: CatalogRequestOutcome<CatalogSeriesDetail>): CatalogClient {
  return {
    getHome: async () => ({ outcome: 'ok', data: { rails: [] } }),
    getSeries: async () => series,
    getEpisode: async () => ({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Resource not found.',
    }),
  };
}

describe('SeriesDetailScreen', () => {
  it('renders published seasons and listed episodes without lock or free inference', async () => {
    const view = await renderWithSafeArea(
      <SeriesDetailScreen
        client={stubSeriesClient({ outcome: 'ok', data: harborLightsDetail })}
        onBack={() => {}}
        onSelectEpisode={() => {}}
        seriesId="ser_harbor"
      />,
    );

    expect(await view.findByTestId('series-detail-loaded')).toBeTruthy();
    expect(view.getByTestId('series-detail-title')).toHaveTextContent('Harbor Lights');
    expect(view.getByTestId('series-season-1')).toBeTruthy();
    expect(view.getByTestId('episode-row-ep_harbor_1')).toBeTruthy();
    expect(view.getByTestId('episode-row-ep_harbor_6')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
  }, 10000);

  it('shows not-found for an ineligible series, not a locked state', async () => {
    const view = await renderWithSafeArea(
      <SeriesDetailScreen
        client={stubSeriesClient({
          outcome: 'not-found',
          httpStatus: 404,
          code: 'not_found',
          message: 'Resource not found.',
        })}
        onBack={() => {}}
        onSelectEpisode={() => {}}
        seriesId="ser_missing"
      />,
    );

    expect(await view.findByTestId('series-detail-not-found')).toBeTruthy();
    expectNoFreeOrLockedBadges(view);
    expect(view.queryByTestId('episode-row-ep_harbor_1')).toBeNull();
  });
});
