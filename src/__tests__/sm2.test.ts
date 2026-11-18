import { describe, expect, it } from 'vitest';
import { calculateSm2, createNewVocabCard } from '../lib/sm2';

describe('sm2 spaced repetition', () => {
  it('advances interval 1 -> 6 -> ~15 days on consecutive Good ratings', () => {
    const card = createNewVocabCard({
      id: 'c1',
      word: 'mitigate',
      meaningVi: 'làm giảm nhẹ',
      todayISO: '2026-11-18',
    });

    const r1 = calculateSm2(card, 3, '2026-11-18');
    expect(r1.repetition).toBe(1);
    expect(r1.interval).toBe(1);
    expect(r1.nextReviewDate).toBe('2026-11-19');

    const r2 = calculateSm2(r1, 3, '2026-11-19');
    expect(r2.repetition).toBe(2);
    expect(r2.interval).toBe(6);
    expect(r2.nextReviewDate).toBe('2026-11-25');

    const r3 = calculateSm2(r2, 3, '2026-11-25');
    expect(r3.repetition).toBe(3);
    expect(r3.interval).toBeGreaterThan(10);
  });

  it('resets repetition and clamps easeFactor >= 1.3 on repeated Again ratings', () => {
    let state = { repetition: 4, interval: 20, easeFactor: 1.4 };
    const r = calculateSm2(state, 1, '2026-11-18');
    expect(r.repetition).toBe(0);
    expect(r.interval).toBe(1);
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
