import { VolDictationSegment } from '../types';

function parseClockTimeToSeconds(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    return Number((parts[0] * 3600 + parts[1] * 60 + parts[2]).toFixed(3));
  }
  if (parts.length === 2) {
    return Number((parts[0] * 60 + parts[1]).toFixed(3));
  }
  return null;
}

export function formatSecondsToSrt(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function parseSubtitleToSegments(
  rawText: string,
  defaultPartNumber: 1 | 2 | 3 | 4 = 1
): VolDictationSegment[] {
  const clean = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Detect LRC lines: [mm:ss.xx] text
  const lrcMatches = [
    ...clean.matchAll(/^\[(\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]\s*(.+)$/gm),
  ];
  if (lrcMatches.length >= 2) {
    const out: VolDictationSegment[] = [];
    for (let i = 0; i < lrcMatches.length; i++) {
      const startTime = parseClockTimeToSeconds(lrcMatches[i][1]) ?? 0;
      const nextStart =
        i + 1 < lrcMatches.length
          ? (parseClockTimeToSeconds(lrcMatches[i + 1][1]) ?? startTime + 5)
          : startTime + 5;
      const text = lrcMatches[i][2].trim();
      if (!text) continue;
      out.push({
        id: `sub-lrc-${i + 1}`,
        index: out.length + 1,
        partNumber: defaultPartNumber,
        startTime,
        endTime: Math.max(startTime + 0.5, nextStart),
        transcript: text,
      });
    }
    return out;
  }

  // SRT / VTT cue blocks
  const blocks = clean
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const segments: VolDictationSegment[] = [];
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeParts = lines[timeLineIdx].split('-->');
    if (timeParts.length < 2) continue;

    const start = parseClockTimeToSeconds(timeParts[0].split(/\s+/)[0]);
    const end = parseClockTimeToSeconds(
      timeParts[1].trim().split(/\s+/)[0]
    );
    if (start === null || end === null) continue;

    const bodyText = lines
      .slice(timeLineIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!bodyText) continue;

    const spMatch = bodyText.match(/^([A-Za-z][A-Za-z0-9\s]{1,22}):\s+(.+)$/);
    segments.push({
      id: `sub-cue-${segments.length + 1}`,
      index: segments.length + 1,
      partNumber: defaultPartNumber,
      speaker: spMatch ? spMatch[1].trim() : undefined,
      startTime: start,
      endTime: Math.max(start + 0.4, end),
      transcript: spMatch ? spMatch[2].trim() : bodyText,
    });
  }

  return segments;
}

export function distributeSegmentTimestamps(
  segments: VolDictationSegment[],
  totalDurationSeconds: number
): VolDictationSegment[] {
  if (segments.length === 0 || !Number.isFinite(totalDurationSeconds) || totalDurationSeconds <= 1) {
    return segments;
  }
  const wordCounts = segments.map((s) =>
    Math.max(2, s.transcript.split(/\s+/).filter(Boolean).length)
  );
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  let cursor = 0;

  return segments.map((seg, idx) => {
    const slice = (wordCounts[idx] / Math.max(1, totalWords)) * totalDurationSeconds;
    const startTime = Number(cursor.toFixed(2));
    cursor += slice;
    const endTime = Number(Math.min(totalDurationSeconds, cursor).toFixed(2));
    return {
      ...seg,
      startTime,
      endTime: Math.max(startTime + 0.5, endTime),
    };
  });
}

export interface ParsedVolFilename {
  volNumber: number | null;
  testNumber: number | null;
  partNumber: 1 | 2 | 3 | 4 | null;
  kind: 'audio' | 'reading' | 'listening' | 'transcript' | 'key' | 'writing' | 'subtitle' | 'json' | 'unknown';
}

export function parseVolFilenamePattern(fileName: string): ParsedVolFilename {
  const lower = fileName.toLowerCase();
  const volMatch = lower.match(/(?:^|[^a-z0-9])vol(?:ume)?[\s_\-]*(\d{1,2})(?=$|[^a-z0-9])/);
  const testMatch = lower.match(/(?:^|[^a-z0-9])(?:test|t)[\s_\-]*(\d{1,2})(?=$|[^a-z0-9])/);
  const partMatch = lower.match(/(?:^|[^a-z0-9])(?:part|section|track|p|s)[\s_\-]*([1-4])(?=$|[^a-z0-9])/);

  const volNumber = volMatch ? Number(volMatch[1]) : null;
  const testNumber = testMatch ? Number(testMatch[1]) : null;
  const partNumber = partMatch ? (Number(partMatch[1]) as 1 | 2 | 3 | 4) : null;

  let kind: ParsedVolFilename['kind'] = 'unknown';
  if (/\.(mp3|wav|m4a|mp4|ogg)$/i.test(lower)) kind = 'audio';
  else if (/\.(srt|vtt|lrc)$/i.test(lower)) kind = 'subtitle';
  else if (/\.json$/i.test(lower)) kind = 'json';
  else if (lower.includes('transcript') || lower.includes('tapescript') || lower.includes('tapscript')) kind = 'transcript';
  else if (lower.includes('writing')) kind = 'writing';
  else if (lower.includes('key') || lower.includes('answer') || lower.includes('giải')) kind = 'key';
  else if (lower.includes('lis')) kind = 'listening';
  else if (lower.includes('read') || lower.endsWith('-r.docx') || lower.endsWith('r.docx')) kind = 'reading';

  return { volNumber, testNumber, partNumber, kind };
}
