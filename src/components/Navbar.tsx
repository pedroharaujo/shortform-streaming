import React from 'react';
import { Coins, Plus, Film, User, Search, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface NavbarProps {
  currentTab: 'catalog' | 'wallet' | 'library' | 'account';
  setCurrentTab: (tab: 'catalog' | 'wallet' | 'library' | 'account') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  searchQuery,
  setSearchQuery
}) => {
  const { user, setIsCoinStoreOpen } = useApp();

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/85 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div 
          onClick={() => setCurrentTab('catalog')}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-extrabold tracking-wider bg-gradient-to-r from-white via-neutral-100 to-amber-200 bg-clip-text text-transparent">
            STOVIO
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-neutral-900/60 p-1 rounded-full border border-neutral-800/60">
          <button
            onClick={() => setCurrentTab('catalog')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              currentTab === 'catalog'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setCurrentTab('library')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              currentTab === 'library'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            My Library
          </button>
          <button
            onClick={() => setCurrentTab('wallet')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              currentTab === 'wallet'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Coin Wallet
          </button>
        </nav>

        {/* Search Bar (desktop) */}
        <div className="hidden lg:flex items-center relative w-60">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search series or tags..."
            className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded-full pl-9 pr-3 py-1.5 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </div>

        {/* Right Action: Coin Wallet Pill & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Coin Counter Pill */}
          <div 
            onClick={() => setIsCoinStoreOpen(true)}
            className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 bg-gradient-to-r from-amber-500/10 to-amber-500/5 hover:from-amber-500/20 hover:to-amber-500/15 border border-amber-500/30 rounded-full cursor-pointer transition-all hover:scale-102"
            title="Click to top up coins"
          >
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-neutral-950 shadow-sm">
              <Coins className="w-3 h-3 stroke-[2.5]" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-amber-200 tracking-tight">
                {user.coins}
              </span>
              <span className="text-[10px] text-amber-400/80 font-medium">coins</span>
            </div>
            <div className="w-5 h-5 rounded-full bg-amber-500/20 hover:bg-amber-500 hover:text-neutral-950 text-amber-300 flex items-center justify-center transition-colors">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
          </div>

          {/* Profile Button */}
          <button
            onClick={() => setCurrentTab('account')}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
              currentTab === 'account'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-neutral-800 text-neutral-300 hover:border-neutral-700 bg-neutral-900'
            }`}
            title="Account and Preferences"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
