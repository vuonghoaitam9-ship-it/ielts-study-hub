import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';

export interface AudioTrackOption {
  label: string;
  url: string;
}

interface AudioPlayerBarProps {
  src: string | null;
  tracks?: AudioTrackOption[];
  activeTrackIndex?: number;
  onSelectTrack?: (idx: number) => void;
  seekRequest?: {
    startTime: number;
    endTime?: number;
    seq: number;
  } | null;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationLoaded?: (duration: number) => void;
  compact?: boolean;
}

const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5];

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  src,
  tracks,
  activeTrackIndex = 0,
  onSelectTrack,
  seekRequest,
  onTimeUpdate,
  onDurationLoaded,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
    stopAtRef.current = null;
  }, [src]);

  // High-precision requestAnimationFrame monitor for exact [startTime, endTime] Dictation cutoffs
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        const t = audio.currentTime;
        setCurrentTime(t);
        onTimeUpdate?.(t);
        if (stopAtRef.current !== null && t >= stopAtRef.current) {
          audio.pause();
          stopAtRef.current = null;
          setIsPlaying(false);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, onTimeUpdate]);

  useEffect(() => {
    if (!seekRequest || !audioRef.current || !src) return;
    const audio = audioRef.current;
    stopAtRef.current = seekRequest.endTime ?? null;
    audio.currentTime = Math.max(0, seekRequest.startTime);
    setCurrentTime(audio.currentTime);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [seekRequest, src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    stopAtRef.current = null;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const skipSeconds = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    stopAtRef.current = null;
    const target = Math.min(
      duration || audio.duration || 0,
      Math.max(0, audio.currentTime + delta)
    );
    audio.currentTime = target;
    setCurrentTime(target);
    onTimeUpdate?.(target);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    stopAtRef.current = null;
    const next = Number(e.target.value);
    audio.currentTime = next;
    setCurrentTime(next);
    onTimeUpdate?.(next);
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration || 0;
          setDuration(dur);
          setLoadError(false);
          onDurationLoaded?.(dur);
          e.currentTarget.playbackRate = playbackRate;
          e.currentTarget.volume = isMuted ? 0 : volume;
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          onTimeUpdate?.(t);
          if (
            stopAtRef.current !== null &&
            t >= stopAtRef.current &&
            !e.currentTarget.paused
          ) {
            e.currentTarget.pause();
            stopAtRef.current = null;
            setIsPlaying(false);
          }
        }}
        onEnded={() => {
          stopAtRef.current = null;
          setIsPlaying(false);
        }}
        onError={() => {
          stopAtRef.current = null;
          setIsPlaying(false);
          setLoadError(true);
        }}
      />

      {tracks && tracks.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
          <span className="text-xs font-medium text-slate-500 mr-1">
            Audio gốc theo Part:
          </span>
          {tracks.map((tr, idx) => (
            <button
              key={tr.label}
              type="button"
              onClick={() => onSelectTrack?.(idx)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                idx === activeTrackIndex
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      )}

      {!src ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          Chưa có file âm thanh gốc hợp lệ cho phần này. Vui lòng gắn file MP3/WAV/M4A/MP4 gốc để phát.
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => skipSeconds(-5)}
              title="Tua lùi 5 giây"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              -5s
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-700 transition"
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => skipSeconds(5)}
              title="Tua tiến 5 giây"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              +5s
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            <span className="ml-2 font-mono text-xs font-medium text-slate-600 tabular-nums">
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </span>
          </div>

          <div className="flex-1 px-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={Math.min(currentTime, duration || 100)}
              onChange={handleScrub}
              aria-label="Thanh tiến trình âm thanh"
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    playbackRate === rate
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-500" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setIsMuted(false);
                  setVolume(Number(e.target.value));
                }}
                aria-label="Âm lượng"
                className="w-20 accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
      {src && loadError && (
        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Không thể tải file âm thanh từ máy chủ lúc này. Vui lòng kiểm tra kết nối mạng, tải lại trang hoặc dùng nút <strong>Gắn Audio gốc</strong> để nạp file từ máy.
        </div>
      )}
    </div>
  );
};
