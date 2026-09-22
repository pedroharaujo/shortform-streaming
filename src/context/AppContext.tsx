import React, { createContext, useContext, useState, useEffect } from 'react';
import { Episode, Series, UserProfile, WalletTransaction, CoinPack, WatchProgress } from '../types';
import { MOCK_SERIES, INITIAL_COIN_PACKS } from '../data/mockData';

interface AppContextType {
  seriesList: Series[];
  user: UserProfile;
  unlockedEpisodeIds: string[];
  watchHistory: Record<string, WatchProgress>;
  savedSeriesIds: string[];
  transactions: WalletTransaction[];
  coinPacks: CoinPack[];
  
  // Modals & Navigation
  selectedSeries: Series | null;
  setSelectedSeries: (series: Series | null) => void;
  activePlayback: { series: Series; episode: Episode } | null;
  startPlayback: (series: Series, episode: Episode) => void;
  closePlayback: () => void;
  playNextEpisode: () => boolean;
  playPreviousEpisode: () => boolean;
  
  isCoinStoreOpen: boolean;
  setIsCoinStoreOpen: (open: boolean) => void;
  
  pendingUnlockEpisode: { series: Series; episode: Episode } | null;
  setPendingUnlockEpisode: (item: { series: Series; episode: Episode } | null) => void;

  // Actions
  isEpisodeAccessible: (episode: Episode) => boolean;
  unlockEpisode: (series: Series, episode: Episode) => boolean;
  purchaseCoinPack: (pack: CoinPack) => void;
  toggleSaveSeries: (seriesId: string) => void;
  toggleAutoUnlock: () => void;
  updateEpisodeProgress: (seriesId: string, episodeId: string, episodeNumber: number, progress: number, duration: number) => void;
  refreshCatalog: () => Promise<void>;
  resetAccountData: () => void;
  switchUserMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'stovio_user_profile',
  UNLOCKED: 'stovio_unlocked_episodes',
  HISTORY: 'stovio_watch_history',
  SAVED: 'stovio_saved_series',
  TRANSACTIONS: 'stovio_transactions'
};

const DEFAULT_USER: UserProfile = {
  id: 'usr_guest_8921',
  displayName: 'Guest Viewer',
  email: 'viewer@stovio.app',
  isGuest: true,
  coins: 120, // Free starting coins so user can experience unlock immediately
  autoUnlockNext: true,
  joinedDate: 'September 2026'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seriesList, setSeriesList] = useState<Series[]>(MOCK_SERIES);
  
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    return saved ? JSON.parse(saved) : DEFAULT_USER;
  });

  const [unlockedEpisodeIds, setUnlockedEpisodeIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.UNLOCKED);
    return saved ? JSON.parse(saved) : [];
  });

  const [watchHistory, setWatchHistory] = useState<Record<string, WatchProgress>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return saved ? JSON.parse(saved) : {};
  });

  const [savedSeriesIds, setSavedSeriesIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SAVED);
    return saved ? JSON.parse(saved) : ['series-alpha-heir'];
  });

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return saved ? JSON.parse(saved) : [
      {
        id: 'tx_welcome_bonus',
        type: 'credit',
        amount: 120,
        balanceAfter: 120,
        description: 'New Viewer Welcome Bonus',
        timestamp: 'Just now'
      }
    ];
  });

  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [activePlayback, setActivePlayback] = useState<{ series: Series; episode: Episode } | null>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [pendingUnlockEpisode, setPendingUnlockEpisode] = useState<{ series: Series; episode: Episode } | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(unlockedEpisodeIds));
  }, [unlockedEpisodeIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(watchHistory));
  }, [watchHistory]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(savedSeriesIds));
  }, [savedSeriesIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  const isEpisodeAccessible = (episode: Episode): boolean => {
    if (episode.isFree) return true;
    return unlockedEpisodeIds.includes(episode.id);
  };

  const startPlayback = (series: Series, episode: Episode) => {
    if (!isEpisodeAccessible(episode)) {
      setPendingUnlockEpisode({ series, episode });
      return;
    }
    setActivePlayback({ series, episode });
  };

  const closePlayback = () => {
    setActivePlayback(null);
  };

  const playNextEpisode = (): boolean => {
    if (!activePlayback) return false;
    const { series, episode } = activePlayback;
    const currentIndex = series.episodes.findIndex(e => e.id === episode.id);
    if (currentIndex >= 0 && currentIndex < series.episodes.length - 1) {
      const nextEp = series.episodes[currentIndex + 1];
      if (isEpisodeAccessible(nextEp)) {
        setActivePlayback({ series, episode: nextEp });
        return true;
      } else if (user.autoUnlockNext && user.coins >= nextEp.coinCost) {
        // Auto unlock
        unlockEpisode(series, nextEp);
        setActivePlayback({ series, episode: nextEp });
        return true;
      } else {
        // Prompt unlock
        setPendingUnlockEpisode({ series, episode: nextEp });
        return false;
      }
    }
    return false;
  };

  const playPreviousEpisode = (): boolean => {
    if (!activePlayback) return false;
    const { series, episode } = activePlayback;
    const currentIndex = series.episodes.findIndex(e => e.id === episode.id);
    if (currentIndex > 0) {
      const prevEp = series.episodes[currentIndex - 1];
      setActivePlayback({ series, episode: prevEp });
      return true;
    }
    return false;
  };

  const unlockEpisode = (series: Series, episode: Episode): boolean => {
    if (user.coins < episode.coinCost) {
      setIsCoinStoreOpen(true);
      return false;
    }

    const newBalance = user.coins - episode.coinCost;
    setUser(prev => ({ ...prev, coins: newBalance }));
    setUnlockedEpisodeIds(prev => (prev.includes(episode.id) ? prev : [...prev, episode.id]));

    const newTx: WalletTransaction = {
      id: `tx_unlock_${Date.now()}`,
      type: 'debit',
      amount: episode.coinCost,
      balanceAfter: newBalance,
      description: `Unlocked Ep. ${episode.episodeNumber}: ${episode.title}`,
      referenceId: episode.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setTransactions(prev => [newTx, ...prev]);

    setPendingUnlockEpisode(null);
    setActivePlayback({ series, episode });
    return true;
  };

  const purchaseCoinPack = (pack: CoinPack) => {
    const totalAdded = pack.coins + pack.bonusCoins;
    const newBalance = user.coins + totalAdded;

    setUser(prev => ({ ...prev, coins: newBalance }));

    const newTx: WalletTransaction = {
      id: `tx_buy_${Date.now()}`,
      type: 'credit',
      amount: totalAdded,
      balanceAfter: newBalance,
      description: `Purchased ${pack.title} (${pack.coins} + ${pack.bonusCoins} bonus)`,
      referenceId: pack.id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setTransactions(prev => [newTx, ...prev]);
    setIsCoinStoreOpen(false);

    if (pendingUnlockEpisode && newBalance >= pendingUnlockEpisode.episode.coinCost) {
      const targetSeries = pendingUnlockEpisode.series;
      const targetEp = pendingUnlockEpisode.episode;
      setPendingUnlockEpisode(null);
      setTimeout(() => {
        unlockEpisode(targetSeries, targetEp);
      }, 200);
    }
  };

  const toggleSaveSeries = (seriesId: string) => {
    setSavedSeriesIds(prev => 
      prev.includes(seriesId) ? prev.filter(id => id !== seriesId) : [...prev, seriesId]
    );
  };

  const toggleAutoUnlock = () => {
    setUser(prev => ({ ...prev, autoUnlockNext: !prev.autoUnlockNext }));
  };

  const updateEpisodeProgress = (seriesId: string, episodeId: string, episodeNumber: number, progress: number, duration: number) => {
    setWatchHistory(prev => ({
      ...prev,
      [seriesId]: {
        seriesId,
        episodeId,
        episodeNumber,
        progressSeconds: progress,
        durationSeconds: duration,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  const resetAccountData = () => {
    localStorage.clear();
    setUser(DEFAULT_USER);
    setUnlockedEpisodeIds([]);
    setWatchHistory({});
    setSavedSeriesIds(['series-alpha-heir']);
    setTransactions([]);
  };

  const switchUserMode = () => {
    setUser(prev => ({
      ...prev,
      isGuest: !prev.isGuest,
      displayName: prev.isGuest ? 'Elena Rostova' : 'Guest Viewer',
      email: prev.isGuest ? 'elena.rostova@premium.app' : 'viewer@stovio.app'
    }));
  };

  const refreshCatalog = async () => {
    // Simulate real network fetch delay
    await new Promise(resolve => setTimeout(resolve, 800));
    // Dynamically update view velocities to simulate real-time trending activity
    setSeriesList(prev => 
      prev.map(s => {
        const delta = Math.floor(Math.random() * 25000) + 5000;
        const newNumeric = (s.views24hNumeric || 500000) + delta;
        const formatted = newNumeric >= 1000000
          ? `${(newNumeric / 1000000).toFixed(1)}M`
          : `${Math.round(newNumeric / 1000)}K`;
        return {
          ...s,
          views24hNumeric: newNumeric,
          views24h: formatted
        };
      })
    );
  };

  return (
    <AppContext.Provider
      value={{
        seriesList,
        user,
        unlockedEpisodeIds,
        watchHistory,
        savedSeriesIds,
        transactions,
        coinPacks: INITIAL_COIN_PACKS,
        selectedSeries,
        setSelectedSeries,
        activePlayback,
        startPlayback,
        closePlayback,
        playNextEpisode,
        playPreviousEpisode,
        isCoinStoreOpen,
        setIsCoinStoreOpen,
        pendingUnlockEpisode,
        setPendingUnlockEpisode,
        isEpisodeAccessible,
        unlockEpisode,
        purchaseCoinPack,
        toggleSaveSeries,
        toggleAutoUnlock,
        updateEpisodeProgress,
        refreshCatalog,
        resetAccountData,
        switchUserMode
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
