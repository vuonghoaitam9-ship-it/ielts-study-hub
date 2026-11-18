import { QuestionItem, QuestionType } from '../types';

export interface BandConversionResult {
  rawScore: number;
  totalQuestions: number;
  scaledOutOf40: number;
  band: number;
  isScaled: boolean;
}

const ACADEMIC_READING_TABLE: Array<{ min: number; band: number }> = [
  { min: 39, band: 9.0 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8.0 },
  { min: 33, band: 7.5 },
  { min: 30, band: 7.0 },
  { min: 27, band: 6.5 },
  { min: 23, band: 6.0 },
  { min: 19, band: 5.5 },
  { min: 15, band: 5.0 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4.0 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3.0 },
  { min: 4, band: 2.5 },
];

const LISTENING_TABLE: Array<{ min: number; band: number }> = [
  { min: 39, band: 9.0 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8.0 },
  { min: 32, band: 7.5 },
  { min: 30, band: 7.0 },
  { min: 26, band: 6.5 },
  { min: 23, band: 6.0 },
  { min: 18, band: 5.5 },
  { min: 16, band: 5.0 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4.0 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3.0 },
  { min: 4, band: 2.5 },
];

export function convertRawScoreToBand(
  skill: 'reading' | 'listening',
  rawScore: number,
  totalQuestions: number
): BandConversionResult {
  const safeTotal = Math.max(1, totalQuestions);
  const isScaled = safeTotal !== 40;
  const scaledOutOf40 = isScaled
    ? Math.round((rawScore / safeTotal) * 40)
    : rawScore;

  const table = skill === 'reading' ? ACADEMIC_READING_TABLE : LISTENING_TABLE;
  let band = 2.0;
  if (scaledOutOf40 === 0) {
    band = 0;
  } else {
    for (const row of table) {
      if (scaledOutOf40 >= row.min) {
        band = row.band;
        break;
      }
    }
  }

  return {
    rawScore,
    totalQuestions: safeTotal,
    scaledOutOf40,
    band,
    isScaled,
  };
}

function normalizeAnswerString(val: string, type: QuestionType): string {
  let clean = val
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\(\[]+/, '')
    .replace(/[\.\,\;\:\!\?\)\]]+$/, '')
    .trim();

  if (type === 'tfng') {
    if (clean === 't' || clean === 'true') return 'true';
    if (clean === 'f' || clean === 'false') return 'false';
    if (clean === 'ng' || clean === 'notgiven' || clean === 'not given') {
      return 'not given';
    }
  }

  if (type === 'ynng') {
    if (clean === 'y' || clean === 'yes') return 'yes';
    if (clean === 'n' || clean === 'no') return 'no';
    if (clean === 'ng' || clean === 'notgiven' || clean === 'not given') {
      return 'not given';
    }
  }

  if (type === 'mcq' || type === 'matching_info' || type === 'matching_headings') {
    // Allow matching "a" with "a. acoustic panels..." or "iv" with "iv. heading..."
    const leadingChoice = clean.match(/^([a-z]|[ivx]{1,5})(?:[\.\)\:\s]|$)/i);
    if (leadingChoice && clean.length > leadingChoice[1].length) {
      // keep option both ways during comparison
      return leadingChoice[1].toLowerCase();
    }
  }

  return clean;
}

export function isAnswerCorrect(
  question: QuestionItem,
  userAnswer: string | undefined
): boolean {
  if (!userAnswer || !userAnswer.trim()) return false;
  if (!question.acceptedAnswers || question.acceptedAnswers.length === 0) {
    return false;
  }

  const normalizedUser = normalizeAnswerString(userAnswer, question.type);
  const rawUserTrimmed = userAnswer.trim().toLowerCase().replace(/\s+/g, ' ');

  for (const rawCandidate of question.acceptedAnswers) {
    // Expand slash / pipe separated variants if stored as one string
    const variants = rawCandidate
      .split(/\s*[|/]\s*/)
      .map((v) => v.trim())
      .filter(Boolean);

    for (const variant of variants) {
      const normVariant = normalizeAnswerString(variant, question.type);
      if (normalizedUser === normVariant) return true;
      if (rawUserTrimmed === variant.toLowerCase().replace(/\s+/g, ' ')) {
        return true;
      }
      // Accept plural/singular minor match only if exact numeric/alphanumeric or spelling matches
      // Handle British/American common equivalents if needed (not overly permissive)
      if (
        question.type === 'mcq' &&
        normalizedUser.length === 1 &&
        variant.toLowerCase().startsWith(`${normalizedUser}.`)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function gradeTestAttempt(
  skill: 'reading' | 'listening',
  questions: QuestionItem[],
  userAnswers: Record<number, string>
): {
  score: number;
  totalQuestions: number;
  questionResults: Record<number, boolean>;
  bandInfo: BandConversionResult;
} {
  const questionResults: Record<number, boolean> = {};
  let score = 0;

  for (const q of questions) {
    const correct = isAnswerCorrect(q, userAnswers[q.questionNumber]);
    questionResults[q.questionNumber] = correct;
    if (correct) score++;
  }

  const bandInfo = convertRawScoreToBand(skill, score, questions.length);
  return {
    score,
    totalQuestions: questions.length,
    questionResults,
    bandInfo,
  };
}

export function getQuestionTypeLabel(type: QuestionType): string {
  switch (type) {
    case 'tfng':
      return 'True / False / Not Given';
    case 'ynng':
      return 'Yes / No / Not Given';
    case 'mcq':
      return 'Multiple Choice';
    case 'gap_fill':
      return 'Gap Fill / Note Completion';
    case 'matching_headings':
      return 'Matching Headings';
    case 'matching_info':
      return 'Matching Information / Features';
    case 'short_answer':
      return 'Short Answer';
  }
}
