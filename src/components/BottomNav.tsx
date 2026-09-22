import React from 'react';
import { Film, BookmarkCheck, Wallet, User } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'catalog' | 'wallet' | 'library' | 'account';
  setCurrentTab: (tab: 'catalog' | 'wallet' | 'library' | 'account') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800/80 px-4 py-2">
      <div className="flex items-center justify-around">
        <button
          onClick={() => setCurrentTab('catalog')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
            currentTab === 'catalog' ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Film className="w-4 h-4" />
          <span className="text-[10px]">Browse</span>
        </button>

        <button
          onClick={() => setCurrentTab('library')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
            currentTab === 'library' ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          <span className="text-[10px]">My Library</span>
        </button>

        <button
          onClick={() => setCurrentTab('wallet')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
            currentTab === 'wallet' ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[10px]">Wallet</span>
        </button>

        <button
          onClick={() => setCurrentTab('account')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
            currentTab === 'account' ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-[10px]">Account</span>
        </button>
      </div>
    </nav>
  );
};
