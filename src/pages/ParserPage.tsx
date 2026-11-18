import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Headphones,
  Plus,
  Save,
  Trash2,
  Volume2,
} from 'lucide-react';
import { extractTextFromFile } from '../lib/fileExtractor';
import { ParsedDocumentOutput, parseIeltsDocument } from '../lib/documentParser';
import { db, saveMediaBlob } from '../db/database';
import {
  DictationSegment,
  IeltsTest,
  QuestionItem,
  QuestionType,
} from '../types';
import { getQuestionTypeLabel } from '../lib/grading';

const QUESTION_TYPES: QuestionType[] = [
  'tfng',
  'ynng',
  'mcq',
  'gap_fill',
  'matching_headings',
  'matching_info',
  'short_answer',
];

export const ParserPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skill, setSkill] = useState<'reading' | 'listening'>('reading');
  const [title, setTitle] = useState('');
  const [sourceFileName, setSourceFileName] = useState<string | undefined>();

  const [mainText, setMainText] = useState('');
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');

  // Technical limitation alert (e.g. Scanned / Image PDF or legacy .doc)
  const [extractionError, setExtractionError] = useState<{
    title: string;
    message: string;
    isScannedPdf: boolean;
  } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Audio attachments for Listening
  const [audioMode, setAudioMode] = useState<'single' | 'parts'>('single');
  const [fullAudioFile, setFullAudioFile] = useState<File | null>(null);
  const [partAudioFiles, setPartAudioFiles] = useState<
    Record<number, File | null>
  >({
    1: null,
    2: null,
    3: null,
    4: null,
  });

  // Step 2 Parsed Editable Draft
  const [draft, setDraft] = useState<ParsedDocumentOutput | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [alsoCreateDictation, setAlsoCreateDictation] = useState(true);
  const [savedTestId, setSavedTestId] = useState<string | null>(null);

  const handleUploadTextFile = async (
    file: File | undefined,
    target: 'main' | 'key' | 'transcript'
  ) => {
    if (!file) return;
    setIsExtracting(true);
    setExtractionError(null);
    const res = await extractTextFromFile(file);
    setIsExtracting(false);

    if (res.errorMessage) {
      setExtractionError({
        title: res.isScannedPdf
          ? 'Phát hiện PDF Scan / Chỉ chứa hình ảnh (Không trích xuất được chữ)'
          : 'Không đọc được định dạng file',
        message: res.errorMessage,
        isScannedPdf: res.isScannedPdf,
      });
      return;
    }

    if (target === 'main') {
      setMainText(res.text);
      setSourceFileName(res.fileName);
      if (!title.trim()) {
        setTitle(res.fileName.replace(/\.[^.]+$/, ''));
      }
    } else if (target === 'key') {
      setAnswerKeyText(res.text);
    } else {
      setTranscriptText(res.text);
    }
  };

  const handleAnalyzeDocument = () => {
    if (!mainText.trim() && !transcriptText.trim()) {
      setExtractionError({
        title: 'Chưa có nội dung tài liệu đầu vào',
        message:
          'Vui lòng tải lên file PDF/DOCX/TXT hoặc dán văn bản đề thi vào khung nội dung. Hệ thống không tự tạo nội dung đề thi giả mạo khi chưa có tài liệu.',
        isScannedPdf: false,
      });
      return;
    }

    setExtractionError(null);
    const parsed = parseIeltsDocument({
      title: title.trim() || undefined,
      skill,
      mainText,
      answerKeyText,
      transcriptText,
      sourceFileName,
    });
    setDraft(parsed);
    setDurationMinutes(skill === 'reading' ? 60 : 35);
    setStep(2);
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionItem>) => {
    if (!draft) return;
    const next = [...draft.questions];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, questions: next });
  };

  const addBlankQuestion = () => {
    if (!draft) return;
    const nextNum =
      draft.questions.length > 0
        ? Math.max(...draft.questions.map((q) => q.questionNumber)) + 1
        : 1;
    setDraft({
      ...draft,
      questions: [
        ...draft.questions,
        {
          id: `manual-q-${Date.now()}`,
          questionNumber: nextNum,
          sectionNumber: 1,
          type: 'gap_fill',
          prompt: '',
          acceptedAnswers: [],
          explanation: '',
        },
      ],
    });
  };

  const deleteQuestion = (idx: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: draft.questions.filter((_, i) => i !== idx),
    });
  };

  const handleSaveTestToBank = async () => {
    if (!draft) return;

    let fullAudioBlobId: string | undefined;
    if (draft.skill === 'listening' && audioMode === 'single' && fullAudioFile) {
      fullAudioBlobId = await saveMediaBlob(fullAudioFile, fullAudioFile.name);
    }

    const listeningParts = [...draft.listeningParts];
    if (draft.skill === 'listening' && audioMode === 'parts') {
      for (let p = 1; p <= 4; p++) {
        const f = partAudioFiles[p];
        if (!f) continue;
        const blobId = await saveMediaBlob(f, f.name);
        const existingPart = listeningParts.find((lp) => lp.partNumber === p);
        if (existingPart) {
          existingPart.audioBlobId = blobId;
        } else {
          listeningParts.push({
            partNumber: p,
            title: `Part ${p}`,
            audioBlobId: blobId,
            lines: [],
          });
        }
      }
      listeningParts.sort((a, b) => a.partNumber - b.partNumber);
    }

    const testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTest: IeltsTest = {
      id: testId,
      title: draft.title.trim() || 'Đề IELTS cá nhân',
      skill: draft.skill,
      sourceType: 'parsed',
      isDemo: false,
      sourceFileName,
      createdAt: new Date().toISOString(),
      durationMinutes,
      passages: draft.skill === 'reading' ? draft.passages : undefined,
      listeningParts:
        draft.skill === 'listening' ? listeningParts : undefined,
      fullAudioBlobId,
      questions: draft.questions,
      parseWarnings: draft.parseWarnings,
    };

    await db.tests.put(newTest);

    // Optionally generate Dictation set from transcript lines + audio
    if (
      draft.skill === 'listening' &&
      alsoCreateDictation &&
      listeningParts.some((p) => p.lines.length > 0)
    ) {
      const segments: DictationSegment[] = [];
      let segIdx = 1;
      let cursorTime = 0;
      for (const part of listeningParts) {
        for (const line of part.lines) {
          const approxSec = Math.max(
            4,
            Math.round(line.text.split(/\s+/).length * 0.45)
          );
          segments.push({
            id: `dic-${testId}-${segIdx}`,
            index: segIdx,
            partNumber: part.partNumber,
            speaker: line.speaker,
            startTime: line.startTime ?? cursorTime,
            endTime: line.endTime ?? cursorTime + approxSec,
            transcript: line.text,
          });
          cursorTime += approxSec;
          segIdx += 1;
        }
      }

      if (segments.length > 0) {
        const audioBlobId =
          fullAudioBlobId ||
          listeningParts.find((p) => p.audioBlobId)?.audioBlobId;
        await db.dictationSets.put({
          id: `dictation-${testId}`,
          title: `${newTest.title} (Dictation từ Transcript)`,
          isDemo: false,
          linkedTestId: testId,
          audioBlobId,
          createdAt: new Date().toISOString(),
          segments,
        });
      }
    }

    setSavedTestId(testId);
    setStep(3);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      {/* Header + 3-Step Indicator */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Bộ công cụ Tách đề IELTS từ Tài liệu cá nhân (Document-to-Test
              Parser)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Hỗ trợ PDF (dạng văn bản), DOCX, TXT hoặc dán trực tiếp + File âm
              thanh MP3/WAV. Cho phép kiểm tra và sửa thủ công trước khi lưu.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            {[
              { n: 1, label: '1. Tải tài liệu' },
              { n: 2, label: '2. Preview & Edit' },
              { n: 3, label: '3. Lưu Ngân hàng đề' },
            ].map((s) => (
              <span
                key={s.n}
                className={`rounded-lg px-3 py-1.5 ${
                  step === s.n
                    ? 'bg-indigo-600 text-white'
                    : step > s.n
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Technical Limitation / Scanned PDF Alert */}
      {extractionError && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-950 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold">{extractionError.title}</h3>
              <p className="text-xs leading-relaxed">{extractionError.message}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-800 border border-rose-200">
                  Cách 1: Dán văn bản trực tiếp vào khung bên dưới
                </span>
                <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-800 border border-rose-200">
                  Cách 2: Dùng bản Word (.docx) từ thư mục đề của bạn
                </span>
                <Link
                  to="/tests"
                  className="rounded-lg bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-800"
                >
                  Hoặc mở [DỮ LIỆU MINH HỌA] để trải nghiệm giao diện
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: Upload & Paste */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kỹ năng của đề thi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSkill('reading')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                      skill === 'reading'
                        ? 'border-sky-600 bg-sky-50 text-sky-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="h-4 w-4" /> Reading
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkill('listening')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                      skill === 'listening'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Headphones className="h-4 w-4" /> Listening
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên bộ đề (tự đặt để quản lý trong Ngân hàng đề)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Vol 7 Test 1 - Passage 1 / Cambridge 18 Test 2"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Main File Upload / Paste */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">
                  {skill === 'reading'
                    ? '1. Tài liệu Bài đọc & Câu hỏi (PDF / DOCX / TXT hoặc dán văn bản)'
                    : '1. Tài liệu Câu hỏi Listening (PDF / DOCX / TXT hoặc dán văn bản)'}
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
                  <FileUp className="h-3.5 w-3.5" />
                  {isExtracting ? 'Đang đọc file...' : 'Chọn file PDF / DOCX / TXT'}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.doc"
                    className="hidden"
                    onChange={(e) =>
                      handleUploadTextFile(e.target.files?.[0], 'main')
                    }
                  />
                </label>
              </div>
              <textarea
                rows={9}
                value={mainText}
                onChange={(e) => setMainText(e.target.value)}
                placeholder={
                  skill === 'reading'
                    ? 'Dán văn bản đề Reading tại đây (hoặc tải file lên ở nút bên trên)...\n\nREADING PASSAGE 1\nTitle...\nA ...\n\nQuestions 1-5\nTRUE / FALSE / NOT GIVEN\n1. ...'
                    : 'Dán văn bản câu hỏi Listening tại đây...\n\nPART 1\nQuestions 1-5\nONE WORD AND/OR A NUMBER\n1. Name: _________'
                }
                className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs leading-relaxed focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Optional Answer Key + Transcript */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    2. Đáp án & Giải thích riêng (Tùy chọn nếu tách file Answer Key)
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200">
                    <FileUp className="h-3 w-3" />
                    Tải Key
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.doc"
                      className="hidden"
                      onChange={(e) =>
                        handleUploadTextFile(e.target.files?.[0], 'key')
                      }
                    />
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={answerKeyText}
                  onChange={(e) => setAnswerKeyText(e.target.value)}
                  placeholder="Ví dụ:\n1. TRUE — Giải thích...\n2. FALSE\n3. radiation | Evidence: thermal radiation"
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {skill === 'listening' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      3. File Transcript Listening riêng (Tùy chọn)
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200">
                      <FileUp className="h-3 w-3" />
                      Tải Transcript
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.doc"
                        className="hidden"
                        onChange={(e) =>
                          handleUploadTextFile(
                            e.target.files?.[0],
                            'transcript'
                          )
                        }
                      />
                    </label>
                  </div>
                  <textarea
                    rows={5}
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder="PART 1\nLibrarian: Welcome to...\nStudent: My postcode is...\n\nPART 2\n..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Audio Attachment for Listening */}
            {skill === 'listening' && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                    <Volume2 className="h-4 w-4 text-indigo-600" />
                    Đính kèm File Âm thanh (MP3 / WAV / M4A)
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-white p-1 border border-indigo-100">
                    <button
                      type="button"
                      onClick={() => setAudioMode('single')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                        audioMode === 'single'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      1 File Full Audio
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioMode('parts')}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                        audioMode === 'parts'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      4 File riêng (Part 1–4)
                    </button>
                  </div>
                </div>

                {audioMode === 'single' ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) =>
                        setFullAudioFile(e.target.files?.[0] || null)
                      }
                      className="text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-700"
                    />
                    {fullAudioFile && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Đã chọn: {fullAudioFile.name}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((p) => (
                      <div
                        key={p}
                        className="rounded-lg bg-white border border-slate-200 p-2.5"
                      >
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Audio Part {p}
                        </label>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) =>
                            setPartAudioFiles((prev) => ({
                              ...prev,
                              [p]: e.target.files?.[0] || null,
                            }))
                          }
                          className="w-full text-[11px] text-slate-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleAnalyzeDocument}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 transition"
              >
                Phân tích & Chuyển sang Preview & Edit
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview & Manual Edit */}
      {step === 2 && draft && (
        <div className="space-y-5">
          {draft.parseWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold">
                    Cảnh báo định dạng khi tách tự động — Vui lòng kiểm tra &
                    chỉnh sửa thủ công:
                  </h3>
                  <ul className="mt-1.5 list-disc list-inside space-y-1 text-xs">
                    {draft.parseWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Metadata Edit */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề đề thi
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thời gian làm bài (phút)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {draft.skill === 'listening' && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoCreateDictation}
                  onChange={(e) => setAlsoCreateDictation(e.target.checked)}
                  className="rounded accent-indigo-600"
                />
                Tự động tách Transcript thành 1 bài luyện Dictation (Nghe chép
                chính tả)
              </label>
            )}
          </div>

          {/* Reading Passages Preview & Edit */}
          {draft.skill === 'reading' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Nội dung Bài đọc ({draft.passages.length} Passage)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      passages: [
                        ...draft.passages,
                        {
                          id: `passage-${draft.passages.length + 1}`,
                          passageNumber: draft.passages.length + 1,
                          title: `Reading Passage ${draft.passages.length + 1}`,
                          paragraphs: [{ label: 'A', text: '' }],
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm Passage
                </button>
              </div>

              {draft.passages.map((p, pIdx) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <input
                    type="text"
                    value={p.title}
                    onChange={(e) => {
                      const next = [...draft.passages];
                      next[pIdx] = { ...p, title: e.target.value };
                      setDraft({ ...draft, passages: next });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold"
                  />
                  <textarea
                    rows={6}
                    value={p.paragraphs
                      .map((para) =>
                        para.label ? `${para.label}. ${para.text}` : para.text
                      )
                      .join('\n\n')}
                    onChange={(e) => {
                      const blocks = e.target.value
                        .split(/\n{2,}/)
                        .map((b) => b.trim())
                        .filter(Boolean)
                        .map((b) => {
                          const m = b.match(/^([A-H])[\.\)\s]+(.+)$/s);
                          return m
                            ? { label: m[1], text: m[2].trim() }
                            : { text: b };
                        });
                      const next = [...draft.passages];
                      next[pIdx] = { ...p, paragraphs: blocks };
                      setDraft({ ...draft, passages: next });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Listening Transcript Preview & Edit */}
          {draft.skill === 'listening' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Transcript theo Part ({draft.listeningParts.length} Part)
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      listeningParts: [
                        ...draft.listeningParts,
                        {
                          partNumber: draft.listeningParts.length + 1,
                          title: `Part ${draft.listeningParts.length + 1}`,
                          lines: [],
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm Part
                </button>
              </div>
              {draft.listeningParts.map((lp, lIdx) => (
                <div
                  key={lp.partNumber}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                >
                  <div className="text-xs font-bold text-indigo-800">
                    {lp.title}
                  </div>
                  <textarea
                    rows={4}
                    value={lp.lines
                      .map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text))
                      .join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split('\n')
                        .map((r) => r.trim())
                        .filter(Boolean)
                        .map((r, rIdx) => {
                          const sp = r.match(/^([^:]{1,20}):\s+(.+)$/);
                          return {
                            id: `edit-p${lp.partNumber}-l${rIdx}`,
                            speaker: sp ? sp[1].trim() : undefined,
                            text: sp ? sp[2].trim() : r,
                          };
                        });
                      const next = [...draft.listeningParts];
                      next[lIdx] = { ...lp, lines };
                      setDraft({ ...draft, listeningParts: next });
                    }}
                    placeholder="Mỗi dòng là một câu thoại (vd: Speaker: nội dung)..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Questions Editor */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Danh sách Câu hỏi & Đáp án ({draft.questions.length} câu)
              </h3>
              <button
                type="button"
                onClick={addBlankQuestion}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm câu hỏi thủ công
              </button>
            </div>

            <div className="space-y-3">
              {draft.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        Câu #
                      </span>
                      <input
                        type="number"
                        value={q.questionNumber}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            questionNumber: Number(e.target.value),
                          })
                        }
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {draft.skill === 'reading' ? 'Passage' : 'Part'}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={q.sectionNumber}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            sectionNumber: Number(e.target.value),
                          })
                        }
                        className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                      />
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            type: e.target.value as QuestionType,
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {getQuestionTypeLabel(t)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteQuestion(idx)}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Nội dung câu hỏi
                    </label>
                    <input
                      type="text"
                      value={q.prompt}
                      onChange={(e) =>
                        updateQuestion(idx, { prompt: e.target.value })
                      }
                      placeholder="Nhập đề câu hỏi..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                    />
                  </div>

                  {(q.type === 'mcq' ||
                    q.type === 'matching_headings' ||
                    q.type === 'matching_info') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Các lựa chọn (mỗi dòng 1 lựa chọn, vd: A. Option 1)
                      </label>
                      <textarea
                        rows={3}
                        value={(q.options || []).join('\n')}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            options: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Đáp án đúng (ngăn cách nhiều đáp án hợp lệ bằng dấu | )
                      </label>
                      <input
                        type="text"
                        value={q.acceptedAnswers.join(' | ')}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            acceptedAnswers: e.target.value
                              .split('|')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Ví dụ: TRUE hoặc 17 | 17th"
                        className={`w-full rounded-lg border px-3 py-1.5 text-xs font-bold ${
                          q.acceptedAnswers.length === 0
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Trích dẫn bằng chứng trong bài (Evidence Quote)
                      </label>
                      <input
                        type="text"
                        value={q.evidenceQuote || ''}
                        onChange={(e) =>
                          updateQuestion(idx, { evidenceQuote: e.target.value })
                        }
                        placeholder="Đoạn câu chứa đáp án để highlight sau nộp bài..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Giải thích đáp án chi tiết
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        updateQuestion(idx, { explanation: e.target.value })
                      }
                      placeholder="Giải thích lý do đúng/sai..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại bước 1
            </button>
            <button
              type="button"
              onClick={handleSaveTestToBank}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 transition"
            >
              <Save className="h-4 w-4" />
              Lưu vào Ngân hàng đề cá nhân
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Saved Confirmation */}
      {step === 3 && savedTestId && draft && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-xs space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h3 className="text-xl font-black text-slate-900">
            Đã lưu thành công "{draft.title}" vào Ngân hàng đề!
          </h3>
          <p className="text-sm text-slate-600">
            Gồm {draft.questions.length} câu hỏi ({draft.skill.toUpperCase()})
            đã sẵn sàng trong trình duyệt (IndexedDB).
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                navigate(
                  draft.skill === 'reading'
                    ? `/reading?testId=${savedTestId}`
                    : `/listening?testId=${savedTestId}`
                )
              }
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Làm bài thi này ngay
            </button>
            <Link
              to="/tests"
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Mở Ngân hàng đề cá nhân
            </Link>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setMainText('');
                setAnswerKeyText('');
                setTranscriptText('');
                setTitle('');
                setDraft(null);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Tách đề khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
