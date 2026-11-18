import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Loader2, Volume2, X } from 'lucide-react';
import {
  LookupResult,
  lookupOfflineWord,
  lookupWordWithOptionalApi,
  playAuthenticWordAudio,
} from '../lib/dictionaryService';
import { createNewVocabCard } from '../lib/sm2';
import { db } from '../db/database';

interface DictionaryPopoverProps {
  word: string;
  contextSentence?: string;
  sourceLabel?: string;
  position?: { x: number; y: number };
  onClose: () => void;
  onSaved?: (savedWord: string) => void;
}

export const DictionaryPopover: React.FC<DictionaryPopoverProps> = ({
  word,
  contextSentence,
  sourceLabel,
  position,
  onClose,
  onSaved,
}) => {
  const [lookup, setLookup] = useState<LookupResult>(() =>
    lookupOfflineWord(word)
  );
  const [loadingApi, setLoadingApi] = useState(false);
  const [meaningVi, setMeaningVi] = useState(
    () => lookupOfflineWord(word).entry?.meaningVi ?? ''
  );
  const [savedState, setSavedState] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );

  useEffect(() => {
    const initial = lookupOfflineWord(word);
    setLookup(initial);
    setMeaningVi(initial.entry?.meaningVi ?? '');
    setSavedState('idle');

    if (!initial.foundInOffline) {
      setLoadingApi(true);
      lookupWordWithOptionalApi(word)
        .then((res) => {
          setLookup(res);
          if (res.entry?.meaningVi) {
            setMeaningVi(res.entry.meaningVi);
          }
        })
        .finally(() => setLoadingApi(false));
    }
  }, [word]);

  const handleSaveToSrs = async () => {
    setSavedState('saving');
    const cleanWord = (lookup.entry?.word || lookup.word || word).trim();
    const existing = await db.vocabCards
      .where('word')
      .equalsIgnoreCase(cleanWord)
      .first();

    if (existing) {
      await db.vocabCards.update(existing.id, {
        meaningVi: meaningVi.trim() || existing.meaningVi,
        contextSentence: contextSentence || existing.contextSentence,
        sourceLabel: sourceLabel || existing.sourceLabel,
      });
    } else {
      const newCard = createNewVocabCard({
        id: `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        word: cleanWord,
        phonetic: lookup.entry?.phonetic,
        partOfSpeech: lookup.entry?.partOfSpeech,
        meaningVi:
          meaningVi.trim() ||
          lookup.entry?.definitionEn ||
          '(Tự ghi chú nghĩa tiếng Việt)',
        definitionEn: lookup.entry?.definitionEn,
        contextSentence,
        sourceLabel,
        topicTag: lookup.entry?.topicTag || 'Personal Lookup',
      });
      await db.vocabCards.put(newCard);
    }

    setSavedState('saved');
    onSaved?.(cleanWord);
  };

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${Math.min(Math.max(16, position.x - 160), window.innerWidth - 356)}px`,
        top: `${Math.min(Math.max(16, position.y + 14), window.innerHeight - 360)}px`,
        zIndex: 60,
      }
    : {
        position: 'fixed',
        right: '24px',
        bottom: '84px',
        zIndex: 60,
      };

  return (
    <div
      style={style}
      className="w-[340px] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl text-slate-900"
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <h4 className="text-base font-bold text-slate-900">
              {lookup.entry?.word || lookup.word || word}
            </h4>
            {lookup.entry?.partOfSpeech && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                {lookup.entry.partOfSpeech}
              </span>
            )}
          </div>
          {lookup.entry?.phonetic && (
            <p className="mt-0.5 text-xs text-slate-500 font-mono">
              {lookup.entry.phonetic}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {lookup.entry?.audioUrl && (
            <button
              type="button"
              onClick={() => playAuthenticWordAudio(lookup.entry?.audioUrl)}
              title="Nghe audio từ điển gốc"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-indigo-600"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng từ điển"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2.5 text-sm">
        {loadingApi && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang tra định nghĩa học thuật bổ sung...
          </div>
        )}

        {lookup.entry?.definitionEn && (
          <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-800">EN: </span>
            {lookup.entry.definitionEn}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Nghĩa tiếng Việt (có thể sửa trước khi lưu):
          </label>
          <input
            type="text"
            value={meaningVi}
            onChange={(e) => setMeaningVi(e.target.value)}
            placeholder="Nhập nghĩa tiếng Việt..."
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {contextSentence && (
          <div className="rounded-lg border border-slate-100 bg-amber-50/50 p-2 text-xs text-slate-600 italic line-clamp-3">
            "{contextSentence}"
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveToSrs}
          disabled={savedState === 'saving'}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
            savedState === 'saved'
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {savedState === 'saved' ? (
            <>
              <Check className="h-4 w-4" />
              Đã lưu vào Flashcard SM-2
            </>
          ) : (
            <>Lưu vào Kho từ vựng (SM-2)</>
          )}
        </button>
      </div>
    </div>
  );
};
