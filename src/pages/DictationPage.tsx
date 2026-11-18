import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  HelpCircle,
  Keyboard,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  createObjectUrlForBlobId,
  db,
  markVolSkillProgress,
  recordStudyMinutes,
  saveMediaBlob,
  upsertVolTestOverride,
} from '../db/database';
import {
  AudioPlayerBar,
  AudioTrackOption,
  formatAudioTime,
} from '../components/AudioPlayerBar';
import {
  DictationDiffResult,
  diffDictationWords,
  getDictationHint,
} from '../lib/dictationDiff';
import { DictionaryPopover } from '../components/DictionaryPopover';
import { TimestampEditorModal } from '../components/TimestampEditorModal';
import { VolTestCrossNav } from '../components/VolTestCrossNav';
import { useResolvedVolumeTest } from '../lib/volumeRepository';
import {
  DictationSegment,
  DictationSet,
  VolDictationSegment,
} from '../types';
import { getTodayLocalISODate } from '../lib/sm2';

export const DictationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const dictationSets = useLiveQuery(
    () => db.dictationSets.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );

  const volParam = searchParams.get('vol');
  const testParam = searchParams.get('test');
  const partParam = searchParams.get('part');
  const volNum = volParam ? Number(volParam) : null;
  const testNum = testParam ? Number(testParam) : null;

  const { test: volTest, loading: volLoading, progressBySkill } =
    useResolvedVolumeTest(volNum, testNum);

  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const activeCustomSet: DictationSet | undefined = useMemo(() => {
    if (volTest || dictationSets.length === 0) return undefined;
    return (
      dictationSets.find((s) => s.id === selectedSetId) || dictationSets[0]
    );
  }, [volTest, dictationSets, selectedSetId]);

  const segments: VolDictationSegment[] = useMemo(() => {
    if (volTest) {
      return volTest.dictation.segments;
    }
    if (activeCustomSet) {
      return activeCustomSet.segments.map((s) => ({
        id: s.id,
        index: s.index,
        partNumber: (Math.min(4, Math.max(1, s.partNumber)) as 1 | 2 | 3 | 4),
        speaker: s.speaker,
        startTime: s.startTime,
        endTime: s.endTime,
        transcript: s.transcript,
      }));
    }
    return [];
  }, [volTest, activeCustomSet]);

  const [activeSegIndex, setActiveSegIndex] = useState(0);
  const [customBlobAudioUrl, setCustomBlobAudioUrl] = useState<string | null>(
    null
  );
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [seekReq, setSeekReq] = useState<{
    startTime: number;
    endTime?: number;
    seq: number;
  } | null>(null);

  const [typedText, setTypedText] = useState('');
  const [diffResult, setDiffResult] = useState<DictationDiffResult | null>(null);
  const [revealOriginal, setRevealOriginal] = useState(false);
  const [segmentScores, setSegmentScores] = useState<Record<string, number>>(
    {}
  );
  const [tsEditorOpen, setTsEditorOpen] = useState(false);

  const [dictLookup, setDictLookup] = useState<{
    word: string;
    contextSentence: string;
    pos?: { x: number; y: number };
  } | null>(null);

  // Custom Dictation Builder Modal (for personal non-Vol audio)
  const [builderOpen, setBuilderOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTranscript, setNewTranscript] = useState('');
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null);

  // Jump to first segment of requested ?part=P if specified
  useEffect(() => {
    if (partParam && segments.length > 0) {
      const pNum = Number(partParam);
      const firstIdx = segments.findIndex((s) => s.partNumber === pNum);
      setActiveSegIndex(firstIdx >= 0 ? firstIdx : 0);
    } else {
      setActiveSegIndex(0);
    }
    setTypedText('');
    setDiffResult(null);
    setRevealOriginal(false);
    setSegmentScores({});
  }, [volTest?.id, activeCustomSet?.id, partParam]);

  useEffect(() => {
    if (volTest || !activeCustomSet) {
      setCustomBlobAudioUrl(null);
      return;
    }

    if (activeCustomSet.audioUrl) {
      setCustomBlobAudioUrl(activeCustomSet.audioUrl);
      return;
    }

    let revoked = false;
    let objUrl: string | null = null;
    if (activeCustomSet.audioBlobId) {
      createObjectUrlForBlobId(activeCustomSet.audioBlobId).then((url) => {
        if (!revoked && url) {
          objUrl = url;
          setCustomBlobAudioUrl(url);
        } else if (url) {
          URL.revokeObjectURL(url);
        }
      });
    } else {
      setCustomBlobAudioUrl(null);
    }

    return () => {
      revoked = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [volTest, activeCustomSet?.id]);

  // Build available original audio tracks for Vol or Custom Set
  const tracks = useMemo<AudioTrackOption[]>(() => {
    if (volTest) {
      const out: AudioTrackOption[] = [];
      if (volTest.dictation.fullAudioSrc) {
        out.push({ label: 'Full Audio', url: volTest.dictation.fullAudioSrc });
      }
      for (const p of [1, 2, 3, 4]) {
        const u = volTest.dictation.partAudioMap[p];
        if (u) out.push({ label: `Part ${p}`, url: u });
      }
      return out;
    }
    if (customBlobAudioUrl) {
      return [{ label: 'Audio gốc', url: customBlobAudioUrl }];
    }
    return [];
  }, [volTest, customBlobAudioUrl]);

  const activeSegment = segments[activeSegIndex];

  // Auto-select matching Part audio track if test uses per-part audio files
  useEffect(() => {
    if (!activeSegment || tracks.length <= 1) return;
    const partTrackIdx = tracks.findIndex(
      (t) => t.label === `Part ${activeSegment.partNumber}`
    );
    if (partTrackIdx > -1) {
      setActiveTrackIdx(partTrackIdx);
    }
  }, [activeSegment?.partNumber, tracks]);

  const activeAudioSrc = tracks[activeTrackIdx]?.url || null;

  const playCurrentSegment = () => {
    if (!activeSegment || !activeAudioSrc) return;
    if (activeSegment.startTime === undefined) return;
    setSeekReq((prev) => ({
      startTime: activeSegment.startTime!,
      endTime: activeSegment.endTime,
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  const selectSegment = (idx: number) => {
    if (segments.length === 0) return;
    const clamped = Math.max(0, Math.min(segments.length - 1, idx));
    setActiveSegIndex(clamped);
    setTypedText('');
    setDiffResult(null);
    setRevealOriginal(false);

    const seg = segments[clamped];
    if (seg && seg.startTime !== undefined) {
      // Ensure track switches before seeking if needed
      const partIdx = tracks.findIndex((t) => t.label === `Part ${seg.partNumber}`);
      if (partIdx > -1) setActiveTrackIdx(partIdx);
      setSeekReq((prev) => ({
        startTime: seg.startTime!,
        endTime: seg.endTime,
        seq: (prev?.seq ?? 0) + 1,
      }));
    }
  };

  const handleCheckDictation = async () => {
    if (!activeSegment) return;
    const res = diffDictationWords(activeSegment.transcript, typedText);
    setDiffResult(res);
    const nextScores = { ...segmentScores, [activeSegment.id]: res.accuracyPercent };
    setSegmentScores(nextScores);
    await recordStudyMinutes(2, getTodayLocalISODate());

    if (volTest) {
      const vals = Object.values(nextScores);
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      await markVolSkillProgress(
        volTest.volNumber,
        volTest.testNumber,
        'dictation',
        true,
        `${vals.length} câu · TB ${avg}%`
      );
    }
  };

  const handleHint = (mode: 'char' | 'word') => {
    if (!activeSegment) return;
    const hinted = getDictationHint(activeSegment.transcript, typedText, mode);
    setTypedText(hinted);
  };

  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      playCurrentSegment();
    } else if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCheckDictation();
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      selectSegment(activeSegIndex + 1);
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      selectSegment(activeSegIndex - 1);
    } else if (e.altKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      handleHint('word');
    }
  };

  const handleCreateCustomSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTranscript.trim()) return;

    const lines = newTranscript
      .replace(/\r\n/g, '\n')
      .split(/\n+|(?<=[\.\?\!])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (lines.length === 0) return;

    let audioBlobId: string | undefined;
    let totalSec = 60;
    if (newAudioFile) {
      audioBlobId = await saveMediaBlob(newAudioFile, newAudioFile.name);
      const tempUrl = URL.createObjectURL(newAudioFile);
      try {
        const audioDur = await new Promise<number>((resolve) => {
          const el = new Audio(tempUrl);
          el.onloadedmetadata = () => resolve(el.duration || totalSec);
          el.onerror = () => resolve(totalSec);
        });
        if (Number.isFinite(audioDur) && audioDur > 1) {
          totalSec = audioDur;
        }
      } finally {
        URL.revokeObjectURL(tempUrl);
      }
    }

    const totalWords = lines.reduce(
      (sum, l) => sum + l.split(/\s+/).length,
      0
    );
    let cursor = 0;
    const builtSegments: DictationSegment[] = lines.map((line, i) => {
      const words = line.split(/\s+/).length;
      const segDur = (words / Math.max(1, totalWords)) * totalSec;
      const startTime = Number(cursor.toFixed(2));
      cursor += segDur;
      const endTime = Number(cursor.toFixed(2));
      return {
        id: `custom-seg-${Date.now()}-${i}`,
        index: i + 1,
        partNumber: 1,
        startTime,
        endTime,
        transcript: line,
      };
    });

    const id = `dic-custom-${Date.now()}`;
    await db.dictationSets.put({
      id,
      title: newTitle.trim() || `Bài Dictation (${builtSegments.length} câu)`,
      isDemo: false,
      audioBlobId,
      createdAt: new Date().toISOString(),
      segments: builtSegments,
    });

    setSelectedSetId(id);
    setBuilderOpen(false);
    setNewTitle('');
    setNewTranscript('');
    setNewAudioFile(null);
  };

  const completedValues = Object.values(segmentScores);
  const averageAccuracy =
    completedValues.length > 0
      ? Math.round(
          completedValues.reduce((a, b) => a + b, 0) / completedValues.length
        )
      : null;

  if (volLoading) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center text-sm font-semibold text-slate-600">
        Đang tải dữ liệu Dictation & Audio gốc Vol {volNum} — Test {testNum}...
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {volTest && (
        <VolTestCrossNav
          test={volTest}
          activeTab="dictation"
          progressBySkill={progressBySkill}
        />
      )}

      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-purple-600" />
            {volTest ? (
              <span className="text-sm font-extrabold text-slate-900">
                {volTest.title} · Dictation từ Audio gốc
              </span>
            ) : (
              <select
                value={activeCustomSet?.id || ''}
                onChange={(e) => setSelectedSetId(e.target.value)}
                aria-label="Chọn bài Dictation"
                className="max-w-md rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {dictationSets.length === 0 ? (
                  <option value="">Chưa có bài Dictation cá nhân</option>
                ) : (
                  dictationSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {averageAccuracy !== null && (
              <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
                Độ chính xác TB: {averageAccuracy}% ({completedValues.length}/
                {segments.length} câu)
              </span>
            )}

            {segments.length > 0 && (
              <button
                type="button"
                onClick={() => setTsEditorOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
              >
                <Clock className="h-3.5 w-3.5" />
                Chỉnh Timestamp / Nhập SRT-VTT-LRC
              </button>
            )}

            {!volTest && (
              <button
                type="button"
                onClick={() => setBuilderOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Tạo bài Dictation từ Audio gốc + Script
              </button>
            )}
          </div>
        </div>

        {/* Manual Mode / Missing Timestamp / Missing Audio Notices */}
        {volTest && !activeAudioSrc && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-extrabold">
                  {volTest.listening.status === 'wma_unsupported'
                    ? 'Audio gốc đang là .wma (HTML5 không hỗ trợ phát trực tiếp)'
                    : 'Chưa có file Audio gốc cho phần Dictation của đề này'}
                </p>
                <p className="mt-0.5">
                  Dictation bắt buộc dùng 100% file audio gốc. Hãy gắn file
                  MP3/WAV/M4A/MP4 gốc tại Bộ đề Vol 1–10 hoặc tải lên ngay bên
                  dưới:
                </p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700">
              <Upload className="h-3.5 w-3.5" />
              Gắn Audio gốc ngay
              <input
                type="file"
                accept="audio/*,video/mp4"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const blobId = await saveMediaBlob(file, file.name);
                  await upsertVolTestOverride(
                    volTest.volNumber,
                    volTest.testNumber,
                    (prev) => ({
                      ...prev,
                      listeningPatch: {
                        ...prev.listeningPatch,
                        fullAudioBlobId: blobId,
                      },
                    })
                  );
                }}
              />
            </label>
          </div>
        )}

        {volTest &&
          activeAudioSrc &&
          segments.length > 0 &&
          !volTest.dictation.hasExactTimestamps && (
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Chế độ phát thủ công:</strong> Bộ Transcript này chưa
                  có mốc thời gian (startTime/endTime) cho từng câu. Bạn vẫn có
                  thể điều khiển trình phát audio gốc bên dưới để nghe chép,
                  hoặc bấm <strong>Chỉnh Timestamp / Nhập SRT-VTT-LRC</strong> để
                  gán mốc tự ngắt câu!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTsEditorOpen(true)}
                className="self-start rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 flex-shrink-0"
              >
                Gán Timestamp ngay
              </button>
            </div>
          )}

        {/* Audio Player */}
        <AudioPlayerBar
          src={activeAudioSrc}
          tracks={tracks}
          activeTrackIndex={activeTrackIdx}
          onSelectTrack={setActiveTrackIdx}
          seekRequest={seekReq}
          compact
        />

        {segments.length > 0 && activeSegment ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Segment List Sidebar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 h-fit">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
                Danh sách Phân đoạn ({segments.length} câu)
              </h3>
              <div className="max-h-[460px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {segments.map((seg, idx) => {
                  const score = segmentScores[seg.id];
                  const isActive = idx === activeSegIndex;
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => selectSegment(idx)}
                      className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-900'
                          : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>Câu {seg.index}</span>
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200">
                            Part {seg.partNumber}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                          {seg.startTime !== undefined && seg.endTime !== undefined
                            ? `${formatAudioTime(seg.startTime)} – ${formatAudioTime(seg.endTime)}`
                            : 'Chưa gắn timestamp (Phát thủ công)'}
                          {seg.speaker ? ` · ${seg.speaker}` : ''}
                        </p>
                      </div>

                      {score !== undefined && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                            score >= 85
                              ? 'bg-emerald-100 text-emerald-700'
                              : score >= 60
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {score}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Typing & Word-Level Diff Workspace */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-extrabold text-indigo-600">
                      Đoạn #{activeSegment.index} / {segments.length} ·{' '}
                      {activeSegment.startTime !== undefined &&
                      activeSegment.endTime !== undefined
                        ? `${formatAudioTime(activeSegment.startTime)} → ${formatAudioTime(activeSegment.endTime)}`
                        : 'Chế độ phát thủ công'}
                    </span>
                    {activeSegment.speaker && (
                      <p className="text-xs text-slate-500">
                        Người nói: {activeSegment.speaker}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={activeSegIndex === 0}
                      onClick={() => selectSegment(activeSegIndex - 1)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      title="Câu trước (Alt + Left)"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={activeSegment.startTime === undefined || !activeAudioSrc}
                      onClick={playCurrentSegment}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-40"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Phát lại đoạn này (Ctrl+Space)
                    </button>
                    <button
                      type="button"
                      disabled={activeSegIndex >= segments.length - 1}
                      onClick={() => selectSegment(activeSegIndex + 1)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      title="Câu tiếp theo (Alt + Right)"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                    Ctrl + Space: Phát lại đoạn
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                    Ctrl + Enter: Chấm từng từ
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                    Alt + ←/→: Đổi câu
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                    Alt + H: Gợi ý từ tiếp
                  </span>
                </div>

                <textarea
                  rows={4}
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Nghe đoạn audio gốc và gõ lại chính xác từng từ bạn nghe được tại đây..."
                  className="w-full rounded-xl border border-slate-300 p-3.5 text-base font-medium leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleHint('char')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
                      Gợi ý ký tự tiếp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHint('word')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Gợi ý từ tiếp theo
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevealOriginal((r) => !r)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {revealOriginal ? 'Ẩn câu gốc' : 'Hiện câu gốc'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTypedText('');
                        setDiffResult(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Xóa gõ lại
                    </button>
                    <button
                      type="button"
                      onClick={handleCheckDictation}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Kiểm tra (Word-level Diff)
                    </button>
                  </div>
                </div>

                {revealOriginal && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-sm text-indigo-950">
                    <span className="text-xs font-bold uppercase text-indigo-700 block mb-1">
                      Đáp án gốc (Nhấn vào từ để tra từ điển & lưu SRS):
                    </span>
                    <p
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.dataset.word) {
                          setDictLookup({
                            word: target.dataset.word,
                            contextSentence: activeSegment.transcript,
                            pos: { x: e.clientX, y: e.clientY },
                          });
                        }
                      }}
                    >
                      {activeSegment.transcript.split(/(\s+)/).map((tok, i) => {
                        if (!tok.trim()) return tok;
                        const clean = tok.replace(
                          /^[^a-zA-Z]+|[^a-zA-Z]+$/g,
                          ''
                        );
                        if (!clean) return tok;
                        return (
                          <span
                            key={i}
                            data-word={clean}
                            className="cursor-pointer hover:bg-indigo-200 rounded-xs"
                          >
                            {tok}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Word-level Diff Panel */}
              {diffResult && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-900">
                        Độ chính xác:
                      </span>
                      <span
                        className={`rounded-xl px-3 py-1 text-base font-black ${
                          diffResult.accuracyPercent >= 85
                            ? 'bg-emerald-100 text-emerald-700'
                            : diffResult.accuracyPercent >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {diffResult.accuracyPercent}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                        Đúng: {diffResult.correctCount}
                      </span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                        Sai chính tả: {diffResult.misspelledCount}
                      </span>
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">
                        Thiếu: {diffResult.missingCount}
                      </span>
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800">
                        Dư: {diffResult.extraCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 leading-loose">
                    {diffResult.tokens.map((tok, i) => {
                      if (tok.status === 'correct') {
                        return (
                          <span
                            key={i}
                            className="rounded-lg bg-emerald-100 px-2 py-1 text-sm font-semibold text-emerald-900"
                          >
                            {tok.expectedWord}
                          </span>
                        );
                      }
                      if (tok.status === 'misspelled') {
                        return (
                          <span
                            key={i}
                            title="Sai chính tả"
                            className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-900"
                          >
                            <span className="line-through text-rose-600 mr-1">
                              {tok.actualWord}
                            </span>
                            → {tok.expectedWord}
                          </span>
                        );
                      }
                      if (tok.status === 'missing') {
                        return (
                          <span
                            key={i}
                            title="Từ bị thiếu"
                            className="rounded-lg border border-dashed border-rose-400 bg-rose-50 px-2 py-1 text-sm font-bold text-rose-700"
                          >
                            + {tok.expectedWord}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={i}
                          title="Từ bị gõ dư"
                          className="rounded-lg bg-purple-100 px-2 py-1 text-sm font-medium text-purple-800 line-through"
                        >
                          {tok.actualWord}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 space-y-3">
            <p className="font-bold text-slate-800">
              {volTest
                ? `Chưa có Transcript/Phụ đề cho ${volTest.title}.`
                : 'Chưa có bài Dictation nào. Hãy mở Bộ đề Vol 1–10 (ví dụ Vol 1, Vol 3, Vol 7, Vol 8, Vol 9) hoặc tạo mới từ file Audio gốc + Script của bạn!'}
            </p>
            <div className="flex justify-center gap-3">
              <Link
                to={volTest ? `/volumes?vol=${volTest.volNumber}` : '/volumes'}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Mở Bộ đề Vol 1–10
              </Link>
              {!volTest && (
                <button
                  type="button"
                  onClick={() => setBuilderOpen(true)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Tạo bài Dictation từ Audio gốc
                </button>
              )}
            </div>
          </div>
        )}

        {/* Custom Dictation Builder Modal */}
        {builderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <form
              onSubmit={handleCreateCustomSet}
              className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  Tạo bài Dictation mới từ Audio gốc & Transcript cá nhân
                </h3>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên bài Dictation
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Vol 1 Test 1 Part 1 - Dictation"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  File âm thanh gốc (MP3 / WAV / M4A / MP4)
                </label>
                <input
                  type="file"
                  required
                  accept="audio/*,video/mp4"
                  onChange={(e) => setNewAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 py-1.5 file:text-xs file:font-semibold file:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dán Transcript (Hệ thống tách từng câu theo dấu câu/xuống dòng)
                </label>
                <textarea
                  rows={6}
                  required
                  value={newTranscript}
                  onChange={(e) => setNewTranscript(e.target.value)}
                  placeholder="Dán nội dung transcript..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Tạo & Chia đoạn ngay
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Timestamp Editor & SRT/VTT/LRC Importer */}
        {tsEditorOpen && (
          <TimestampEditorModal
            open={tsEditorOpen}
            title={volTest?.title || activeCustomSet?.title || 'Dictation'}
            segments={segments}
            audioSrc={activeAudioSrc}
            tracks={tracks}
            onClose={() => setTsEditorOpen(false)}
            onSave={async (updated) => {
              if (volTest) {
                await upsertVolTestOverride(
                  volTest.volNumber,
                  volTest.testNumber,
                  (prev) => ({
                    ...prev,
                    dictationSegments: updated,
                  })
                );
              } else if (activeCustomSet) {
                await db.dictationSets.update(activeCustomSet.id, {
                  segments: updated.map((u) => ({
                    id: u.id,
                    index: u.index,
                    partNumber: u.partNumber,
                    speaker: u.speaker,
                    startTime: u.startTime ?? 0,
                    endTime: u.endTime ?? 5,
                    transcript: u.transcript,
                  })),
                });
              }
            }}
          />
        )}

        {dictLookup && (
          <DictionaryPopover
            word={dictLookup.word}
            contextSentence={dictLookup.contextSentence}
            sourceLabel={volTest?.title || activeCustomSet?.title}
            position={dictLookup.pos}
            onClose={() => setDictLookup(null)}
          />
        )}
      </div>
    </div>
  );
};
