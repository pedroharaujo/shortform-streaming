import React, { useState, useRef } from 'react';
import { Play, Info, Bookmark, BookmarkCheck, Flame, Sparkles, Eye, Star, RefreshCw, ArrowDown, Check } from 'lucide-react';
import { Series } from '../types';
import { useApp } from '../context/AppContext';

interface CatalogViewProps {
  searchQuery: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ searchQuery }) => {
  const {
    seriesList,
    setSelectedSeries,
    startPlayback,
    savedSeriesIds,
    toggleSaveSeries,
    watchHistory,
    refreshCatalog
  } = useApp();

  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  // Trigger refresh cycle
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(55);
    try {
      await refreshCatalog();
      setJustRefreshed(true);
      setTimeout(() => {
        setJustRefreshed(false);
        setIsRefreshing(false);
        setPullDistance(0);
      }, 700);
    } catch {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  // Touch handlers for mobile pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5 && !isRefreshing) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0 && window.scrollY <= 5) {
      // Damped rubber-band formula
      const dist = Math.min(85, Math.pow(diff, 0.82) * 1.6);
      setPullDistance(dist);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    if (pullDistance >= 50 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  };

  // Recent watch progress series (for Continue Watching section)
  const inProgressList = seriesList.filter(s => watchHistory[s.id]);
  const inProgressIds = new Set(inProgressList.map(s => s.id));

  // Featured Hero Series (should not duplicate series appearing in Continue Watching)
  const featured =
    seriesList.find(s => s.isFeatured && !inProgressIds.has(s.id)) ||
    seriesList.find(s => !inProgressIds.has(s.id)) ||
    null;

  // Extract all unique tags
  const allTags = ['All', ...Array.from(new Set(seriesList.flatMap(s => s.tags)))];

  // Filter series based on search and tag - excluding series in Continue Watching
  const filteredSeries = seriesList.filter(series => {
    // If series appears in Continue Watching, it shouldn't appear again in another section
    if (!searchQuery && inProgressIds.has(series.id)) {
      return false;
    }

    const matchesSearch =
      searchQuery.trim() === '' ||
      series.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      series.synopsis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      series.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = selectedTag === 'All' || series.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-6 pb-20 relative pt-1"
    >
      {/* Pull-To-Refresh Indicator */}
      {(isRefreshing || pullDistance > 0) && (
        <div
          className="overflow-hidden transition-[height,opacity] duration-200 ease-out flex items-center justify-center pointer-events-none sticky top-14 z-30 mb-2"
          style={{
            height: `${Math.max(pullDistance, isRefreshing ? 54 : 0)}px`,
            opacity: pullDistance > 10 || isRefreshing ? 1 : 0
          }}
        >
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur-md text-neutral-200">
            {isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-xs font-semibold text-amber-300">Refreshing trending series...</span>
              </>
            ) : justRefreshed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Updated just now!</span>
              </>
            ) : (
              <>
                <ArrowDown
                  className="w-4 h-4 text-amber-400 transition-transform duration-150"
                  style={{
                    transform: pullDistance >= 50 ? 'rotate(180deg)' : `rotate(${Math.min(180, (pullDistance / 50) * 180)}deg)`
                  }}
                />
                <span className="text-xs font-medium text-neutral-300">
                  {pullDistance >= 50 ? 'Release to update' : 'Pull down to refresh'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {/* Hero Banner for Featured Microdrama */}
      {featured && !searchQuery && selectedTag === 'All' && (
        <section className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl">
          {/* Background image with dramatic gradient overlays */}
          <div className="absolute inset-0">
            <img
              src={featured.horizontalBannerUrl}
              alt={featured.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-40 scale-105 filter blur-xs"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent" />
          </div>

          <div className="relative p-6 sm:p-10 flex flex-col md:flex-row gap-6 items-start md:items-end justify-between">
            <div className="max-w-xl space-y-3">
              {/* Badge row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-neutral-950 shadow-sm">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  #1 TRENDING
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-800/80 text-neutral-300 border border-neutral-700/50">
                  {featured.rating}
                </span>
                <span className="text-xs text-amber-300 font-medium flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {featured.viewsCount} views
                </span>
              </div>

              {/* Title & Tagline */}
              <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {featured.title}
              </h1>

              <p className="text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed">
                {featured.synopsis}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {featured.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[11px] font-medium px-2 py-0.5 bg-neutral-800/60 text-neutral-300 rounded border border-neutral-700/40"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <button
                  onClick={() => startPlayback(featured, featured.episodes[0])}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all hover:scale-102 active:scale-98"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Watch Ep 1 Free
                </button>

                <button
                  onClick={() => setSelectedSeries(featured)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-white font-semibold text-sm border border-neutral-700/80 transition-all"
                >
                  <Info className="w-4 h-4" />
                  Episodes & Info
                </button>

                <button
                  onClick={() => toggleSaveSeries(featured.id)}
                  className="p-2.5 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 transition-all"
                  title="Save to My Library"
                >
                  {savedSeriesIds.includes(featured.id) ? (
                    <BookmarkCheck className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Quick stats panel */}
            <div className="hidden lg:flex flex-col gap-2 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm min-w-44">
              <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold">
                Access Policy
              </div>
              <div className="text-xs text-neutral-200">
                <span className="text-amber-400 font-bold">{featured.freeEpisodesCount} Episodes Free</span>, then 40 coins/ep
              </div>
              <div className="text-[11px] text-neutral-400">
                Total {featured.totalEpisodes} Vertical Episodes
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Continue Watching Section (if active history exists) - 1 Rollable Row of Cards with Progress Bar */}
      {inProgressList.length > 0 && !searchQuery && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
                Continue Watching
              </h2>
            </div>
            <span className="text-[11px] text-neutral-400">
              {inProgressList.length} in progress
            </span>
          </div>

          {/* Rollable row with each column as a continue watching card */}
          <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-neutral-800">
            {inProgressList.map(series => {
              const hist = watchHistory[series.id];
              const ep = series.episodes.find(e => e.id === hist.episodeId) || series.episodes[0];
              const pct = hist.durationSeconds > 0 ? (hist.progressSeconds / hist.durationSeconds) * 100 : 0;
              const roundedPct = Math.round(pct);
              const isSaved = savedSeriesIds.includes(series.id);

              return (
                <div
                  key={`continue-${series.id}`}
                  className="group relative flex-shrink-0 w-36 sm:w-44 flex flex-col rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/60"
                >
                  {/* Vertical Poster with 9:13 ratio */}
                  <div
                    onClick={() => startPlayback(series, ep)}
                    className="relative aspect-[9/13] w-full overflow-hidden bg-neutral-800 cursor-pointer"
                  >
                    <img
                      src={series.verticalCoverUrl}
                      alt={series.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Episode Badge top-left */}
                    <div className="absolute top-2 left-2 z-20 pointer-events-none">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-amber-300 border border-amber-500/30">
                        Ep {ep.episodeNumber}
                      </span>
                    </div>

                    {/* Bookmark quick toggle top-right */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveSeries(series.id);
                      }}
                      className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/75 hover:bg-black/95 backdrop-blur-xs text-neutral-300 hover:text-amber-400 transition-colors shadow-md cursor-pointer pointer-events-auto"
                      title={isSaved ? 'Saved to Library (click to remove)' : 'Save to Library'}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Play button overlay on hover (pointer-events-none so it doesn't block clicks on badges) */}
                    <div className="absolute inset-0 z-10 pointer-events-none bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current translate-x-0.5" />
                      </div>
                    </div>

                    {/* Progress Bar overlaid on bottom of poster */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent pt-3 pb-1.5 px-2">
                      <div className="flex items-center justify-between text-[10px] text-neutral-300 font-semibold mb-1">
                        <span>Ep {ep.episodeNumber}: {roundedPct}%</span>
                        <span className="text-amber-400">Resume</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800/90 rounded-full overflow-hidden border border-neutral-700/40">
                        <div
                          className="h-full bg-amber-500 rounded-full shadow-sm shadow-amber-500/50"
                          style={{ width: `${Math.min(100, Math.max(8, roundedPct))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-2.5 flex flex-col justify-between flex-1 space-y-2">
                    <div>
                      <h3
                        onClick={() => setSelectedSeries(series)}
                        className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1 cursor-pointer"
                      >
                        {series.title}
                      </h3>
                      <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                        {ep.title}
                      </p>
                    </div>

                    <button
                      onClick={() => startPlayback(series, ep)}
                      className="w-full py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                    >
                      <Play className="w-3 h-3 fill-current" /> Resume
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Genre Filter Pills */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedTag === tag
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Series Grid */}
        {filteredSeries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-center space-y-2">
            <p className="text-sm font-semibold text-neutral-300">
              {searchQuery ? 'No microdramas found matching your search' : 'All series are currently in Continue Watching'}
            </p>
            <p className="text-xs text-neutral-500">
              {searchQuery
                ? 'Try searching by a different title or keyword.'
                : 'Resume your episodes from the Continue Watching row above.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {filteredSeries.map(series => {
              const isSaved = savedSeriesIds.includes(series.id);

            return (
              <div
                key={series.id}
                className="group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50"
              >
                {/* Vertical Poster with 9:14 ratio */}
                <div 
                  onClick={() => setSelectedSeries(series)}
                  className="relative aspect-[9/13] w-full overflow-hidden bg-neutral-800 cursor-pointer"
                >
                  <img
                    src={series.verticalCoverUrl}
                    alt={series.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Top Badges */}
                  <div className="absolute top-2 inset-x-2 z-20 flex items-center justify-between pointer-events-none">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-amber-300 border border-amber-500/20">
                      {series.freeEpisodesCount} FREE EPS
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveSeries(series.id);
                      }}
                      className="pointer-events-auto p-1.5 rounded-full bg-black/75 hover:bg-black/95 backdrop-blur-xs text-neutral-300 hover:text-amber-400 transition-colors shadow-md z-30 cursor-pointer"
                      title={isSaved ? "Saved to Library (click to remove)" : "Save to Library"}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Play Overlay On Hover (pointer-events-none so it doesn't block clicks on badges) */}
                  <div className="absolute inset-0 z-10 pointer-events-none bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-amber-500/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 text-neutral-950 fill-neutral-950 translate-x-0.5" />
                    </div>
                  </div>

                  {/* Bottom overlay with episode count */}
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent flex items-center justify-between text-[11px] text-neutral-300 pointer-events-none">
                    <span>{series.totalEpisodes} Episodes</span>
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <Eye className="w-3 h-3" /> {series.viewsCount}
                    </span>
                  </div>
                </div>

                {/* Series Info */}
                <div className="p-3 flex flex-col justify-between flex-1 space-y-2">
                  <div>
                    <h3 
                      onClick={() => setSelectedSeries(series)}
                      className="text-xs sm:text-sm font-bold text-white hover:text-amber-300 transition-colors line-clamp-1 cursor-pointer"
                    >
                      {series.title}
                    </h3>
                    <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-snug">
                      {series.synopsis}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                    <span className="text-[10px] text-neutral-500 font-medium truncate max-w-[70px]">
                      {series.tags[0]}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveSeries(series.id);
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                            : 'bg-neutral-800 border-neutral-700/80 text-neutral-400 hover:text-white hover:bg-neutral-700'
                        }`}
                        title={isSaved ? "Saved to Library (click to remove)" : "Save to Library"}
                        aria-label={isSaved ? "Remove from Library" : "Save to Library"}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startPlayback(series, series.episodes[0]);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        Play <Play className="w-2.5 h-2.5 fill-current" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </section>
    </div>
  );
};
