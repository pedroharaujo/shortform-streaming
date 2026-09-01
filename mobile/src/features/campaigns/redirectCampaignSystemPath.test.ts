import { redirectCampaignSystemPath } from './redirectCampaignSystemPath';

it('rewrites a campaign series URL to the guarded landing route and records sanitized attribution', () => {
  const recordDeepLink = jest.fn();

  expect(
    redirectCampaignSystemPath(
      {
        path: 'shortform://series/ser_launch?utm_campaign=launch_1&utm_source=tiktok',
        initial: true,
      },
      recordDeepLink,
    ),
  ).toBe('/campaign?series_id=ser_launch');

  expect(recordDeepLink).toHaveBeenCalledWith(
    {
      seriesId: 'ser_launch',
      target: '/series/ser_launch',
      attribution: { campaign: 'launch_1', source: 'tiktok' },
    },
    true,
  );
});

it('fails a malformed series link closed while leaving unrelated app routes unchanged', () => {
  const recordDeepLink = jest.fn();

  expect(
    redirectCampaignSystemPath({ path: '/series/unsafe!', initial: false }, recordDeepLink),
  ).toBe('/');
  expect(redirectCampaignSystemPath({ path: '/sign-in', initial: false }, recordDeepLink)).toBe(
    '/sign-in',
  );
  expect(recordDeepLink).not.toHaveBeenCalled();
});
