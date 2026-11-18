import { db } from './database';
import { DEMO_READING_TEST } from '../data/demoTests';
import { ACADEMIC_DICTIONARY } from '../data/academicDictionary';
import { createNewVocabCard, getTodayLocalISODate } from '../lib/sm2';

const SEED_FLAG_KEY = 'ielts_hub_seeded_v2';

export async function ensureDemoDataSeeded(): Promise<void> {
  // Always remove legacy TTS demo listening/dictation entries so 100% audio is authentic original
  await Promise.all([
    db.tests.delete('demo-listening-library-seminar').catch(() => undefined),
    db.dictationSets.delete('demo-dictation-library-seminar').catch(() => undefined),
  ]);

  const existingTests = await db.tests.count();
  if (localStorage.getItem(SEED_FLAG_KEY) !== 'done' || existingTests === 0) {
    await db.tests.put(DEMO_READING_TEST);

    const cardCount = await db.vocabCards.count();
    if (cardCount === 0) {
      const today = getTodayLocalISODate();
      const starterEntries = ACADEMIC_DICTIONARY.slice(0, 12).map((entry, idx) =>
        createNewVocabCard({
          id: `starter-awl-${idx + 1}`,
          word: entry.word,
          phonetic: entry.phonetic,
          partOfSpeech: entry.partOfSpeech,
          meaningVi: entry.meaningVi,
          definitionEn: entry.definitionEn,
          contextSentence: entry.example,
          sourceLabel: 'Starter IELTS Academic Word List',
          topicTag: entry.topicTag,
          todayISO: today,
        })
      );
      await db.vocabCards.bulkPut(starterEntries);
    }

    localStorage.setItem(SEED_FLAG_KEY, 'done');
  }
}

export async function restoreDemoSamples(): Promise<void> {
  await db.tests.put(DEMO_READING_TEST);
  localStorage.setItem(SEED_FLAG_KEY, 'done');
}

export async function removeDemoSamples(): Promise<void> {
  await db.tests.delete(DEMO_READING_TEST.id);
}
