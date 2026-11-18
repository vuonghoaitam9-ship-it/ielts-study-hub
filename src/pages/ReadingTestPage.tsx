import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Highlighter,
  RotateCcw,
  StickyNote,
  Type,
  XCircle,
} from 'lucide-react';
import { db, markVolSkillProgress, recordStudyMinutes } from '../db/database';
import { getQuestionTypeLabel, gradeTestAttempt } from '../lib/grading';
import { HighlightedPassage } from '../components/HighlightedPassage';
import { DictionaryPopover } from '../components/DictionaryPopover';
import { formatAudioTime } from '../components/AudioPlayerBar';
import { VolTestCrossNav } from '../components/VolTestCrossNav';
import { useResolvedVolumeTest } from '../lib/volumeRepository';
import {
  ErrorLogItem,
  HighlightRange,
  IeltsTest,
  TestAttempt,
} from '../types';
import { getTodayLocalISODate } from '../lib/sm2';

export const ReadingTestPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const readingTests = useLiveQuery(
    () => db.tests.where('skill').equals('reading').toArray(),
    [],
    []
  );

  const volParam = searchParams.get('vol');
  const testParam = searchParams.get('test');
  const volNum = volParam ? Number(volParam) : null;
  const testNum = testParam ? Number(testParam) : null;
  const { test: volTest, loading: volLoading, progressBySkill } = useResolvedVolumeTest(
    volNum,
    testNum
  );

  const requestedId = searchParams.get('testId');
  const activeTest: IeltsTest | undefined = useMemo(() => {
    if (volTest) {
      return {
        id: volTest.id,
        title: `${volTest.title} — Reading`,
        skill: 'reading',
        sourceType: 'parsed',
        isDemo: false,
        createdAt: '',
        durationMinutes: 60,
        passages: volTest.reading.passages,
        questions: volTest.reading.questions,
      };
    }
    if (readingTests.length === 0) return undefined;
    return (
      readingTests.find((t) => t.id === requestedId) || readingTests[0]
    );
  }, [volTest, readingTests, requestedId]);

  const [activePassageNum, setActivePassageNum] = useState(1);
  const [splitPercent, setSplitPercent] = useState(50);
  const isResizingRef = useRef(false);

  // IDP Accessibility & UI Controls
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [contrastMode, setContrastMode] = useState<
    'light' | 'dark' | 'contrast_yellow'
  >('light');
  const [clickLookupEnabled, setClickLookupEnabled] = useState(true);
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);

  // Exam State
  const [remainingSeconds, setRemainingSeconds] = useState(3600);
  const [timerRunning, setTimerRunning] = useState(true);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [highlights, setHighlights] = useState<HighlightRange[]>([]);
  const [submittedAttempt, setSubmittedAttempt] = useState<TestAttempt | null>(
    null
  );

  // Dictionary Popover State
  const [dictLookup, setDictLookup] = useState<{
    word: string;
    contextSentence: string;
    pos?: { x: number; y: number };
  } | null>(null);

  // Reset state when switching test
  useEffect(() => {
    if (!activeTest) return;
    setActivePassageNum(activeTest.passages?.[0]?.passageNumber ?? 1);
    setRemainingSeconds((activeTest.durationMinutes || 60) * 60);
    setTimerRunning(true);
    setAnswers({});
    setFlagged(new Set());
    setHighlights([]);
    setSubmittedAttempt(null);
  }, [activeTest?.id]);

  // Countdown tick
  useEffect(() => {
    if (!timerRunning || submittedAttempt || !activeTest) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, submittedAttempt, activeTest]);

  // Auto-submit on 0 seconds
  useEffect(() => {
    if (remainingSeconds === 0 && !submittedAttempt && activeTest) {
      handleSubmit();
    }
  }, [remainingSeconds]);

  // Split-screen drag resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const pct = (e.clientX / window.innerWidth) * 100;
      setSplitPercent(Math.min(72, Math.max(28, pct)));
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSubmit = async () => {
    if (!activeTest || submittedAttempt) return;
    const graded = gradeTestAttempt('reading', activeTest.questions, answers);
    const totalBudget = (activeTest.durationMinutes || 60) * 60;
    const elapsedSeconds = Math.max(10, totalBudget - remainingSeconds);

    const attempt: TestAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      testId: activeTest.id,
      testTitle: activeTest.title,
      skill: 'reading',
      submittedAt: new Date().toISOString(),
      durationSeconds: elapsedSeconds,
      score: graded.score,
      totalQuestions: graded.totalQuestions,
      estimatedBand: graded.bandInfo.band,
      userAnswers: answers,
      questionResults: graded.questionResults,
      highlights,
    };

    await db.attempts.put(attempt);
    await recordStudyMinutes(
      Math.max(1, Math.round(elapsedSeconds / 60)),
      getTodayLocalISODate()
    );
    if (volTest) {
      await markVolSkillProgress(
        volTest.volNumber,
        volTest.testNumber,
        'reading',
        true,
        `${graded.score}/${graded.totalQuestions} (Band ${graded.bandInfo.band})`
      );
    }

    // Push wrong questions to Error Log
    const wrongErrors: ErrorLogItem[] = activeTest.questions
      .filter((q) => !graded.questionResults[q.questionNumber])
      .map((q) => ({
        id: `err-${attempt.id}-q${q.questionNumber}`,
        attemptId: attempt.id,
        testId: activeTest.id,
        testTitle: activeTest.title,
        skill: 'reading',
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

    setTimerRunning(false);
    setSubmittedAttempt(attempt);
  };

  const handleResetAttempt = () => {
    if (!activeTest) return;
    setRemainingSeconds((activeTest.durationMinutes || 60) * 60);
    setTimerRunning(true);
    setAnswers({});
    setFlagged(new Set());
    setSubmittedAttempt(null);
  };

  const jumpToQuestion = (qNum: number, sectionNum: number) => {
    setActivePassageNum(sectionNum);
    window.setTimeout(() => {
      document
        .getElementById(`reading-q-${qNum}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  if (volLoading) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center text-sm font-semibold text-slate-600">
        Đang tải dữ liệu đề Reading Vol {volNum} — Test {testNum}...
      </div>
    );
  }

  if (!activeTest) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900">
          Chưa có đề Reading nào được chọn
        </h2>
        <p className="text-sm text-slate-600">
          Mở Bộ đề Vol 1–10 hoặc tải file PDF/DOCX/TXT đề thi của bạn ở Bộ tách
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
            Tách đề cá nhân
          </Link>
        </div>
      </div>
    );
  }

  const passages = activeTest.passages || [];
  const activePassage =
    passages.find((p) => p.passageNumber === activePassageNum) || passages[0];

  const visibleQuestions =
    passages.length > 1
      ? activeTest.questions.filter(
          (q) => q.sectionNumber === activePassage?.passageNumber
        )
      : activeTest.questions;

  const fontSizeClass =
    fontScale === 'sm'
      ? 'text-[14px]'
      : fontScale === 'lg'
        ? 'text-[18px]'
        : 'text-[16px]';

  const paneThemeClass =
    contrastMode === 'light'
      ? 'bg-white text-slate-900'
      : contrastMode === 'dark'
        ? 'bg-slate-900 text-slate-100'
        : 'bg-zinc-950 text-yellow-200';

  const evidenceQuotes = submittedAttempt
    ? activeTest.questions
        .map((q) => q.evidenceQuote || '')
        .filter(Boolean)
    : [];

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col overflow-hidden">
      {volTest && (
        <VolTestCrossNav
          test={volTest}
          activeTab="reading"
          progressBySkill={progressBySkill}
          compact
        />
      )}

      {/* IDP Computer-Delivered Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-900 px-4 py-2 text-white">
        <div className="flex flex-wrap items-center gap-2">
          {volTest ? (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-bold text-sky-300">
                {volTest.title}
              </span>
              {volTest.reading.originalPdfUrl && (
                <a
                  href={volTest.reading.originalPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-slate-700"
                >
                  Mở PDF gốc
                </a>
              )}
            </div>
          ) : (
            <select
              value={activeTest.id}
              onChange={(e) => setSearchParams({ testId: e.target.value })}
              aria-label="Chọn đề Reading"
              className="max-w-[260px] truncate rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
            >
              {readingTests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}

          {activeTest.isDemo && (
            <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
              DEMO UI
            </span>
          )}

          {passages.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5">
              {passages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePassageNum(p.passageNumber)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                    p.passageNumber === activePassage?.passageNumber
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Passage {p.passageNumber}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center Countdown Timer */}
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-1 font-mono text-sm font-black ${
            remainingSeconds <= 300
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-800 text-amber-300'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>{formatAudioTime(remainingSeconds)}</span>
        </div>

        {/* IDP Display & Tool Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setFontScale((f) => (f === 'sm' ? 'md' : f === 'md' ? 'lg' : 'sm'))
            }
            title="Chuyển cỡ chữ"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-700"
          >
            <Type className="h-3.5 w-3.5" />
            Cỡ chữ: {fontScale.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() =>
              setContrastMode((c) =>
                c === 'light'
                  ? 'dark'
                  : c === 'dark'
                    ? 'contrast_yellow'
                    : 'light'
              )
            }
            title="Đổi độ tương phản IDP"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-700"
          >
            <Eye className="h-3.5 w-3.5" />
            {contrastMode === 'light'
              ? 'Nền Trắng'
              : contrastMode === 'dark'
                ? 'Nền Tối'
                : 'Vàng/Đen'}
          </button>

          <button
            type="button"
            onClick={() => setClickLookupEnabled((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              clickLookupEnabled
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Tra từ nhanh
          </button>

          <button
            type="button"
            onClick={() => setNotesDrawerOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-700"
          >
            <StickyNote className="h-3.5 w-3.5 text-amber-300" />
            Notes ({highlights.length})
          </button>

          {!submittedAttempt ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-500"
            >
              Nộp bài & Chấm điểm
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetAttempt}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm lại
            </button>
          )}
        </div>
      </div>

      {/* Post-Submit Score Banner */}
      {submittedAttempt && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-950">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-black text-sm">
              Kết quả: {submittedAttempt.score}/{submittedAttempt.totalQuestions}{' '}
              câu đúng
            </span>
            <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 font-extrabold text-white">
              Band Reading tham khảo: {submittedAttempt.estimatedBand.toFixed(1)}
            </span>
            {submittedAttempt.totalQuestions !== 40 && (
              <span className="text-emerald-800">
                (Quy đổi tỷ lệ từ {submittedAttempt.totalQuestions} câu sang
                thang chuẩn 40 câu)
              </span>
            )}
          </div>
          <Link
            to="/errors"
            className="font-bold text-indigo-700 hover:underline"
          >
            Xem câu sai trong Sổ tay lỗi sai →
          </Link>
        </div>
      )}

      {/* IDP Split-Screen Body (Independent Scroll Left & Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Pane: Passage */}
        <div
          style={{
            width:
              typeof window !== 'undefined' && window.innerWidth >= 1024
                ? `${splitPercent}%`
                : '100%',
          }}
          className={`h-1/2 lg:h-full overflow-y-auto custom-scrollbar p-6 ${paneThemeClass}`}
        >
          <div className="mb-3 flex items-center justify-between text-[11px] opacity-70 border-b border-current/15 pb-2">
            <span className="flex items-center gap-1">
              <Highlighter className="h-3.5 w-3.5" />
              Quét chọn chữ để bôi đen 3 màu / Tạo Note · Nhấn đúp hoặc chạm từ
              để tra từ điển
            </span>
          </div>

          {activePassage ? (
            <HighlightedPassage
              passage={activePassage}
              highlights={highlights}
              onAddHighlight={(item) =>
                setHighlights((prev) => [
                  ...prev,
                  {
                    ...item,
                    id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    createdAt: new Date().toISOString(),
                  },
                ])
              }
              onUpdateHighlightNote={(id, note) =>
                setHighlights((prev) =>
                  prev.map((h) => (h.id === id ? { ...h, note } : h))
                )
              }
              onRemoveHighlight={(id) =>
                setHighlights((prev) => prev.filter((h) => h.id !== id))
              }
              onLookupWord={(word, contextSentence, pos) =>
                setDictLookup({ word, contextSentence, pos })
              }
              clickLookupEnabled={clickLookupEnabled}
              contrastMode={contrastMode}
              fontSizeClass={fontSizeClass}
              evidenceQuotes={evidenceQuotes}
            />
          ) : volTest?.reading.originalPdfUrl ? (
            <div className="flex h-full flex-col gap-3">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <strong>PDF Scan gốc ({volTest.title}): </strong>
                {volTest.reading.notes ||
                  'Tài liệu gốc là PDF ảnh scan nên hiển thị trực tiếp bản PDF để bạn đọc. Bạn có thể bổ sung bản DOCX/TXT tại Bộ đề Vol để bật Highlight văn bản.'}
              </div>
              <iframe
                src={volTest.reading.originalPdfUrl}
                title={`Original PDF ${volTest.title}`}
                className="w-full flex-1 min-h-[460px] rounded-xl border border-slate-300 bg-white"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm space-y-3">
              <p className="font-bold">
                Chưa có dữ liệu Reading cho {volTest?.title || 'bài thi này'}.
              </p>
              {volTest && (
                <Link
                  to={`/volumes?vol=${volTest.volNumber}`}
                  className="inline-flex rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Tải lên file DOCX / PDF ngay
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Draggable Vertical Divider (Desktop) */}
        <div
          onMouseDown={() => {
            isResizingRef.current = true;
          }}
          title="Kéo để thay đổi tỷ lệ 2 cột"
          className="hidden lg:flex w-2 cursor-col-resize items-center justify-center bg-slate-200 hover:bg-indigo-400 transition flex-shrink-0"
        >
          <div className="h-10 w-0.5 rounded-full bg-slate-400" />
        </div>

        {/* Right Pane: Questions */}
        <div
          className={`flex-1 h-1/2 lg:h-full overflow-y-auto custom-scrollbar p-5 space-y-5 border-t lg:border-t-0 border-slate-300 ${paneThemeClass}`}
        >
          {visibleQuestions.map((q) => {
            const isFlagged = flagged.has(q.questionNumber);
            const userVal = answers[q.questionNumber] || '';
            const isCorrect =
              submittedAttempt?.questionResults[q.questionNumber];

            return (
              <div
                key={q.id}
                id={`reading-q-${q.questionNumber}`}
                className={`rounded-xl border p-4 transition ${
                  submittedAttempt
                    ? isCorrect
                      ? 'border-emerald-400 bg-emerald-50/30'
                      : 'border-rose-400 bg-rose-50/30'
                    : contrastMode === 'light'
                      ? 'border-slate-200 bg-slate-50/60'
                      : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                {q.instruction && (
                  <div className="mb-3 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2 text-xs font-semibold">
                    {q.instruction}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-slate-800 px-1.5 text-xs font-extrabold text-white">
                      {q.questionNumber}
                    </span>
                    <div>
                      <p className={`${fontSizeClass} font-semibold`}>
                        {q.prompt}
                      </p>
                      <span className="text-[11px] opacity-65">
                        {getQuestionTypeLabel(q.type)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFlagged((prev) => {
                        const next = new Set(prev);
                        if (next.has(q.questionNumber))
                          next.delete(q.questionNumber);
                        else next.add(q.questionNumber);
                        return next;
                      });
                    }}
                    title="Đánh dấu xem lại (Flag for review)"
                    className={`rounded-lg px-2 py-1 text-xs font-bold flex items-center gap-1 ${
                      isFlagged
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-200/60 text-slate-600 hover:bg-amber-200'
                    }`}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {isFlagged ? 'Flagged' : 'Flag'}
                  </button>
                </div>

                {/* Answer Input Control */}
                <div className="mt-3 pl-8">
                  {q.options && q.options.length > 0 ? (
                    <div className="space-y-1.5">
                      {q.options.map((opt) => {
                        const optValue =
                          q.type === 'mcq' ||
                          q.type === 'matching_info' ||
                          q.type === 'matching_headings'
                            ? opt.split(/[\.\)]/)[0].trim()
                            : opt;
                        const selected =
                          userVal.toLowerCase() === optValue.toLowerCase();
                        return (
                          <label
                            key={opt}
                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition ${
                              selected
                                ? 'border-indigo-500 bg-indigo-500/15 font-bold'
                                : 'border-current/15 hover:border-indigo-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.questionNumber}`}
                              value={optValue}
                              checked={selected}
                              disabled={Boolean(submittedAttempt)}
                              onChange={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.questionNumber]: optValue,
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
                      placeholder="Nhập đáp án (Word / Number)..."
                      className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  )}

                  {submittedAttempt && (
                    <div className="mt-3 rounded-lg border border-current/15 bg-white/80 p-3 text-xs text-slate-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        )}
                        <span>
                          Đáp án đúng:{' '}
                          <span className="text-emerald-700">
                            {q.acceptedAnswers.join(' / ') || 'Chưa cập nhật'}
                          </span>
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
            );
          })}
        </div>

        {/* Highlights & Notes Slide-over Drawer */}
        {notesDrawerOpen && (
          <div className="absolute right-0 top-0 bottom-0 z-30 w-80 border-l border-slate-200 bg-white p-4 text-slate-900 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold">
                Highlights & Ghi chú ({highlights.length})
              </h4>
              <button
                type="button"
                onClick={() => setNotesDrawerOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {highlights.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Bôi đen đoạn văn bản bên trái để lưu highlight và ghi chú.
                </p>
              ) : (
                highlights.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg border border-slate-200 p-2.5 text-xs space-y-1"
                  >
                    <p className="font-semibold text-slate-800">
                      "{h.selectedText}"
                    </p>
                    {h.note && (
                      <p className="text-indigo-700 bg-indigo-50 rounded p-1.5">
                        Note: {h.note}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setHighlights((prev) =>
                          prev.filter((item) => item.id !== h.id)
                        )
                      }
                      className="text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Xóa
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom IDP Question Palette */}
      <div className="border-t border-slate-300 bg-slate-100 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-600 mr-1">
            Question Palette:
          </span>
          {activeTest.questions.map((q) => {
            const answered = Boolean(answers[q.questionNumber]?.trim());
            const isFlagged = flagged.has(q.questionNumber);
            const isCorrect =
              submittedAttempt?.questionResults[q.questionNumber];

            let btnCls = 'bg-white text-slate-700 border-slate-300';
            if (submittedAttempt) {
              btnCls = isCorrect
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-rose-600 text-white border-rose-700';
            } else if (answered) {
              btnCls = 'bg-slate-900 text-white border-slate-900';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => jumpToQuestion(q.questionNumber, q.sectionNumber)}
                className={`relative h-7 min-w-7 rounded border px-1.5 text-xs font-bold transition hover:scale-105 ${btnCls} ${
                  isFlagged ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                {q.questionNumber}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-slate-300 bg-white" />
            Chưa làm
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-slate-900" />
            Đã làm
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded ring-2 ring-amber-400 bg-white" />
            Đánh dấu xem lại
          </span>
        </div>
      </div>

      {/* Dictionary Popover */}
      {dictLookup && (
        <DictionaryPopover
          word={dictLookup.word}
          contextSentence={dictLookup.contextSentence}
          sourceLabel={activeTest.title}
          position={dictLookup.pos}
          onClose={() => setDictLookup(null)}
        />
      )}
    </div>
  );
};
