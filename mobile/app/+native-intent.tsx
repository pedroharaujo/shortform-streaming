import { redirectCampaignSystemPath } from '../src/features/campaigns/redirectCampaignSystemPath';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  return redirectCampaignSystemPath({ path, initial });
}
