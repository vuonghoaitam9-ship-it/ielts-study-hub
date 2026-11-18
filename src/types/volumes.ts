import { QuestionItem, ReadingPassage } from './index';

export type VolReadingStatus = 'ready' | 'scanned_pdf' | 'missing';

export type VolListeningStatus =
  | 'ready'
  | 'scanned_questions_with_audio'
  | 'wma_unsupported'
  | 'missing_audio'
  | 'missing';

export type VolTranscriptStatus = 'ready' | 'missing';

export type VolDictationStatus =
  | 'ready'
  | 'needs_timestamps'
  | 'missing_audio'
  | 'missing';

export type VolWritingStatus = 'ready' | 'image_or_scan_only' | 'missing';

export interface VolReadingSection {
  status: VolReadingStatus;
  sourceFiles: string[];
  originalPdfUrl?: string;
  passages: ReadingPassage[];
  questions: QuestionItem[];
  hasAnswerKey: boolean;
  notes?: string;
}

export interface VolListeningPart {
  partNumber: 1 | 2 | 3 | 4;
  title: string;
  audioSrc?: string;
  originalAudioFile?: string;
  isWmaUnsupported?: boolean;
  duration?: number;
  questions: QuestionItem[];
}

export interface VolListeningSection {
  status: VolListeningStatus;
  fullAudioSrc?: string;
  originalPdfUrl?: string;
  parts: VolListeningPart[];
  hasAnswerKey: boolean;
  sourceFiles: string[];
  notes?: string;
}

export interface VolTranscriptSegment {
  id: string;
  partNumber: 1 | 2 | 3 | 4;
  index: number;
  startTime?: number;
  endTime?: number;
  speaker?: string;
  text: string;
  answerRef?: number;
  highlightKeyword?: string;
}

export interface VolTranscriptSection {
  status: VolTranscriptStatus;
  hasExactTimestamps: boolean;
  parts: Array<{
    partNumber: 1 | 2 | 3 | 4;
    title: string;
    segments: VolTranscriptSegment[];
  }>;
  sourceFiles: string[];
  originalPdfUrl?: string;
  notes?: string;
}

export interface VolDictationSegment {
  id: string;
  index: number;
  partNumber: 1 | 2 | 3 | 4;
  speaker?: string;
  startTime?: number;
  endTime?: number;
  transcript: string;
}

export interface VolDictationSection {
  status: VolDictationStatus;
  fullAudioSrc?: string;
  partAudioMap: Record<number, string>;
  hasExactTimestamps: boolean;
  segments: VolDictationSegment[];
  notes?: string;
}

export interface VolWritingTask {
  prompt: string;
  taskTypeLabel: string;
  imageUrl?: string;
  originalPdfUrl?: string;
  writingGuide: string[];
  sampleEssay?: string;
}

export interface VolWritingSection {
  status: VolWritingStatus;
  task1?: VolWritingTask;
  task2?: VolWritingTask;
  sourceFiles: string[];
  notes?: string;
}

export interface VolIdeaSection {
  status: 'ready' | 'missing';
  topic: string;
  linkedPrompt?: string;
  sideATitle: string;
  sideAArguments: string[];
  sideBTitle: string;
  sideBArguments: string[];
  examples: string[];
  collocations: Array<{ phrase: string; meaningVi: string }>;
}

export interface VolumeTestEntry {
  id: string; // e.g. 'vol-7-test-1'
  volNumber: number; // 1..10
  testNumber: number; // 1..16
  title: string;
  reading: VolReadingSection;
  listening: VolListeningSection;
  transcript: VolTranscriptSection;
  dictation: VolDictationSection;
  writing: VolWritingSection;
  idea: VolIdeaSection;
}

export interface VolumeEntry {
  volNumber: number; // 1..10
  title: string;
  description: string;
  tests: VolumeTestEntry[];
}

export interface MissingItemRecord {
  volNumber: number;
  testNumber?: number;
  component: 'reading' | 'listening' | 'audio' | 'transcript' | 'writing';
  reason:
    | 'missing_source'
    | 'scanned_image_pdf'
    | 'wma_audio_format'
    | 'missing_answer_key';
  detailVi: string;
  expectedPathSuggestion: string;
}

export interface VolTestOverride {
  id: string; // 'vol-{v}-test-{t}'
  volNumber: number;
  testNumber: number;
  updatedAt: string;
  reading?: Partial<VolReadingSection>;
  listeningPatch?: {
    fullAudioBlobId?: string;
    partAudioBlobIds?: Record<number, string>;
    questions?: QuestionItem[];
    hasAnswerKey?: boolean;
  };
  transcript?: VolTranscriptSection;
  dictationSegments?: VolDictationSegment[];
  writing?: VolWritingSection;
  idea?: VolIdeaSection;
}

export type VolSkillTabKey =
  | 'reading'
  | 'listening'
  | 'transcript'
  | 'dictation'
  | 'writing'
  | 'idea';

export interface VolSkillProgress {
  id: string; // 'vol-{v}-test-{t}-{skill}'
  volNumber: number;
  testNumber: number;
  skill: VolSkillTabKey;
  completed: boolean;
  scoreLabel?: string;
  updatedAt: string;
}

export interface VolumeTestSummaryEntry {
  id: string;
  volNumber: number;
  testNumber: number;
  title: string;
  reading: {
    status: VolReadingStatus;
    passageCount: number;
    questionCount: number;
    hasAnswerKey: boolean;
  };
  listening: {
    status: VolListeningStatus;
    hasAnswerKey: boolean;
  };
  transcript: {
    status: VolTranscriptStatus;
    segmentCount: number;
    hasExactTimestamps: boolean;
    hasOriginalPdf: boolean;
  };
  dictation: {
    status: VolDictationStatus;
    segmentCount: number;
    hasExactTimestamps: boolean;
  };
  writing: {
    status: VolWritingStatus;
    task1Prompt: string;
    task2Prompt: string;
  };
  idea: {
    status: 'ready' | 'missing';
    topic: string;
  };
}

export interface VolumeCatalogSummaryEntry {
  volNumber: number;
  title: string;
  description: string;
  tests: VolumeTestSummaryEntry[];
}
