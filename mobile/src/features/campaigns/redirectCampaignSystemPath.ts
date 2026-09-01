import { getAppOpenTracker } from '../../analytics/appAnalytics';
import type { CampaignDeepLink } from './campaignLink';
import { campaignLandingPath, isCampaignSeriesLink, parseCampaignDeepLink } from './campaignLink';

type RecordDeepLink = (link: CampaignDeepLink, initial: boolean) => void;

function recordDeepLink(link: CampaignDeepLink, initial: boolean): void {
  getAppOpenTracker().recordDeepLink(link, initial);
}

export function redirectCampaignSystemPath(
  { path, initial }: { readonly path: string; readonly initial: boolean },
  record: RecordDeepLink = recordDeepLink,
): string {
  try {
    const link = parseCampaignDeepLink(path);
    if (link === null) return isCampaignSeriesLink(path) ? '/' : path;

    try {
      record(link, initial);
    } catch {
      // Analytics is optional and must never prevent a valid content route.
    }
    return campaignLandingPath(link);
  } catch {
    return '/';
  }
}
