import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_SUMMARY, STATIC_MISSING_REPORT } from '../data/volumes';
import { VolumeEntry } from '../types';

const VOL_DATA_DIR = path.resolve(__dirname, '../../public/data/volumes');

describe('Vol 1-10 Data Integrity & Strict Original Audio Constraints', () => {
  it('provides catalog summaries for all 10 Volumes (Vol 1 to Vol 10)', () => {
    expect(CATALOG_SUMMARY).toHaveLength(10);
    expect(CATALOG_SUMMARY.map((v) => v.volNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    for (const vol of CATALOG_SUMMARY) {
      expect(vol.tests.length).toBeGreaterThan(0);
      for (const t of vol.tests) {
        expect(t).toHaveProperty('reading');
        expect(t).toHaveProperty('listening');
        expect(t).toHaveProperty('transcript');
        expect(t).toHaveProperty('dictation');
        expect(t).toHaveProperty('writing');
        expect(t).toHaveProperty('idea');
      }
    }
  });

  it('loads vol-1..vol-10.json with exact 6 linked skills and 100% authentic audio sources', () => {
    let totalTests = 0;

    for (let volNum = 1; volNum <= 10; volNum++) {
      const filePath = path.join(VOL_DATA_DIR, `vol-${volNum}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      const raw = fs.readFileSync(filePath, 'utf8');
      const vol = JSON.parse(raw) as VolumeEntry;

      expect(vol.volNumber).toBe(volNum);
      expect(vol.tests.length).toBeGreaterThan(0);

      for (const test of vol.tests) {
        totalTests++;

        // Exact top-level schema keys enforce the 6-module design with zero extraneous skill tabs
        expect(Object.keys(test).sort()).toEqual([
          'dictation',
          'id',
          'idea',
          'listening',
          'reading',
          'testNumber',
          'title',
          'transcript',
          'volNumber',
          'writing',
        ]);

        // Reading passages must never contain duplicate passage IDs (React key collision guard)
        const passageIds = test.reading.passages.map((p) => p.id);
        expect(new Set(passageIds).size).toBe(passageIds.length);
        expect(test.reading.passages.length).toBeLessThanOrEqual(3);

        const audioUrls: string[] = [];
        if (test.listening.fullAudioSrc) {
          audioUrls.push(test.listening.fullAudioSrc);
        }
        for (const part of test.listening.parts) {
          if (part.audioSrc) {
            audioUrls.push(part.audioSrc);
          }
        }

        for (const url of audioUrls) {
          expect(
            url.startsWith('/vol-archive/') || url.startsWith('/audio/')
          ).toBe(true);
          expect(url.toLowerCase()).not.toMatch(/\.wma$/);
        }

        // Dictation reuses original Listening audio tracks (either fullAudioSrc or per-part audioSrc)
        if (test.dictation.status !== 'missing') {
          expect(test.dictation.segments.length).toBeGreaterThan(0);
          for (const seg of test.dictation.segments) {
            expect(seg.transcript.trim().length).toBeGreaterThan(0);
            expect(seg.partNumber).toBeGreaterThanOrEqual(1);
            expect(seg.partNumber).toBeLessThanOrEqual(4);
          }
          if (test.dictation.status === 'ready') {
            expect(audioUrls.length).toBeGreaterThan(0);
          }
        }
      }
    }

    expect(totalTests).toBeGreaterThanOrEqual(80);
  });

  it('tracks missing, scanned PDF, and .wma audio gaps explicitly without fabricating content', () => {
    expect(STATIC_MISSING_REPORT.length).toBeGreaterThan(0);
    const vol10Missing = STATIC_MISSING_REPORT.filter((m) => m.volNumber === 10);
    expect(vol10Missing.length).toBeGreaterThan(0);
    expect(
      STATIC_MISSING_REPORT.some(
        (m) =>
          m.reason === 'wma_audio_format' ||
          m.reason === 'missing_source' ||
          m.reason === 'missing_answer_key'
      )
    ).toBe(true);
  });
});
