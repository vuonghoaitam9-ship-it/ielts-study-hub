import React, { useState } from 'react';
import { Clock, FileUp, Play, Save, Sparkles, X } from 'lucide-react';
import { AudioPlayerBar, AudioTrackOption } from './AudioPlayerBar';
import {
  distributeSegmentTimestamps,
  parseSubtitleToSegments,
} from '../lib/subtitleParser';
import { VolDictationSegment } from '../types';

interface TimestampEditorModalProps {
  open: boolean;
  title: string;
  segments: VolDictationSegment[];
  audioSrc: string | null;
  tracks?: AudioTrackOption[];
  onClose: () => void;
  onSave: (updatedSegments: VolDictationSegment[]) => Promise<void>;
}

export const TimestampEditorModal: React.FC<TimestampEditorModalProps> = ({
  open,
  title,
  segments,
  audioSrc,
  tracks,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<VolDictationSegment[]>(() =>
    segments.map((s) => ({ ...s }))
  );
  const [activeRow, setActiveRow] = useState(0);
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [liveTime, setLiveTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [seekReq, setSeekReq] = useState<{
    startTime: number;
    endTime?: number;
    seq: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const activeSrc =
    tracks && tracks.length > 0 ? tracks[activeTrackIdx]?.url || audioSrc : audioSrc;

  const handleSubtitleUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseSubtitleToSegments(text);
    if (parsed.length > 0) {
      setDraft(parsed);
      setActiveRow(0);
    }
  };

  const handleAutoDistribute = () => {
    const dur = audioDuration > 2 ? audioDuration : draft.length * 6;
    setDraft((prev) => distributeSegmentTimestamps(prev, dur));
  };

  const stampStartHere = (idx: number) => {
    const next = [...draft];
    next[idx] = { ...next[idx], startTime: Number(liveTime.toFixed(2)) };
    setDraft(next);
  };

  const stampEndAndNext = (idx: number) => {
    const t = Number(liveTime.toFixed(2));
    const next = [...draft];
    const start = next[idx].startTime ?? Math.max(0, t - 2);
    next[idx] = { ...next[idx], startTime: start, endTime: Math.max(start + 0.5, t) };
    if (idx + 1 < next.length && next[idx + 1].startTime === undefined) {
      next[idx + 1] = { ...next[idx + 1], startTime: t };
    }
    setDraft(next);
    if (idx + 1 < next.length) {
      setActiveRow(idx + 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" />
              Trình căn chỉnh Timestamp & Nhập SRT/VTT/LRC — {title}
            </h3>
            <p className="text-xs text-slate-500">
              Nghe audio gốc và bấm <strong>Gán Start</strong> /{' '}
              <strong>Gán End & Câu kế</strong> hoặc nhập file phụ đề `.srt`, `.vtt`, `.lrc`.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <AudioPlayerBar
            src={activeSrc}
            tracks={tracks}
            activeTrackIndex={activeTrackIdx}
            onSelectTrack={setActiveTrackIdx}
            seekRequest={seekReq}
            onTimeUpdate={setLiveTime}
            onDurationLoaded={setAudioDuration}
            compact
          />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-700">
                <FileUp className="h-3.5 w-3.5" />
                Nhập file SRT / VTT / LRC
                <input
                  type="file"
                  accept=".srt,.vtt,.lrc,.txt"
                  className="hidden"
                  onChange={(e) => handleSubtitleUpload(e.target.files?.[0])}
                />
              </label>

              <button
                type="button"
                onClick={handleAutoDistribute}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-100"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Ước lượng mốc theo thời lượng ({Math.round(audioDuration)}s)
              </button>
            </div>

            <div className="font-mono font-bold text-indigo-700">
              Vị trí hiện tại: {liveTime.toFixed(2)}s
            </div>
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl divide-y divide-slate-100">
          {draft.map((seg, idx) => {
            const isActive = idx === activeRow;
            return (
              <div
                key={seg.id}
                onClick={() => setActiveRow(idx)}
                className={`p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${
                  isActive ? 'bg-indigo-50/70' : 'bg-white'
                }`}
              >
                <div className="flex-1 text-xs">
                  <span className="font-extrabold text-indigo-700 mr-2">
                    #{seg.index} (P{seg.partNumber})
                  </span>
                  <span className="text-slate-800">{seg.transcript}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                  <input
                    type="number"
                    step={0.1}
                    value={seg.startTime ?? ''}
                    placeholder="Start"
                    onChange={(e) => {
                      const next = [...draft];
                      next[idx] = {
                        ...seg,
                        startTime: e.target.value === '' ? undefined : Number(e.target.value),
                      };
                      setDraft(next);
                    }}
                    className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono"
                  />
                  <span className="text-xs text-slate-400">→</span>
                  <input
                    type="number"
                    step={0.1}
                    value={seg.endTime ?? ''}
                    placeholder="End"
                    onChange={(e) => {
                      const next = [...draft];
                      next[idx] = {
                        ...seg,
                        endTime: e.target.value === '' ? undefined : Number(e.target.value),
                      };
                      setDraft(next);
                    }}
                    className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stampStartHere(idx);
                    }}
                    className="rounded bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-800 hover:bg-sky-200"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stampEndAndNext(idx);
                    }}
                    className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200"
                  >
                    End & Kế
                  </button>
                  {seg.startTime !== undefined && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSeekReq((prev) => ({
                          startTime: seg.startTime!,
                          endTime: seg.endTime,
                          seq: (prev?.seq ?? 0) + 1,
                        }));
                      }}
                      title="Nghe thử đoạn này"
                      className="rounded bg-purple-600 p-1.5 text-white hover:bg-purple-700"
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Save className="h-4 w-4" />
            Lưu Timestamp cho Dictation & Transcript
          </button>
        </div>
      </div>
    </div>
  );
};
