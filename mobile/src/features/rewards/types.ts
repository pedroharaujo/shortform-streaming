import type { RewardIntent } from '../../api/rewards/types';
import type { RewardedAdLifecycleEvent } from './rewardAnalytics';

export interface RewardedAdPresenter {
  prepare(isCurrent: () => boolean): Promise<void>;
  present(
    intent: RewardIntent,
    isCurrent: () => boolean,
    onEvent: (event: RewardedAdLifecycleEvent) => void,
  ): Promise<'completed' | 'dismissed'>;
  privacy(isCurrent: () => boolean): Promise<void>;
}
