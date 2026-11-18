export type WordDiffStatus = 'correct' | 'misspelled' | 'missing' | 'extra';

export interface WordDiffToken {
  status: WordDiffStatus;
  expectedWord?: string;
  actualWord?: string;
}

export interface DictationDiffResult {
  tokens: WordDiffToken[];
  accuracyPercent: number;
  correctCount: number;
  misspelledCount: number;
  missingCount: number;
  extraCount: number;
  totalExpected: number;
}

interface ParsedToken {
  raw: string;
  normalized: string;
}

function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '')
    .replace(/[’‘]/g, "'");
}

function tokenizeWords(input: string): ParsedToken[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({
      raw,
      normalized: normalizeToken(raw),
    }))
    .filter((t) => t.normalized.length > 0 || t.raw.length > 0);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function isSimilarSpelling(expectedNorm: string, actualNorm: string): boolean {
  if (!expectedNorm || !actualNorm) return false;
  const maxLen = Math.max(expectedNorm.length, actualNorm.length);
  const dist = levenshteinDistance(expectedNorm, actualNorm);
  if (maxLen <= 4) {
    return dist <= 1 || dist / maxLen <= 0.5;
  }
  const similarity = 1 - dist / maxLen;
  return similarity >= 0.45;
}

function emitGapTokens(
  expSlice: ParsedToken[],
  actSlice: ParsedToken[],
  out: WordDiffToken[]
): void {
  let i = 0;
  let j = 0;
  while (i < expSlice.length && j < actSlice.length) {
    if (isSimilarSpelling(expSlice[i].normalized, actSlice[j].normalized)) {
      out.push({
        status: 'misspelled',
        expectedWord: expSlice[i].raw,
        actualWord: actSlice[j].raw,
      });
      i++;
      j++;
    } else if (expSlice.length - i > actSlice.length - j) {
      out.push({
        status: 'missing',
        expectedWord: expSlice[i].raw,
      });
      i++;
    } else if (actSlice.length - j > expSlice.length - i) {
      out.push({
        status: 'extra',
        actualWord: actSlice[j].raw,
      });
      j++;
    } else {
      out.push({
        status: 'misspelled',
        expectedWord: expSlice[i].raw,
        actualWord: actSlice[j].raw,
      });
      i++;
      j++;
    }
  }

  while (i < expSlice.length) {
    out.push({ status: 'missing', expectedWord: expSlice[i].raw });
    i++;
  }
  while (j < actSlice.length) {
    out.push({ status: 'extra', actualWord: actSlice[j].raw });
    j++;
  }
}

export function diffDictationWords(
  expectedText: string,
  actualText: string
): DictationDiffResult {
  const expTokens = tokenizeWords(expectedText);
  const actTokens = tokenizeWords(actualText);

  const m = expTokens.length;
  const n = actTokens.length;

  if (m === 0 && n === 0) {
    return {
      tokens: [],
      accuracyPercent: 100,
      correctCount: 0,
      misspelledCount: 0,
      missingCount: 0,
      extraCount: 0,
      totalExpected: 0,
    };
  }

  // Standard LCS table to align matching words
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (expTokens[i].normalized === actTokens[j].normalized) {
        lcs[i][j] = 1 + lcs[i + 1][j + 1];
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const anchors: Array<{ expIdx: number; actIdx: number }> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (expTokens[i].normalized === actTokens[j].normalized) {
      anchors.push({ expIdx: i, actIdx: j });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const tokens: WordDiffToken[] = [];
  let prevExp = 0;
  let prevAct = 0;

  for (const anchor of anchors) {
    emitGapTokens(
      expTokens.slice(prevExp, anchor.expIdx),
      actTokens.slice(prevAct, anchor.actIdx),
      tokens
    );
    tokens.push({
      status: 'correct',
      expectedWord: expTokens[anchor.expIdx].raw,
      actualWord: actTokens[anchor.actIdx].raw,
    });
    prevExp = anchor.expIdx + 1;
    prevAct = anchor.actIdx + 1;
  }

  emitGapTokens(expTokens.slice(prevExp), actTokens.slice(prevAct), tokens);

  const correctCount = tokens.filter((t) => t.status === 'correct').length;
  const misspelledCount = tokens.filter((t) => t.status === 'misspelled').length;
  const missingCount = tokens.filter((t) => t.status === 'missing').length;
  const extraCount = tokens.filter((t) => t.status === 'extra').length;

  const accuracyPercent =
    m === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((correctCount - extraCount * 0.25) / m) * 100
            )
          )
        );

  return {
    tokens,
    accuracyPercent,
    correctCount,
    misspelledCount,
    missingCount,
    extraCount,
    totalExpected: m,
  };
}

/**
 * Provides the next expected word or character to assist learners when stuck.
 */
export function getDictationHint(
  expectedText: string,
  actualText: string,
  mode: 'char' | 'word'
): string {
  const expClean = expectedText.trim();
  const actClean = actualText;

  if (!expClean) return '';

  // Find longest matching case-insensitive prefix or word boundary
  const expWords = expClean.split(/\s+/);
  const actWords = actClean.trim() ? actClean.trim().split(/\s+/) : [];

  let matchIndex = 0;
  while (
    matchIndex < expWords.length &&
    matchIndex < actWords.length &&
    normalizeToken(expWords[matchIndex]) === normalizeToken(actWords[matchIndex])
  ) {
    matchIndex++;
  }

  if (matchIndex >= expWords.length) {
    return expClean;
  }

  const targetWord = expWords[matchIndex];
  const currentTypedWord = actWords[matchIndex] ?? '';

  if (mode === 'word') {
    const prefix = expWords.slice(0, matchIndex + 1).join(' ');
    return prefix + ' ';
  }

  // mode === 'char': reveal one more character of the target word
  const cleanTarget = targetWord;
  const nextLen = Math.min(cleanTarget.length, currentTypedWord.length + 1);
  const partialWord = cleanTarget.slice(0, nextLen);
  const prefixWords = [...expWords.slice(0, matchIndex), partialWord];
  return prefixWords.join(' ');
}
