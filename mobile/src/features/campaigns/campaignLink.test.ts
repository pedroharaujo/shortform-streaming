import { campaignLandingPath, isCampaignSeriesLink, parseCampaignDeepLink } from './campaignLink';

describe('campaign deep links', () => {
  it.each([
    ['shortform://series/ser_launch', {}],
    ['/series/ser_launch?source=organic', { source: 'organic' }],
    [
      'shortform:///series/ser_launch?utm_campaign=launch_1&ad_set=set_2&creative=hook_3&utm_source=tiktok&utm_medium=paid_social',
      {
        campaign: 'launch_1',
        adSet: 'set_2',
        creative: 'hook_3',
        source: 'tiktok',
        medium: 'paid_social',
      },
    ],
  ])(
    'parses direct, organic, and campaign links without retaining the raw URL',
    (path, attribution) => {
      const parsed = parseCampaignDeepLink(path);

      expect(parsed).toEqual({
        seriesId: 'ser_launch',
        target: '/series/ser_launch',
        attribution,
      });
      expect(campaignLandingPath(parsed!)).toBe('/campaign?series_id=ser_launch');
    },
  );

  it('drops ambiguous or unsafe campaign values while preserving a safe content route', () => {
    const parsed = parseCampaignDeepLink(
      '/series/ser_launch?campaign=first&campaign=second&creative=person%40example.com',
    );

    expect(parsed?.attribution).toEqual({});
  });

  it.each([
    '/series/',
    '/series/unsafe!',
    '/series/ser_launch/episode',
    '/series/ser_launch#fragment',
    'https://example.com/series/ser_launch',
  ])('rejects an invalid or non-app series target: %s', (path) => {
    expect(parseCampaignDeepLink(path)).toBeNull();
  });

  it('distinguishes malformed campaign series links from unrelated app routes', () => {
    expect(isCampaignSeriesLink('/series/unsafe!')).toBe(true);
    expect(isCampaignSeriesLink(`/series/${'a'.repeat(2_100)}`)).toBe(true);
    expect(isCampaignSeriesLink('/sign-in')).toBe(false);
  });
});
