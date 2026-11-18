import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Keyboard,
  Play,
  RotateCcw,
  Upload,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  createObjectUrlForBlobId,
  db,
  markVolSkillProgress,
  recordStudyMinutes,
  saveMediaBlob,
  upsertVolTestOverride,
} from '../db/database';
import { AudioPlayerBar, AudioTrackOption } from '../components/AudioPlayerBar';
import { DictionaryPopover } from '../components/DictionaryPopover';
import { VolTestCrossNav } from '../components/VolTestCrossNav';
import { useResolvedVolumeTest } from '../lib/volumeRepository';
import { getQuestionTypeLabel, gradeTestAttempt } from '../lib/grading';
import { ErrorLogItem, IeltsTest, ListeningPart, TestAttempt } from '../types';
import { getTodayLocalISODate } from '../lib/sm2';

function highlightTranscriptKeyword(
  text: string,
  keyword: string | undefined,
  qNum: number | undefined,
  revealHighlights: boolean
): React.ReactNode {
  if (!revealHighlights || !keyword || !keyword.trim()) {
    return text;
  }
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + keyword.length);
  const after = text.slice(idx + keyword.length);

  return (
    <>
      {before}
      <mark className="rounded bg-amber-200 px-1 py-0.5 font-bold text-slate-950 ring-1 ring-amber-400">
        {match}
        {qNum ? (
          <span className="ml-1 rounded bg-indigo-700 px-1 text-[10px] font-black text-white">
            Q{qNum}
          </span>
        ) : null}
      </mark>
      {after}
    </>
  );
}

export const ListeningTestPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const listeningTests = useLiveQuery(
    () => db.tests.where('skill').equals('listening').toArray(),
    [],
    []
  );

  const volParam = searchParams.get('vol');
  const testParam = searchParams.get('test');
  const viewParam = searchParams.get('view');
  const volNum = volParam ? Number(volParam) : null;
  const testNum = testParam ? Number(testParam) : null;
  const { test: volTest, loading: volLoading, progressBySkill } =
    useResolvedVolumeTest(volNum, testNum);

  const requestedId = searchParams.get('testId');
  const activeTest: IeltsTest | undefined = useMemo(() => {
    if (volTest) {
      const mergedParts: ListeningPart[] = [1, 2, 3, 4].map((pNum) => {
        const lPart = volTest.listening.parts.find((p) => p.partNumber === pNum);
        const tPart = volTest.transcript.parts.find((p) => p.partNumber === pNum);
        return {
          partNumber: pNum,
          title: lPart?.title || tPart?.title || `Part ${pNum}`,
          audioUrl: lPart?.audioSrc,
          lines: (tPart?.segments || []).map((s) => ({
            id: s.id,
            speaker: s.speaker,
            text: s.text,
            startTime: s.startTime,
            endTime: s.endTime,
            targetQuestionNumber: s.answerRef,
            highlightKeyword: s.highlightKeyword,
          })),
        };
      });

      const allQs = volTest.listening.parts.flatMap((p) => p.questions);
      return {
        id: volTest.id,
        title: `${volTest.title} — Listening`,
        skill: 'listening',
        sourceType: 'parsed',
        isDemo: false,
        createdAt: '',
        durationMinutes: 35,
        fullAudioUrl: volTest.listening.fullAudioSrc,
        listeningParts: mergedParts,
        questions: allQs,
      };
    }

    if (listeningTests.length === 0) return undefined;
    return (
      listeningTests.find((t) => t.id === requestedId) || listeningTests[0]
    );
  }, [volTest, listeningTests, requestedId]);

  const [activePartNum, setActivePartNum] = useState(1);
  const [showTranscript, setShowTranscript] = useState(
    viewParam === 'transcript'
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submittedAttempt, setSubmittedAttempt] = useState<TestAttempt | null>(
    null
  );

  const [tracks, setTracks] = useState<AudioTrackOption[]>([]);
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [seekReq, setSeekReq] = useState<{
    startTime: number;
    endTime?: number;
    seq: number;
  } | null>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);

  const [dictLookup, setDictLookup] = useState<{
    word: string;
    contextSentence: string;
    pos?: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    setActivePartNum(1);
    setShowTranscript(viewParam === 'transcript');
    setAnswers({});
    setSubmittedAttempt(null);
    setActiveTrackIdx(0);
  }, [activeTest?.id]);

  useEffect(() => {
    if (viewParam === 'transcript') {
      setShowTranscript(true);
    }
  }, [viewParam]);

  useEffect(() => {
    if (!activeTest) {
      setTracks([]);
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    const loadAudio = async () => {
      const resolved: AudioTrackOption[] = [];

      if (activeTest.fullAudioUrl) {
        resolved.push({ label: 'Full Audio', url: activeTest.fullAudioUrl });
      } else if (activeTest.fullAudioBlobId) {
        const url = await createObjectUrlForBlobId(activeTest.fullAudioBlobId);
        if (url) {
          createdUrls.push(url);
          resolved.push({ label: 'Full Audio', url });
        }
      }

      if (activeTest.listeningParts) {
        for (const p of activeTest.listeningParts) {
          if (p.audioUrl) {
            resolved.push({ label: `Part ${p.partNumber}`, url: p.audioUrl });
          } else if (p.audioBlobId) {
            const url = await createObjectUrlForBlobId(p.audioBlobId);
            if (url) {
              createdUrls.push(url);
              resolved.push({ label: `Part ${p.partNumber}`, url });
            }
          }
        }
      }

      if (!cancelled) {
        setTracks(resolved);
      } else {
        createdUrls.forEach((u) => URL.revokeObjectURL(u));
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [activeTest]);

  const handleAttachOriginalAudio = async (
    file: File | undefined,
    targetPart: 0 | 1 | 2 | 3 | 4
  ) => {
    if (!file || !volTest) return;
    const blobId = await saveMediaBlob(file, file.name);
    await upsertVolTestOverride(
      volTest.volNumber,
      volTest.testNumber,
      (prev) => ({
        ...prev,
        listeningPatch: {
          ...prev.listeningPatch,
          ...(targetPart === 0
            ? { fullAudioBlobId: blobId }
            : {
                partAudioBlobIds: {
                  ...(prev.listeningPatch?.partAudioBlobIds || {}),
                  [targetPart]: blobId,
                },
              }),
        },
      })
    );
  };

  const handleSubmit = async () => {
    if (!activeTest || submittedAttempt) return;
    const graded = gradeTestAttempt('listening', activeTest.questions, answers);

    const attempt: TestAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      testId: activeTest.id,
      testTitle: activeTest.title,
      skill: 'listening',
      submittedAt: new Date().toISOString(),
      durationSeconds: Math.max(60, Math.round(currentAudioTime)),
      score: graded.score,
      totalQuestions: graded.totalQuestions,
      estimatedBand: graded.bandInfo.band,
      userAnswers: answers,
      questionResults: graded.questionResults,
    };

    await db.attempts.put(attempt);
    await recordStudyMinutes(
      Math.max(5, Math.round((attempt.durationSeconds || 300) / 60)),
      getTodayLocalISODate()
    );

    if (volTest) {
      await markVolSkillProgress(
        volTest.volNumber,
        volTest.testNumber,
        'listening',
        true,
        `${graded.score}/${graded.totalQuestions} (Band ${graded.bandInfo.band})`
      );
    }

    const wrongErrors: ErrorLogItem[] = activeTest.questions
      .filter((q) => !graded.questionResults[q.questionNumber])
      .map((q) => ({
        id: `err-${attempt.id}-q${q.questionNumber}`,
        attemptId: attempt.id,
        testId: activeTest.id,
        testTitle: activeTest.title,
        skill: 'listening',
        questionNumber: q.questionNumber,
        questionType: q.type,
        prompt: q.prompt,
        userAnswer: answers[q.questionNumber] || '(Bỏ trống)',
        correctAnswer: q.acceptedAnswers[0] || '(Chưa có đáp án)',
        explanation: q.explanation,
        evidenceQuote: q.evidenceQuote,
        personalNote: '',
        mastered: false,
        createdAt: new Date().toISOString(),
      }));

    if (wrongErrors.length > 0) {
      await db.errorLogs.bulkPut(wrongErrors);
    }

    setSubmittedAttempt(attempt);
    setShowTranscript(true);
  };

  if (volLoading) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center text-sm font-semibold text-slate-600">
        Đang tải dữ liệu Listening & Transcript Vol {volNum} — Test {testNum}...
      </div>
    );
  }

  if (!activeTest) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900">
          Chưa có đề Listening nào được chọn
        </h2>
        <p className="text-sm text-slate-600">
          Chọn từ Bộ đề Vol 1–10 hoặc tải file câu hỏi + MP3/WAV gốc ở Bộ tách
          đề.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/volumes"
            className="inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            Mở Bộ đề Vol 1–10
          </Link>
          <Link
            to="/parser"
            className="inline-flex rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700"
          >
            Tải đề cá nhân
          </Link>
        </div>
      </div>
    );
  }

  const parts = activeTest.listeningParts || [];
  const availablePartNumbers =
    parts.length > 0 ? parts.map((p) => p.partNumber) : [1, 2, 3, 4];

  const activePart = parts.find((p) => p.partNumber === activePartNum);
  const partQuestions = activeTest.questions.filter(
    (q) => q.sectionNumber === activePartNum
  );
  const displayedQuestions =
    partQuestions.length > 0 ? partQuestions : activeTest.questions;

  const activeAudioSrc = tracks[activeTrackIdx]?.url || null;

  return (
    <div className="flex flex-col">
      {volTest && (
        <VolTestCrossNav
          test={volTest}
          activeTab={viewParam === 'transcript' ? 'transcript' : 'listening'}
          progressBySkill={progressBySkill}
        />
      )}

      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Headphones className="h-5 w-5 text-indigo-600" />
            {volTest ? (
              <span className="text-sm font-extrabold text-slate-900">
                {volTest.title} · Audio gốc
              </span>
            ) : (
              <select
                value={activeTest.id}
                onChange={(e) => setSearchParams({ testId: e.target.value })}
                aria-label="Chọn bài Listening"
                className="max-w-md rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                {listeningTests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {volTest && (
              <Link
                to={`/dictation?vol=${volTest.volNumber}&test=${volTest.testNumber}&part=${activePartNum}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700"
              >
                <Keyboard className="h-4 w-4" />
                Luyện Dictation trên Audio gốc này
              </Link>
            )}

            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                showTranscript
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {showTranscript ? (
                <>
                  <EyeOff className="h-4 w-4" /> Ẩn Transcript
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" /> Hiện Transcript
                </>
              )}
            </button>

            {activeTest.questions.length > 0 &&
              (!submittedAttempt ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                >
                  Nộp bài & Chấm điểm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setSubmittedAttempt(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Làm lại
                </button>
              ))}
          </div>
        </div>

        {/* Missing / WMA Original Audio Notice & Inline Upload */}
        {volTest &&
          (volTest.listening.status === 'missing_audio' ||
            volTest.listening.status === 'wma_unsupported' ||
            tracks.length === 0) && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-extrabold">
                    {volTest.listening.status === 'wma_unsupported'
                      ? 'File Audio gốc đang ở định dạng .wma (HTML5 không hỗ trợ phát trực tiếp)'
                      : 'Thiếu file Audio gốc cho bài Listening này'}
                  </p>
                  <p className="mt-0.5">
                    {volTest.listening.notes ||
                      `Hệ thống tuyệt đối không thay thế bằng giọng đọc AI/TTS. Hãy gắn file MP3/WAV/M4A/MP4 gốc cho Vol ${volTest.volNumber} Test ${volTest.testNumber} tại đây:`}
                  </p>
                </div>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700">
                <Upload className="h-3.5 w-3.5" />
                Gắn file Audio gốc vào bài thi này
                <input
                  type="file"
                  accept="audio/*,video/mp4"
                  className="hidden"
                  onChange={(e) =>
                    handleAttachOriginalAudio(e.target.files?.[0], 0)
                  }
                />
              </label>
            </div>
          )}

        {/* Audio Player */}
        <AudioPlayerBar
          src={activeAudioSrc}
          tracks={tracks}
          activeTrackIndex={activeTrackIdx}
          onSelectTrack={(idx) => setActiveTrackIdx(idx)}
          seekRequest={seekReq}
          onTimeUpdate={setCurrentAudioTime}
        />

        {/* Result Summary Banner */}
        {submittedAttempt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-black">
                Kết quả: {submittedAttempt.score}/{submittedAttempt.totalQuestions}{' '}
                câu đúng
              </span>
              <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                Band Listening tham khảo:{' '}
                {submittedAttempt.estimatedBand.toFixed(1)}
              </span>
              <span className="text-xs text-emerald-800">
                Transcript bên phải đã đánh dấu từ khóa đáp án.
              </span>
            </div>
            <Link
              to="/errors"
              className="text-xs font-bold text-indigo-700 hover:underline"
            >
              Ôn câu sai trong Error Log →
            </Link>
          </div>
        )}

        {/* Part 1 - 4 Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {availablePartNumbers.map((pNum) => {
            const count = activeTest.questions.filter(
              (q) => q.sectionNumber === pNum
            ).length;
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => {
                  setActivePartNum(pNum);
                  const matchingTrack = tracks.findIndex(
                    (t) => t.label === `Part ${pNum}`
                  );
                  if (matchingTrack > -1) setActiveTrackIdx(matchingTrack);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activePartNum === pNum
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Part {pNum} {count > 0 ? `(${count} câu)` : ''}
              </button>
            );
          })}
        </div>

        {/* Main Content: Questions / Scanned PDF (Left) + Transcript (Right) */}
        <div
          className={`grid grid-cols-1 gap-6 ${
            showTranscript ? 'lg:grid-cols-2' : ''
          }`}
        >
          {/* Left Column */}
          <div className="space-y-4">
            {volTest?.listening.originalPdfUrl && (
              <div className="rounded-2xl border border-amber-200 bg-white p-3 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-800">
                    Đề câu hỏi PDF gốc (kèm theo audio gốc)
                  </span>
                  <a
                    href={volTest.listening.originalPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-indigo-600 hover:underline"
                  >
                    Mở tab riêng ↗
                  </a>
                </div>
                <iframe
                  src={volTest.listening.originalPdfUrl}
                  title={`Listening PDF ${volTest.title}`}
                  className="w-full h-[460px] rounded-xl border border-slate-200"
                />
              </div>
            )}

            {displayedQuestions.length === 0 && !volTest?.listening.originalPdfUrl && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-600">
                Chưa có câu hỏi số hóa cho phần này. Bạn có thể bổ sung file
                DOCX/PDF đề thi trong Bộ đề Vol 1–10.
              </div>
            )}

            {displayedQuestions.map((q) => {
              const userVal = answers[q.questionNumber] || '';
              const isCorrect =
                submittedAttempt?.questionResults[q.questionNumber];

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-4 shadow-xs ${
                    submittedAttempt
                      ? isCorrect
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-rose-300 bg-rose-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {q.instruction && (
                    <p className="mb-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900">
                      {q.instruction}
                    </p>
                  )}

                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-slate-900 px-1.5 text-xs font-extrabold text-white">
                      {q.questionNumber}
                    </span>
                    <div className="flex-1 space-y-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {q.prompt}
                        </p>
                        <span className="text-[11px] text-slate-500">
                          {getQuestionTypeLabel(q.type)}
                        </span>
                      </div>

                      {q.options && q.options.length > 0 ? (
                        <div className="space-y-1.5">
                          {q.options.map((opt) => {
                            const val = opt.split(/[\.\)]/)[0].trim();
                            const checked =
                              userVal.toLowerCase() === val.toLowerCase();
                            return (
                              <label
                                key={opt}
                                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                                  checked
                                    ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-900'
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`lq-${q.questionNumber}`}
                                  checked={checked}
                                  disabled={Boolean(submittedAttempt)}
                                  onChange={() =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [q.questionNumber]: val,
                                    }))
                                  }
                                  className="accent-indigo-600"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={userVal}
                          disabled={Boolean(submittedAttempt)}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.questionNumber]: e.target.value,
                            }))
                          }
                          placeholder="Nhập đáp án nghe được..."
                          className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                        />
                      )}

                      {submittedAttempt && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            {isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-600" />
                            )}
                            <span>
                              Đáp án đúng:{' '}
                              <strong className="text-emerald-700">
                                {q.acceptedAnswers.join(' / ') || 'Chưa có đáp án'}
                              </strong>
                            </span>
                          </div>
                          {q.explanation && (
                            <p className="text-slate-700 leading-relaxed">
                              <strong>Giải thích: </strong>
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Transcript */}
          {showTranscript && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 h-fit lg:sticky lg:top-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {activePart?.title || `Transcript Part ${activePartNum}`}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    Nhấn vào từ để tra từ điển & lưu SRS
                  </span>
                </div>
              </div>

              {!activePart || activePart.lines.length === 0 ? (
                volTest?.transcript.originalPdfUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800 font-semibold">
                      Transcript gốc của Vol này là PDF scan ảnh:
                    </p>
                    <iframe
                      src={volTest.transcript.originalPdfUrl}
                      title="Original Scanned Transcript"
                      className="w-full h-[460px] rounded-xl border border-slate-200"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Part này chưa có nội dung Transcript văn bản.
                  </p>
                )
              ) : (
                <div className="space-y-3 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
                  {activePart.lines.map((line) => {
                    const isActiveNow =
                      line.startTime !== undefined &&
                      line.endTime !== undefined &&
                      currentAudioTime >= line.startTime &&
                      currentAudioTime <= line.endTime;

                    return (
                      <div
                        key={line.id}
                        className={`rounded-xl border p-3 text-sm leading-relaxed transition ${
                          isActiveNow
                            ? 'border-indigo-400 bg-indigo-50/70'
                            : 'border-slate-100 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-indigo-700">
                            {line.speaker || `Câu #${line.id.split('-').pop()}`}
                          </span>
                          {line.startTime !== undefined && (
                            <button
                              type="button"
                              onClick={() =>
                                setSeekReq((prev) => ({
                                  startTime: line.startTime!,
                                  endTime: line.endTime,
                                  seq: (prev?.seq ?? 0) + 1,
                                }))
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-indigo-600 hover:text-white"
                            >
                              <Play className="h-3 w-3" />
                              Nghe ({line.startTime.toFixed(1)}s)
                            </button>
                          )}
                        </div>

                        <p
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.dataset.word) {
                              setDictLookup({
                                word: target.dataset.word,
                                contextSentence: line.text,
                                pos: { x: e.clientX, y: e.clientY },
                              });
                            }
                          }}
                          className="text-slate-800"
                        >
                          {submittedAttempt && line.highlightKeyword ? (
                            highlightTranscriptKeyword(
                              line.text,
                              line.highlightKeyword,
                              line.targetQuestionNumber,
                              true
                            )
                          ) : (
                            line.text.split(/(\s+)/).map((tok, i) => {
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
                                  className="cursor-pointer hover:bg-indigo-100 rounded-xs"
                                >
                                  {tok}
                                </span>
                              );
                            })
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {dictLookup && (
          <DictionaryPopover
            word={dictLookup.word}
            contextSentence={dictLookup.contextSentence}
            sourceLabel={activeTest.title}
            position={dictLookup.pos}
            onClose={() => setDictLookup(null)}
          />
        )}

        {tracks.length === 0 && !volTest && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Chưa có file Audio gắn với bộ đề cá nhân này.
          </div>
        )}
      </div>
    </div>
  );
};
