import { VocabCard } from '../types';

export type Sm2Rating = 1 | 2 | 3 | 4; // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

export interface Sm2ReviewOutcome {
  repetition: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: string;
}

export function addDaysToISODate(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function getTodayLocalISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapRatingToQuality(rating: Sm2Rating): number {
  switch (rating) {
    case 1:
      return 1; // Again -> failed recall (<3)
    case 2:
      return 3; // Hard -> pass with difficulty
    case 3:
      return 4; // Good -> standard recall
    case 4:
      return 5; // Easy -> instant recall
  }
}

export function calculateSm2(
  card: Pick<VocabCard, 'repetition' | 'interval' | 'easeFactor'>,
  rating: Sm2Rating,
  todayISO: string = getTodayLocalISODate()
): Sm2ReviewOutcome {
  const quality = mapRatingToQuality(rating);
  let { repetition, interval, easeFactor } = card;

  if (quality < 3) {
    // Failed recall: reset repetitions and schedule for next day review (while current session may re-queue)
    repetition = 0;
    interval = 1;
  } else {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }

    if (rating === 2) {
      // Hard modifier keeps interval shorter than Good
      interval = Math.max(1, Math.round(interval * 0.8));
    } else if (rating === 4) {
      // Easy modifier gives a 30% interval boost
      interval = Math.max(interval + 1, Math.round(interval * 1.3));
    }

    repetition += 1;
  }

  const nextEase =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Number(Math.max(1.3, nextEase).toFixed(2));

  return {
    repetition,
    interval,
    easeFactor,
    nextReviewDate: addDaysToISODate(todayISO, interval),
  };
}

export function previewSm2Intervals(
  card: Pick<VocabCard, 'repetition' | 'interval' | 'easeFactor'>,
  todayISO: string = getTodayLocalISODate()
): Record<Sm2Rating, number> {
  return {
    1: calculateSm2(card, 1, todayISO).interval,
    2: calculateSm2(card, 2, todayISO).interval,
    3: calculateSm2(card, 3, todayISO).interval,
    4: calculateSm2(card, 4, todayISO).interval,
  };
}

export function createNewVocabCard(input: {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaningVi: string;
  definitionEn?: string;
  contextSentence?: string;
  sourceLabel?: string;
  topicTag?: string;
  todayISO?: string;
}): VocabCard {
  const today = input.todayISO ?? getTodayLocalISODate();
  return {
    id: input.id,
    word: input.word.trim(),
    phonetic: input.phonetic?.trim(),
    partOfSpeech: input.partOfSpeech?.trim(),
    meaningVi: input.meaningVi.trim(),
    definitionEn: input.definitionEn?.trim(),
    contextSentence: input.contextSentence?.trim(),
    sourceLabel: input.sourceLabel?.trim(),
    topicTag: input.topicTag?.trim(),
    repetition: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewDate: today,
    createdAt: new Date().toISOString(),
  };
}
