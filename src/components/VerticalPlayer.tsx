import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Heart,
  Volume2,
  VolumeX,
  Lock,
  Coins,
  CheckCircle2,
  Sparkles,
  Maximize2,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const VerticalPlayer: React.FC = () => {
  const {
    activePlayback,
    closePlayback,
    playNextEpisode,
    playPreviousEpisode,
    isEpisodeAccessible,
    startPlayback,
    updateEpisodeProgress,
    user,
    toggleAutoUnlock,
    setIsCoinStoreOpen
  } = useApp();

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(85);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(1420);
  const [showDrawer, setShowDrawer] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const series = activePlayback?.series;
  const episode = activePlayback?.episode;
  const episodeId = episode?.id;
  const seriesId = series?.id;
  const currentEpIndex = series && episode ? series.episodes.findIndex(e => e.id === episode.id) : -1;
  const hasNext = series ? currentEpIndex < series.episodes.length - 1 : false;
  const hasPrev = currentEpIndex > 0;

  // Reset states on episode change
  useEffect(() => {
    if (!episodeId) return;
    setCurrentTime(0);
    setIsPlaying(true);
    setVideoError(false);
    setAutoNextCountdown(null);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [episodeId]);

  // Handle auto-advance countdown timer
  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null);
      playNextEpisode();
      return;
    }
    const timer = setTimeout(() => {
      setAutoNextCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoNextCountdown]);

  // Handle video completion
  const handleEnded = () => {
    if (!series) return;
    if (hasNext) {
      const nextEp = series.episodes[currentEpIndex + 1];
      const isNextAccessible = isEpisodeAccessible(nextEp);
      const willAutoUnlock = user.autoUnlockNext && user.coins >= nextEp.coinCost;

      if (isNextAccessible || willAutoUnlock) {
        // Next episode is already unlocked or will auto-unlock: initiate smooth transition countdown
        setAutoNextCountdown(2);
      } else {
        // Next episode is blocked: immediate unlock prompt modal
        playNextEpisode();
      }
    } else {
      setIsPlaying(false);
    }
  };

  // Advance progress if in simulated fallback mode
  useEffect(() => {
    if (!series || !episode) return;
    if (videoError && isPlaying && autoNextCountdown === null) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 1;
          const dur = episode.durationSeconds || duration || 85;
          updateEpisodeProgress(series.id, episode.id, episode.episodeNumber, Math.floor(next), Math.floor(dur));
          if (next >= dur) {
            handleEnded();
            return dur;
          }
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [videoError, isPlaying, episodeId, duration, autoNextCountdown, seriesId]);

  // Early return ONLY after all hooks have been unconditionally registered
  if (!activePlayback || !series || !episode) return null;

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current && series && episode) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || episode.durationSeconds;
      setCurrentTime(cur);
      setDuration(dur);
      updateEpisodeProgress(series.id, episode.id, episode.episodeNumber, Math.floor(cur), Math.floor(dur));
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {/* Player Container styled as vertical 9:16 smartphone / microdrama layout */}
      <div className="relative w-full h-full max-w-md sm:max-h-[96vh] sm:rounded-2xl overflow-hidden bg-neutral-950 flex flex-col justify-between shadow-2xl border border-neutral-900 select-none">
        
        {/* Top Story-Style Watch Progress Bar */}
        <div className="absolute top-0 inset-x-0 z-30 h-1 bg-neutral-800/80">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.7)] transition-[width] duration-150 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Background Video Element */}
        <div 
          onClick={togglePlay}
          className="absolute inset-0 z-0 bg-neutral-900 flex items-center justify-center cursor-pointer"
        >
          {!videoError ? (
            <video
              ref={videoRef}
              src={episode.videoUrl}
              poster={episode.thumbnailUrl}
              playsInline
              autoPlay
              muted={isMuted}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            // Simulated backup vertical player canvas
            <div className="relative w-full h-full bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 flex flex-col items-center justify-center p-6 text-center select-none">
              <img
                src={series.verticalCoverUrl}
                alt={series.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-30 filter blur-sm pointer-events-none"
              />
              <div className="relative z-10 max-w-xs space-y-2">
                <h3 className="text-lg font-bold text-white drop-shadow-md">{episode.title}</h3>
                <p className="text-xs font-medium text-neutral-300 drop-shadow">Episode {episode.episodeNumber} of {series.totalEpisodes}</p>
              </div>
            </div>
          )}

          {/* Pause Icon Overlay */}
          {!isPlaying && autoNextCountdown === null && (
            <div className="absolute inset-0 z-10 bg-black/30 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center border border-white/20 animate-in zoom-in-75 duration-150">
                <Play className="w-8 h-8 fill-white translate-x-1" />
              </div>
            </div>
          )}

          {/* Automatic Transition Up-Next Countdown Overlay */}
          {autoNextCountdown !== null && hasNext && (
            <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 mb-3 animate-pulse">
                <span className="text-xl font-extrabold">{autoNextCountdown}</span>
              </div>
              <span className="text-[11px] uppercase font-bold tracking-widest text-amber-400">
                Up Next in {autoNextCountdown}s
              </span>
              <h3 className="text-sm font-bold text-white mt-1 max-w-[240px] truncate">
                Ep. {series.episodes[currentEpIndex + 1]?.episodeNumber}: {series.episodes[currentEpIndex + 1]?.title}
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 mb-5">
                Playing next episode automatically...
              </p>

              <div className="flex items-center gap-3 w-full max-w-xs">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAutoNextCountdown(null);
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().catch(() => {});
                    }
                    setCurrentTime(0);
                    setIsPlaying(true);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Replay
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAutoNextCountdown(null);
                    playNextEpisode();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-amber-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Now
                </button>
              </div>
            </div>
          )}

          {/* Subtle vignette gradients */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-transparent to-black/75" />
        </div>

        {/* Top Header Controls */}
        <div className="relative z-20 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <button
              onClick={closePlayback}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/80 flex items-center justify-center text-white border border-white/10 transition-colors"
              title="Close player"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="max-w-[200px] overflow-hidden">
              <h4 className="text-xs font-bold truncate drop-shadow">
                {series.title}
              </h4>
              <p className="text-[11px] text-amber-300 font-semibold drop-shadow flex items-center gap-1">
                Ep. {episode.episodeNumber}: {episode.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick coin top-up */}
            <button
              onClick={() => setIsCoinStoreOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-amber-500/30 text-amber-300 hover:bg-black/80 text-xs font-bold transition-all"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{user.coins}</span>
            </button>

            <button
              onClick={toggleMute}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/80 flex items-center justify-center text-white border border-white/10 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Right Floating Actions Column */}
        <div className="relative z-20 self-end mr-3 flex flex-col items-center gap-4 text-white">
          {/* Like button */}
          <button
            onClick={() => {
              setIsLiked(!isLiked);
              setLikeCount(prev => (isLiked ? prev - 1 : prev + 1));
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border transition-all ${
              isLiked
                ? 'bg-rose-500/80 border-rose-400 text-white shadow-lg shadow-rose-500/30'
                : 'bg-black/50 border-white/10 text-white hover:bg-black/70'
            }`}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-[10px] font-bold drop-shadow">{likeCount}</span>
          </button>

          {/* Episode Drawer Toggle */}
          <button
            onClick={() => setShowDrawer(!showDrawer)}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 flex items-center justify-center text-white transition-all">
              <ListVideo className="w-5 h-5 text-amber-300" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">Episodes</span>
          </button>

          {/* Auto Unlock Next Toggle */}
          <button
            onClick={toggleAutoUnlock}
            className="flex flex-col items-center gap-1 group"
            title="Auto-unlock next episodes using coins"
          >
            <div className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center border transition-all ${
              user.autoUnlockNext
                ? 'bg-amber-500/80 border-amber-400 text-neutral-950 font-bold shadow-lg shadow-amber-500/20'
                : 'bg-black/50 border-white/10 text-neutral-400 hover:text-white'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold drop-shadow">
              {user.autoUnlockNext ? 'Auto: ON' : 'Auto: OFF'}
            </span>
          </button>
        </div>

        {/* Bottom Playback Bar & Episode Steppers */}
        <div className="relative z-20 p-4 space-y-2 text-white">
          {/* Episode quick step controls */}
          <div className="flex items-center justify-between text-xs">
            <button
              onClick={playPreviousEpisode}
              disabled={!hasPrev}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg backdrop-blur-md font-semibold transition-all ${
                hasPrev
                  ? 'bg-black/50 hover:bg-black/80 text-white border border-white/10'
                  : 'bg-black/20 text-neutral-600 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Prev Ep
            </button>

            <span className="text-[11px] font-medium text-neutral-300">
              {episode.episodeNumber} / {series.totalEpisodes}
            </span>

            <button
              onClick={playNextEpisode}
              disabled={!hasNext}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg backdrop-blur-md font-semibold transition-all ${
                hasNext
                  ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-black/20 text-neutral-600 cursor-not-allowed'
              }`}
            >
              Next Ep <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Scrubber Progress Bar Track & Time Readout */}
          <div className="space-y-1.5 pt-1">
            <div className="relative group/progress flex items-center h-5 cursor-pointer">
              {/* Background Track */}
              <div className="w-full h-1.5 group-hover/progress:h-2 bg-neutral-800/80 backdrop-blur-xs rounded-full overflow-hidden transition-all">
                {/* Progress Fill Bar */}
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full relative shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-[width] duration-100 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Scrubber Handle Thumb on Hover / Scrub */}
              <div
                className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-amber-500 shadow-md transform -translate-x-1/2 pointer-events-none opacity-0 group-hover/progress:opacity-100 scale-75 group-hover/progress:scale-100 transition-all"
                style={{ left: `${progressPercent}%` }}
              />

              {/* Invisible Interactive Range Input Overlay for Drag / Touch */}
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.5"
                value={currentTime}
                onChange={handleSeek}
                aria-label="Video Progress Scrubber"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>

            {/* Time Readout */}
            <div className="flex items-center text-[11px] font-medium text-neutral-300">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                <span className="text-neutral-500">/</span>
                <span className="text-neutral-400">{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* In-Player Episode Selection Sheet Drawer */}
        {showDrawer && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800 rounded-t-2xl flex flex-col p-4 space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                All Episodes ({series.totalEpisodes})
              </h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
              {series.episodes.map(ep => {
                const isAccessible = isEpisodeAccessible(ep);
                const isCurrent = ep.id === episode.id;

                return (
                  <div
                    key={ep.id}
                    onClick={() => {
                      setShowDrawer(false);
                      startPlayback(series, ep);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                      isCurrent
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : isAccessible
                        ? 'bg-neutral-900/60 text-white hover:bg-neutral-800'
                        : 'bg-neutral-900/30 text-neutral-400 hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center font-bold">
                        {ep.episodeNumber}
                      </span>
                      <span className="truncate max-w-[180px]">
                        {ep.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ep.isFree ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          FREE
                        </span>
                      ) : isAccessible ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          <Lock className="w-2.5 h-2.5 text-amber-400" /> {ep.coinCost}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
