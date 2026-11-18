import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  FolderUp,
  Headphones,
  Keyboard,
  Layers,
  Lightbulb,
  PenTool,
  Upload,
  X,
} from 'lucide-react';
import { useVolumeCatalog } from '../lib/volumeRepository';
import { saveMediaBlob, upsertVolTestOverride } from '../db/database';
import { extractTextFromFile } from '../lib/fileExtractor';
import { parseIeltsDocument } from '../lib/documentParser';
import { parseSubtitleToSegments } from '../lib/subtitleParser';
import { VolumeCatalogSummaryEntry, VolumeTestSummaryEntry } from '../types';

function countReadyComponents(vol: VolumeCatalogSummaryEntry) {
  const total = vol.tests.length;
  const reading = vol.tests.filter((t) => t.reading.status === 'ready').length;
  const audio = vol.tests.filter(
    (t) =>
      t.listening.status === 'ready' ||
      t.listening.status === 'scanned_questions_with_audio'
  ).length;
  const transcript = vol.tests.filter((t) => t.transcript.status === 'ready').length;
  const dictation = vol.tests.filter(
    (t) => t.dictation.status === 'ready' || t.dictation.status === 'needs_timestamps'
  ).length;
  const writing = vol.tests.filter(
    (t) => t.writing.status === 'ready' || t.writing.status === 'image_or_scan_only'
  ).length;
  return { total, reading, audio, transcript, dictation, writing };
}

export const VolumeHubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { volumes, progressMap, missingReport } = useVolumeCatalog();

  const initialVol = Number(searchParams.get('vol')) || 1;
  const selectedVolNum = Math.min(10, Math.max(1, initialVol));
  const activeVol =
    volumes.find((v) => v.volNumber === selectedVolNum) || volumes[0];

  const [attachTarget, setAttachTarget] = useState<{
    test: VolumeTestSummaryEntry;
    mode: 'audio' | 'reading' | 'transcript' | 'writing';
  } | null>(null);
  const [attachPartNum, setAttachPartNum] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [attachText, setAttachText] = useState('');
  const [attachKeyText, setAttachKeyText] = useState('');
  const [attachWritingT1, setAttachWritingT1] = useState('');
  const [attachWritingT2, setAttachWritingT2] = useState('');
  const [attachStatus, setAttachStatus] = useState<string | null>(null);

  const volMissingCount = useMemo(
    () => missingReport.filter((m) => m.volNumber === selectedVolNum).length,
    [missingReport, selectedVolNum]
  );

  const handleUploadAudioForTest = async (
    file: File | undefined,
    test: VolumeTestSummaryEntry
  ) => {
    if (!file) return;
    const blobId = await saveMediaBlob(file, file.name);
    await upsertVolTestOverride(test.volNumber, test.testNumber, (prev) => ({
      ...prev,
      listeningPatch: {
        ...prev.listeningPatch,
        ...(attachPartNum === 0
          ? { fullAudioBlobId: blobId }
          : {
              partAudioBlobIds: {
                ...(prev.listeningPatch?.partAudioBlobIds || {}),
                [attachPartNum]: blobId,
              },
            }),
      },
    }));
    setAttachStatus(`Đã gắn file Audio gốc "${file.name}" vào ${test.title}.`);
  };

  const handleSaveTextOverride = async () => {
    if (!attachTarget) return;
    const { test, mode } = attachTarget;

    if (mode === 'reading') {
      const parsed = parseIeltsDocument({
        title: test.title,
        skill: 'reading',
        mainText: attachText,
        answerKeyText: attachKeyText,
      });
      await upsertVolTestOverride(test.volNumber, test.testNumber, (prev) => ({
        ...prev,
        reading: {
          status: 'ready',
          sourceFiles: ['Tài liệu bổ sung thủ công'],
          passages: parsed.passages,
          questions: parsed.questions,
          hasAnswerKey: parsed.questions.some(
            (q) => q.acceptedAnswers.length > 0
          ),
        },
      }));
      setAttachStatus(
        `Đã nạp ${parsed.passages.length} Passage & ${parsed.questions.length} câu hỏi Reading.`
      );
    } else if (mode === 'transcript') {
      const srtSegs = parseSubtitleToSegments(attachText);
      if (srtSegs.length > 0) {
        await upsertVolTestOverride(test.volNumber, test.testNumber, (prev) => ({
          ...prev,
          transcript: {
            status: 'ready',
            hasExactTimestamps: true,
            sourceFiles: ['SRT/VTT/LRC nhập thủ công'],
            parts: [1, 2, 3, 4]
              .map((p) => ({
                partNumber: p as 1 | 2 | 3 | 4,
                title: `Part ${p}`,
                segments: srtSegs
                  .filter((s) => s.partNumber === p)
                  .map((s) => ({
                    id: s.id,
                    partNumber: s.partNumber,
                    index: s.index,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    speaker: s.speaker,
                    text: s.transcript,
                  })),
              }))
              .filter((p) => p.segments.length > 0),
          },
          dictationSegments: srtSegs,
        }));
        setAttachStatus(`Đã nhập ${srtSegs.length} câu phụ đề có timestamp.`);
      } else {
        const parsed = parseIeltsDocument({
          title: test.title,
          skill: 'listening',
          mainText: attachKeyText || '',
          transcriptText: attachText,
        });
        const flatSegs = parsed.listeningParts.flatMap((lp) =>
          lp.lines.map((l, idx) => ({
            id: l.id,
            index: idx + 1,
            partNumber: lp.partNumber as 1 | 2 | 3 | 4,
            speaker: l.speaker,
            startTime: l.startTime,
            endTime: l.endTime,
            transcript: l.text,
          }))
        );
        await upsertVolTestOverride(test.volNumber, test.testNumber, (prev) => ({
          ...prev,
          transcript: {
            status: flatSegs.length > 0 ? 'ready' : 'missing',
            hasExactTimestamps: flatSegs.some((s) => s.startTime !== undefined),
            sourceFiles: ['Transcript bổ sung thủ công'],
            parts: parsed.listeningParts.map((lp) => ({
              partNumber: lp.partNumber as 1 | 2 | 3 | 4,
              title: lp.title,
              segments: lp.lines.map((l, idx) => ({
                id: l.id,
                partNumber: lp.partNumber as 1 | 2 | 3 | 4,
                index: idx + 1,
                startTime: l.startTime,
                endTime: l.endTime,
                speaker: l.speaker,
                text: l.text,
              })),
            })),
          },
          dictationSegments: flatSegs,
        }));
        setAttachStatus(`Đã lưu Transcript (${flatSegs.length} dòng).`);
      }
    } else if (mode === 'writing') {
      await upsertVolTestOverride(test.volNumber, test.testNumber, (prev) => ({
        ...prev,
        writing: {
          status: 'ready',
          sourceFiles: ['Writing bổ sung thủ công'],
          task1: attachWritingT1.trim()
            ? {
                prompt: attachWritingT1.trim(),
                taskTypeLabel: 'Task 1 Academic',
                writingGuide: [
                  'Introduction: Paraphrase đề bài.',
                  'Overview: Nêu xu hướng tổng thể và điểm cực trị.',
                  'Body 1 & 2: Nhóm số liệu và so sánh.',
                ],
              }
            : undefined,
          task2: attachWritingT2.trim()
            ? {
                prompt: attachWritingT2.trim(),
                taskTypeLabel: 'Task 2 Essay',
                writingGuide: [
                  'Introduction: Paraphrase + Thesis.',
                  'Body 1 & 2: Phát triển luận điểm theo PEEL.',
                  'Conclusion: Tóm tắt lập trường.',
                ],
              }
            : undefined,
        },
        idea: attachWritingT2.trim()
          ? {
              status: 'ready',
              topic: `Vol ${test.volNumber} Test ${test.testNumber} Writing`,
              linkedPrompt: attachWritingT2.trim(),
              sideATitle: 'Luận điểm ủng hộ / Mặt tích cực',
              sideAArguments: [
                'Ghi chú luận điểm 1 và cơ chế nguyên nhân - kết quả.',
                'Ghi chú luận điểm 2 mở rộng góc độ xã hội/kinh tế.',
              ],
              sideBTitle: 'Luận điểm phản biện / Bất cập',
              sideBArguments: [
                'Ghi chú phản biện đối trọng hoặc giải pháp cân bằng.',
              ],
              examples: ['Ví dụ thực tế từ ngữ cảnh bài viết của bạn.'],
              collocations: [
                { phrase: 'long-term sustainability', meaningVi: 'tính bền vững dài hạn' },
                { phrase: 'socioeconomic impact', meaningVi: 'tác động kinh tế - xã hội' },
              ],
            }
          : undefined,
      }));
      setAttachStatus('Đã cập nhật đề Writing & Idea Bank cho đề thi này.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-600">
            <Layers className="h-4 w-4" />
            Thư viện 10 Bộ đề IELTS Academic (Vol 1 – Vol 10)
          </div>
          <h2 className="mt-1 text-2xl font-black text-slate-900">
            Hệ thống 6 Hợp phần Liên kết Chặt chẽ (100% Audio gốc)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Mỗi Test kết nối xuyên suốt Reading · Listening · Transcript ·
            Dictation · Writing · Idea Bank trên cùng nguồn audio gốc. Các mục
            chưa có dữ liệu nguồn được đánh dấu minh bạch kèm nút bổ sung trực
            tiếp.
          </p>
        </div>

        <Link
          to="/volumes/import"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
        >
          <FolderUp className="h-4 w-4" />
          Batch Importer & Báo cáo Thiếu ({missingReport.length})
        </Link>
      </div>

      {/* Volume Selector Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {volumes.map((vol) => {
          const stats = countReadyComponents(vol);
          const isSelected = vol.volNumber === selectedVolNum;
          return (
            <button
              key={vol.volNumber}
              type="button"
              onClick={() => setSearchParams({ vol: String(vol.volNumber) })}
              className={`rounded-2xl border p-3 text-left transition ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">Vol {vol.volNumber}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stats.total} Tests
                </span>
              </div>
              <div
                className={`mt-2 grid grid-cols-2 gap-1 text-[10px] font-semibold ${
                  isSelected ? 'text-indigo-100' : 'text-slate-500'
                }`}
              >
                <span>Read: {stats.reading}/{stats.total}</span>
                <span>Audio: {stats.audio}/{stats.total}</span>
                <span>Trans: {stats.transcript}/{stats.total}</span>
                <span>Write: {stats.writing}/{stats.total}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Volume Tests */}
      {activeVol && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {activeVol.title}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {activeVol.description}
              </p>
            </div>
            {volMissingCount > 0 && (
              <Link
                to={`/volumes/import?vol=${activeVol.volNumber}&tab=missing`}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                {volMissingCount} mục thiếu/PDF scan cần lưu ý
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {activeVol.tests.map((test) => {
              const v = test.volNumber;
              const t = test.testNumber;
              const pRead = progressMap.get(`vol-${v}-test-${t}-reading`);
              const pLis = progressMap.get(`vol-${v}-test-${t}-listening`);
              const pDic = progressMap.get(`vol-${v}-test-${t}-dictation`);
              const pWr = progressMap.get(`vol-${v}-test-${t}-writing`);

              return (
                <div
                  key={test.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 hover:border-indigo-200 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
                        Test {test.testNumber}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {test.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setAttachStatus(null);
                          setAttachPartNum(0);
                          setAttachTarget({ test, mode: 'audio' });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-indigo-400"
                      >
                        <Upload className="h-3 w-3 text-indigo-600" />
                        Gắn Audio gốc
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachStatus(null);
                          setAttachText('');
                          setAttachKeyText('');
                          setAttachTarget({ test, mode: 'reading' });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-sky-400"
                      >
                        <Upload className="h-3 w-3 text-sky-600" />
                        Bổ sung Reading
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachStatus(null);
                          setAttachText('');
                          setAttachTarget({ test, mode: 'transcript' });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-purple-400"
                      >
                        <Upload className="h-3 w-3 text-purple-600" />
                        Nhập Transcript/SRT
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachStatus(null);
                          setAttachWritingT1(test.writing.task1Prompt || '');
                          setAttachWritingT2(test.writing.task2Prompt || '');
                          setAttachTarget({ test, mode: 'writing' });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-emerald-400"
                      >
                        <Upload className="h-3 w-3 text-emerald-600" />
                        Nhập Writing
                      </button>
                    </div>
                  </div>

                  {/* 6 Linked Skill Cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <Link
                      to={`/reading?vol=${v}&test=${t}`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-sky-400 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                          Reading
                        </span>
                        {pRead?.completed && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-bold ${
                          test.reading.status === 'ready'
                            ? 'text-emerald-700'
                            : test.reading.status === 'scanned_pdf'
                              ? 'text-amber-700'
                              : 'text-rose-600'
                        }`}
                      >
                        {test.reading.status === 'ready'
                          ? `${test.reading.passageCount} Passage · ${test.reading.questionCount}q`
                          : test.reading.status === 'scanned_pdf'
                            ? 'PDF Scan gốc'
                            : 'Chưa có dữ liệu'}
                      </span>
                    </Link>

                    <Link
                      to={`/listening?vol=${v}&test=${t}`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-indigo-400 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <Headphones className="h-3.5 w-3.5 text-indigo-600" />
                          Listening
                        </span>
                        {pLis?.completed && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-bold ${
                          test.listening.status === 'ready'
                            ? 'text-emerald-700'
                            : test.listening.status === 'scanned_questions_with_audio'
                              ? 'text-sky-700'
                              : 'text-rose-600'
                        }`}
                      >
                        {test.listening.status === 'ready'
                          ? 'Audio gốc + Đề số'
                          : test.listening.status === 'scanned_questions_with_audio'
                            ? 'Audio gốc + PDF'
                            : test.listening.status === 'wma_unsupported'
                              ? 'Lỗi định dạng .wma'
                              : 'Thiếu Audio gốc'}
                      </span>
                    </Link>

                    <Link
                      to={`/listening?vol=${v}&test=${t}&view=transcript`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-violet-400 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-violet-600" />
                          Transcript
                        </span>
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-bold ${
                          test.transcript.status === 'ready'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {test.transcript.status === 'ready'
                          ? `${test.transcript.segmentCount} câu thoại`
                          : test.transcript.hasOriginalPdf
                            ? 'PDF Scan gốc'
                            : 'Chưa có dữ liệu'}
                      </span>
                    </Link>

                    <Link
                      to={`/dictation?vol=${v}&test=${t}`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-purple-400 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <Keyboard className="h-3.5 w-3.5 text-purple-600" />
                          Dictation
                        </span>
                        {pDic?.completed && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-bold ${
                          test.dictation.status === 'ready'
                            ? 'text-emerald-700'
                            : test.dictation.status === 'needs_timestamps'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {test.dictation.status === 'ready'
                          ? `${test.dictation.segmentCount} câu (Timestamp)`
                          : test.dictation.status === 'needs_timestamps'
                            ? 'Chờ gán Timestamp'
                            : 'Thiếu Audio/Script'}
                      </span>
                    </Link>

                    <Link
                      to={`/writing?vol=${v}&test=${t}&tab=writing`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-emerald-400 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                          Writing
                        </span>
                        {pWr?.completed && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-bold ${
                          test.writing.status === 'ready'
                            ? 'text-emerald-700'
                            : test.writing.status === 'image_or_scan_only'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {test.writing.status === 'ready'
                          ? 'Đủ đề & Bài mẫu'
                          : test.writing.status === 'image_or_scan_only'
                            ? 'Ảnh / PDF gốc'
                            : 'Chưa có dữ liệu'}
                      </span>
                    </Link>

                    <Link
                      to={`/writing?vol=${v}&test=${t}&tab=idea`}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-amber-400 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                          Idea Bank
                        </span>
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-bold truncate ${
                          test.idea.status === 'ready'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {test.idea.status === 'ready'
                          ? test.idea.topic
                          : 'Chưa có đề Writing'}
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline Attach Modal */}
      {attachTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Bổ sung nguồn gốc cho {attachTarget.test.title}
              </h3>
              <button
                type="button"
                onClick={() => setAttachTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {attachTarget.mode === 'audio' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chọn vị trí gắn Audio gốc:
                  </label>
                  <select
                    value={attachPartNum}
                    onChange={(e) =>
                      setAttachPartNum(Number(e.target.value) as 0 | 1 | 2 | 3 | 4)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold"
                  >
                    <option value={0}>Audio Full Test (Cả bài Listening & Dictation)</option>
                    <option value={1}>Audio Part 1</option>
                    <option value={2}>Audio Part 2</option>
                    <option value={3}>Audio Part 3</option>
                    <option value={4}>Audio Part 4</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chọn file âm thanh gốc (MP3 / WAV / M4A / MP4):
                  </label>
                  <input
                    type="file"
                    accept="audio/*,video/mp4"
                    onChange={(e) =>
                      handleUploadAudioForTest(
                        e.target.files?.[0],
                        attachTarget.test
                      )
                    }
                    className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 py-2 file:text-xs file:font-bold file:text-white"
                  />
                </div>
              </div>
            )}

            {(attachTarget.mode === 'reading' ||
              attachTarget.mode === 'transcript') && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">
                    {attachTarget.mode === 'reading'
                      ? 'Tải file DOCX / PDF / TXT hoặc dán bài đọc:'
                      : 'Tải file SRT / VTT / LRC / DOCX / TXT hoặc dán Transcript:'}
                  </span>
                  <label className="cursor-pointer rounded-lg bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100">
                    Chọn file
                    <input
                      type="file"
                      accept=".docx,.pdf,.txt,.srt,.vtt,.lrc"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (/\.(srt|vtt|lrc)$/i.test(f.name)) {
                          setAttachText(await f.text());
                        } else {
                          const res = await extractTextFromFile(f);
                          if (res.errorMessage) {
                            setAttachStatus(res.errorMessage);
                          } else {
                            setAttachText(res.text);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  rows={7}
                  value={attachText}
                  onChange={(e) => setAttachText(e.target.value)}
                  placeholder="Dán nội dung tại đây..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
                {attachTarget.mode === 'reading' && (
                  <textarea
                    rows={3}
                    value={attachKeyText}
                    onChange={(e) => setAttachKeyText(e.target.value)}
                    placeholder="Dán Answer Key riêng (nếu có)..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={handleSaveTextOverride}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
                >
                  Lưu vào đề này
                </button>
              </div>
            )}

            {attachTarget.mode === 'writing' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Đề Writing Task 1:
                  </label>
                  <textarea
                    rows={3}
                    value={attachWritingT1}
                    onChange={(e) => setAttachWritingT1(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Đề Writing Task 2:
                  </label>
                  <textarea
                    rows={3}
                    value={attachWritingT2}
                    onChange={(e) => setAttachWritingT2(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveTextOverride}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
                >
                  Lưu đề Writing & Tạo Idea Bank tương ứng
                </button>
              </div>
            )}

            {attachStatus && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
                {attachStatus}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
