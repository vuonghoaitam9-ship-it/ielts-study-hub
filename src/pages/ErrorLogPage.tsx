import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { db } from '../db/database';
import { getQuestionTypeLabel } from '../lib/grading';
import { ErrorLogItem, QuestionType } from '../types';

export const ErrorLogPage: React.FC = () => {
  const errors = useLiveQuery(
    () => db.errorLogs.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );

  const [skillFilter, setSkillFilter] = useState<'all' | 'reading' | 'listening'>(
    'all'
  );
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'mastered' | 'all'>(
    'open'
  );
  const [retryInputs, setRetryInputs] = useState<Record<string, string>>({});
  const [retryFeedback, setRetryFeedback] = useState<
    Record<string, 'correct' | 'wrong'>
  >({});

  const filteredErrors = useMemo(() => {
    return errors.filter((e) => {
      if (skillFilter !== 'all' && e.skill !== skillFilter) return false;
      if (typeFilter !== 'all' && e.questionType !== typeFilter) return false;
      if (statusFilter === 'open' && e.mastered) return false;
      if (statusFilter === 'mastered' && !e.mastered) return false;
      return true;
    });
  }, [errors, skillFilter, typeFilter, statusFilter]);

  // Group counts by question type for weak-spot analytics
  const typeBreakdown = useMemo(() => {
    const map = new Map<QuestionType, number>();
    for (const e of errors.filter((item) => !item.mastered)) {
      map.set(e.questionType, (map.get(e.questionType) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [errors]);

  const handleCheckRetry = async (item: ErrorLogItem) => {
    const guess = (retryInputs[item.id] || '').trim().toLowerCase();
    const target = item.correctAnswer.trim().toLowerCase();
    const ok = Boolean(guess) && (guess === target || target.includes(guess));
    setRetryFeedback((prev) => ({
      ...prev,
      [item.id]: ok ? 'correct' : 'wrong',
    }));
    if (ok) {
      await db.errorLogs.update(item.id, { mastered: true });
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Sổ tay lỗi sai thông minh (Error Log)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Tự động gom toàn bộ câu trả lời sai từ các bài test Reading &
              Listening theo kỹ năng và dạng câu hỏi để bạn làm lại tới khi
              Mastered.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-rose-700">
              Chưa xử lý: {errors.filter((e) => !e.mastered).length}
            </span>
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700">
              Đã nắm vững: {errors.filter((e) => e.mastered).length}
            </span>
          </div>
        </div>

        {/* Weakest Question Types */}
        {typeBreakdown.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">
              Thống kê dạng câu hỏi hay sai nhất:
            </p>
            <div className="flex flex-wrap gap-2">
              {typeBreakdown.map(([qType, cnt]) => (
                <button
                  key={qType}
                  type="button"
                  onClick={() => setTypeFilter(qType)}
                  className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-indigo-400"
                >
                  {getQuestionTypeLabel(qType)}:{' '}
                  <span className="text-rose-600">{cnt} lỗi</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={skillFilter}
          onChange={(e) =>
            setSkillFilter(e.target.value as 'all' | 'reading' | 'listening')
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
        >
          <option value="all">Tất cả kỹ năng (Reading & Listening)</option>
          <option value="reading">Reading</option>
          <option value="listening">Listening</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as QuestionType | 'all')
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
        >
          <option value="all">Mọi dạng câu hỏi</option>
          <option value="tfng">True / False / Not Given</option>
          <option value="ynng">Yes / No / Not Given</option>
          <option value="mcq">Multiple Choice</option>
          <option value="gap_fill">Gap Fill / Note Completion</option>
          <option value="matching_headings">Matching Headings</option>
          <option value="matching_info">Matching Information</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'open' | 'mastered' | 'all')
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
        >
          <option value="open">Chưa xử lý</option>
          <option value="mastered">Đã nắm vững</option>
          <option value="all">Tất cả</option>
        </select>
      </div>

      {/* Error Cards */}
      {filteredErrors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-700">
            Không có lỗi sai nào trong bộ lọc này.
          </p>
          <p className="text-xs text-slate-500">
            Khi bạn nộp bài Reading hoặc Listening, các câu làm sai sẽ tự động
            được lưu vào đây để tổng ôn.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredErrors.map((err) => {
            const fb = retryFeedback[err.id];
            return (
              <div
                key={err.id}
                className={`rounded-2xl border p-5 shadow-xs space-y-3 ${
                  err.mastered
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 uppercase">
                      {err.skill}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {getQuestionTypeLabel(err.questionType)}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {err.testTitle} · Câu #{err.questionNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        db.errorLogs.update(err.id, { mastered: !err.mastered })
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                        err.mastered
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {err.mastered ? 'Đã nắm vững' : 'Đánh dấu Đã hiểu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => db.errorLogs.delete(err.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-bold text-slate-900">{err.prompt}</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5">
                    <span className="font-bold text-rose-800">
                      Bạn đã chọn:{' '}
                    </span>
                    <span className="text-rose-900">{err.userAnswer}</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                    <span className="font-bold text-emerald-800">
                      Đáp án đúng:{' '}
                    </span>
                    <span className="font-bold text-emerald-900">
                      {err.correctAnswer}
                    </span>
                  </div>
                </div>

                {err.explanation && (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    <strong>Giải thích: </strong>
                    {err.explanation}
                  </p>
                )}

                {/* Re-try & Reflection Note */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={retryInputs[err.id] || ''}
                      onChange={(e) =>
                        setRetryInputs((prev) => ({
                          ...prev,
                          [err.id]: e.target.value,
                        }))
                      }
                      placeholder="Gõ lại đáp án đúng để kiểm tra trí nhớ..."
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleCheckRetry(err)}
                      className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Kiểm tra
                    </button>
                    {fb === 'correct' && (
                      <span className="text-xs font-bold text-emerald-600">
                        Chuẩn!
                      </span>
                    )}
                    {fb === 'wrong' && (
                      <span className="text-xs font-bold text-rose-600">
                        Chưa khớp
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={err.personalNote}
                    onChange={(e) =>
                      db.errorLogs.update(err.id, {
                        personalNote: e.target.value,
                      })
                    }
                    placeholder="Ghi chú lý do sai (vd: bẫy paraphrase, thiếu s/es)..."
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
