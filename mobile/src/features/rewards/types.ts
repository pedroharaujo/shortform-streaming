import type { RewardIntent } from '../../api/rewards/types';

export interface RewardedAdPresenter {
  prepare(isCurrent: () => boolean): Promise<void>;
  present(intent: RewardIntent, isCurrent: () => boolean): Promise<'completed' | 'dismissed'>;
  privacy(isCurrent: () => boolean): Promise<void>;
}
