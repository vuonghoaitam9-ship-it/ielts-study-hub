import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileImage,
  Filter,
  Lightbulb,
  PenTool,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  EssayCategoryFilter,
  IDEA_BANK_ENTRIES,
  IDEA_BANK_TOPICS,
  IdeaBankTopic,
  TASK_1_GUIDES,
  TASK_2_GUIDES,
  WRITING_CRITERIA,
} from '../data/writingData';
import { db, markVolSkillProgress, recordStudyMinutes } from '../db/database';
import { createNewVocabCard, getTodayLocalISODate } from '../lib/sm2';
import { formatAudioTime } from '../components/AudioPlayerBar';
import { useResolvedVolumeTest } from '../lib/volumeRepository';
import { VolTestCrossNav } from '../components/VolTestCrossNav';

type WritingPageTab = 'vol_writing' | 'vol_idea' | 'guide' | 'ideas' | 'practice';

export const WritingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const volParam = searchParams.get('vol');
  const testParam = searchParams.get('test');
  const urlTab = searchParams.get('tab');

  const parsedVol = volParam ? Number.parseInt(volParam, 10) : NaN;
  const parsedTest = testParam ? Number.parseInt(testParam, 10) : NaN;
  const volNum = Number.isFinite(parsedVol) ? parsedVol : null;
  const testNum = Number.isFinite(parsedTest) ? parsedTest : null;

  const {
    test: volTest,
    loading: volLoading,
    progressBySkill,
  } = useResolvedVolumeTest(volNum, testNum);

  const [activeTab, setActiveTab] = useState<WritingPageTab>(() => {
    if (volNum !== null && testNum !== null) {
      return urlTab === 'idea' ? 'vol_idea' : 'vol_writing';
    }
    return 'guide';
  });
  const [showSampleTask1, setShowSampleTask1] = useState(false);
  const [showSampleTask2, setShowSampleTask2] = useState(false);

  useEffect(() => {
    setShowSampleTask1(false);
    setShowSampleTask2(false);
    if (volNum !== null && testNum !== null) {
      setActiveTab(urlTab === 'idea' ? 'vol_idea' : 'vol_writing');
    } else if (activeTab === 'vol_writing' || activeTab === 'vol_idea') {
      setActiveTab('guide');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volNum, testNum, urlTab]);

  useEffect(() => {
    if (!volTest) return;
    if (volTest.writing.task2?.prompt) {
      setPracticeTaskType('task2');
      setPracticePrompt(volTest.writing.task2.prompt);
      setSecondsLeft(2400);
    } else if (volTest.writing.task1?.prompt) {
      setPracticeTaskType('task1');
      setPracticePrompt(volTest.writing.task1.prompt);
      setSecondsLeft(1200);
    }
  }, [volTest]);
  const [guideSection, setGuideSection] = useState<'task1' | 'task2' | 'criteria'>(
    'task1'
  );
  const [selectedTask1Id, setSelectedTask1Id] = useState<string>(
    TASK_1_GUIDES[0].id
  );
  const [selectedTask2Id, setSelectedTask2Id] = useState<string>(
    TASK_2_GUIDES[0].id
  );

  // Idea Bank filters
  const [topicFilter, setTopicFilter] = useState<IdeaBankTopic | 'ALL'>('ALL');
  const [essayFilter, setEssayFilter] = useState<EssayCategoryFilter | 'ALL'>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [savedCollocations, setSavedCollocations] = useState<Set<string>>(
    new Set()
  );

  // Timed Writing Scratchpad
  const [practiceTaskType, setPracticeTaskType] = useState<'task1' | 'task2'>(
    'task2'
  );
  const [practicePrompt, setPracticePrompt] = useState(
    IDEA_BANK_ENTRIES[0].prompt
  );
  const [essayText, setEssayText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(2400);
  const [timerActive, setTimerActive] = useState(false);
  const [selfChecklist, setSelfChecklist] = useState<Record<string, boolean>>(
    {}
  );
  const [savedLogMsg, setSavedLogMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!timerActive) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerActive]);

  const wordCount = useMemo(() => {
    const trimmed = essayText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [essayText]);

  const filteredIdeas = useMemo(() => {
    return IDEA_BANK_ENTRIES.filter((item) => {
      if (topicFilter !== 'ALL' && item.topic !== topicFilter) return false;
      if (essayFilter !== 'ALL' && item.essayType !== essayFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const blob = [
          item.prompt,
          item.promptSummaryVi,
          item.topic,
          ...item.sideAArguments,
          ...item.sideBArguments,
          ...item.examples,
          ...item.collocations.map((c) => `${c.phrase} ${c.meaningVi}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [topicFilter, essayFilter, searchQuery]);

  const handleSaveCollocationToSrs = async (
    phrase: string,
    meaningVi: string,
    topic: string,
    contextPrompt: string
  ) => {
    const existing = await db.vocabCards
      .where('word')
      .equalsIgnoreCase(phrase)
      .first();

    if (!existing) {
      await db.vocabCards.put(
        createNewVocabCard({
          id: `vocab-wr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          word: phrase,
          partOfSpeech: 'collocation',
          meaningVi,
          contextSentence: contextPrompt,
          sourceLabel: `Writing Idea Bank (${topic})`,
          topicTag: topic,
        })
      );
    }
    setSavedCollocations((prev) => new Set(prev).add(phrase));
  };

  const activeTask1 =
    TASK_1_GUIDES.find((g) => g.id === selectedTask1Id) || TASK_1_GUIDES[0];
  const activeTask2 =
    TASK_2_GUIDES.find((g) => g.id === selectedTask2Id) || TASK_2_GUIDES[0];

  const minTargetWords = practiceTaskType === 'task1' ? 150 : 250;

  const switchVolSubTab = (tab: 'vol_writing' | 'vol_idea') => {
    setActiveTab(tab);
    if (volNum !== null && testNum !== null) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab === 'vol_idea' ? 'idea' : 'writing');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      {volNum !== null && testNum !== null && volLoading && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs font-semibold text-indigo-800">
          Đang tải dữ liệu Writing &amp; Idea Bank cho Vol {volNum} – Test{' '}
          {testNum}...
        </div>
      )}

      {volNum !== null && testNum !== null && !volLoading && !volTest && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-900">
            <strong className="font-bold">
              Không tìm thấy dữ liệu Vol {volNum} – Test {testNum}.
            </strong>{' '}
            Vui lòng kiểm tra lại trong Kho đề Vol 1–10.
          </div>
          <Link
            to="/volumes"
            className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
          >
            Mở Kho đề Vol 1–10
          </Link>
        </div>
      )}

      {volTest && (
        <VolTestCrossNav
          test={volTest}
          activeTab={activeTab === 'vol_idea' ? 'idea' : 'writing'}
          progressBySkill={progressBySkill}
        />
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {volTest
              ? `Vol ${volTest.volNumber} · Test ${volTest.testNumber} — Writing & Idea Bank`
              : 'Writing Academic Guide & Idea Bank (Band 6.5 – 7.5+)'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {volTest
              ? 'Đề thi Writing gốc, ảnh biểu đồ Task 1 (nếu có), hướng dẫn triển khai và kho ý tưởng riêng theo bài kèm collocations lưu SM-2.'
              : 'Hướng dẫn chi tiết 6 dạng Task 1, 5 dạng Task 2, 4 tiêu chí chấm IELTS và kho ý tưởng 8 chủ đề kèm collocations lưu trực tiếp sang Flashcard SM-2.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {volTest && (
            <>
              <button
                type="button"
                onClick={() => switchVolSubTab('vol_writing')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === 'vol_writing'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <PenTool className="h-4 w-4" />
                Đề Writing V{volTest.volNumber}·T{volTest.testNumber}
              </button>
              <button
                type="button"
                onClick={() => switchVolSubTab('vol_idea')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === 'vol_idea'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <Lightbulb className="h-4 w-4" />
                Idea Bank V{volTest.volNumber}·T{volTest.testNumber}
              </button>
            </>
          )}

          {[
            { id: 'guide', label: 'Hướng dẫn Task 1 & 2', icon: BookOpen },
            {
              id: 'ideas',
              label: `Kho Ý tưởng chung (${IDEA_BANK_ENTRIES.length} đề)`,
              icon: Lightbulb,
            },
            { id: 'practice', label: 'Tập viết bấm giờ', icon: PenTool },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as WritingPageTab)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* VOL TEST SPECIFIC WRITING TAB */}
      {activeTab === 'vol_writing' && volTest && (
        <div className="space-y-5">
          {volTest.writing.notes && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-xs text-sky-900">
              <strong className="font-bold">Ghi chú nguồn Vol {volTest.volNumber}:</strong>{' '}
              {volTest.writing.notes}
              {volTest.writing.sourceFiles.length > 0 && (
                <span className="ml-2 text-sky-700">
                  ({volTest.writing.sourceFiles.join(', ')})
                </span>
              )}
            </div>
          )}

          {volTest.writing.status === 'missing' &&
            !volTest.writing.task1 &&
            !volTest.writing.task2 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-amber-950">
                      Chưa có đề Writing số hóa trong Vol {volTest.volNumber} – Test{' '}
                      {volTest.testNumber}
                    </h3>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Thư mục nguồn hiện chưa có đề Writing tách chữ cho bài test này
                      (hoặc đề nằm trong file PDF scan chưa có văn bản). Bạn có thể
                      mở Kho đề Vol 1–10 để kiểm tra trạng thái thiếu / đính kèm nội dung
                      tự nhập, hoặc luyện tập với Hướng dẫn &amp; Kho Ý tưởng chung.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-7">
                  <Link
                    to={`/volumes?vol=${volTest.volNumber}`}
                    className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Mở Kho đề Vol {volTest.volNumber}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveTab('practice')}
                    className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  >
                    Mở Scratchpad viết tự do
                  </button>
                </div>
              </div>
            )}

          {volTest.writing.task1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="inline-block rounded-lg bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 mb-1">
                    Writing Task 1 · {volTest.writing.task1.taskTypeLabel}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Đề bài Task 1 (20 phút · tối thiểu 150 từ)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPracticeTaskType('task1');
                    setPracticePrompt(
                      volTest.writing.task1?.prompt ||
                        `Vol ${volTest.volNumber} Test ${volTest.testNumber} - Writing Task 1`
                    );
                    setSecondsLeft(1200);
                    setTimerActive(false);
                    setActiveTab('practice');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  Đưa Task 1 vào Scratchpad bấm giờ
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                {volTest.writing.task1.prompt}
              </div>

              {volTest.writing.task1.imageUrl && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <FileImage className="h-4 w-4 text-sky-600" />
                      Biểu đồ / Bản đồ gốc đính kèm
                    </span>
                    <a
                      href={volTest.writing.task1.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Mở ảnh gốc <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <img
                    src={volTest.writing.task1.imageUrl}
                    alt={`Writing Task 1 Vol ${volTest.volNumber} Test ${volTest.testNumber}`}
                    className="mx-auto max-h-[460px] rounded-xl border border-slate-100 object-contain"
                  />
                </div>
              )}

              {volTest.writing.task1.originalPdfUrl && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Tài liệu PDF gốc Task 1</span>
                    <a
                      href={volTest.writing.task1.originalPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Mở tab mới <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <iframe
                    src={volTest.writing.task1.originalPdfUrl}
                    title={`Writing Task 1 PDF Vol ${volTest.volNumber} Test ${volTest.testNumber}`}
                    className="h-[460px] w-full rounded-lg border border-slate-200"
                  />
                </div>
              )}

              {volTest.writing.task1.writingGuide.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-1.5">
                  <h4 className="text-xs font-extrabold text-emerald-900">
                    Hướng dẫn triển khai Task 1 (Overview &amp; Grouping):
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-800">
                    {volTest.writing.task1.writingGuide.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {volTest.writing.task1.sampleEssay && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={() => setShowSampleTask1((s) => !s)}
                    className="flex w-full items-center justify-between text-xs font-bold text-slate-800"
                  >
                    <span>Bài mẫu tham khảo Task 1 (Sample Essay)</span>
                    {showSampleTask1 ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {showSampleTask1 && (
                    <div className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                      {volTest.writing.task1.sampleEssay}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {volTest.writing.task2 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="inline-block rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 mb-1">
                    Writing Task 2 · {volTest.writing.task2.taskTypeLabel}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Đề bài Task 2 (40 phút · tối thiểu 250 từ)
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchVolSubTab('vol_idea')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-200"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    Mở Idea Bank riêng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeTaskType('task2');
                      setPracticePrompt(
                        volTest.writing.task2?.prompt ||
                          `Vol ${volTest.volNumber} Test ${volTest.testNumber} - Writing Task 2`
                      );
                      setSecondsLeft(2400);
                      setTimerActive(false);
                      setActiveTab('practice');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    Đưa Task 2 vào Scratchpad bấm giờ
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                {volTest.writing.task2.prompt}
              </div>

              {volTest.writing.task2.originalPdfUrl && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Tài liệu PDF gốc Task 2</span>
                    <a
                      href={volTest.writing.task2.originalPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      Mở tab mới <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <iframe
                    src={volTest.writing.task2.originalPdfUrl}
                    title={`Writing Task 2 PDF Vol ${volTest.volNumber} Test ${volTest.testNumber}`}
                    className="h-[460px] w-full rounded-lg border border-slate-200"
                  />
                </div>
              )}

              {volTest.writing.task2.writingGuide.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-1.5">
                  <h4 className="text-xs font-extrabold text-emerald-900">
                    Hướng dẫn lập dàn ý &amp; triển khai Task 2:
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-800">
                    {volTest.writing.task2.writingGuide.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {volTest.writing.task2.sampleEssay && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={() => setShowSampleTask2((s) => !s)}
                    className="flex w-full items-center justify-between text-xs font-bold text-slate-800"
                  >
                    <span>Bài mẫu tham khảo Task 2 (Sample Essay)</span>
                    {showSampleTask2 ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {showSampleTask2 && (
                    <div className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                      {volTest.writing.task2.sampleEssay}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="text-xs text-slate-600">
              Trạng thái Writing cho Vol {volTest.volNumber} – Test{' '}
              {volTest.testNumber}:{' '}
              <strong className="text-slate-900">
                {progressBySkill.writing?.completed
                  ? 'Đã hoàn thành'
                  : 'Chưa đánh dấu hoàn thành'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() =>
                markVolSkillProgress(
                  volTest.volNumber,
                  volTest.testNumber,
                  'writing',
                  !progressBySkill.writing?.completed
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                progressBySkill.writing?.completed
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-900 text-white hover:bg-emerald-600'
              }`}
            >
              <Check className="h-4 w-4" />
              {progressBySkill.writing?.completed
                ? 'Đã hoàn thành Writing (Nhấn để bỏ)'
                : 'Đánh dấu hoàn thành Writing'}
            </button>
          </div>
        </div>
      )}

      {/* VOL TEST SPECIFIC IDEA BANK TAB */}
      {activeTab === 'vol_idea' && volTest && (
        <div className="space-y-5">
          {volTest.idea.status === 'missing' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-amber-950">
                    Chưa có Idea Bank riêng cho Vol {volTest.volNumber} – Test{' '}
                    {volTest.testNumber}
                  </h3>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Hiện chưa có đề Writing Task 2 số hóa gắn trực tiếp cho đề này
                    để trích xuất Idea Bank riêng. Bạn có thể dùng Kho Ý tưởng
                    chung 8 chủ đề bên dưới hoặc bổ sung đề tại Kho đề Vol 1–10.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-7">
                <button
                  type="button"
                  onClick={() => setActiveTab('ideas')}
                  className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Mở Kho Ý tưởng chung ({IDEA_BANK_ENTRIES.length} đề)
                </button>
                <Link
                  to={`/volumes?vol=${volTest.volNumber}`}
                  className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                >
                  Quay lại Vol {volTest.volNumber}
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                      Vol {volTest.volNumber} · Test {volTest.testNumber}
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                      Chủ đề: {volTest.idea.topic}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {volTest.idea.linkedPrompt || volTest.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPracticeTaskType('task2');
                    setPracticePrompt(
                      volTest.idea.linkedPrompt ||
                        volTest.writing.task2?.prompt ||
                        volTest.title
                    );
                    setSecondsLeft(2400);
                    setTimerActive(false);
                    setActiveTab('practice');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-600 flex-shrink-0"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  Luyện viết đề này
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-sky-50/60 border border-sky-200 p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-sky-900">
                    {volTest.idea.sideATitle}
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-800 space-y-1.5">
                    {volTest.idea.sideAArguments.map((arg, idx) => (
                      <li key={idx}>{arg}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-amber-900">
                    {volTest.idea.sideBTitle}
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-800 space-y-1.5">
                    {volTest.idea.sideBArguments.map((arg, idx) => (
                      <li key={idx}>{arg}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {volTest.idea.examples.length > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700 space-y-1">
                  <strong className="text-slate-900 block">
                    Ví dụ &amp; dẫn chứng cụ thể:
                  </strong>
                  <ul className="list-disc list-inside space-y-1">
                    {volTest.idea.examples.map((ex, idx) => (
                      <li key={idx}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-slate-600 mb-2">
                  Collocations ghi điểm (Nhấn để lưu ngay vào Flashcard SM-2):
                </h4>
                <div className="flex flex-wrap gap-2">
                  {volTest.idea.collocations.map((col) => {
                    const saved = savedCollocations.has(col.phrase);
                    return (
                      <button
                        key={col.phrase}
                        type="button"
                        onClick={async () => {
                          await handleSaveCollocationToSrs(
                            col.phrase,
                            col.meaningVi,
                            volTest.idea.topic,
                            volTest.idea.linkedPrompt || volTest.title
                          );
                          await markVolSkillProgress(
                            volTest.volNumber,
                            volTest.testNumber,
                            'idea',
                            true
                          );
                        }}
                        title={`Nghĩa: ${col.meaningVi}`}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                          saved
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'
                            : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
                        }`}
                      >
                        {saved ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-indigo-600" />
                        )}
                        <span className="font-bold">{col.phrase}</span>
                        <span className="text-slate-500">
                          ({col.meaningVi})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  Nhấn đánh dấu sau khi đã đọc luận điểm &amp; lưu từ vựng trọng tâm.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    markVolSkillProgress(
                      volTest.volNumber,
                      volTest.testNumber,
                      'idea',
                      !progressBySkill.idea?.completed
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    progressBySkill.idea?.completed
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {progressBySkill.idea?.completed
                    ? 'Đã hoàn thành Idea Bank (Nhấn để bỏ)'
                    : 'Đánh dấu đã ôn Idea Bank'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: MASTER WRITING GUIDE */}
      {activeTab === 'guide' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'task1', label: 'Task 1 Academic (6 dạng biểu đồ & quy trình)' },
              { id: 'task2', label: 'Task 2 Essay (5 dạng bài luận)' },
              { id: 'criteria', label: '4 Tiêu chí chấm điểm Band 7.0+' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setGuideSection(s.id as 'task1' | 'task2' | 'criteria')
                }
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  guideSection === s.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {guideSection === 'criteria' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {WRITING_CRITERIA.map((c) => (
                <div
                  key={c.code}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                      {c.code} · {c.weight}
                    </span>
                    <Award className="h-4 w-4 text-amber-500" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {c.name}
                  </h3>
                  <p className="text-xs text-slate-600">{c.focusVi}</p>

                  <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-3 space-y-1">
                    <p className="text-[11px] font-bold text-rose-800">
                      Bẫy kẹt ở Band 5.5 – 6.0:
                    </p>
                    <ul className="list-disc list-inside text-xs text-rose-900 space-y-1">
                      {c.band6Characteristics.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800">
                      Chuẩn bứt phá lên Band 7.0 – 7.5+:
                    </p>
                    <ul className="list-disc list-inside text-xs text-emerald-900 space-y-1">
                      {c.band7PlusTargets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {guideSection === 'task1' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TASK_1_GUIDES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedTask1Id(g.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      selectedTask1Id === g.id
                        ? 'bg-sky-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {g.title}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {activeTask1.title}
                  </h3>
                  <p className="text-xs font-medium text-sky-700">
                    {activeTask1.titleVi}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase text-slate-700">
                    Cách phân tích đề trong 3 phút đầu
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                    {activeTask1.promptAnalysis.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-700 mb-2">
                    Dàn ý chuẩn 4 đoạn (150+ words · 20 phút)
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {activeTask1.structure.map((st, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 p-3.5"
                      >
                        <p className="text-xs font-extrabold text-indigo-700">
                          {st.paragraph}
                        </p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          {st.role}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">{st.tips}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                    <h4 className="text-xs font-extrabold text-emerald-900">
                      Cấu trúc câu ghi điểm Band 7.0+
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-800">
                      {activeTask1.scoringStructures.map((s, i) => (
                        <li key={i} className="rounded bg-white p-2 border border-emerald-100">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
                    <h4 className="text-xs font-extrabold text-indigo-900">
                      Từ vựng đắt giá (Nhấn để lưu SRS)
                    </h4>
                    <div className="space-y-1.5">
                      {activeTask1.keyVocabulary.map((v) => {
                        const isSaved = savedCollocations.has(v.term);
                        return (
                          <div
                            key={v.term}
                            className="flex items-center justify-between gap-2 rounded bg-white p-2 border border-indigo-100 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900">
                                {v.term}
                              </span>
                              <span className="text-slate-500">
                                {' '}
                                — {v.meaningVi}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveCollocationToSrs(
                                  v.term,
                                  v.meaningVi,
                                  'Writing Task 1',
                                  activeTask1.miniModelSnippet
                                )
                              }
                              className={`rounded px-2 py-1 text-[11px] font-bold flex-shrink-0 ${
                                isSaved
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              }`}
                            >
                              {isSaved ? 'Đã lưu' : '+ SRS'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-4 text-slate-100 text-xs leading-relaxed">
                  <span className="font-bold text-amber-300 block mb-1">
                    Mẫu Overview tham khảo (Band 7.5):
                  </span>
                  "{activeTask1.miniModelSnippet}"
                </div>
              </div>
            </div>
          )}

          {guideSection === 'task2' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TASK_2_GUIDES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedTask2Id(g.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                      selectedTask2Id === g.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {g.title}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {activeTask2.title}
                  </h3>
                  <p className="text-xs font-medium text-emerald-700">
                    {activeTask2.titleVi}
                  </p>
                  <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                    <strong>Dấu hiệu nhận biết đề: </strong>
                    {activeTask2.recognitionCue}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {activeTask2.structure.map((st, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 p-3.5"
                    >
                      <p className="text-xs font-extrabold text-indigo-700">
                        {st.paragraph}
                      </p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {st.role}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">{st.tips}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                    <h4 className="text-xs font-extrabold text-emerald-900">
                      Mẫu câu phức ăn điểm (GRA & CC)
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-800">
                      {activeTask2.scoringStructures.map((s, i) => (
                        <li
                          key={i}
                          className="rounded bg-white p-2 border border-emerald-100"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
                    <h4 className="text-xs font-extrabold text-rose-900">
                      Lỗi khiến bài bị giới hạn ở Band 6.0
                    </h4>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-rose-900">
                      {activeTask2.commonTraps.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-4 text-slate-100 text-xs leading-relaxed">
                  <span className="font-bold text-amber-300 block mb-1">
                    Mẫu Thesis Statement chuẩn Band 7.5+:
                  </span>
                  "{activeTask2.miniModelSnippet}"
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IDEA BANK */}
      {activeTab === 'ideas' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm chủ đề, luận điểm, ví dụ hoặc collocation..."
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={essayFilter}
                  onChange={(e) =>
                    setEssayFilter(
                      e.target.value as EssayCategoryFilter | 'ALL'
                    )
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                >
                  <option value="ALL">Mọi dạng đề Task 2</option>
                  <option value="Opinion">Opinion</option>
                  <option value="Discussion">Discussion</option>
                  <option value="Advantage/Disadvantage">
                    Advantage / Disadvantage
                  </option>
                  <option value="Problem/Solution">Problem / Solution</option>
                  <option value="Two-part Question">Two-part Question</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTopicFilter('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  topicFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tất cả chủ đề
              </button>
              {IDEA_BANK_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopicFilter(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    topicFilter === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredIdeas.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                        {entry.topic}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        {entry.essayType}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {entry.prompt}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {entry.promptSummaryVi}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPracticeTaskType('task2');
                      setPracticePrompt(entry.prompt);
                      setSecondsLeft(2400);
                      setActiveTab('practice');
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-600 flex-shrink-0"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    Luyện viết đề này
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-sky-50/60 border border-sky-200 p-3.5 space-y-1.5">
                    <h4 className="text-xs font-extrabold text-sky-900">
                      {entry.sideATitle}
                    </h4>
                    <ul className="list-disc list-inside text-xs text-slate-800 space-y-1">
                      {entry.sideAArguments.map((arg, i) => (
                        <li key={i}>{arg}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-3.5 space-y-1.5">
                    <h4 className="text-xs font-extrabold text-amber-900">
                      {entry.sideBTitle}
                    </h4>
                    <ul className="list-disc list-inside text-xs text-slate-800 space-y-1">
                      {entry.sideBArguments.map((arg, i) => (
                        <li key={i}>{arg}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                  <strong className="text-slate-900">Ví dụ minh họa: </strong>
                  {entry.examples.join(' ')}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-2">
                    Collocations nâng Band (Nhấn để lưu vào Flashcard SM-2):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {entry.collocations.map((col) => {
                      const saved = savedCollocations.has(col.phrase);
                      return (
                        <button
                          key={col.phrase}
                          type="button"
                          onClick={() =>
                            handleSaveCollocationToSrs(
                              col.phrase,
                              col.meaningVi,
                              entry.topic,
                              entry.prompt
                            )
                          }
                          title={`Nghĩa: ${col.meaningVi}`}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                            saved
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'
                              : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
                          }`}
                        >
                          {saved ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Plus className="h-3.5 w-3.5 text-indigo-600" />
                          )}
                          <span className="font-bold">{col.phrase}</span>
                          <span className="text-slate-500">
                            ({col.meaningVi})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TIMED WRITING SCRATCHPAD */}
      {activeTab === 'practice' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPracticeTaskType('task1');
                    setSecondsLeft(1200);
                    setTimerActive(false);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    practiceTaskType === 'task1'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Task 1 (20 phút · 150+ từ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPracticeTaskType('task2');
                    setSecondsLeft(2400);
                    setTimerActive(false);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    practiceTaskType === 'task2'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Task 2 (40 phút · 250+ từ)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-xs font-bold text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  {formatAudioTime(secondsLeft)}
                </span>
                <button
                  type="button"
                  onClick={() => setTimerActive((a) => !a)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  {timerActive ? 'Tạm dừng' : 'Bắt đầu bấm giờ'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerActive(false);
                    setSecondsLeft(practiceTaskType === 'task1' ? 1200 : 2400);
                  }}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Đề bài luyện tập:
              </label>
              <textarea
                rows={2}
                value={practicePrompt}
                onChange={(e) => setPracticePrompt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold"
              />
            </div>

            <textarea
              rows={14}
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="Bắt đầu viết bài tại đây (tự động đếm số từ chuẩn phòng thi máy)..."
              className="w-full rounded-xl border border-slate-300 p-4 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold">
                Số từ hiện tại:{' '}
                <span
                  className={
                    wordCount >= minTargetWords
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }
                >
                  {wordCount} words
                </span>{' '}
                <span className="text-slate-400">
                  (Yêu cầu tối thiểu {minTargetWords} từ)
                </span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const mins = practiceTaskType === 'task1' ? 20 : 40;
                  await recordStudyMinutes(mins, getTodayLocalISODate());
                  if (volTest) {
                    await markVolSkillProgress(
                      volTest.volNumber,
                      volTest.testNumber,
                      'writing',
                      true,
                      `${wordCount} từ`
                    );
                  }
                  setSavedLogMsg(
                    `Đã lưu ${mins} phút luyện Writing (${wordCount} từ) vào Dashboard!`
                  );
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Hoàn thành & Ghi nhận giờ học
              </button>
            </div>
            {savedLogMsg && (
              <p className="text-xs font-semibold text-emerald-700">
                {savedLogMsg}
              </p>
            )}
          </div>

          {/* 4-Criteria Self-Review Checklist */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 h-fit">
            <h3 className="text-sm font-extrabold text-slate-900">
              Checklist tự chấm trước khi nộp
            </h3>
            <p className="text-xs text-slate-500">
              Rà soát 5 phút cuối để tránh mất điểm oan ở 4 tiêu chí.
            </p>
            {[
              'Đủ số từ (Task 1 >= 150, Task 2 >= 250)',
              'Có Overview rõ (Task 1) hoặc Thesis Statement trực diện (Task 2)',
              'Mỗi Body chỉ tập trung 1-2 ý sâu theo mạch PEEL',
              'Không lặp từ khóa đề bài quá 3 lần; đã dùng collocations',
              'Đã kiểm tra chia thì, số ít/nhiều, mạo từ a/an/the',
            ].map((item) => (
              <label
                key={item}
                className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(selfChecklist[item])}
                  onChange={(e) =>
                    setSelfChecklist((prev) => ({
                      ...prev,
                      [item]: e.target.checked,
                    }))
                  }
                  className="mt-0.5 accent-emerald-600"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
