import { describe, expect, it } from 'vitest';
import {
  convertRawScoreToBand,
  gradeTestAttempt,
  isAnswerCorrect,
} from '../lib/grading';
import { QuestionItem } from '../types';

describe('grading & band conversion', () => {
  it('maps standard 40-question IELTS Academic Reading & Listening scores accurately', () => {
    expect(convertRawScoreToBand('reading', 30, 40).band).toBe(7.0);
    expect(convertRawScoreToBand('reading', 23, 40).band).toBe(6.0);
    expect(convertRawScoreToBand('listening', 32, 40).band).toBe(7.5);
    expect(convertRawScoreToBand('listening', 26, 40).band).toBe(6.5);
  });

  it('scales custom/demo question counts cleanly and grades variants', () => {
    const questions: QuestionItem[] = [
      {
        id: '1',
        questionNumber: 1,
        sectionNumber: 1,
        type: 'tfng',
        prompt: 'Statement 1',
        acceptedAnswers: ['TRUE'],
        explanation: '',
      },
      {
        id: '2',
        questionNumber: 2,
        sectionNumber: 1,
        type: 'gap_fill',
        prompt: 'Blank 2',
        acceptedAnswers: ['17 | 17th'],
        explanation: '',
      },
      {
        id: '3',
        questionNumber: 3,
        sectionNumber: 1,
        type: 'mcq',
        prompt: 'MCQ 3',
        acceptedAnswers: ['B'],
        explanation: '',
      },
    ];

    expect(isAnswerCorrect(questions[0], 't')).toBe(true);
    expect(isAnswerCorrect(questions[1], '17th')).toBe(true);
    expect(isAnswerCorrect(questions[2], 'B. Option text')).toBe(true);

    const graded = gradeTestAttempt('reading', questions, {
      1: 'TRUE',
      2: '17',
      3: 'A',
    });

    expect(graded.score).toBe(2);
    expect(graded.totalQuestions).toBe(3);
    expect(graded.questionResults[1]).toBe(true);
    expect(graded.questionResults[2]).toBe(true);
    expect(graded.questionResults[3]).toBe(false);
    expect(graded.bandInfo.isScaled).toBe(true);
    expect(graded.bandInfo.band).toBe(6.5); // 2/3 * 40 = 27 -> Band 6.5
  });
});
