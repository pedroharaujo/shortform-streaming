import React, { useState } from 'react';
import { User, Shield, Coins, Sparkles, LogOut, RotateCcw, Check, Smartphone, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AccountView: React.FC = () => {
  const { user, switchUserMode, toggleAutoUnlock, resetAccountData, setIsCoinStoreOpen, unlockedEpisodeIds } = useApp();
  const [resetConfirm, setResetConfirm] = useState(false);

  const handleReset = () => {
    resetAccountData();
    setResetConfirm(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-white">
          Account & Settings
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Manage your viewer identity, episode unlock preferences, and security.
        </p>
      </div>

      {/* Profile Card */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-amber-500/10">
            {user.displayName.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">{user.displayName}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                user.isGuest
                  ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {user.isGuest ? 'Guest' : 'Verified Member'}
              </span>
            </div>
            <p className="text-xs text-neutral-400">{user.email}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">Joined {user.joinedDate}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
          <button
            onClick={switchUserMode}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            {user.isGuest ? 'Switch to Verified Member' : 'Switch to Guest Mode'}
          </button>

          <button
            onClick={() => setIsCoinStoreOpen(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5"
          >
            <Coins className="w-3.5 h-3.5" />
            Top Up ({user.coins} coins)
          </button>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <h3 className="text-xs uppercase font-bold tracking-wider text-neutral-400">
          Playback Preferences
        </h3>

        {/* Auto Unlock */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Auto-Unlock Next Episode
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5 max-w-xs">
              Automatically spend coins to unlock the next episode upon finishing without interrupting playback.
            </div>
          </div>

          <button
            onClick={toggleAutoUnlock}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              user.autoUnlockNext ? 'bg-amber-500' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-neutral-950 transition-transform ${
                user.autoUnlockNext ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* System & Architecture Info */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 text-xs">
        <h3 className="uppercase font-bold tracking-wider text-neutral-400 text-[11px]">
          Shortform Platform Overview
        </h3>
        <div className="space-y-2 text-neutral-300 text-[11px]">
          <div className="flex justify-between border-b border-neutral-800/60 pb-1.5">
            <span className="text-neutral-500">Video Pipeline:</span>
            <span>Opaque HLS Vertical Streams</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800/60 pb-1.5">
            <span className="text-neutral-500">Monetization:</span>
            <span>Server-Authoritative Coin Ledger</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800/60 pb-1.5">
            <span className="text-neutral-500">Unlocked Content:</span>
            <span className="text-amber-400 font-bold">{unlockedEpisodeIds.length} episodes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">App Version:</span>
            <span>0.1.0 (Web Studio Edition)</span>
          </div>
        </div>
      </div>

      {/* Reset Cache / Data */}
      <div className="pt-2">
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            className="w-full py-2.5 rounded-xl border border-neutral-800 hover:border-rose-500/50 text-neutral-400 hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Sandbox State to Defaults
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-3 text-center">
            <p className="text-xs text-rose-300">
              Reset all local watch progress, coins, and unlocks to defaults?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleReset}
                className="px-4 py-1.5 rounded-lg bg-rose-500 text-white font-bold text-xs"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
