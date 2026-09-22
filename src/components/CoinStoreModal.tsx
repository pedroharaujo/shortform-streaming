import React, { useState } from 'react';
import { X, Coins, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CoinPack } from '../types';

export const CoinStoreModal: React.FC = () => {
  const { isCoinStoreOpen, setIsCoinStoreOpen, coinPacks, purchaseCoinPack, user } = useApp();
  const [purchasedPack, setPurchasedPack] = useState<CoinPack | null>(null);

  if (!isCoinStoreOpen) return null;

  const handleBuy = (pack: CoinPack) => {
    purchaseCoinPack(pack);
    setPurchasedPack(pack);
    setTimeout(() => {
      setPurchasedPack(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 sm:p-6 flex flex-col gap-4 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => setIsCoinStoreOpen(false)}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-full bg-neutral-800/60"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-1">
            <Coins className="w-3.5 h-3.5" />
            <span>Coin Shop</span>
          </div>
          <h2 className="text-xl font-display font-extrabold text-white">
            Get Coins for Episodes
          </h2>
          <p className="text-xs text-neutral-400">
            Current balance: <strong className="text-amber-400">{user.coins} Coins</strong>
          </p>
        </div>

        {/* Success toast if purchased */}
        {purchasedPack && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 text-xs animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-bold">Purchase Successful!</p>
              <p className="text-[11px] text-emerald-400/80">
                Added {purchasedPack.coins + purchasedPack.bonusCoins} coins to your balance.
              </p>
            </div>
          </div>
        )}

        {/* Coin Packs List */}
        <div className="grid grid-cols-1 gap-3.5 max-h-[60vh] overflow-y-auto pt-3 pb-1 px-1 pr-1.5">
          {coinPacks.map(pack => {
            const totalCoins = pack.coins + pack.bonusCoins;

            return (
              <div
                key={pack.id}
                onClick={() => handleBuy(pack)}
                className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  pack.isPopular
                    ? 'bg-gradient-to-r from-amber-500/15 via-neutral-900 to-neutral-900 border-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {pack.tag && (
                  <span className={`absolute -top-2.5 left-4 z-10 text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs leading-none inline-flex items-center ${
                    pack.isPopular
                      ? 'bg-amber-500 text-neutral-950 font-black shadow-amber-500/20'
                      : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                  }`}>
                    {pack.tag}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold text-white">
                        {totalCoins}
                      </span>
                      <span className="text-xs text-amber-400 font-semibold">Coins</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {pack.coins} base + <span className="text-amber-300 font-medium">+{pack.bonusCoins} bonus</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBuy(pack);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    pack.isPopular
                      ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  }`}
                >
                  {pack.priceFormatted}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Guarantee */}
        <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Sandbox Verified Ledger
          </span>
          <span className="text-neutral-500">Instant credit</span>
        </div>
      </div>
    </div>
  );
};
