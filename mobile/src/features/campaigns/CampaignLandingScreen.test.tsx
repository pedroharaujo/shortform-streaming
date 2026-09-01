import { render, waitFor } from '@testing-library/react-native';

import type { CatalogClient, CatalogSeriesDetail } from '../../api/catalog/types';
import { CampaignLandingScreen } from './CampaignLandingScreen';

const launchSeries = { id: 'ser_launch' } as CatalogSeriesDetail;

function catalog(outcome: Awaited<ReturnType<CatalogClient['getSeries']>>): CatalogClient {
  return {
    getHome: jest.fn(),
    getEpisode: jest.fn(),
    getSeries: jest.fn(async () => outcome),
  };
}

it.each([
  [{ outcome: 'ok' as const, data: launchSeries }, 'ser_launch'],
  [
    { outcome: 'not-found' as const, code: 'not_found', message: 'Missing.', httpStatus: 404 },
    null,
  ],
])(
  'opens only an eligible launch series and otherwise resolves to home',
  async (outcome, expected) => {
    const onResolve = jest.fn();
    render(
      <CampaignLandingScreen
        client={catalog(outcome)}
        onResolve={onResolve}
        seriesId="ser_launch"
      />,
    );

    await waitFor(() => expect(onResolve).toHaveBeenCalledWith(expected));
  },
);

it('returns an invalid internal target to home without calling the catalog', async () => {
  const client = catalog({
    outcome: 'not-found',
    code: 'not_found',
    message: 'Missing.',
    httpStatus: 404,
  });
  const onResolve = jest.fn();
  render(<CampaignLandingScreen client={client} onResolve={onResolve} seriesId="" />);

  await waitFor(() => expect(onResolve).toHaveBeenCalledWith(null));
  expect(client.getSeries).not.toHaveBeenCalled();
});

it('returns to home if eligibility cannot be checked', async () => {
  const client = catalog({ outcome: 'ok', data: launchSeries });
  jest.mocked(client.getSeries).mockRejectedValueOnce(new Error('network failure'));
  const onResolve = jest.fn();
  render(<CampaignLandingScreen client={client} onResolve={onResolve} seriesId="ser_launch" />);

  await waitFor(() => expect(onResolve).toHaveBeenCalledWith(null));
});
