import Dexie, { Table } from 'dexie';
import {
  DailyStudyLog,
  DictationSet,
  ErrorLogItem,
  IeltsTest,
  MediaBlobRecord,
  RoadmapTaskCompletion,
  TestAttempt,
  VocabCard,
  VolSkillProgress,
  VolSkillTabKey,
  VolTestOverride,
} from '../types';
import { getTodayLocalISODate } from '../lib/sm2';

export class IeltsStudyHubDB extends Dexie {
  tests!: Table<IeltsTest, string>;
  mediaBlobs!: Table<MediaBlobRecord, string>;
  dictationSets!: Table<DictationSet, string>;
  attempts!: Table<TestAttempt, string>;
  vocabCards!: Table<VocabCard, string>;
  errorLogs!: Table<ErrorLogItem, string>;
  roadmapCompletions!: Table<RoadmapTaskCompletion, string>;
  studyLogs!: Table<DailyStudyLog, string>;
  volOverrides!: Table<VolTestOverride, string>;
  volProgress!: Table<VolSkillProgress, string>;

  constructor() {
    super('IeltsStudyHubDB');
    this.version(1).stores({
      tests: 'id, skill, isDemo, createdAt',
      mediaBlobs: 'id, name, createdAt',
      dictationSets: 'id, isDemo, linkedTestId, createdAt',
      attempts: 'id, testId, skill, submittedAt',
      vocabCards: 'id, word, nextReviewDate, topicTag, createdAt',
      errorLogs: 'id, attemptId, testId, skill, questionType, mastered, createdAt',
      roadmapCompletions: 'taskId, completedAt',
      studyLogs: 'dateISO',
    });
    this.version(2).stores({
      tests: 'id, skill, isDemo, createdAt',
      mediaBlobs: 'id, name, createdAt',
      dictationSets: 'id, isDemo, linkedTestId, createdAt',
      attempts: 'id, testId, skill, submittedAt',
      vocabCards: 'id, word, nextReviewDate, topicTag, createdAt',
      errorLogs: 'id, attemptId, testId, skill, questionType, mastered, createdAt',
      roadmapCompletions: 'taskId, completedAt',
      studyLogs: 'dateISO',
      volOverrides: 'id, volNumber, testNumber, updatedAt',
      volProgress: 'id, volNumber, testNumber, skill, completed',
    });
  }
}

export const db = new IeltsStudyHubDB();

export async function recordStudyMinutes(
  minutes: number,
  dateISO: string = getTodayLocalISODate()
): Promise<void> {
  const safeMinutes = Math.max(1, Math.round(minutes));
  const existing = await db.studyLogs.get(dateISO);
  if (existing) {
    await db.studyLogs.put({
      dateISO,
      minutesStudied: existing.minutesStudied + safeMinutes,
      sessionsCount: existing.sessionsCount + 1,
    });
  } else {
    await db.studyLogs.put({
      dateISO,
      minutesStudied: safeMinutes,
      sessionsCount: 1,
    });
  }
}

export async function saveMediaBlob(file: File | Blob, name: string): Promise<string> {
  const id = `blob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.mediaBlobs.put({
    id,
    name,
    mimeType: file.type || 'audio/mpeg',
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function createObjectUrlForBlobId(
  blobId: string | undefined
): Promise<string | null> {
  if (!blobId) return null;
  const record = await db.mediaBlobs.get(blobId);
  if (!record) return null;
  return URL.createObjectURL(record.blob);
}

export async function markVolSkillProgress(
  volNumber: number,
  testNumber: number,
  skill: VolSkillTabKey,
  completed: boolean,
  scoreLabel?: string
): Promise<void> {
  const id = `vol-${volNumber}-test-${testNumber}-${skill}`;
  await db.volProgress.put({
    id,
    volNumber,
    testNumber,
    skill,
    completed,
    scoreLabel,
    updatedAt: new Date().toISOString(),
  });
}

export async function upsertVolTestOverride(
  volNumber: number,
  testNumber: number,
  updater: (prev: VolTestOverride) => VolTestOverride
): Promise<void> {
  const id = `vol-${volNumber}-test-${testNumber}`;
  const existing = (await db.volOverrides.get(id)) || {
    id,
    volNumber,
    testNumber,
    updatedAt: new Date().toISOString(),
  };
  const next = updater(existing);
  next.updatedAt = new Date().toISOString();
  await db.volOverrides.put(next);
}

export async function deleteTestWithRelatedMedia(testId: string): Promise<void> {
  const test = await db.tests.get(testId);
  if (!test) return;

  if (test.fullAudioBlobId) {
    await db.mediaBlobs.delete(test.fullAudioBlobId);
  }
  if (test.listeningParts) {
    for (const part of test.listeningParts) {
      if (part.audioBlobId) {
        await db.mediaBlobs.delete(part.audioBlobId);
      }
    }
  }
  await db.tests.delete(testId);
}

export async function exportProgressBackupJson(): Promise<string> {
  const [
    tests,
    dictationSets,
    attempts,
    vocabCards,
    errorLogs,
    roadmapCompletions,
    studyLogs,
    volOverrides,
    volProgress,
  ] = await Promise.all([
    db.tests.toArray(),
    db.dictationSets.toArray(),
    db.attempts.toArray(),
    db.vocabCards.toArray(),
    db.errorLogs.toArray(),
    db.roadmapCompletions.toArray(),
    db.studyLogs.toArray(),
    db.volOverrides.toArray(),
    db.volProgress.toArray(),
  ]);

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 2,
      note: 'Binary audio blobs are excluded from JSON backups; re-attach audio if restoring custom listening tests.',
      data: {
        tests,
        dictationSets,
        attempts,
        vocabCards,
        errorLogs,
        roadmapCompletions,
        studyLogs,
        volOverrides,
        volProgress,
      },
    },
    null,
    2
  );
}

export async function importProgressBackupJson(jsonText: string): Promise<{
  importedCount: number;
}> {
  const parsed = JSON.parse(jsonText) as {
    data?: {
      tests?: IeltsTest[];
      dictationSets?: DictationSet[];
      attempts?: TestAttempt[];
      vocabCards?: VocabCard[];
      errorLogs?: ErrorLogItem[];
      roadmapCompletions?: RoadmapTaskCompletion[];
      studyLogs?: DailyStudyLog[];
      volOverrides?: VolTestOverride[];
      volProgress?: VolSkillProgress[];
    };
  };

  if (!parsed || !parsed.data) {
    throw new Error('File JSON sao lưu không đúng định dạng.');
  }

  const d = parsed.data;
  let count = 0;

  await db.transaction(
    'rw',
    [
      db.tests,
      db.dictationSets,
      db.attempts,
      db.vocabCards,
      db.errorLogs,
      db.roadmapCompletions,
      db.studyLogs,
      db.volOverrides,
      db.volProgress,
    ],
    async () => {
      if (d.tests?.length) {
        await db.tests.bulkPut(d.tests);
        count += d.tests.length;
      }
      if (d.dictationSets?.length) {
        await db.dictationSets.bulkPut(d.dictationSets);
        count += d.dictationSets.length;
      }
      if (d.attempts?.length) {
        await db.attempts.bulkPut(d.attempts);
        count += d.attempts.length;
      }
      if (d.vocabCards?.length) {
        await db.vocabCards.bulkPut(d.vocabCards);
        count += d.vocabCards.length;
      }
      if (d.errorLogs?.length) {
        await db.errorLogs.bulkPut(d.errorLogs);
        count += d.errorLogs.length;
      }
      if (d.roadmapCompletions?.length) {
        await db.roadmapCompletions.bulkPut(d.roadmapCompletions);
        count += d.roadmapCompletions.length;
      }
      if (d.studyLogs?.length) {
        await db.studyLogs.bulkPut(d.studyLogs);
        count += d.studyLogs.length;
      }
      if (d.volOverrides?.length) {
        await db.volOverrides.bulkPut(d.volOverrides);
        count += d.volOverrides.length;
      }
      if (d.volProgress?.length) {
        await db.volProgress.bulkPut(d.volProgress);
        count += d.volProgress.length;
      }
    }
  );

  return { importedCount: count };
}
