import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  FileUp,
  Headphones,
  Play,
  Search,
  Trash2,
} from 'lucide-react';
import { db, deleteTestWithRelatedMedia } from '../db/database';

export const TestBankPage: React.FC = () => {
  const tests = useLiveQuery(
    () => db.tests.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );
  const attempts = useLiveQuery(() => db.attempts.toArray(), [], []);

  const [filterSkill, setFilterSkill] = useState<'all' | 'reading' | 'listening'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (filterSkill !== 'all' && t.skill !== filterSkill) return false;
      if (
        searchQuery.trim() &&
        !t.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tests, filterSkill, searchQuery]);

  const handleDelete = async (testId: string, title: string) => {
    if (!window.confirm(`Xóa đề "${title}" và file audio đính kèm?`)) return;
    await deleteTestWithRelatedMedia(testId);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            Ngân hàng đề cá nhân (Personal Test Bank)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Quản lý toàn bộ đề Reading & Listening bạn đã tách từ tài liệu PDF /
            DOCX / TXT. Các bộ mẫu minh họa được gắn nhãn rõ ràng [DỮ LIỆU MINH
            HỌA].
          </p>
        </div>

        <Link
          to="/parser"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
        >
          <FileUp className="h-4 w-4" />
          Tách đề mới từ tài liệu
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: `Tất cả (${tests.length})` },
            {
              id: 'reading',
              label: `Reading (${tests.filter((t) => t.skill === 'reading').length})`,
            },
            {
              id: 'listening',
              label: `Listening (${tests.filter((t) => t.skill === 'listening').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setFilterSkill(tab.id as 'all' | 'reading' | 'listening')
              }
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                filterSkill === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên bộ đề..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {filteredTests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">
            Chưa có bộ đề nào phù hợp bộ lọc hiện tại.
          </p>
          <Link
            to="/parser"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <FileUp className="h-4 w-4" /> Tải tài liệu đề thi cá nhân ngay
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredTests.map((test) => {
            const testAttempts = attempts.filter((a) => a.testId === test.id);
            const bestBand =
              testAttempts.length > 0
                ? Math.max(...testAttempts.map((a) => a.estimatedBand)).toFixed(
                    1
                  )
                : null;
            const targetRoute =
              test.skill === 'reading'
                ? `/reading?testId=${test.id}`
                : `/listening?testId=${test.id}`;

            return (
              <div
                key={test.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-200 transition"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          test.skill === 'reading'
                            ? 'bg-sky-50 text-sky-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {test.skill === 'reading' ? (
                          <BookOpen className="h-3.5 w-3.5" />
                        ) : (
                          <Headphones className="h-3.5 w-3.5" />
                        )}
                        {test.skill.toUpperCase()}
                      </span>

                      {test.isDemo ? (
                        <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                          DỮ LIỆU MINH HỌA - DEMO UI
                        </span>
                      ) : (
                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                          TÀI LIỆU CÁ NHÂN
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(test.id, test.title)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Xóa đề này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="mt-3 text-base font-extrabold text-slate-900">
                    {test.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {test.questions.length} câu hỏi ·{' '}
                    {test.skill === 'reading'
                      ? `${test.passages?.length ?? 0} bài đọc`
                      : `${test.listeningParts?.length ?? 0} Part`}
                    {test.sourceFileName ? ` · Nguồn: ${test.sourceFileName}` : ''}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="text-xs text-slate-600">
                    {bestBand ? (
                      <span>
                        Đã làm {testAttempts.length} lần · Best Band:{' '}
                        <strong className="text-emerald-700">{bestBand}</strong>
                      </span>
                    ) : (
                      <span>Chưa làm lần nào</span>
                    )}
                  </div>

                  <Link
                    to={targetRoute}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Làm bài
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
