import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Highlighter, StickyNote, Trash2 } from 'lucide-react';
import { HighlightColor, HighlightRange, ReadingPassage } from '../types';

interface HighlightedPassageProps {
  passage: ReadingPassage;
  highlights: HighlightRange[];
  onAddHighlight: (item: Omit<HighlightRange, 'id' | 'createdAt'>) => void;
  onUpdateHighlightNote: (id: string, note: string) => void;
  onRemoveHighlight: (id: string) => void;
  onLookupWord: (word: string, contextSentence: string, pos?: { x: number; y: number }) => void;
  clickLookupEnabled: boolean;
  contrastMode: 'light' | 'dark' | 'contrast_yellow';
  fontSizeClass: string;
  evidenceQuotes?: string[];
}

interface SelectionDraft {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  contextSentence: string;
  x: number;
  y: number;
}

const COLOR_STYLES: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-200 text-slate-950 rounded-xs px-0.5',
  green: 'bg-emerald-200 text-slate-950 rounded-xs px-0.5',
  pink: 'bg-pink-200 text-slate-950 rounded-xs px-0.5',
};

function getSelectionOffsetsWithinElement(
  container: HTMLElement,
  range: Range
): { start: number; end: number } | null {
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }

  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;
  const end = start + range.toString().length;

  if (end <= start) return null;
  return { start, end };
}

export const HighlightedPassage: React.FC<HighlightedPassageProps> = ({
  passage,
  highlights,
  onAddHighlight,
  onUpdateHighlightNote,
  onRemoveHighlight,
  onLookupWord,
  clickLookupEnabled,
  contrastMode,
  fontSizeClass,
  evidenceQuotes = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(
    null
  );
  const [noteInputOpen, setNoteInputOpen] = useState(false);
  const [draftNoteText, setDraftNoteText] = useState('');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(
    null
  );
  const [editingNoteText, setEditingNoteText] = useState('');

  useEffect(() => {
    setSelectionDraft(null);
    setNoteInputOpen(false);
    setActiveHighlightId(null);
  }, [passage.id]);

  const handleMouseUpOnParagraph = (
    paragraphIndex: number,
    paragraphText: string,
    e: React.MouseEvent<HTMLParagraphElement>
  ) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      // Handle single-word click lookup if toggled on
      if (clickLookupEnabled) {
        const target = e.target as HTMLElement;
        if (target.dataset.wordToken) {
          const clean = target.dataset.wordToken;
          onLookupWord(clean, paragraphText, { x: e.clientX, y: e.clientY });
        }
      }
      return;
    }

    const range = sel.getRangeAt(0);
    const offsets = getSelectionOffsetsWithinElement(e.currentTarget, range);
    if (!offsets) return;

    const selectedText = paragraphText
      .slice(offsets.start, offsets.end)
      .trim();
    if (!selectedText) return;

    const rect = range.getBoundingClientRect();
    setSelectionDraft({
      paragraphIndex,
      startOffset: offsets.start,
      endOffset: offsets.end,
      selectedText,
      contextSentence: paragraphText,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setNoteInputOpen(false);
    setDraftNoteText('');
    setActiveHighlightId(null);
  };

  const commitHighlight = (color: HighlightColor, note?: string) => {
    if (!selectionDraft) return;
    onAddHighlight({
      passageId: passage.id,
      paragraphIndex: selectionDraft.paragraphIndex,
      startOffset: selectionDraft.startOffset,
      endOffset: selectionDraft.endOffset,
      selectedText: selectionDraft.selectedText,
      color,
      note: note?.trim() || undefined,
    });
    window.getSelection()?.removeAllRanges();
    setSelectionDraft(null);
    setNoteInputOpen(false);
  };

  const renderParagraphContent = (
    paragraphIndex: number,
    paragraphText: string
  ) => {
    const paraHighlights = highlights
      .filter(
        (h) => h.passageId === passage.id && h.paragraphIndex === paragraphIndex
      )
      .sort((a, b) => a.startOffset - b.startOffset);

    // Also build virtual ranges for post-submit evidence quotes
    const nonOverlapping: Array<{
      start: number;
      end: number;
      highlight?: HighlightRange;
      isEvidence?: boolean;
    }> = [];

    let cursor = 0;
    for (const h of paraHighlights) {
      const start = Math.max(cursor, Math.min(h.startOffset, paragraphText.length));
      const end = Math.max(start, Math.min(h.endOffset, paragraphText.length));
      if (end > start) {
        nonOverlapping.push({ start, end, highlight: h });
        cursor = end;
      }
    }

    if (nonOverlapping.length === 0 && evidenceQuotes.length > 0) {
      for (const quote of evidenceQuotes) {
        if (!quote || quote.length < 6) continue;
        const idx = paragraphText.toLowerCase().indexOf(quote.toLowerCase());
        if (idx > -1) {
          nonOverlapping.push({
            start: idx,
            end: idx + quote.length,
            isEvidence: true,
          });
          break;
        }
      }
    }

    const renderPlainTokens = (slice: string, keyPrefix: string) => {
      if (!clickLookupEnabled) return slice;
      return slice.split(/(\s+)/).map((part, idx) => {
        if (!part.trim()) return part;
        const clean = part.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
        if (!clean) return part;
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            data-word-token={clean}
            className="cursor-pointer hover:underline hover:decoration-indigo-500 hover:decoration-2"
          >
            {part}
          </span>
        );
      });
    };

    if (nonOverlapping.length === 0) {
      return renderPlainTokens(paragraphText, `p${paragraphIndex}-raw`);
    }

    const nodes: React.ReactNode[] = [];
    let pos = 0;
    nonOverlapping.forEach((seg, idx) => {
      if (seg.start > pos) {
        nodes.push(
          <React.Fragment key={`plain-${idx}`}>
            {renderPlainTokens(
              paragraphText.slice(pos, seg.start),
              `p${paragraphIndex}-${idx}`
            )}
          </React.Fragment>
        );
      }

      const sliceText = paragraphText.slice(seg.start, seg.end);
      if (seg.highlight) {
        const h = seg.highlight;
        nodes.push(
          <mark
            key={h.id}
            onClick={(ev) => {
              ev.stopPropagation();
              setActiveHighlightId(h.id);
              setEditingNoteText(h.note || '');
            }}
            title={h.note ? `Ghi chú: ${h.note}` : 'Nhấn để thêm ghi chú hoặc xóa'}
            className={`${COLOR_STYLES[h.color]} cursor-pointer relative inline`}
          >
            {sliceText}
            {h.note && (
              <span className="ml-0.5 inline-flex items-center align-super text-[10px] font-bold text-indigo-800 bg-white/80 rounded px-0.5 border border-indigo-300">
                Note
              </span>
            )}
          </mark>
        );
      } else if (seg.isEvidence) {
        nodes.push(
          <mark
            key={`ev-${idx}`}
            className="bg-sky-200 text-slate-950 rounded px-0.5 ring-1 ring-sky-500"
          >
            {sliceText}
          </mark>
        );
      }

      pos = seg.end;
    });

    if (pos < paragraphText.length) {
      nodes.push(
        <React.Fragment key="tail">
          {renderPlainTokens(
            paragraphText.slice(pos),
            `p${paragraphIndex}-tail`
          )}
        </React.Fragment>
      );
    }

    return nodes;
  };

  const activeHighlight = highlights.find((h) => h.id === activeHighlightId);

  const labelColor =
    contrastMode === 'light'
      ? 'text-slate-900'
      : contrastMode === 'dark'
        ? 'text-sky-300'
        : 'text-yellow-300';

  return (
    <div ref={containerRef} className="relative space-y-5 leading-relaxed">
      <div className="border-b border-current/15 pb-3">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">
          Reading Passage {passage.passageNumber}
        </span>
        <h2 className="mt-1 text-xl font-bold">{passage.title}</h2>
        {passage.subtitle && (
          <p className="mt-1 text-xs opacity-75 italic">{passage.subtitle}</p>
        )}
      </div>

      {passage.paragraphs.map((para, pIdx) => (
        <p
          key={`${passage.id}-p-${pIdx}`}
          onMouseUp={(e) => handleMouseUpOnParagraph(pIdx, para.text, e)}
          className={`${fontSizeClass} leading-[1.75] select-text`}
        >
          {para.label && (
            <span className={`mr-2.5 font-extrabold ${labelColor}`}>
              {para.label}
            </span>
          )}
          {renderParagraphContent(pIdx, para.text)}
        </p>
      ))}

      {/* Floating Selection Toolbar (Highlight + Note + Dictionary) */}
      {selectionDraft && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(Math.max(12, selectionDraft.x - 145), window.innerWidth - 320)}px`,
            top: `${Math.max(12, selectionDraft.y - (noteInputOpen ? 130 : 54))}px`,
            zIndex: 55,
          }}
          className="rounded-xl border border-slate-300 bg-slate-900 text-white p-2 shadow-2xl"
        >
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 text-[11px] font-medium text-slate-300 flex items-center gap-1">
              <Highlighter className="h-3 w-3" />
              Bôi đen:
            </span>
            <button
              type="button"
              onClick={() => commitHighlight('yellow')}
              title="Highlight Vàng"
              className="h-6 w-6 rounded-full bg-yellow-300 border-2 border-white hover:scale-110 transition"
            />
            <button
              type="button"
              onClick={() => commitHighlight('green')}
              title="Highlight Xanh lá"
              className="h-6 w-6 rounded-full bg-emerald-300 border-2 border-white hover:scale-110 transition"
            />
            <button
              type="button"
              onClick={() => commitHighlight('pink')}
              title="Highlight Hồng"
              className="h-6 w-6 rounded-full bg-pink-300 border-2 border-white hover:scale-110 transition"
            />

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={() => setNoteInputOpen((o) => !o)}
              className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-xs font-medium hover:bg-slate-700"
            >
              <StickyNote className="h-3.5 w-3.5 text-amber-300" />
              Ghi chú
            </button>

            <button
              type="button"
              onClick={() => {
                const firstWord = selectionDraft.selectedText.split(/\s+/)[0];
                onLookupWord(
                  firstWord || selectionDraft.selectedText,
                  selectionDraft.contextSentence,
                  { x: selectionDraft.x, y: selectionDraft.y + 20 }
                );
                setSelectionDraft(null);
              }}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium hover:bg-indigo-500"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Tra từ
            </button>
          </div>

          {noteInputOpen && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-slate-700 pt-2">
              <input
                type="text"
                autoFocus
                value={draftNoteText}
                onChange={(e) => setDraftNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitHighlight('yellow', draftNoteText);
                  }
                }}
                placeholder="Nhập ghi chú đoạn này..."
                className="w-52 rounded bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={() => commitHighlight('yellow', draftNoteText)}
                className="rounded bg-amber-400 px-2 py-1 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                Lưu
              </button>
            </div>
          )}
        </div>
      )}

      {/* Existing Highlight Inspector Bar */}
      {activeHighlight && (
        <div className="sticky bottom-2 z-40 rounded-xl border border-indigo-200 bg-white p-3 text-slate-900 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs">
              <span className="font-semibold text-indigo-700">
                Đoạn đang chọn:{' '}
              </span>
              <span className="italic text-slate-600">
                "{activeHighlight.selectedText.slice(0, 80)}
                {activeHighlight.selectedText.length > 80 ? '...' : ''}"
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onRemoveHighlight(activeHighlight.id);
                setActiveHighlightId(null);
              }}
              className="flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa highlight
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={editingNoteText}
              onChange={(e) => setEditingNoteText(e.target.value)}
              placeholder="Thêm hoặc chỉnh sửa ghi chú cho đoạn bôi đen này..."
              className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                onUpdateHighlightNote(activeHighlight.id, editingNoteText);
                setActiveHighlightId(null);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Lưu Note
            </button>
            <button
              type="button"
              onClick={() => setActiveHighlightId(null)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
