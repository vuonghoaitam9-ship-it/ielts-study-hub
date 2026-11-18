import { describe, expect, it } from 'vitest';
import { parseIeltsDocument } from '../lib/documentParser';

describe('documentParser', () => {
  it('parses a reading passage, TFNG/MCQ/Gap Fill questions, and answer key with explanations', () => {
    const sampleDoc = `
READING PASSAGE 1
Urban Microclimates in Coastal Cities

A. Coastal cities often experience milder temperature swings due to oceanic thermal inertia.

B. Recent sensors revealed that asphalt avenues trap radiant heat long after sunset.

Questions 1-3
Do the following statements agree with the information given in the passage? TRUE / FALSE / NOT GIVEN
1. Coastal cities experience extreme temperature swings every afternoon.
2. Asphalt roads release trapped heat immediately before sunset.

Choose the correct letter, A, B, C or D.
3. What reduces extreme swings in coastal cities?
A. Concrete towers
B. Oceanic thermal inertia
C. Underground tunnels
D. Mountain wind

ANSWER KEY
1. FALSE — Đoạn A nói milder temperature swings chứ không phải extreme.
2. FALSE — Đoạn B ghi "long after sunset".
3. B | Evidence: due to oceanic thermal inertia
`;

    const parsed = parseIeltsDocument({
      skill: 'reading',
      mainText: sampleDoc,
    });

    expect(parsed.passages.length).toBe(1);
    expect(parsed.passages[0].paragraphs.length).toBe(2);
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0].type).toBe('tfng');
    expect(parsed.questions[0].acceptedAnswers).toEqual(['FALSE']);
    expect(parsed.questions[2].type).toBe('mcq');
    expect(parsed.questions[2].options).toHaveLength(4);
    expect(parsed.questions[2].acceptedAnswers).toEqual(['B']);
    expect(parsed.questions[2].evidenceQuote).toBe(
      'due to oceanic thermal inertia'
    );
    expect(parsed.hasFormatErrors).toBe(false);
  });

  it('emits clear warnings without fabricating answers when answer key or questions are missing', () => {
    const incompleteDoc = `
READING PASSAGE 1
A. Only passage text is provided here with no numbered questions or key.
`;

    const parsed = parseIeltsDocument({
      skill: 'reading',
      mainText: incompleteDoc,
    });

    expect(parsed.questions).toHaveLength(0);
    expect(parsed.hasFormatErrors).toBe(true);
    expect(parsed.parseWarnings.length).toBeGreaterThan(0);
  });

  it('parses separate transcript parts and separate answer key for Listening', () => {
    const questionsText = `
PART 1
Questions 1-2
ONE WORD AND/OR A NUMBER
1. Contact postcode: __________
2. Monthly fee: __________ pounds
`;
    const transcriptText = `
PART 1
Clerk: Welcome! What is your postcode?
Member: It is E14 9AB and the monthly fee is 45 pounds.
`;
    const keyText = `
1. E14 9AB
2. 45
`;

    const parsed = parseIeltsDocument({
      skill: 'listening',
      title: 'Gym Registration',
      mainText: questionsText,
      transcriptText,
      answerKeyText: keyText,
    });

    expect(parsed.listeningParts).toHaveLength(1);
    expect(parsed.listeningParts[0].lines).toHaveLength(2);
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].acceptedAnswers).toEqual(['E14 9AB']);
    expect(parsed.questions[1].acceptedAnswers).toEqual(['45']);
    expect(parsed.hasFormatErrors).toBe(false);
  });
});
