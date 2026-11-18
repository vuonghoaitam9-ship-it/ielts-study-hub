import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CheckCircle2,
  Layers,
  Plus,
  RotateCw,
  Search,
  Trash2,
} from 'lucide-react';
import { db, recordStudyMinutes } from '../db/database';
import {
  Sm2Rating,
  calculateSm2,
  createNewVocabCard,
  getTodayLocalISODate,
  previewSm2Intervals,
} from '../lib/sm2';

export const VocabSrsPage: React.FC = () => {
  const cards = useLiveQuery(
    () => db.vocabCards.orderBy('nextReviewDate').toArray(),
    [],
    []
  );

  const todayISO = getTodayLocalISODate();
  const dueCards = useMemo(
    () => cards.filter((c) => c.nextReviewDate <= todayISO),
    [cards, todayISO]
  );

  const [tab, setTab] = useState<'review' | 'deck'>('review');
  const [flipped, setFlipped] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add Card Form
  const [newWord, setNewWord] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newContext, setNewContext] = useState('');

  const currentCard = dueCards[0];
  const predictedIntervals = currentCard
    ? previewSm2Intervals(currentCard, todayISO)
    : null;

  const handleRateCard = async (rating: Sm2Rating) => {
    if (!currentCard) return;
    const outcome = calculateSm2(currentCard, rating, todayISO);
    await db.vocabCards.update(currentCard.id, {
      repetition: outcome.repetition,
      interval: outcome.interval,
      easeFactor: outcome.easeFactor,
      nextReviewDate: outcome.nextReviewDate,
      lastReviewedAt: new Date().toISOString(),
    });
    await recordStudyMinutes(1, todayISO);
    setFlipped(false);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) return;
    await db.vocabCards.put(
      createNewVocabCard({
        id: `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        word: newWord,
        phonetic: newPhonetic,
        meaningVi: newMeaning,
        contextSentence: newContext,
        sourceLabel: 'Thủ công',
        todayISO,
      })
    );
    setNewWord('');
    setNewPhonetic('');
    setNewMeaning('');
    setNewContext('');
  };

  const filteredDeck = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const q = searchQuery.toLowerCase();
    return cards.filter(
      (c) =>
        c.word.toLowerCase().includes(q) ||
        c.meaningVi.toLowerCase().includes(q) ||
        (c.topicTag || '').toLowerCase().includes(q)
    );
  }, [cards, searchQuery]);

  const masteredCount = cards.filter((c) => c.interval >= 14).length;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            Kho Từ vựng & Flashcards (Thuật toán lặp lại ngắt quãng SM-2)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cần ôn hôm nay:{' '}
            <strong className="text-amber-700">{dueCards.length} thẻ</strong> ·
            Tổng kho: <strong>{cards.length} từ</strong> · Đã nhớ sâu (&gt;=14
            ngày): <strong className="text-emerald-700">{masteredCount}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('review')}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${
              tab === 'review'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Phiên ôn tập ({dueCards.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('deck')}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${
              tab === 'deck'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Quản lý toàn bộ thẻ ({cards.length})
          </button>
        </div>
      </div>

      {tab === 'review' && (
        <div>
          {!currentCard ? (
            <div className="rounded-2xl border border-emerald-200 bg-white p-10 text-center space-y-3 shadow-xs">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h3 className="text-lg font-black text-slate-900">
                Bạn đã hoàn thành toàn bộ thẻ Flashcard đến hạn hôm nay!
              </h3>
              <p className="text-xs text-slate-500">
                Hãy tra từ trực tiếp trong Reading, Listening hoặc Writing Idea
                Bank để bổ sung từ mới vào kho SM-2.
              </p>
              <button
                type="button"
                onClick={() => setTab('deck')}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Xem & Thêm từ vào kho
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              <div
                onClick={() => setFlipped((f) => !f)}
                className="cursor-pointer rounded-3xl border border-slate-200 bg-white p-8 shadow-md transition hover:border-indigo-300 min-h-[280px] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-semibold">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    {currentCard.topicTag || 'IELTS Academic'} · Rep #
                    {currentCard.repetition} · EF {currentCard.easeFactor}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    SM-2 Active Recall
                  </span>
                </div>

                <div className="my-6 text-center space-y-3">
                  <h3 className="text-3xl font-black text-slate-900">
                    {currentCard.word}
                  </h3>
                  {(currentCard.phonetic || currentCard.partOfSpeech) && (
                    <p className="text-sm text-slate-500 font-mono">
                      {currentCard.phonetic}{' '}
                      {currentCard.partOfSpeech
                        ? `(${currentCard.partOfSpeech})`
                        : ''}
                    </p>
                  )}

                  {flipped ? (
                    <div className="mt-5 space-y-2 border-t border-slate-100 pt-5">
                      <p className="text-xl font-bold text-indigo-700">
                        {currentCard.meaningVi}
                      </p>
                      {currentCard.definitionEn && (
                        <p className="text-xs text-slate-600">
                          {currentCard.definitionEn}
                        </p>
                      )}
                      {currentCard.contextSentence && (
                        <p className="rounded-xl bg-amber-50 p-3 text-xs italic text-slate-700">
                          "{currentCard.contextSentence}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                      <RotateCw className="h-3.5 w-3.5" />
                      Nhấn vào thẻ để lật xem nghĩa tiếng Việt & ngữ cảnh
                    </p>
                  )}
                </div>

                <div className="text-center text-[11px] text-slate-400">
                  Còn lại trong hàng đợi hôm nay: {dueCards.length} thẻ
                </div>
              </div>

              {flipped && predictedIntervals && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    {
                      rating: 1 as Sm2Rating,
                      label: 'Quên (Again)',
                      cls: 'bg-rose-600 hover:bg-rose-700 text-white',
                    },
                    {
                      rating: 2 as Sm2Rating,
                      label: 'Khó (Hard)',
                      cls: 'bg-amber-500 hover:bg-amber-600 text-white',
                    },
                    {
                      rating: 3 as Sm2Rating,
                      label: 'Nhớ tốt (Good)',
                      cls: 'bg-indigo-600 hover:bg-indigo-700 text-white',
                    },
                    {
                      rating: 4 as Sm2Rating,
                      label: 'Rất dễ (Easy)',
                      cls: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                    },
                  ].map((btn) => (
                    <button
                      key={btn.rating}
                      type="button"
                      onClick={() => handleRateCard(btn.rating)}
                      className={`rounded-xl px-3 py-3 text-xs font-bold shadow-xs transition ${btn.cls}`}
                    >
                      <div>{btn.label}</div>
                      <div className="mt-0.5 text-[10px] opacity-90">
                        +{predictedIntervals[btn.rating]} ngày
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'deck' && (
        <div className="space-y-5">
          {/* Quick Add Card */}
          <form
            onSubmit={handleAddCard}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs grid grid-cols-1 gap-3 md:grid-cols-5"
          >
            <input
              type="text"
              required
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Từ / Collocation..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newPhonetic}
              onChange={(e) => setNewPhonetic(e.target.value)}
              placeholder="Phiên âm IPA..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={newMeaning}
              onChange={(e) => setNewMeaning(e.target.value)}
              placeholder="Nghĩa tiếng Việt..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              placeholder="Câu ví dụ..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Thêm thẻ
            </button>
          </form>

          {/* Search & Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ trong kho..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Từ vựng</th>
                    <th className="py-2 pr-3">Nghĩa tiếng Việt</th>
                    <th className="py-2 pr-3">Chủ đề</th>
                    <th className="py-2 pr-3">Ôn tiếp theo</th>
                    <th className="py-2 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeck.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-3 font-bold text-slate-900">
                        {c.word}{' '}
                        <span className="font-mono font-normal text-slate-400">
                          {c.phonetic}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {c.meaningVi}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium">
                          {c.topicTag || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px]">
                        {c.nextReviewDate <= todayISO ? (
                          <span className="font-bold text-amber-700">
                            Hôm nay ({c.nextReviewDate})
                          </span>
                        ) : (
                          c.nextReviewDate
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => db.vocabCards.delete(c.id)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
