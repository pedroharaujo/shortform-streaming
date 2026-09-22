import React from 'react';
import { Coins, Plus, ArrowUpRight, ArrowDownLeft, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const WalletView: React.FC = () => {
  const { user, transactions, setIsCoinStoreOpen, unlockedEpisodeIds } = useApp();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-white">
          Coin Wallet & Ledger
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Server-authoritative balance, episode unlocks, and immutable transaction history.
        </p>
      </div>

      {/* Main Balance Card */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/40 border border-amber-500/30 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              Available Balance
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-extrabold font-display text-white tracking-tight">
                {user.coins}
              </span>
              <span className="text-sm font-bold text-amber-400">Coins</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {unlockedEpisodeIds.length} episodes unlocked across all series
            </p>
          </div>

          <button
            onClick={() => setIsCoinStoreOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Top Up Coins
          </button>
        </div>
      </div>

      {/* Feature stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-[11px] text-neutral-400 font-medium">Unlocked Episodes</div>
          <div className="text-lg font-bold text-white mt-1">{unlockedEpisodeIds.length}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-[11px] text-neutral-400 font-medium">Auto-Unlock Next</div>
          <div className="text-lg font-bold text-amber-400 mt-1">
            {user.autoUnlockNext ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-[11px] text-neutral-400 font-medium">Account Mode</div>
          <div className="text-lg font-bold text-neutral-200 mt-1">
            {user.isGuest ? 'Guest' : 'Verified'}
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
            Transaction Activity ({transactions.length})
          </h2>
          <span className="text-xs text-neutral-500">Live ledger</span>
        </div>

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden divide-y divide-neutral-800/80">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No transactions recorded yet.
            </div>
          ) : (
            transactions.map(tx => {
              const isCredit = tx.type === 'credit';

              return (
                <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCredit
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {tx.description}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {tx.timestamp} • Balance after: {tx.balanceAfter} coins
                      </div>
                    </div>
                  </div>

                  <div className={`font-bold flex-shrink-0 ${
                    isCredit ? 'text-emerald-400' : 'text-neutral-300'
                  }`}>
                    {isCredit ? '+' : '-'}{tx.amount} coins
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info notice */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 space-y-1.5">
        <div className="font-bold text-neutral-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          About Coin Access in Stovio
        </div>
        <p className="leading-relaxed text-[11px]">
          Every series offers the first 2–4 episodes free. Continuing beyond cliffhangers debits coins atomically from your wallet ledger. Unlocked episodes remain available permanently on your account.
        </p>
      </div>
    </div>
  );
};
