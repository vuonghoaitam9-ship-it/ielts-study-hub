import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  FolderUp,
} from 'lucide-react';
import { useVolumeCatalog } from '../lib/volumeRepository';
import {
  ParsedVolFilename,
  parseVolFilenamePattern,
  parseSubtitleToSegments,
} from '../lib/subtitleParser';
import { saveMediaBlob, upsertVolTestOverride } from '../db/database';
import { extractTextFromFile } from '../lib/fileExtractor';
import { parseIeltsDocument } from '../lib/documentParser';

interface QueuedBatchFile {
  id: string;
  file: File;
  volNumber: number;
  testNumber: number;
  partNumber: 0 | 1 | 2 | 3 | 4;
  kind: ParsedVolFilename['kind'];
  status: 'pending' | 'imported' | 'error';
  message?: string;
}

export const VolBatchImporterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { missingReport } = useVolumeCatalog();

  const initialTab = searchParams.get('tab') === 'missing' ? 'missing' : 'import';
  const initialVol = Number(searchParams.get('vol')) || 0;

  const [tab, setTab] = useState<'import' | 'missing'>(initialTab);
  const [queue, setQueue] = useState<QueuedBatchFile[]>([]);
  const [importing, setImporting] = useState(false);

  // Missing Report Filters
  const [filterVol, setFilterVol] = useState<number>(initialVol);
  const [filterComp, setFilterComp] = useState<string>('all');

  const handleSelectBatchFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const rows: QueuedBatchFile[] = Array.from(fileList)
      .filter((f) => !/\bspeak/i.test(f.name) && !/\.DS_Store$/i.test(f.name))
      .map((file, i) => {
        const parsed = parseVolFilenamePattern(file.name);
        return {
          id: `batch-${Date.now()}-${i}`,
          file,
          volNumber: parsed.volNumber ?? 10,
          testNumber: parsed.testNumber ?? 1,
          partNumber: (parsed.partNumber ?? 0) as 0 | 1 | 2 | 3 | 4,
          kind: parsed.kind === 'unknown' ? 'reading' : parsed.kind,
          status: 'pending',
        };
      });
    setQueue((prev) => [...prev, ...rows]);
  };

  const handleRunBatchImport = async () => {
    setImporting(true);
    const updated = [...queue];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.status === 'imported') continue;
      try {
        if (item.kind === 'audio') {
          const blobId = await saveMediaBlob(item.file, item.file.name);
          await upsertVolTestOverride(
            item.volNumber,
            item.testNumber,
            (prev) => ({
              ...prev,
              listeningPatch: {
                ...prev.listeningPatch,
                ...(item.partNumber === 0
                  ? { fullAudioBlobId: blobId }
                  : {
                      partAudioBlobIds: {
                        ...(prev.listeningPatch?.partAudioBlobIds || {}),
                        [item.partNumber]: blobId,
                      },
                    }),
              },
            })
          );
          updated[i] = {
            ...item,
            status: 'imported',
            message: `Đã gắn Audio gốc vào Vol ${item.volNumber} Test ${item.testNumber}`,
          };
        } else if (item.kind === 'subtitle') {
          const raw = await item.file.text();
          const segs = parseSubtitleToSegments(
            raw,
            (item.partNumber || 1) as 1 | 2 | 3 | 4
          );
          if (segs.length === 0) {
            throw new Error('Không tìm thấy timestamp hợp lệ trong file phụ đề.');
          }
          await upsertVolTestOverride(
            item.volNumber,
            item.testNumber,
            (prev) => ({
              ...prev,
              dictationSegments: segs,
              transcript: {
                status: 'ready',
                hasExactTimestamps: true,
                sourceFiles: [item.file.name],
                parts: [1, 2, 3, 4]
                  .map((p) => ({
                    partNumber: p as 1 | 2 | 3 | 4,
                    title: `Part ${p}`,
                    segments: segs
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
            })
          );
          updated[i] = {
            ...item,
            status: 'imported',
            message: `Đã nhập ${segs.length} mốc phụ đề Dictation`,
          };
        } else {
          const extRes = await extractTextFromFile(item.file);
          if (extRes.errorMessage) {
            throw new Error(extRes.errorMessage);
          }
          if (item.kind === 'transcript') {
            const parsed = parseIeltsDocument({
              skill: 'listening',
              mainText: '',
              transcriptText: extRes.text,
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
            await upsertVolTestOverride(
              item.volNumber,
              item.testNumber,
              (prev) => ({
                ...prev,
                dictationSegments: flatSegs,
                transcript: {
                  status: 'ready',
                  hasExactTimestamps: flatSegs.some(
                    (s) => s.startTime !== undefined
                  ),
                  sourceFiles: [item.file.name],
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
              })
            );
            updated[i] = {
              ...item,
              status: 'imported',
              message: `Đã nạp Transcript (${flatSegs.length} câu)`,
            };
          } else if (item.kind === 'writing') {
            await upsertVolTestOverride(
              item.volNumber,
              item.testNumber,
              (prev) => ({
                ...prev,
                writing: {
                  status: 'ready',
                  sourceFiles: [item.file.name],
                  task2: {
                    prompt: extRes.text.slice(0, 500),
                    taskTypeLabel: 'Imported Writing Prompt',
                    writingGuide: [
                      'Phân tích câu hỏi & từ khóa chủ đề.',
                      'Lập dàn ý 4 đoạn theo cấu trúc PEEL.',
                    ],
                    sampleEssay: extRes.text,
                  },
                },
              })
            );
            updated[i] = {
              ...item,
              status: 'imported',
              message: `Đã nạp Writing vào Vol ${item.volNumber} Test ${item.testNumber}`,
            };
          } else {
            const skill = item.kind === 'listening' ? 'listening' : 'reading';
            const parsed = parseIeltsDocument({
              skill,
              mainText: extRes.text,
              sourceFileName: item.file.name,
            });
            await upsertVolTestOverride(
              item.volNumber,
              item.testNumber,
              (prev) =>
                skill === 'reading'
                  ? {
                      ...prev,
                      reading: {
                        status: 'ready',
                        sourceFiles: [item.file.name],
                        passages: parsed.passages,
                        questions: parsed.questions,
                        hasAnswerKey: parsed.questions.some(
                          (q) => q.acceptedAnswers.length > 0
                        ),
                      },
                    }
                  : {
                      ...prev,
                      listeningPatch: {
                        ...prev.listeningPatch,
                        questions: parsed.questions,
                        hasAnswerKey: parsed.questions.some(
                          (q) => q.acceptedAnswers.length > 0
                        ),
                      },
                    }
            );
            updated[i] = {
              ...item,
              status: 'imported',
              message: `Đã tách ${parsed.questions.length} câu hỏi (${skill})`,
            };
          }
        }
      } catch (err) {
        updated[i] = {
          ...item,
          status: 'error',
          message: err instanceof Error ? err.message : 'Lỗi đọc file',
        };
      }
    }

    setQueue(updated);
    setImporting(false);
  };

  const filteredMissing = useMemo(() => {
    return missingReport.filter((m) => {
      if (filterVol > 0 && m.volNumber !== filterVol) return false;
      if (filterComp !== 'all' && m.component !== filterComp) return false;
      return true;
    });
  }, [missingReport, filterVol, filterComp]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/volumes"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại Bộ đề Vol 1–10
          </Link>
          <h2 className="text-xl font-black text-slate-900">
            Công cụ Import Hàng loạt (Batch Importer) & Báo cáo Nguồn thiếu
          </h2>
          <p className="text-xs text-slate-500">
            Tự động nhận diện mã đề theo tên file (vd:{' '}
            <code>Vol10_Test1.mp3</code>, <code>Vol1_Test1_Part2.mp3</code>,{' '}
            <code>Vol8_Test1_Reading.docx</code>, <code>Vol3_Test1.srt</code>).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${
              tab === 'import'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Import hàng loạt ({queue.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('missing')}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${
              tab === 'missing'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Mục thiếu / PDF scan ({missingReport.length})
          </button>
        </div>
      </div>

      {tab === 'import' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">
              <FileUp className="h-4 w-4" />
              Chọn nhiều File (PDF/DOCX/TXT/SRT/MP3/WAV/M4A)
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.srt,.vtt,.lrc,.mp3,.wav,.m4a,.mp4,.ogg"
                className="hidden"
                onChange={(e) => handleSelectBatchFiles(e.target.files)}
              />
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100">
              <FolderUp className="h-4 w-4" />
              Chọn cả Thư mục Audio / Tài liệu gốc
              <input
                type="file"
                multiple
                // @ts-expect-error webkitdirectory is supported in Chromium/Edge for folder batch import
                webkitdirectory=""
                className="hidden"
                onChange={(e) => handleSelectBatchFiles(e.target.files)}
              />
            </label>

            {queue.length > 0 && (
              <button
                type="button"
                disabled={importing}
                onClick={handleRunBatchImport}
                className="ml-auto rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing
                  ? 'Đang nạp vào IndexedDB...'
                  : `Khớp mã & Lưu ${queue.filter((q) => q.status !== 'imported').length} file`}
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-600">
              Chưa chọn file nào. Bạn có thể chọn hàng loạt file audio gốc
              (ví dụ cho <strong>Vol 10</strong> hoặc thay thế file{' '}
              <code>.wma</code> ở Vol 4) để gắn vào đúng Vol & Test chỉ trong 1
              lần bấm.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Tên file</th>
                    <th className="py-2 pr-3">Vol</th>
                    <th className="py-2 pr-3">Test</th>
                    <th className="py-2 pr-3">Part</th>
                    <th className="py-2 pr-3">Phân loại</th>
                    <th className="py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-800 max-w-[260px] truncate">
                        {row.file.name}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.volNumber}
                          onChange={(e) => {
                            const next = [...queue];
                            next[idx] = {
                              ...row,
                              volNumber: Number(e.target.value),
                            };
                            setQueue(next);
                          }}
                          className="w-14 rounded border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={1}
                          max={16}
                          value={row.testNumber}
                          onChange={(e) => {
                            const next = [...queue];
                            next[idx] = {
                              ...row,
                              testNumber: Number(e.target.value),
                            };
                            setQueue(next);
                          }}
                          className="w-14 rounded border border-slate-200 px-2 py-1"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.partNumber}
                          onChange={(e) => {
                            const next = [...queue];
                            next[idx] = {
                              ...row,
                              partNumber: Number(e.target.value) as 0 | 1 | 2 | 3 | 4,
                            };
                            setQueue(next);
                          }}
                          className="rounded border border-slate-200 px-2 py-1"
                        >
                          <option value={0}>Full</option>
                          <option value={1}>P1</option>
                          <option value={2}>P2</option>
                          <option value={3}>P3</option>
                          <option value={4}>P4</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.kind}
                          onChange={(e) => {
                            const next = [...queue];
                            next[idx] = {
                              ...row,
                              kind: e.target.value as ParsedVolFilename['kind'],
                            };
                            setQueue(next);
                          }}
                          className="rounded border border-slate-200 px-2 py-1"
                        >
                          <option value="audio">Audio gốc</option>
                          <option value="reading">Reading</option>
                          <option value="listening">Listening Câu hỏi</option>
                          <option value="transcript">Transcript</option>
                          <option value="subtitle">SRT/VTT/LRC</option>
                          <option value="writing">Writing</option>
                        </select>
                      </td>
                      <td className="py-2">
                        {row.status === 'imported' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />{' '}
                            {row.message}
                          </span>
                        ) : row.status === 'error' ? (
                          <span className="font-bold text-rose-600">
                            {row.message}
                          </span>
                        ) : (
                          <span className="text-slate-500">Chờ nạp</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'missing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterVol}
              onChange={(e) => setFilterVol(Number(e.target.value))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
            >
              <option value={0}>Tất cả Vol 1 – Vol 10</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <option key={v} value={v}>
                  Volume {v}
                </option>
              ))}
            </select>

            <select
              value={filterComp}
              onChange={(e) => setFilterComp(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
            >
              <option value="all">Tất cả hợp phần</option>
              <option value="audio">Audio gốc (.mp3/.m4a)</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="transcript">Transcript</option>
              <option value="writing">Writing</option>
            </select>

            <span className="text-xs font-semibold text-slate-500 ml-auto">
              Đang hiển thị {filteredMissing.length} mục cần bổ sung / lưu ý
            </span>
          </div>

          <div className="max-h-[540px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {filteredMissing.map((item, idx) => (
              <div
                key={`${item.volNumber}-${item.testNumber}-${item.component}-${idx}`}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-900">{item.detailVi}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Gợi ý đặt tên / đường dẫn: {item.expectedPathSuggestion}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/volumes?vol=${item.volNumber}`}
                  className="self-start rounded-lg bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100 flex-shrink-0"
                >
                  Mở Vol {item.volNumber}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
