import React from 'react';
import { X, Lock, Coins, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const UnlockModal: React.FC = () => {
  const {
    pendingUnlockEpisode,
    setPendingUnlockEpisode,
    user,
    unlockEpisode,
    setIsCoinStoreOpen,
    toggleAutoUnlock
  } = useApp();

  if (!pendingUnlockEpisode) return null;

  const { series, episode } = pendingUnlockEpisode;
  const hasEnoughCoins = user.coins >= episode.coinCost;
  const remainingCoins = user.coins - episode.coinCost;

  const handleUnlock = () => {
    unlockEpisode(series, episode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 flex flex-col gap-5 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => setPendingUnlockEpisode(null)}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-full bg-neutral-800/60"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lock Graphic Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">
            Unlock Episode {episode.episodeNumber}
          </h3>
          <p className="text-xs text-neutral-400 line-clamp-1">
            {series.title}: {episode.title}
          </p>
        </div>

        {/* Price & Balance Box */}
        <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Unlock Cost:</span>
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {episode.coinCost} coins
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Your Coin Balance:</span>
            <span className="font-bold text-white flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {user.coins} coins
            </span>
          </div>

          <div className="border-t border-neutral-800/80 pt-2 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Balance After:</span>
            {hasEnoughCoins ? (
              <span className="font-bold text-emerald-400">
                {remainingCoins} coins
              </span>
            ) : (
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Need {episode.coinCost - user.coins} more
              </span>
            )}
          </div>
        </div>

        {/* Auto unlock toggle checkbox */}
        <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={user.autoUnlockNext}
            onChange={toggleAutoUnlock}
            className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 accent-amber-500 cursor-pointer"
          />
          <span>Auto-unlock subsequent episodes with coins</span>
        </label>

        {/* Primary Action Button */}
        {hasEnoughCoins ? (
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            Unlock & Watch ({episode.coinCost} Coins)
          </button>
        ) : (
          <button
            onClick={() => {
              setIsCoinStoreOpen(true);
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Coins className="w-4 h-4" />
            Top Up Coins Now <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
