import { describe, expect, it } from 'vitest';
import {
  distributeSegmentTimestamps,
  formatSecondsToSrt,
  parseSubtitleToSegments,
  parseVolFilenamePattern,
} from '../lib/subtitleParser';

describe('subtitleParser', () => {
  it('parses standard SRT cues with speaker labels into VolDictationSegment[]', () => {
    const srt = `1
00:00:01,500 --> 00:00:05,250
Receptionist: Good morning, Greenhill Sports Centre.

2
00:00:05,500 --> 00:00:10,000
Caller: I would like to book a tennis court for Saturday.`;

    const segs = parseSubtitleToSegments(srt, 1);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({
      index: 1,
      partNumber: 1,
      speaker: 'Receptionist',
      startTime: 1.5,
      endTime: 5.25,
      transcript: 'Good morning, Greenhill Sports Centre.',
    });
    expect(segs[1].startTime).toBe(5.5);
    expect(segs[1].endTime).toBe(10);
  });

  it('parses WebVTT and LRC files cleanly', () => {
    const vtt = `WEBVTT

00:12.000 --> 00:15.400
Welcome to the university library orientation.`;

    const vttSegs = parseSubtitleToSegments(vtt, 2);
    expect(vttSegs).toHaveLength(1);
    expect(vttSegs[0].partNumber).toBe(2);
    expect(vttSegs[0].startTime).toBe(12);
    expect(vttSegs[0].endTime).toBe(15.4);

    const lrc = `[00:02.50] Today we will explore coastal biodiversity.
[00:08.00] Please take notes on the tidal zone.`;
    const lrcSegs = parseSubtitleToSegments(lrc, 4);
    expect(lrcSegs).toHaveLength(2);
    expect(lrcSegs[0].startTime).toBe(2.5);
    expect(lrcSegs[0].endTime).toBe(8);
    expect(lrcSegs[1].partNumber).toBe(4);
  });

  it('distributes segment timestamps proportionally to word count', () => {
    const base = [
      {
        id: '1',
        index: 1,
        partNumber: 1 as const,
        startTime: 0,
        endTime: 0,
        transcript: 'one two',
      },
      {
        id: '2',
        index: 2,
        partNumber: 1 as const,
        startTime: 0,
        endTime: 0,
        transcript: 'one two three four five six',
      },
    ];
    const distributed = distributeSegmentTimestamps(base, 80);
    expect(distributed[0].startTime).toBe(0);
    expect(distributed[0].endTime).toBe(20);
    expect(distributed[1].startTime).toBe(20);
    expect(distributed[1].endTime).toBe(80);
  });

  it('formats seconds to SRT clock string and detects Vol/Test/Part filenames', () => {
    expect(formatSecondsToSrt(65.25)).toBe('00:01:05,250');

    expect(parseVolFilenamePattern('Vol4_Test1_Part2.mp3')).toEqual({
      volNumber: 4,
      testNumber: 1,
      partNumber: 2,
      kind: 'audio',
    });

    expect(parseVolFilenamePattern('volume-10-t3-s4.srt')).toEqual({
      volNumber: 10,
      testNumber: 3,
      partNumber: 4,
      kind: 'subtitle',
    });
  });
});
