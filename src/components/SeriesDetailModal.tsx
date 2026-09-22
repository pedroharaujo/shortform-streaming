import React from 'react';
import { X, Play, Lock, CheckCircle2, Coins, Bookmark, BookmarkCheck, Share2, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SeriesDetailModal: React.FC = () => {
  const {
    selectedSeries,
    setSelectedSeries,
    startPlayback,
    isEpisodeAccessible,
    savedSeriesIds,
    toggleSaveSeries,
    watchHistory
  } = useApp();

  if (!selectedSeries) return null;

  const isSaved = savedSeriesIds.includes(selectedSeries.id);
  const history = watchHistory[selectedSeries.id];
  const resumeEpisode = history
    ? selectedSeries.episodes.find(e => e.id === history.episodeId) || selectedSeries.episodes[0]
    : selectedSeries.episodes[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] sm:rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex flex-col shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => setSelectedSeries(null)}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-neutral-300 hover:text-white flex items-center justify-center border border-neutral-700/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Hero Banner */}
        <div className="relative aspect-video sm:aspect-[21/9] w-full overflow-hidden flex-shrink-0">
          <img
            src={selectedSeries.horizontalBannerUrl}
            alt={selectedSeries.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />

          {/* Title & Floating details */}
          <div className="absolute bottom-4 left-4 right-16 space-y-1.5 z-10">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-neutral-900/90 text-amber-300 border border-amber-500/40 font-bold text-xs tracking-wider uppercase leading-none whitespace-nowrap shadow-sm backdrop-blur-xs">
                {selectedSeries.rating}
              </span>
              <span className="text-neutral-300 font-medium">
                {selectedSeries.releaseYear} • {selectedSeries.totalEpisodes} Episodes
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white">
              {selectedSeries.title}
            </h2>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                startPlayback(selectedSeries, resumeEpisode);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              {history ? `Resume Ep. ${resumeEpisode.episodeNumber}` : 'Watch Ep. 1 Free'}
            </button>

            <button
              onClick={() => toggleSaveSeries(selectedSeries.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 font-semibold text-xs transition-colors"
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4 text-amber-400" /> : <Bookmark className="w-4 h-4" />}
              {isSaved ? 'Saved' : 'Save to Library'}
            </button>
          </div>

          {/* Synopsis */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase font-bold tracking-wider text-neutral-400">
              Synopsis
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              {selectedSeries.synopsis}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {selectedSeries.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* Episodes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold tracking-wider text-neutral-400">
                Episodes ({selectedSeries.totalEpisodes})
              </h3>
              <span className="text-xs text-amber-400">
                First {selectedSeries.freeEpisodesCount} episodes free
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedSeries.episodes.map(ep => {
                const isAccessible = isEpisodeAccessible(ep);
                const isCurrentWatching = history?.episodeId === ep.id;

                return (
                  <div
                    key={ep.id}
                    onClick={() => startPlayback(selectedSeries, ep)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isCurrentWatching
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : isAccessible
                        ? 'bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-800/80 text-white'
                        : 'bg-neutral-900/30 border-neutral-800/40 hover:bg-neutral-900/70 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {ep.episodeNumber}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold truncate">
                          {ep.title}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {Math.floor(ep.durationSeconds / 60)}:{(ep.durationSeconds % 60).toString().padStart(2, '0')} min
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {ep.isFree ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          FREE
                        </span>
                      ) : isAccessible ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-amber-400" /> UNLOCKED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                          {ep.coinCost} coins
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
