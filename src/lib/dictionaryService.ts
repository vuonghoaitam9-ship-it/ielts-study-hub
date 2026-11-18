import { ACADEMIC_DICTIONARY } from '../data/academicDictionary';
import { DictionaryEntry } from '../types';

const DICTIONARY_MAP = new Map<string, DictionaryEntry>();
for (const entry of ACADEMIC_DICTIONARY) {
  DICTIONARY_MAP.set(entry.word.toLowerCase(), entry);
}

function normalizeLookupWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/gi, '');
}

function generateStemCandidates(word: string): string[] {
  const candidates = [word];
  if (word.endsWith('ies') && word.length > 4) {
    candidates.push(word.slice(0, -3) + 'y');
  }
  if (word.endsWith('es') && word.length > 3) {
    candidates.push(word.slice(0, -2));
  }
  if (word.endsWith('s') && word.length > 3) {
    candidates.push(word.slice(0, -1));
  }
  if (word.endsWith('ied') && word.length > 4) {
    candidates.push(word.slice(0, -3) + 'y');
  }
  if (word.endsWith('ed') && word.length > 3) {
    candidates.push(word.slice(0, -2));
    candidates.push(word.slice(0, -1));
  }
  if (word.endsWith('ing') && word.length > 4) {
    candidates.push(word.slice(0, -3));
    candidates.push(word.slice(0, -3) + 'e');
  }
  if (word.endsWith('ly') && word.length > 4) {
    candidates.push(word.slice(0, -2));
  }
  return candidates;
}

export interface LookupResult {
  word: string;
  foundInOffline: boolean;
  entry?: DictionaryEntry;
}

export function lookupOfflineWord(rawWord: string): LookupResult {
  const clean = normalizeLookupWord(rawWord);
  if (!clean) {
    return { word: rawWord.trim(), foundInOffline: false };
  }

  for (const candidate of generateStemCandidates(clean)) {
    const hit = DICTIONARY_MAP.get(candidate);
    if (hit) {
      return {
        word: hit.word,
        foundInOffline: true,
        entry: hit,
      };
    }
  }

  return {
    word: clean,
    foundInOffline: false,
  };
}

export async function lookupWordWithOptionalApi(
  rawWord: string
): Promise<LookupResult> {
  const offline = lookupOfflineWord(rawWord);
  const clean = normalizeLookupWord(rawWord);
  if (!clean || clean.includes(' ')) return offline;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return offline;

    const payload = (await res.json()) as Array<{
      word?: string;
      phonetic?: string;
      phonetics?: Array<{ text?: string; audio?: string }>;
      meanings?: Array<{
        partOfSpeech?: string;
        definitions?: Array<{ definition?: string; example?: string }>;
      }>;
    }>;

    const first = payload[0];
    if (!first) return offline;
    const phonetic =
      first.phonetic ||
      first.phonetics?.find((p) => p.text)?.text ||
      '';
    const authenticAudioUrl = first.phonetics?.find(
      (p) => typeof p.audio === 'string' && p.audio.startsWith('http')
    )?.audio;

    if (offline.foundInOffline && offline.entry) {
      return {
        ...offline,
        entry: {
          ...offline.entry,
          audioUrl: authenticAudioUrl,
        },
      };
    }

    const meaning = first.meanings?.[0];
    const def = meaning?.definitions?.[0]?.definition || '';
    const example = meaning?.definitions?.[0]?.example || '';

    return {
      word: first.word || clean,
      foundInOffline: false,
      entry: {
        word: first.word || clean,
        phonetic,
        partOfSpeech: meaning?.partOfSpeech || '',
        meaningVi: '',
        definitionEn: def,
        example,
        audioUrl: authenticAudioUrl,
      },
    };
  } catch {
    return offline;
  }
}

/**
 * Plays only real recorded dictionary audio files when an audioUrl is provided.
 * Synthesized speech is disabled strictly across the entire application.
 */
export function playAuthenticWordAudio(audioUrl?: string): void {
  if (!audioUrl || typeof Audio === 'undefined') return;
  try {
    const audio = new Audio(audioUrl);
    void audio.play().catch(() => undefined);
  } catch {
    // Ignore browser autoplay restrictions
  }
}
