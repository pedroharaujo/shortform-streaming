import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { CatalogView } from './components/CatalogView';
import { WalletView } from './components/WalletView';
import { LibraryView } from './components/LibraryView';
import { AccountView } from './components/AccountView';
import { SeriesDetailModal } from './components/SeriesDetailModal';
import { VerticalPlayer } from './components/VerticalPlayer';
import { UnlockModal } from './components/UnlockModal';
import { CoinStoreModal } from './components/CoinStoreModal';

const AppContent: React.FC = () => {
  const { activePlayback } = useApp();
  const [currentTab, setCurrentTab] = useState<'catalog' | 'wallet' | 'library' | 'account'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-2 sm:pt-3">
        {currentTab === 'catalog' && <CatalogView searchQuery={searchQuery} />}
        {currentTab === 'wallet' && <WalletView />}
        {currentTab === 'library' && <LibraryView />}
        {currentTab === 'account' && <AccountView />}
      </main>

      {/* Mobile Sticky Bottom Navigation */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Modals & Overlays */}
      <SeriesDetailModal />
      {activePlayback && <VerticalPlayer />}
      <UnlockModal />
      <CoinStoreModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
