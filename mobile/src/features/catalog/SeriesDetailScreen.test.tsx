import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  CatalogClient,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import { SeriesDetailScreen } from './SeriesDetailScreen';

const harborLightsDetail: CatalogSeriesDetail = {
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
  afterEach(async () => {
    await cleanup();
  });

  it('renders published seasons and listed episodes without lock or free inference', async () => {
    const onSelectEpisode = jest.fn();
    const view = await render(
      <SeriesDetailScreen
        client={stubSeriesClient({ outcome: 'ok', data: harborLightsDetail })}
        onBack={() => {}}
        onSelectEpisode={onSelectEpisode}
        seriesId="ser_harbor"
      />,
    );

    await waitFor(() => expect(view.getByText('Harbor Lights')).toBeTruthy());
    expect(
      view.getByText('Synthetic FR-only English microdrama for local catalog tests.'),
    ).toBeTruthy();
    expect(view.getByText('Season 1')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 1')).toBeTruthy();
    expect(view.getByText('Harbor Lights · Episode 6')).toBeTruthy();
    expect(view.getByTestId('episode-row-ep_harbor_1')).toBeTruthy();
    expect(view.getByTestId('episode-row-ep_harbor_6')).toBeTruthy();
    expect(view.queryByText(/^Free$/i)).toBeNull();
    expect(view.queryByText(/^Locked$/i)).toBeNull();
    expect(view.queryByText(/free/i)).toBeNull();
    expect(view.queryByText(/locked/i)).toBeNull();

    await fireEvent.press(view.getByTestId('episode-row-ep_harbor_1'));
    await fireEvent.press(view.getByTestId('episode-row-ep_harbor_6'));
    expect(onSelectEpisode).toHaveBeenNthCalledWith(1, 'ep_harbor_1');
    expect(onSelectEpisode).toHaveBeenNthCalledWith(2, 'ep_harbor_6');
  });

  it('shows not-found for an ineligible series, not a locked state', async () => {
    const view = await render(
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
    expect(view.getByText('This title is not available.')).toBeTruthy();
    expect(view.queryByText(/locked/i)).toBeNull();
    expect(view.queryByTestId('episode-row-ep_harbor_1')).toBeNull();
  });
});
