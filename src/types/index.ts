export type SkillType = 'listening' | 'reading' | 'writing';

export type QuestionType =
  | 'tfng'
  | 'ynng'
  | 'mcq'
  | 'gap_fill'
  | 'matching_headings'
  | 'matching_info'
  | 'short_answer';

export interface UserProfile {
  examModule: 'Academic';
  currentBandRange: string;
  currentBandNumeric: number;
  targetBandRange: string;
  targetBandNumeric: number;
  dailyStudyHours: number;
  startDateISO: string; // Default: '2026-11-18'
  examDateISO: string; // Default: '2027-02-14'
  uiLanguage: 'vi-en' | 'en';
}

export interface ReadingParagraph {
  label?: string; // e.g., "A", "B", "C"
  text: string;
}

export interface ReadingPassage {
  id: string;
  passageNumber: number; // 1 | 2 | 3
  title: string;
  subtitle?: string;
  paragraphs: ReadingParagraph[];
}

export interface ListeningTranscriptLine {
  id: string;
  speaker?: string;
  text: string;
  startTime?: number;
  endTime?: number;
  targetQuestionNumber?: number;
  highlightKeyword?: string;
}

export interface ListeningPart {
  partNumber: number; // 1 | 2 | 3 | 4
  title: string;
  context?: string;
  audioBlobId?: string;
  audioUrl?: string;
  lines: ListeningTranscriptLine[];
}

export interface QuestionItem {
  id: string;
  questionNumber: number;
  sectionNumber: number; // Passage 1-3 or Part 1-4
  type: QuestionType;
  instruction?: string;
  prompt: string;
  options?: string[];
  acceptedAnswers: string[]; // First item is primary answer
  explanation: string;
  evidenceQuote?: string;
}

export interface IeltsTest {
  id: string;
  title: string;
  skill: 'reading' | 'listening';
  sourceType: 'demo' | 'parsed' | 'manual';
  isDemo: boolean;
  sourceFileName?: string;
  createdAt: string;
  durationMinutes: number;
  passages?: ReadingPassage[];
  listeningParts?: ListeningPart[];
  fullAudioBlobId?: string;
  fullAudioUrl?: string;
  questions: QuestionItem[];
  parseWarnings?: string[];
}

export interface MediaBlobRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export type HighlightColor = 'yellow' | 'green' | 'pink';

export interface HighlightRange {
  id: string;
  passageId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  testTitle: string;
  skill: 'reading' | 'listening';
  submittedAt: string;
  durationSeconds: number;
  score: number;
  totalQuestions: number;
  estimatedBand: number;
  userAnswers: Record<number, string>;
  questionResults: Record<number, boolean>;
  highlights?: HighlightRange[];
}

export interface DictationSegment {
  id: string;
  index: number;
  partNumber: number;
  speaker?: string;
  startTime: number;
  endTime: number;
  transcript: string;
}

export interface DictationSet {
  id: string;
  title: string;
  isDemo: boolean;
  linkedTestId?: string;
  audioBlobId?: string;
  audioUrl?: string;
  createdAt: string;
  segments: DictationSegment[];
}

export interface VocabCard {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaningVi: string;
  definitionEn?: string;
  contextSentence?: string;
  sourceLabel?: string;
  topicTag?: string;
  repetition: number;
  interval: number; // days
  easeFactor: number;
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
  createdAt: string;
}

export interface ErrorLogItem {
  id: string;
  attemptId: string;
  testId: string;
  testTitle: string;
  skill: 'reading' | 'listening';
  questionNumber: number;
  questionType: QuestionType;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  evidenceQuote?: string;
  personalNote: string;
  mastered: boolean;
  createdAt: string;
}

export interface RoadmapTaskCompletion {
  taskId: string;
  completedAt: string;
}

export interface DailyStudyLog {
  dateISO: string; // YYYY-MM-DD
  minutesStudied: number;
  sessionsCount: number;
}

export type RoadmapTaskCategory =
  | 'listening'
  | 'dictation'
  | 'reading'
  | 'writing'
  | 'vocab'
  | 'review';

export interface RoadmapTask {
  id: string;
  dayNumber: number; // 1..88
  dateISO: string;
  phaseId: 1 | 2 | 3;
  title: string;
  description: string;
  category: RoadmapTaskCategory;
  targetRoute: string;
  estimatedMinutes: number;
  isMilestone?: boolean;
}

export interface RoadmapDay {
  dayNumber: number;
  dateISO: string;
  weekNumber: number;
  phaseId: 1 | 2 | 3;
  focusTitle: string;
  tasks: RoadmapTask[];
  totalMinutes: number;
}

export interface RoadmapPhase {
  id: 1 | 2 | 3;
  name: string;
  englishSubtitle: string;
  description: string;
  startDay: number;
  endDay: number;
  startDateISO: string;
  endDateISO: string;
  colorClass: string;
}

export interface StudyRoadmap {
  startDateISO: string;
  examDateISO: string;
  totalDays: number;
  daysRemainingFromReference: number;
  totalWeeks: number;
  phases: RoadmapPhase[];
  days: RoadmapDay[];
}

export interface DictionaryEntry {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  definitionEn: string;
  example: string;
  topicTag?: string;
  audioUrl?: string;
}

export * from './volumes';
