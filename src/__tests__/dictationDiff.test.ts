import { describe, expect, it } from 'vitest';
import { diffDictationWords, getDictationHint } from '../lib/dictationDiff';

describe('dictationDiff', () => {
  it('returns 100% accuracy for identical sentences ignoring outer punctuation/case', () => {
    const res = diffDictationWords(
      'Urban corridors retain thermal radiation after sunset.',
      'urban corridors retain thermal radiation after sunset'
    );
    expect(res.accuracyPercent).toBe(100);
    expect(res.correctCount).toBe(7);
    expect(res.misspelledCount).toBe(0);
    expect(res.missingCount).toBe(0);
    expect(res.extraCount).toBe(0);
  });

  it('distinguishes correct, misspelled, missing, and extra words cleanly', () => {
    const res = diffDictationWords(
      'Incorporating permeable pavements reduces surface warmth.',
      'Incorprating pavements really reduces surfce warmt'
    );
    expect(res.tokens.some((t) => t.status === 'misspelled')).toBe(true);
    expect(res.tokens.some((t) => t.status === 'missing' && t.expectedWord === 'permeable')).toBe(true);
    expect(res.tokens.some((t) => t.status === 'extra' && t.actualWord === 'really')).toBe(true);
    expect(res.tokens.some((t) => t.status === 'correct' && t.expectedWord === 'reduces')).toBe(true);
    expect(res.accuracyPercent).toBeGreaterThan(0);
    expect(res.accuracyPercent).toBeLessThan(100);
  });

  it('provides next character and next word hints sequentially', () => {
    const expected = 'Coastal samples contained microfibers.';
    expect(getDictationHint(expected, 'Coastal', 'word')).toBe(
      'Coastal samples '
    );
    expect(getDictationHint(expected, 'Coastal sam', 'char')).toBe(
      'Coastal samp'
    );
  });
});
