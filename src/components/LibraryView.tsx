import React from 'react';
import { Bookmark, Play, Trash2, Film, Sparkles, Lock, CheckCircle2, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Episode, Series } from '../types';

export const LibraryView: React.FC = () => {
  const {
    seriesList,
    savedSeriesIds,
    toggleSaveSeries,
    watchHistory,
    startPlayback,
    setSelectedSeries,
    isEpisodeAccessible
  } = useApp();

  const savedSeries = seriesList.filter(s => savedSeriesIds.includes(s.id));
  
  // Find all series the user has started watching
  const startedSeries = seriesList.filter(s => watchHistory[s.id]);

  // Compute the next unplayed episode for each started series
  const continueWatchingItems = startedSeries.map(series => {
    const hist = watchHistory[series.id];
    const currentEpIndex = series.episodes.findIndex(e => e.id === hist.episodeId);
    const currentEp = currentEpIndex >= 0 ? series.episodes[currentEpIndex] : series.episodes[0];
    
    // Consider finished if watched >= 90% or within 5 seconds of the end
    const isCurrentEpFinished =
      hist.durationSeconds > 0 &&
      (hist.progressSeconds >= hist.durationSeconds - 5 || hist.progressSeconds / hist.durationSeconds >= 0.9);

    let nextEpisode: Episode;
    let isNextNewEpisode = false;
    let isAllCompleted = false;

    if (isCurrentEpFinished) {
      if (currentEpIndex + 1 < series.episodes.length) {
        // Next unplayed episode in sequence
        nextEpisode = series.episodes[currentEpIndex + 1];
        isNextNewEpisode = true;
      } else {
        // All episodes in series watched
        nextEpisode = series.episodes[0];
        isAllCompleted = true;
      }
    } else {
      // Resume current unplayed/in-progress episode
      nextEpisode = currentEp;
    }

    const progressPct =
      hist.durationSeconds > 0 && !isNextNewEpisode
        ? Math.min(100, Math.round((hist.progressSeconds / hist.durationSeconds) * 100))
        : 0;

    return {
      series,
      hist,
      nextEpisode,
      isNextNewEpisode,
      isAllCompleted,
      progressPct
    };
  });

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-white">
          My Library
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Pick up where you left off, manage your watchlist, and view your progress.
        </p>
      </div>

      {/* Continue Watching Section: Next Unplayed Episode for Started Series */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
              Continue Watching ({continueWatchingItems.length})
            </h2>
          </div>
          <span className="text-[11px] text-neutral-400">
            Next unplayed episodes
          </span>
        </div>

        {continueWatchingItems.length === 0 ? (
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center space-y-2">
            <Film className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-sm font-semibold text-neutral-300">
              No series started yet
            </p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Start watching any vertical microdrama from the catalog and your next unplayed episodes will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {continueWatchingItems.map(({ series, hist, nextEpisode, isNextNewEpisode, isAllCompleted, progressPct }) => {
              const isAccessible = isEpisodeAccessible(nextEpisode);

              return (
                <div
                  key={series.id}
                  className="group relative flex gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-900/80 border border-neutral-800 hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-black/40"
                >
                  {/* Vertical Poster Thumbnail */}
                  <div
                    onClick={() => startPlayback(series, nextEpisode)}
                    className="relative w-20 sm:w-24 aspect-[9/13] rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 cursor-pointer shadow-md"
                  >
                    <img
                      src={series.verticalCoverUrl}
                      alt={series.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Play Badge Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-neutral-950 shadow-md">
                        <Play className="w-4 h-4 fill-current translate-x-0.5" />
                      </div>
                    </div>

                    {/* Episode Pill */}
                    <div className="absolute bottom-1 left-1 right-1 text-center py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-bold text-amber-300">
                      Ep {nextEpisode.episodeNumber} of {series.totalEpisodes}
                    </div>
                  </div>

                  {/* Details & Next Episode Action */}
                  <div className="flex flex-col justify-between flex-1 min-w-0">
                    <div className="space-y-1">
                      {/* Status Header Badge */}
                      <div className="flex items-center gap-2">
                        {isAllCompleted ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                            Series Completed
                          </span>
                        ) : isNextNewEpisode ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Up Next
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Resume {progressPct}%
                          </span>
                        )}

                        {nextEpisode.isFree ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                            FREE
                          </span>
                        ) : isAccessible ? (
                          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Unlocked
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-amber-400" /> {nextEpisode.coinCost} coins
                          </span>
                        )}
                      </div>

                      {/* Series & Episode Titles */}
                      <h3
                        onClick={() => setSelectedSeries(series)}
                        className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1 cursor-pointer"
                      >
                        {series.title}
                      </h3>

                      <p className="text-[11px] text-neutral-300 line-clamp-1">
                        Episode {nextEpisode.episodeNumber}: {nextEpisode.title}
                      </p>
                    </div>

                    {/* Progress Track (if resuming partial episode) */}
                    {!isNextNewEpisode && !isAllCompleted && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.max(5, progressPct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-500">
                          <span>{formatSeconds(hist.progressSeconds)} / {formatSeconds(hist.durationSeconds)}</span>
                          <span>{progressPct}%</span>
                        </div>
                      </div>
                    )}

                    {/* Launch Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => startPlayback(series, nextEpisode)}
                        className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-amber-500/10"
                      >
                        {isAllCompleted ? (
                          <>
                            <RotateCcw className="w-3 h-3" /> Watch Again (Ep 1)
                          </>
                        ) : isNextNewEpisode ? (
                          <>
                            <Play className="w-3 h-3 fill-current" /> Play Episode {nextEpisode.episodeNumber}
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" /> Resume Watching
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bookmarked Series */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400" />
            Bookmarked Series ({savedSeries.length})
          </h2>
        </div>

        {savedSeries.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-900 border border-neutral-800 text-center space-y-2">
            <Film className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-sm font-medium text-neutral-300">No bookmarked series yet</p>
            <p className="text-xs text-neutral-500">
              Browse the catalog and tap the bookmark icon to save microdramas to your library.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {savedSeries.map(series => (
              <div
                key={series.id}
                className="group relative flex flex-col rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800"
              >
                <div 
                  onClick={() => setSelectedSeries(series)}
                  className="relative aspect-[9/13] w-full overflow-hidden bg-neutral-800 cursor-pointer"
                >
                  <img
                    src={series.verticalCoverUrl}
                    alt={series.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveSeries(series.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-amber-400 hover:text-white"
                    title="Remove bookmark"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <h3
                    onClick={() => setSelectedSeries(series)}
                    className="text-xs font-bold text-white line-clamp-1 cursor-pointer hover:text-amber-300"
                  >
                    {series.title}
                  </h3>
                  <button
                    onClick={() => startPlayback(series, series.episodes[0])}
                    className="w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" /> Watch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

