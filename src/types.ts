export interface Episode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  durationSeconds: number;
  videoUrl: string;
  thumbnailUrl: string;
  coinCost: number;
  isFree: boolean;
}

export interface Series {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  verticalCoverUrl: string;
  horizontalBannerUrl: string;
  tags: string[];
  totalEpisodes: number;
  freeEpisodesCount: number;
  releaseYear: number;
  rating: string;
  viewsCount: string;
  views24h?: string;
  views24hNumeric?: number;
  author: string;
  isPopular?: boolean;
  isFeatured?: boolean;
  episodes: Episode[];
}

export type AccessStatus = 'free' | 'unlocked' | 'locked';

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  timestamp: string;
}

export interface CoinPack {
  id: string;
  title: string;
  coins: number;
  bonusCoins: number;
  priceFormatted: string;
  priceAmount: number;
  tag?: string;
  isPopular?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  isGuest: boolean;
  coins: number;
  autoUnlockNext: boolean;
  joinedDate: string;
}

export interface WatchProgress {
  seriesId: string;
  episodeId: string;
  episodeNumber: number;
  progressSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}
