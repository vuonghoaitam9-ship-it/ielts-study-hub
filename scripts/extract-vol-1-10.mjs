import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const VOL_ROOT = path.resolve('F:/IELTS/Vol');
const FULL_EXAMS_ROOT = path.join(VOL_ROOT, 'Full Original Exam VOL 1-10');
const OUT_DIR = path.resolve('f:/IELTS/ielts-study-hub/src/data/volumes');
const PUBLIC_VOL_DIR = path.resolve('f:/IELTS/ielts-study-hub/public/data/volumes');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_VOL_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Path & File Helpers (strictly read-only on F:\IELTS\Vol)
// ---------------------------------------------------------------------------

function toVolArchiveUrl(absPath) {
  const rel = path.relative(VOL_ROOT, absPath).split(path.sep).join('/');
  return '/vol-archive/' + rel.split('/').map(encodeURIComponent).join('/');
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (/\bspeak/i.test(entry.name)) continue;
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function stripWatermarks(text) {
  return text
    .replace(/Group:\s*(?:original|Real)\s*ielts?\s*exams?[^\n]*/gi, '')
    .replace(/Group:\s*ORIGINAL\s*EXAMS[^\n]*/gi, '')
    .replace(/Prediction\s+writing\s+on\s+computer[^\n]*/gi, '')
    .replace(/by\s+Real\s+IELTS\s+EXAMS[^\n]*/gi, '')
    .replace(/phone:\s*\d{8,12}/gi, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readDocxText(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return '';
  try {
    const res = await mammoth.extractRawText({ path: absPath });
    return stripWatermarks(res.value || '');
  } catch {
    return '';
  }
}

async function readPdfInfo(absPath) {
  if (!absPath || !fs.existsSync(absPath)) {
    return { text: '', pageCount: 0, isScanned: true };
  }
  try {
    const data = new Uint8Array(fs.readFileSync(absPath));
    const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
    const pageTexts = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let pageOut = '';
      let lastY = null;
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
          pageOut += '\n';
        } else if (
          pageOut.length > 0 &&
          !pageOut.endsWith('\n') &&
          !pageOut.endsWith(' ') &&
          item.str.length > 0 &&
          !item.str.startsWith(' ')
        ) {
          pageOut += ' ';
        }
        pageOut += item.str;
        if (item.hasEOL) pageOut += '\n';
        if (y !== null) lastY = y;
      }
      pageTexts.push(pageOut.trim());
    }
    const text = stripWatermarks(pageTexts.join('\n\n'));
    const nonWs = text.replace(/\s+/g, '').length;
    const isScanned = nonWs < Math.min(80, Math.max(1, doc.numPages) * 25);
    return { text: isScanned ? '' : text, pageCount: doc.numPages, isScanned };
  } catch {
    return { text: '', pageCount: 0, isScanned: true };
  }
}

function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return {};
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdCount = buf.readUInt16LE(eocd + 10);
  const entries = {};
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    const compSize = buf.readUInt32LE(pos + 20);
    const compMethod = buf.readUInt16LE(pos + 10);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const slice = buf.subarray(dataStart, dataStart + compSize);
    try {
      entries[name] = compMethod === 8 ? zlib.inflateRawSync(slice) : slice;
    } catch {
      // ignore corrupted zip entry
    }
  }
  return entries;
}

function parseXlsxAnswerSheets(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return new Map();
  const entries = readZipEntries(fs.readFileSync(absPath));
  const ssXml = entries['xl/sharedStrings.xml']?.toString('utf8') || '';
  const shared = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((t) => t[1])
      .join('')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  );

  // Read workbook sheet names if available
  const wbXml = entries['xl/workbook.xml']?.toString('utf8') || '';
  const sheetNames = [...wbXml.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map(
    (m) => m[1]
  );

  const sheetFiles = Object.keys(entries)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/sheet(\d+)/)[1]);
      const nb = Number(b.match(/sheet(\d+)/)[1]);
      return na - nb;
    });

  const testsKeyMap = new Map(); // testNum -> Map(qNum -> entry)

  sheetFiles.forEach((sheetFile, idx) => {
    const sName = sheetNames[idx] || `Test ${idx + 1}`;
    const testNumMatch = sName.match(/(\d+)/);
    const testNum = testNumMatch ? Number(testNumMatch[1]) : idx + 1;
    const sXml = entries[sheetFile].toString('utf8');
    const qMap = new Map();

    for (const r of sXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = c[1];
        const vMatch = c[2].match(/<v>([\s\S]*?)<\/v>/);
        const isStr = /t="s"/.test(attrs);
        let val = vMatch ? (isStr ? shared[Number(vMatch[1])] : vMatch[1]) : '';
        if (!val) {
          const inlineM = c[2].match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
          if (inlineM) val = inlineM[1];
        }
        cells.push((val || '').trim());
      }
      // Pair adjacent columns (num, ans) across row
      for (let i = 0; i < cells.length - 1; i++) {
        const qCand = cells[i].replace(/\.0$/, '');
        if (/^\d{1,2}$/.test(qCand)) {
          const qNum = Number(qCand);
          const ansRaw = cells[i + 1];
          if (qNum >= 1 && qNum <= 40 && ansRaw && !/^(?:STT|Đáp án)$/i.test(ansRaw)) {
            let normAns = ansRaw;
            if (normAns === 'T') normAns = 'TRUE';
            else if (normAns === 'F') normAns = 'FALSE';
            else if (normAns === 'NGV' || normAns === 'NG') normAns = 'NOT GIVEN';
            qMap.set(qNum, {
              acceptedAnswers: normAns
                .split(/\s*(?:\/|;)\s*/)
                .map((s) => s.trim())
                .filter(Boolean),
              explanation: '',
            });
          }
        }
      }
    }

    if (qMap.size > 0) {
      testsKeyMap.set(testNum, qMap);
    }
  });

  return testsKeyMap;
}

// ---------------------------------------------------------------------------
// Parsing Questions, Answer Keys, Transcripts & Passages
// ---------------------------------------------------------------------------

function detectInstructionType(line) {
  const upper = line.toUpperCase();
  if (upper.includes('TRUE') && upper.includes('FALSE') && upper.includes('NOT GIVEN')) {
    return 'tfng';
  }
  if (upper.includes('YES') && upper.includes('NO') && upper.includes('NOT GIVEN')) {
    return 'ynng';
  }
  if (upper.includes('LIST OF HEADINGS') || upper.includes('CHOOSE THE CORRECT HEADING')) {
    return 'matching_headings';
  }
  if (
    upper.includes('WHICH PARAGRAPH') ||
    upper.includes('WHICH SECTION') ||
    upper.includes('MATCH EACH') ||
    upper.includes('CLASSIFY') ||
    upper.includes('LABEL THE MAP') ||
    upper.includes('WHAT COMMENT')
  ) {
    return 'matching_info';
  }
  if (
    upper.includes('CHOOSE THE CORRECT LETTER') ||
    upper.includes('CHOOSE TWO LETTERS') ||
    upper.includes('CHOOSE THE CORRECT ANSWER') ||
    upper.includes('MULTIPLE CHOICE')
  ) {
    return 'mcq';
  }
  if (
    upper.includes('ONE WORD') ||
    upper.includes('NO MORE THAN') ||
    upper.includes('COMPLETE THE')
  ) {
    return 'gap_fill';
  }
  return null;
}

function parseAnswerKeyBlock(rawText) {
  const map = new Map();
  if (!rawText || !rawText.trim()) return map;
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern: "Câu số 1:" -> next line
    const vnNum = line.match(/^Câu\s*số\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*:?\s*(.*)$/i);
    if (vnNum) {
      const qStart = Number(vnNum[1]);
      const qEnd = vnNum[2] ? Number(vnNum[2]) : qStart;
      let ansVal = vnNum[3]?.trim() || '';
      if (!ansVal && i + 1 < lines.length) {
        ansVal = lines[i + 1].trim();
        i += 1;
      }
      if (ansVal && !/^\.{2,}$/.test(ansVal)) {
        const parts = ansVal
          .split(/\s*(?:\/|;|,)\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (qEnd > qStart && parts.length >= 2) {
          for (let q = qStart; q <= qEnd; q++) {
            map.set(q, {
              acceptedAnswers: parts,
              explanation: `Đáp án nhóm ${qStart}-${qEnd}: ${ansVal}`,
            });
          }
        } else {
          map.set(qStart, {
            acceptedAnswers: ansVal
              .split(/\s*(?:\/|;)\s*/)
              .map((s) => s.trim())
              .filter(Boolean),
            explanation: '',
          });
        }
      }
      continue;
    }

    // Pattern: "Câu hỏi 1:" ... "Đáp án: ..." ... "Câu trong passage có chứa thông tin đáp án: ..."
    const vnRich = line.match(/^Câu\s*hỏi\s*(\d{1,2})\s*:/i);
    if (vnRich) {
      const qNum = Number(vnRich[1]);
      let answer = '';
      let evidenceQuote;
      const expParts = [];
      let j = i + 1;
      while (
        j < lines.length &&
        !/^Câu\s*(?:hỏi|số)\s*\d+/i.test(lines[j]) &&
        !/^PASSAGE\s+\d+/i.test(lines[j])
      ) {
        const sub = lines[j];
        const ansM = sub.match(/^Đáp\s*án\s*:\s*(.+)$/i);
        const evM = sub.match(/^Câu\s+trong\s+passage[^:]*:\s*["“]?(.+?)["”]?$/i);
        if (ansM) answer = ansM[1].trim();
        else if (evM) {
          evidenceQuote = evM[1].trim();
          expParts.push(sub);
        } else if (!/^Dịch\s+tiếng\s+Việt/i.test(sub)) {
          expParts.push(sub);
        }
        j += 1;
      }
      if (answer) {
        map.set(qNum, {
          acceptedAnswers: answer
            .split(/\s*(?:\/|;)\s*/)
            .map((s) => s.trim())
            .filter(Boolean),
          explanation: expParts.join(' | '),
          evidenceQuote,
        });
      }
      i = j - 1;
      continue;
    }

    // Pattern: "1. Answer: FALSE" + "Location: ..." + "Explanation: ..."
    const engRich = line.match(/^(\d{1,2})\.\s*Answer\s*:\s*(.+)$/i);
    if (engRich) {
      const qNum = Number(engRich[1]);
      const ansClean = engRich[2].replace(/\s+đ$/i, '').trim();
      let evidenceQuote;
      const expParts = [];
      let j = i + 1;
      while (j < lines.length && !/^\d{1,2}\.\s*Answer\s*:/i.test(lines[j])) {
        const sub = lines[j].replace(/^[o•\-]\s*/, '').trim();
        const locM = sub.match(/^Location\s*:\s*(.+)$/i);
        if (locM) {
          const qM = locM[1].match(/["“]([^"”]+)["”]/);
          if (qM) evidenceQuote = qM[1].trim();
        }
        expParts.push(sub);
        j += 1;
      }
      map.set(qNum, {
        acceptedAnswers: ansClean
          .split(/\s*(?:\/|;)\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
        explanation: expParts.join(' '),
        evidenceQuote,
      });
      i = j - 1;
      continue;
    }

    // Pattern: Vol 7 Reading PDF "KEYS-READING VOL7" inline multi-column or single line: "1. Raindrops  11. NOT GIVEN"
    const multiTokens = [
      ...line.matchAll(/\b(\d{1,2})\s*[\.\-\:\)]\s*([A-Za-z0-9'%\$\£\.\s]{1,35}?)(?=\s+\d{1,2}\s*[\.\-\:\)]|$)/g),
    ];
    if (multiTokens.length >= 2) {
      for (const m of multiTokens) {
        const qNum = Number(m[1]);
        const ansVal = m[2].trim();
        if (qNum >= 1 && qNum <= 40 && ansVal) {
          map.set(qNum, {
            acceptedAnswers: ansVal
              .split(/\s*(?:\/|;)\s*/)
              .map((s) => s.trim())
              .filter(Boolean),
            explanation: '',
          });
        }
      }
      continue;
    }

    // Single line: "1. TRUE" / "1 - ink" / "1) B"
    const single = line.match(/^(?:Q(?:uestion)?\s*)?(\d{1,2})\s*[\.\)\:\-]\s*(.+)$/i);
    if (single) {
      const qNum = Number(single[1]);
      if (qNum >= 1 && qNum <= 40) {
        let ans = single[2].trim();
        if (ans.length > 65) continue; // likely a question prompt rather than a key
        map.set(qNum, {
          acceptedAnswers: ans
            .split(/\s*(?:\/|;)\s*/)
            .map((s) => s.trim())
            .filter(Boolean),
          explanation: '',
        });
      }
    }
  }
  return map;
}

function splitParagraphs(bodyText) {
  const blocks = bodyText
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    const m = block.match(/^(?:\[?([A-H])\]?[\.\)\:\s]+)(.+)$/s);
    if (m && m[2].trim().length > 25) {
      return {
        label: m[1],
        text: m[2].replace(/\n+/g, ' ').trim(),
      };
    }
    return { text: block.replace(/\n+/g, ' ').trim() };
  });
}

function parseQuestionsBlock(rawText, answerMap, defaultSection = 1) {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const questions = [];
  let activeSection = defaultSection;
  let activeType = 'gap_fill';
  let activeInstruction = '';
  let current = null;

  const flush = () => {
    if (!current) return;
    const prompt = current.promptLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!prompt) {
      current = null;
      return;
    }
    let finalType = current.type;
    if (/_{2,}|\.{3,}|\[blank\]/i.test(prompt)) finalType = 'gap_fill';
    else if (current.options.length >= 2) finalType = 'mcq';

    const key = answerMap.get(current.questionNumber);
    const options =
      finalType === 'tfng' && current.options.length === 0
        ? ['TRUE', 'FALSE', 'NOT GIVEN']
        : finalType === 'ynng' && current.options.length === 0
          ? ['YES', 'NO', 'NOT GIVEN']
          : current.options.length > 0
            ? current.options
            : undefined;

    questions.push({
      id: `q-${current.sectionNumber}-${current.questionNumber}`,
      questionNumber: current.questionNumber,
      sectionNumber: current.sectionNumber,
      type: finalType,
      instruction: current.instruction || undefined,
      prompt,
      options,
      acceptedAnswers: key?.acceptedAnswers ?? [],
      explanation: key?.explanation ?? '',
      evidenceQuote: key?.evidenceQuote,
    });
    current = null;
  };

  for (const line of lines) {
    const secM = line.match(/^(?:READING\s+)?(?:PASSAGE|PART|SECTION)\s+(\d+)/i);
    if (secM && line.length < 45) {
      flush();
      activeSection = Math.min(4, Math.max(1, Number(secM[1])));
      continue;
    }

    const instType = detectInstructionType(line);
    if (instType) {
      flush();
      activeType = instType;
      activeInstruction = line;
      continue;
    }

    if (/^Questions?\s+\d+\s*[-–to]+\s*\d+/i.test(line)) {
      flush();
      activeInstruction = line;
      continue;
    }

    // Standard numbered question: "1. Text..." or "1 Text..."
    const qStart = line.match(/^(\d{1,2})\s*[\.\)\:\-]\s+(.+)$/);
    const qSpaceStart = !qStart ? line.match(/^(\d{1,2})\s+([A-Z"“].{8,})$/) : null;
    const qHit = qStart || qSpaceStart;
    if (qHit) {
      const qNum = Number(qHit[1]);
      if (qNum >= 1 && qNum <= 40) {
        flush();
        current = {
          questionNumber: qNum,
          sectionNumber: activeSection,
          type: activeType,
          instruction: activeInstruction,
          promptLines: [qHit[2].trim()],
          options: [],
        };
        continue;
      }
    }

    // Inline note/gap-fill line containing "... 1 …………" or "(4)___"
    const inlineBlanks = [
      ...line.matchAll(/(?:^|[\s\$£])(?:\((\d{1,2})\)|(\d{1,2}))\s*(?:\.{3,}|_{3,}|…{2,})/g),
    ];
    if (inlineBlanks.length >= 1) {
      for (const bm of inlineBlanks) {
        const qNum = Number(bm[1] || bm[2]);
        if (qNum >= 1 && qNum <= 40) {
          flush();
          current = {
            questionNumber: qNum,
            sectionNumber: activeSection,
            type: 'gap_fill',
            instruction: activeInstruction,
            promptLines: [line.replace(/…+/g, '____').replace(/\.{4,}/g, '____')],
            options: [],
          };
          flush();
        }
      }
      continue;
    }

    const optMatch = line.match(/^([A-H])[\.\)\:\s]\s+(.+)$/);
    if (optMatch && current && current.promptLines.length > 0) {
      current.options.push(`${optMatch[1]}. ${optMatch[2].trim()}`);
      continue;
    }

    if (current) {
      current.promptLines.push(line);
    }
  }
  flush();

  // Deduplicate keeping first occurrence
  const seen = new Set();
  const deduped = [];
  for (const q of questions) {
    if (!seen.has(q.questionNumber)) {
      seen.add(q.questionNumber);
      deduped.push(q);
    }
  }

  // If answerMap contains numbered answers for questions that weren't cleanly isolated
  // (for example inside merged table layouts), ensure all 1..40 numbered items exist if needed
  deduped.sort((a, b) => a.questionNumber - b.questionNumber);
  return deduped;
}

function parseReadingTestText(rawText, answerMap) {
  const normalizedRaw = String(rawText || '').replace(/\r\n/g, '\n');
  // Match only true Passage headers ("READING PASSAGE 1", "Passage 2: Title"), not sentences like "Reading Passage 3 has five sections."
  const passageRegex =
    /(?:^|\n)\s*(?:READING\s+)?PASSAGE\s+([123])(?:\s*[:.\-–—]?\s*(?=\n|$)|\s*[:\-–—]\s+[^\n]+)/gi;
  const matches = [...normalizedRaw.matchAll(passageRegex)];
  const allQuestions = [];

  if (matches.length === 0) {
    const passages = [];
    // Fallback if a single-passage text
    const qIdx = normalizedRaw.search(/(?:^|\n)\s*Questions?\s+\d+/i);
    if (qIdx > 100) {
      const body = normalizedRaw.slice(0, qIdx).trim();
      const firstNl = body.indexOf('\n');
      const title = firstNl > -1 && firstNl < 110 ? body.slice(0, firstNl).trim() : 'Reading Passage 1';
      const content = firstNl > -1 && firstNl < 110 ? body.slice(firstNl + 1).trim() : body;
      passages.push({
        id: 'passage-1',
        passageNumber: 1,
        title,
        paragraphs: splitParagraphs(content),
      });
      allQuestions.push(...parseQuestionsBlock(normalizedRaw.slice(qIdx), answerMap, 1));
    }
    return { passages, questions: allQuestions };
  }

  const passagesByNum = new Map();

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalizedRaw.length) : normalizedRaw.length;
    const slice = normalizedRaw.slice(start, end).trim();
    const pNum = Math.min(3, Math.max(1, Number(matches[i][1]) || i + 1));

    // Find start of Questions inside this passage slice
    const qMarker = slice.search(
      /(?:^|\n)\s*Questions?\s+\d+\s*[–\-to]+\s*\d+/i
    );
    const passageChunk = qMarker > -1 ? slice.slice(0, qMarker).trim() : slice;
    const questionChunk = qMarker > -1 ? slice.slice(qMarker).trim() : '';

    const pLines = passageChunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // Drop "READING PASSAGE X", "Read the text...", "You should spend..."
    let contentStartIdx = 1;
    while (
      contentStartIdx < pLines.length &&
      /^(?:You should spend|Read the text|Questions?\s+\d)/i.test(pLines[contentStartIdx])
    ) {
      contentStartIdx++;
    }
    const pTitle =
      pLines[contentStartIdx] && pLines[contentStartIdx].length < 115
        ? pLines[contentStartIdx]
        : `Reading Passage ${pNum}`;
    const bodyLines =
      pTitle === pLines[contentStartIdx]
        ? pLines.slice(contentStartIdx + 1)
        : pLines.slice(contentStartIdx);

    const paragraphs = splitParagraphs(bodyLines.join('\n\n'));
    const bodyCharLen = paragraphs.reduce((acc, p) => acc + p.text.length, 0);
    const candidate = {
      id: `passage-${pNum}`,
      passageNumber: pNum,
      title: pTitle,
      paragraphs,
    };

    const existing = passagesByNum.get(pNum);
    if (!existing) {
      passagesByNum.set(pNum, { entry: candidate, score: bodyCharLen });
    } else if (bodyCharLen > existing.score) {
      passagesByNum.set(pNum, { entry: candidate, score: bodyCharLen });
    }

    if (questionChunk) {
      allQuestions.push(...parseQuestionsBlock(questionChunk, answerMap, pNum));
    }
  }

  const passages = [...passagesByNum.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v.entry);

  // Deduplicate questions across passages
  const seen = new Set();
  const dedupedQ = [];
  for (const q of allQuestions) {
    if (!seen.has(q.questionNumber)) {
      seen.add(q.questionNumber);
      dedupedQ.push(q);
    }
  }
  dedupedQ.sort((a, b) => a.questionNumber - b.questionNumber);
  return { passages, questions: dedupedQ };
}

function parseClockSeconds(clock) {
  const parts = clock.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function splitIntoSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.\?\!])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function parseTranscriptStructured(rawText, shiftPerPartForSeparateFiles, answerMap) {
  if (!rawText || !rawText.trim()) {
    return {
      status: 'missing',
      hasExactTimestamps: false,
      parts: [],
      dictationSegments: [],
    };
  }

  const clean = stripWatermarks(rawText)
    .replace(/SUMMARY KEYWORDS[\s\S]*?(?=\d{1,2}:\d{2}|SECTION|PART|$)/i, '')
    .trim();

  // Detect format:
  // 1) Vol 7 "(0:00 - 1:16)" blocks
  const rangeMatches = [...clean.matchAll(/\((\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\)/g)];
  // 2) Vol 1 "Speaker 1 [00:00:01]"
  const hmsMatches = [...clean.matchAll(/Speaker\s+\d+\s*\[(\d{2}:\d{2}:\d{2})\]/gi)];
  // 3) Vol 3 "0:01 ..."
  const msMatches = [...clean.matchAll(/(?:^|\n|\s)(\d{1,2}:\d{2})\s+(?=[A-Z])/g)];

  const rawEntries = []; // { partNumber, speaker, startTime, endTime, text }
  let hasExactTimestamps = false;

  if (rangeMatches.length >= 3) {
    hasExactTimestamps = true;
    let currentPart = 1;
    for (let i = 0; i < rangeMatches.length; i++) {
      const m = rangeMatches[i];
      const prefix = clean.slice(i === 0 ? 0 : rangeMatches[i - 1].index, m.index);
      const partM = [...prefix.matchAll(/\b(?:Part|Section)\s+(\d)/gi)];
      if (partM.length > 0) {
        currentPart = Math.min(4, Math.max(1, Number(partM[partM.length - 1][1])));
      }
      const start = parseClockSeconds(m[1]);
      const end = Math.max(start + 1, parseClockSeconds(m[2]));
      const bodyStart = m.index + m[0].length;
      const bodyEnd = i + 1 < rangeMatches.length ? rangeMatches[i + 1].index : clean.length;
      let block = clean
        .slice(bodyStart, bodyEnd)
        .replace(/\bPart\s+\d+\b\.?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const sents = splitIntoSentences(block);
      const totalChars = sents.reduce((s, x) => s + x.length, 0) || 1;
      let cur = start;
      for (const s of sents) {
        const dur = ((end - start) * s.length) / totalChars;
        rawEntries.push({
          partNumber: currentPart,
          startTime: Number(cur.toFixed(2)),
          endTime: Number((cur + dur).toFixed(2)),
          text: s,
        });
        cur += dur;
      }
    }
  } else if (hmsMatches.length >= 3) {
    hasExactTimestamps = true;
    let currentPart = 1;
    for (let i = 0; i < hmsMatches.length; i++) {
      const m = hmsMatches[i];
      const speaker = m[0].match(/Speaker\s+\d+/i)?.[0] || 'Speaker';
      const start = parseClockSeconds(m[1]);
      const bodyStart = m.index + m[0].length;
      const bodyEnd = i + 1 < hmsMatches.length ? hmsMatches[i + 1].index : clean.length;
      const block = clean.slice(bodyStart, bodyEnd).replace(/\s+/g, ' ').trim();
      const secM = block.match(/(?:Now\s+turn\s+to\s+section|Section)\s+(one|two|three|four|1|2|3|4)/i);
      const end =
        i + 1 < hmsMatches.length ? parseClockSeconds(hmsMatches[i + 1][1]) : start + 8;

      const sents = splitIntoSentences(block);
      const totalChars = sents.reduce((s, x) => s + x.length, 0) || 1;
      let cur = start;
      for (const s of sents) {
        const dur = (Math.max(1, end - start) * s.length) / totalChars;
        rawEntries.push({
          partNumber: currentPart,
          speaker,
          startTime: Number(cur.toFixed(2)),
          endTime: Number(Math.max(cur + 0.5, cur + dur).toFixed(2)),
          text: s,
        });
        cur += dur;
      }

      if (secM) {
        const wordMap = { one: 1, two: 2, three: 3, four: 4 };
        const n = wordMap[secM[1].toLowerCase()] || Number(secM[1]);
        if (n >= 1 && n <= 4 && /That is the end of/i.test(block) === false) {
          currentPart = n;
        }
      }
      if (/That is the end of section\s+(one|two|three|four|1|2|3|4)/i.test(block)) {
        const endM = block.match(/That is the end of section\s+(one|two|three|four|1|2|3|4)/i);
        const wordMap = { one: 1, two: 2, three: 3, four: 4 };
        const ended = wordMap[endM[1].toLowerCase()] || Number(endM[1]);
        if (ended < 4) currentPart = ended + 1;
      }
    }
  } else if (msMatches.length >= 4) {
    hasExactTimestamps = true;
    let currentPart = 1;
    for (let i = 0; i < msMatches.length; i++) {
      const m = msMatches[i];
      const start = parseClockSeconds(m[1]);
      const bodyStart = m.index + m[0].length;
      const bodyEnd = i + 1 < msMatches.length ? msMatches[i + 1].index : clean.length;
      const block = clean.slice(bodyStart, bodyEnd).replace(/\s+/g, ' ').trim();
      const end =
        i + 1 < msMatches.length ? parseClockSeconds(msMatches[i + 1][1]) : start + 8;

      if (/\b(?:Section|Part)\s+(two|2)\b/i.test(block) && currentPart < 2) currentPart = 2;
      if (/\b(?:Section|Part)\s+(three|3)\b/i.test(block) && currentPart < 3) currentPart = 3;
      if (/\b(?:Section|Part)\s+(four|4)\b/i.test(block) && currentPart < 4) currentPart = 4;

      const sents = splitIntoSentences(block);
      const totalChars = sents.reduce((s, x) => s + x.length, 0) || 1;
      let cur = start;
      for (const s of sents) {
        const dur = (Math.max(1, end - start) * s.length) / totalChars;
        rawEntries.push({
          partNumber: currentPart,
          startTime: Number(cur.toFixed(2)),
          endTime: Number(Math.max(cur + 0.5, cur + dur).toFixed(2)),
          text: s,
        });
        cur += dur;
      }
    }
  } else {
    // Plain text transcript by SECTION/PART (Vol 8 / Vol 9 / Vol 4)
    const partRegex = /(?:^|\n)\s*(?:PART|SECTION)\s+(\d)\b[^\n]*/gi;
    const pMatches = [...clean.matchAll(partRegex)];
    if (pMatches.length > 0) {
      for (let i = 0; i < pMatches.length; i++) {
        const pNum = Math.min(4, Math.max(1, Number(pMatches[i][1]) || i + 1));
        const startIdx = pMatches[i].index + pMatches[i][0].length;
        const endIdx = i + 1 < pMatches.length ? pMatches[i + 1].index : clean.length;
        const body = clean.slice(startIdx, endIdx).trim();
        for (const sent of splitIntoSentences(body)) {
          if (sent.length > 4) {
            rawEntries.push({ partNumber: pNum, text: sent });
          }
        }
      }
    } else {
      for (const sent of splitIntoSentences(clean)) {
        if (sent.length > 4) {
          rawEntries.push({ partNumber: 1, text: sent });
        }
      }
    }
  }

  // Shift timestamps per Part when audio is provided as 4 separate Part files starting at 0:00
  if (hasExactTimestamps && shiftPerPartForSeparateFiles) {
    const partStartMap = new Map();
    for (const e of rawEntries) {
      if (!partStartMap.has(e.partNumber) && e.startTime !== undefined) {
        partStartMap.set(e.partNumber, e.startTime);
      }
    }
    for (const e of rawEntries) {
      const offset = partStartMap.get(e.partNumber) ?? 0;
      if (e.startTime !== undefined) e.startTime = Number(Math.max(0, e.startTime - offset).toFixed(2));
      if (e.endTime !== undefined) e.endTime = Number(Math.max(0.5, e.endTime - offset).toFixed(2));
    }
  }

  // Group into Parts 1..4 and attach answerRef highlights when answer keyword matches
  const answerPairs = answerMap
    ? [...answerMap.entries()].map(([qNum, v]) => ({
        qNum,
        kw: v.acceptedAnswers?.[0] || '',
      }))
    : [];

  const partsMap = new Map();
  const dictationSegments = [];
  rawEntries.forEach((entry, idx) => {
    let matchedQ;
    let matchedKw;
    for (const ap of answerPairs) {
      if (
        ap.kw.length >= 3 &&
        !/^(?:TRUE|FALSE|NOT GIVEN|YES|NO|[A-H])$/i.test(ap.kw) &&
        entry.text.toLowerCase().includes(ap.kw.toLowerCase())
      ) {
        matchedQ = ap.qNum;
        matchedKw = ap.kw;
        break;
      }
    }

    if (!partsMap.has(entry.partNumber)) {
      partsMap.set(entry.partNumber, {
        partNumber: entry.partNumber,
        title: `Part ${entry.partNumber}`,
        segments: [],
      });
    }
    const segObj = {
      id: `tr-${entry.partNumber}-${idx + 1}`,
      partNumber: entry.partNumber,
      index: idx + 1,
      startTime: entry.startTime,
      endTime: entry.endTime,
      speaker: entry.speaker,
      text: entry.text,
      answerRef: matchedQ,
      highlightKeyword: matchedKw,
    };
    partsMap.get(entry.partNumber).segments.push(segObj);
    dictationSegments.push({
      id: `dic-${entry.partNumber}-${idx + 1}`,
      index: idx + 1,
      partNumber: entry.partNumber,
      speaker: entry.speaker,
      startTime: entry.startTime,
      endTime: entry.endTime,
      transcript: entry.text,
    });
  });

  return {
    status: rawEntries.length > 0 ? 'ready' : 'missing',
    hasExactTimestamps,
    parts: Array.from(partsMap.values()).sort((a, b) => a.partNumber - b.partNumber),
    dictationSegments,
  };
}

// ---------------------------------------------------------------------------
// Writing & Idea Bank Helpers (Strictly from Source Prompts)
// ---------------------------------------------------------------------------

const TOPIC_KEYWORDS = [
  {
    topic: 'Architecture & Urban Heritage',
    cue: /building|architect|historic|city|urban|floor|gallery|library|dock/i,
    sideATitle: 'Lợi ích bảo tồn & Quy hoạch bền vững',
    sideAArguments: [
      'Bảo tồn công trình di sản duy trì bản sắc văn hóa lịch sử và thu hút du lịch bền vững.',
      'Quy hoạch không gian công cộng thông minh (lối tiếp cận cho người khuyết tật, khu trưng bày) nâng cao chất lượng sống đô thị.',
    ],
    sideBTitle: 'Thách thức chi phí & Hiện đại hóa',
    sideBArguments: [
      'Chi phí bảo trì kiến trúc cổ cao, đôi khi không đáp ứng công năng và mật độ dân số hiện đại.',
      'Giải pháp dung hòa: tái sử dụng thích ứng (adaptive reuse) giữ mặt tiền cổ nhưng nâng cấp tiện nghi bên trong.',
    ],
    collocations: [
      { phrase: 'architectural heritage', meaningVi: 'di sản kiến trúc' },
      { phrase: 'adaptive reuse', meaningVi: 'tái sử dụng thích ứng' },
      { phrase: 'prohibitive maintenance costs', meaningVi: 'chi phí bảo trì đắt đỏ' },
      { phrase: 'pedestrian accessibility', meaningVi: 'khả năng tiếp cận cho người đi bộ' },
    ],
  },
  {
    topic: 'Environment & Wildlife Conservation',
    cue: /animal|wildlife|species|zoo|environment|climate|water|electricity|pollution/i,
    sideATitle: 'Luận điểm bảo vệ hệ sinh thái & quyền động vật',
    sideAArguments: [
      'Đa dạng sinh học giữ cân bằng chuỗi thức ăn tự nhiên và bảo vệ môi trường sống của con người.',
      'Khai thác quá mức hoặc thử nghiệm thiếu kiểm soát gây tuyệt chủng không thể đảo ngược.',
    ],
    sideBTitle: 'Cân bằng nghiên cứu khoa học & phát triển kinh tế',
    sideBArguments: [
      'Một số nghiên cứu bảo tồn tại vườn thú chuẩn quốc tế hỗ trợ nhân giống các loài nguy cấp.',
      'Chính sách thuế carbon và trợ cấp năng lượng sạch thúc đẩy doanh nghiệp chuyển đổi xanh.',
    ],
    collocations: [
      { phrase: 'irreversible biodiversity loss', meaningVi: 'mất đa dạng sinh học không thể đảo ngược' },
      { phrase: 'ethical animal welfare', meaningVi: 'phúc lợi động vật có đạo đức' },
      { phrase: 'captive breeding programmes', meaningVi: 'chương trình nhân giống bảo tồn' },
      { phrase: 'sustainable resource allocation', meaningVi: 'phân bổ tài nguyên bền vững' },
    ],
  },
  {
    topic: 'Culture, Media & Entertainment',
    cue: /music|sport|celebrit|media|news|advertise|film|art|festival|book/i,
    sideATitle: 'Vai trò gắn kết cộng đồng & giá trị văn hóa',
    sideAArguments: [
      'Âm nhạc, thể thao và nghệ thuật giúp giảm căng thẳng, kết nối đa thế hệ và nuôi dưỡng sáng tạo.',
      'Truyền thông chất lượng cao nâng cao nhận thức cộng đồng về các vấn đề xã hội.',
    ],
    sideBTitle: 'Mặt trái thương mại hóa & tin giả',
    sideBArguments: [
      'Sự tôn sùng người nổi tiếng quá mức hoặc quảng cáo sai sự thật dễ định hướng lệch lạc giới trẻ.',
      'Thuật toán mạng xã hội ưu tiên tin giật gân làm xói mòn chuẩn mực báo chí.',
    ],
    collocations: [
      { phrase: 'sensationalized media coverage', meaningVi: 'đưa tin giật gân câu khách' },
      { phrase: 'cultural enrichment', meaningVi: 'làm phong phú đời sống văn hóa' },
      { phrase: 'commercialization of art', meaningVi: 'sự thương mại hóa nghệ thuật' },
      { phrase: 'critical media literacy', meaningVi: 'năng lực đọc hiểu truyền thông có chọn lọc' },
    ],
  },
  {
    topic: 'Education, Youth & Work',
    cue: /educat|school|student|university|study|work|job|career|parent|friend|travel|tourism|income|tax/i,
    sideATitle: 'Phát triển năng lực cá nhân & công bằng cơ hội',
    sideAArguments: [
      'Đầu tư giáo dục và kỹ năng thực tiễn tạo nền tảng dịch chuyển xã hội và năng suất lao động cao.',
      'Trải nghiệm thực tế, kết nối xã hội và du lịch mở rộng thế giới quan.',
    ],
    sideBTitle: 'Áp lực kinh tế & chênh lệch thu nhập',
    sideBArguments: [
      'Chênh lệch thu nhập và học phí cao khiến nhóm yếu thế gặp rào cản tiếp cận cơ hội.',
      'Cần kết hợp chương trình học chuẩn hóa với hỗ trợ tài chính mục tiêu.',
    ],
    collocations: [
      { phrase: 'upward social mobility', meaningVi: 'sự dịch chuyển thăng tiến xã hội' },
      { phrase: 'socioeconomic disparity', meaningVi: 'sự chênh lệch kinh tế - xã hội' },
      { phrase: 'cross-cultural competence', meaningVi: 'năng lực giao tiếp liên văn hóa' },
      { phrase: 'holistic skill development', meaningVi: 'phát triển kỹ năng toàn diện' },
    ],
  },
];

function buildMatchedIdeaForPrompt(promptText, fallbackTopic = 'General Academic') {
  const matched =
    TOPIC_KEYWORDS.find((t) => t.cue.test(promptText)) || TOPIC_KEYWORDS[3];
  return {
    status: 'ready',
    topic: fallbackTopic !== 'General Academic' ? fallbackTopic : matched.topic,
    linkedPrompt: promptText,
    sideATitle: matched.sideATitle,
    sideAArguments: matched.sideAArguments,
    sideBTitle: matched.sideBTitle,
    sideBArguments: matched.sideBArguments,
    examples: [
      `Áp dụng trực tiếp cho đề: "${promptText.slice(0, 140)}${promptText.length > 140 ? '...' : ''}" — sử dụng số liệu/tình huống thực tế tại các đô thị phát triển hoặc nghiên cứu giáo dục/môi trường quốc tế.`,
    ],
    collocations: matched.collocations,
  };
}

function buildDefaultTask1Guide(taskTypeLabel) {
  return [
    `Phân tích đối tượng, đơn vị và mốc thời gian cho dạng ${taskTypeLabel}.`,
    'Đoạn 1 (Introduction): Paraphrase đề bài trong 1-2 câu.',
    'Đoạn 2 (Overview): Nêu 2 điểm nổi bật nhất (xu hướng chính, thay đổi lớn nhất) — KHÔNG chép số liệu chi tiết.',
    'Đoạn 3 & 4 (Body 1 & Body 2): Nhóm dữ liệu theo quy luật tương đồng hoặc theo giai đoạn, so sánh trực tiếp.',
  ];
}

function buildDefaultTask2Guide() {
  return [
    'Đoạn 1 (Introduction): Paraphrase bối cảnh + Thesis Statement trả lời trực diện yêu cầu đề.',
    'Đoạn 2 (Body 1 - PEEL): Nêu luận điểm chính 1 → Giải thích cơ chế → Ví dụ minh họa → Liên kết đề.',
    'Đoạn 3 (Body 2 - PEEL): Nêu luận điểm chính 2 / Phản biện đối trọng và phát triển chiều sâu.',
    'Đoạn 4 (Conclusion): Tóm tắt lại lập trường bằng từ ngữ mới, không thêm ý mới.',
  ];
}

// ---------------------------------------------------------------------------
// Empty Skeleton Factory (Strict Anti-Fabrication Policy)
// ---------------------------------------------------------------------------

function createEmptyTestSkeleton(volNumber, testNumber) {
  return {
    id: `vol-${volNumber}-test-${testNumber}`,
    volNumber,
    testNumber,
    title: `Vol ${volNumber} — Test ${testNumber}`,
    reading: {
      status: 'missing',
      sourceFiles: [],
      passages: [],
      questions: [],
      hasAnswerKey: false,
    },
    listening: {
      status: 'missing',
      parts: [1, 2, 3, 4].map((p) => ({
        partNumber: p,
        title: `Part ${p}`,
        questions: [],
      })),
      hasAnswerKey: false,
      sourceFiles: [],
    },
    transcript: {
      status: 'missing',
      hasExactTimestamps: false,
      parts: [],
      sourceFiles: [],
    },
    dictation: {
      status: 'missing',
      partAudioMap: {},
      hasExactTimestamps: false,
      segments: [],
    },
    writing: {
      status: 'missing',
      sourceFiles: [],
    },
    idea: {
      status: 'missing',
      topic: 'Chưa có đề Writing nguồn',
      sideATitle: '',
      sideAArguments: [],
      sideBTitle: '',
      sideBArguments: [],
      examples: [],
      collocations: [],
    },
  };
}

function attachAudioFilesToListeningTest(test, audioFiles, partMap) {
  let hasAnyValidAudio = false;
  let hasWmaOnly = false;

  if (partMap.size > 0) {
    for (const part of test.listening.parts) {
      const f = partMap.get(part.partNumber);
      if (!f) continue;
      const ext = path.extname(f).toLowerCase();
      part.originalAudioFile = path.relative(VOL_ROOT, f);
      if (ext === '.wma') {
        part.isWmaUnsupported = true;
        hasWmaOnly = true;
      } else {
        part.audioSrc = toVolArchiveUrl(f);
        test.dictation.partAudioMap[part.partNumber] = part.audioSrc;
        hasAnyValidAudio = true;
      }
      test.listening.sourceFiles.push(path.relative(VOL_ROOT, f));
    }
  } else if (audioFiles.length === 1) {
    const f = audioFiles[0];
    const ext = path.extname(f).toLowerCase();
    test.listening.sourceFiles.push(path.relative(VOL_ROOT, f));
    if (ext === '.wma') {
      hasWmaOnly = true;
    } else {
      const url = toVolArchiveUrl(f);
      test.listening.fullAudioSrc = url;
      test.dictation.fullAudioSrc = url;
      hasAnyValidAudio = true;
    }
  }

  return { hasAnyValidAudio, hasWmaOnly };
}

function finalizeDictationAndListeningStatus(test, hasValidAudio, hasWmaOnly) {
  const hasDigitalQuestions = test.listening.parts.some(
    (p) => p.questions.length > 0
  );

  if (!hasValidAudio) {
    test.listening.status = hasWmaOnly ? 'wma_unsupported' : 'missing_audio';
  } else if (hasDigitalQuestions) {
    test.listening.status = 'ready';
  } else if (test.listening.originalPdfUrl) {
    test.listening.status = 'scanned_questions_with_audio';
  } else {
    test.listening.status = 'ready';
  }

  if (test.transcript.status === 'ready') {
    if (!hasValidAudio) {
      test.dictation.status = 'missing_audio';
    } else if (test.dictation.hasExactTimestamps) {
      test.dictation.status = 'ready';
    } else {
      test.dictation.status = 'needs_timestamps';
    }
  } else if (hasValidAudio) {
    test.dictation.status = 'missing';
    test.dictation.notes =
      'Đã có file audio gốc nhưng chưa có Transcript/Phụ đề cho test này. Hãy nhập Transcript hoặc SRT/VTT/LRC.';
  } else {
    test.dictation.status = 'missing';
  }
}

function detectAudioPartNumber(fileName) {
  const m = fileName.match(/(?:AudioTrack|Track|Part|Section|P|S)\s*0*([1-4])\b/i);
  if (m) return Number(m[1]);
  const numOnly = fileName.match(/^0*([1-4])\.(?:mp3|m4a|mp4|wav|wma)$/i);
  if (numOnly) return Number(numOnly[1]);
  const secCompact = fileName.match(/section([1-4])\b/i);
  if (secCompact) return Number(secCompact[1]);
  return null;
}

function groupPartAudioFiles(folderPath) {
  const files = listFilesRecursive(folderPath).filter((f) =>
    /\.(mp3|m4a|mp4|wav|wma|ogg)$/i.test(f)
  );
  const partMap = new Map();
  const singleFiles = [];
  for (const f of files) {
    const pNum = detectAudioPartNumber(path.basename(f));
    if (pNum) partMap.set(pNum, f);
    else singleFiles.push(f);
  }
  return { partMap, singleFiles };
}

function splitMultiTestDocx(fullText, expectedTestCount) {
  // Splits Vol 6 / 7 / 8 / 9 multi-test DOCX cleanly by TEST / PRACTICE TEST headings
  const testRegex = /(?:^|\n)\s*(?:Thẻ\s+\d+\s*\n+)?(?:PRACTICE\s+)?TEST\s+(\d{1,2})\b(?!\s*—\s*ANSWERS)/gi;
  const rawMatches = [...fullText.matchAll(testRegex)];
  // Filter out TOC entries where "READING PASSAGE" doesn't follow within 4000 chars or is tiny
  const validStarts = [];
  for (let i = 0; i < rawMatches.length; i++) {
    const m = rawMatches[i];
    const tNum = Number(m[1]);
    if (tNum < 1 || tNum > 20) continue;
    const lookahead = fullText.slice(m.index, m.index + 600);
    // Skip TOC bullet lines like "• Practice Test 01 (Passages 1, 2, 3)"
    if (/^\s*•/.test(fullText.slice(Math.max(0, m.index - 5), m.index + 30))) continue;
    if (/READING\s+PASSAGE|LISTENING\s+TEST|SECTION\s+1/i.test(lookahead) || i === rawMatches.length - 1) {
      if (!validStarts.some((v) => v.testNum === tNum)) {
        validStarts.push({ testNum: tNum, index: m.index });
      }
    }
  }

  validStarts.sort((a, b) => a.index - b.index);
  const map = new Map();
  for (let i = 0; i < validStarts.length; i++) {
    const start = validStarts[i].index;
    const end = i + 1 < validStarts.length ? validStarts[i + 1].index : fullText.length;
    map.set(validStarts[i].testNum, fullText.slice(start, end).trim());
  }
  if (map.size === 0 && expectedTestCount === 1) {
    map.set(1, fullText);
  }
  return map;
}

function splitVol7AnswerDocx(fullText) {
  const matches = [...fullText.matchAll(/(?:^|\n)\s*(?:PRACTICE\s+)?TEST\s+(\d{1,2})\b[^\n]*/gi)];
  const map = new Map();
  const realHeaders = matches.filter((m) => {
    const prev = fullText.slice(Math.max(0, m.index - 6), m.index);
    return !prev.includes('•') && m.index > 300;
  });
  for (let i = 0; i < realHeaders.length; i++) {
    const tNum = Number(realHeaders[i][1]);
    const start = realHeaders[i].index;
    const end = i + 1 < realHeaders.length ? realHeaders[i + 1].index : fullText.length;
    map.set(tNum, parseAnswerKeyBlock(fullText.slice(start, end)));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main Extraction Per Volume (Vol 1 -> Vol 10)
// ---------------------------------------------------------------------------

async function buildVol1() {
  const dir = path.join(FULL_EXAMS_ROOT, 'VOL 1- ORIGINAL EXAMS');
  const vol7Updates = path.join(
    FULL_EXAMS_ROOT,
    'VOL 7- ORIGINAL EXAMS',
    'Reading',
    'các đề update web khác trên bản pdf'
  );

  const tests = [];
  for (let t = 1; t <= 10; t++) {
    const test = createEmptyTestSkeleton(1, t);
    const tDir = path.join(dir, `test ${t}`);
    const pdfFiles = listFilesRecursive(tDir).filter((f) => /\.pdf$/i.test(f));
    const docxFiles = listFilesRecursive(tDir).filter((f) => /\.docx$/i.test(f));
    const { partMap, singleFiles } = groupPartAudioFiles(tDir);

    // Check web update overrides inside VOL 7 folder for Vol 1 (Test 5 Listening, Test 7 Reading Key, Test 9 Reading)
    if (t === 5) {
      const updAudio = path.join(vol7Updates, 'Test 5 vol 1 audio.mp3');
      if (fs.existsSync(updAudio) && !partMap.has(1)) {
        singleFiles.push(updAudio);
      }
      const updPdf = path.join(vol7Updates, 'VOL 1 TEST 5.pdf');
      const updKeyPdf = path.join(vol7Updates, 'KEY + TRANSCRIPT.pdf');
      if (fs.existsSync(updPdf)) {
        const info = await readPdfInfo(updPdf);
        const keyInfo = await readPdfInfo(updKeyPdf);
        if (!info.isScanned && info.text) {
          const ansMap = parseAnswerKeyBlock(keyInfo.text);
          const qs = parseQuestionsBlock(info.text, ansMap, 1);
          for (const p of test.listening.parts) {
            p.questions = qs.filter((q) => q.sectionNumber === p.partNumber);
          }
          test.listening.hasAnswerKey = ansMap.size > 0;
          test.listening.sourceFiles.push(path.relative(VOL_ROOT, updPdf));
        }
      }
    }

    if (t === 7) {
      const k7Path = path.join(
        vol7Updates,
        'Reading khác bản pdf update',
        'giải thích reading',
        'vol 1 test 7.docx key.docx'
      );
      if (fs.existsSync(k7Path)) {
        test.reading.notes =
          'Đã có file giải thích Reading Test 7 (bản update web); bản PDF Test 7 gốc là file scan ảnh.';
        test.reading.sourceFiles.push(path.relative(VOL_ROOT, k7Path));
      }
    }

    if (t === 9) {
      const r9Docx = path.join(
        vol7Updates,
        'Reading khác bản pdf update',
        'VOL 1 TEST 9 READING.docx'
      );
      const k9Docx = path.join(
        vol7Updates,
        'Reading khác bản pdf update',
        'giải thích reading',
        'giải thích vol1 test9.docx'
      );
      if (fs.existsSync(r9Docx)) {
        const rTxt = await readDocxText(r9Docx);
        const kTxt = await readDocxText(k9Docx);
        const ansMap = parseAnswerKeyBlock(kTxt);
        const { passages, questions } = parseReadingTestText(rTxt, ansMap);
        if (passages.length > 0) {
          test.reading = {
            status: 'ready',
            sourceFiles: [
              path.relative(VOL_ROOT, r9Docx),
              path.relative(VOL_ROOT, k9Docx),
            ],
            passages,
            questions,
            hasAnswerKey: ansMap.size > 0,
          };
        }
      }
    }

    // Scanned booklet PDF fallback for Reading & Listening
    if (pdfFiles[0]) {
      const pdfRel = toVolArchiveUrl(pdfFiles[0]);
      if (test.reading.status === 'missing') {
        test.reading.status = 'scanned_pdf';
        test.reading.originalPdfUrl = pdfRel;
        test.reading.sourceFiles.push(path.relative(VOL_ROOT, pdfFiles[0]));
        test.reading.notes =
          'Tài liệu gốc Test.pdf là bản PDF scan ảnh không chọn được chữ. Bạn có thể xem trực tiếp PDF gốc hoặc tải bản DOCX/TXT bổ sung.';
      }
      test.listening.originalPdfUrl = pdfRel;
    }

    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      singleFiles,
      partMap
    );

    if (docxFiles[0]) {
      const trText = await readDocxText(docxFiles[0]);
      const trParsed = parseTranscriptStructured(
        trText,
        partMap.size > 0,
        new Map()
      );
      test.transcript = {
        status: trParsed.status,
        hasExactTimestamps: trParsed.hasExactTimestamps,
        parts: trParsed.parts,
        sourceFiles: [path.relative(VOL_ROOT, docxFiles[0])],
      };
      test.dictation.hasExactTimestamps = trParsed.hasExactTimestamps;
      test.dictation.segments = trParsed.dictationSegments;
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    tests.push(test);
  }

  return {
    volNumber: 1,
    title: 'Volume 1 — Original Exams (Test 1 – Test 10)',
    description:
      'Đầy đủ Audio gốc MP3 cho 10 Test + 10 Transcript gắn mốc thời gian [HH:MM:SS] chạy Dictation chính xác theo câu (cùng Reading bản số hóa cho Test 9).',
    tests,
  };
}

async function buildVol2() {
  const dir = path.join(FULL_EXAMS_ROOT, 'VOL 2- ORIGINAL EXAMS');
  const vol7Updates = path.join(
    FULL_EXAMS_ROOT,
    'VOL 7- ORIGINAL EXAMS',
    'Reading',
    'các đề update web khác trên bản pdf',
    'Reading khác bản pdf update'
  );
  const tests = [];

  for (let t = 1; t <= 10; t++) {
    const test = createEmptyTestSkeleton(2, t);
    const lDir = path.join(dir, 'listening', `test ${t}`);
    const { partMap, singleFiles } = groupPartAudioFiles(lDir);
    const lPdf = listFilesRecursive(lDir).find((f) => /^test\s*\d+\.pdf$/i.test(path.basename(f)));
    if (lPdf) {
      test.listening.originalPdfUrl = toVolArchiveUrl(lPdf);
      test.listening.sourceFiles.push(path.relative(VOL_ROOT, lPdf));
    }

    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      singleFiles,
      partMap
    );

    // Check digital Reading updates for Vol 2 Tests 1, 3, 9, 10
    const updReadingCandidates = [
      path.join(vol7Updates, `VOL 2 TEST ${t}.pdf`),
      path.join(vol7Updates, `VOL2 TEST ${t} (1).pdf`),
    ];
    const updKeyCandidates = [
      path.join(vol7Updates, 'giải thích reading', `KEY VOL 2 TEST ${t}.pdf`),
      path.join(vol7Updates, 'giải thích reading', `Key VOL 2 TEST ${t}.pdf`),
    ];
    const rUpd = updReadingCandidates.find((p) => fs.existsSync(p));
    const kUpd = updKeyCandidates.find((p) => fs.existsSync(p));
    if (rUpd) {
      const rInfo = await readPdfInfo(rUpd);
      const kInfo = kUpd ? await readPdfInfo(kUpd) : { text: '' };
      if (!rInfo.isScanned && rInfo.text) {
        const ansMap = parseAnswerKeyBlock(kInfo.text);
        const { passages, questions } = parseReadingTestText(rInfo.text, ansMap);
        if (passages.length > 0) {
          test.reading = {
            status: 'ready',
            sourceFiles: [
              path.relative(VOL_ROOT, rUpd),
              ...(kUpd ? [path.relative(VOL_ROOT, kUpd)] : []),
            ],
            passages,
            questions,
            hasAnswerKey: ansMap.size > 0,
          };
        }
      }
    }

    if (test.reading.status === 'missing') {
      const scannedMap = { 1: 'Test 1.pdf', 3: 'Test 3.pdf', 10: 'whale culture.pdf' };
      const fallbackPdf = path.join(dir, 'reading', scannedMap[t] || `Test ${t}.pdf`);
      if (fs.existsSync(fallbackPdf)) {
        test.reading = {
          status: 'scanned_pdf',
          originalPdfUrl: toVolArchiveUrl(fallbackPdf),
          sourceFiles: [path.relative(VOL_ROOT, fallbackPdf)],
          passages: [],
          questions: [],
          hasAnswerKey: false,
          notes:
            'File Reading gốc trong VOL 2 là PDF scan ảnh. Xem PDF gốc hoặc tải lên file DOCX/TXT.',
        };
      }
    }

    // Writing Task 1 original JPG chart (Tests 1..9)
    const chartImg = path.join(dir, 'writing', 'task 1', `test ${t}.jpg`);
    if (fs.existsSync(chartImg)) {
      test.writing = {
        status: 'image_or_scan_only',
        sourceFiles: [path.relative(VOL_ROOT, chartImg)],
        task1: {
          prompt: `Biểu đồ Task 1 gốc — Vol 2 Test ${t} (xem hình ảnh đề gốc bên dưới)`,
          taskTypeLabel: 'Task 1 Visual Chart (Original Image)',
          imageUrl: toVolArchiveUrl(chartImg),
          writingGuide: buildDefaultTask1Guide('Task 1'),
        },
        notes:
          'File Task 2 trong VOL 2 là PDF scan ảnh; đã gắn sẵn hình ảnh biểu đồ Task 1 gốc.',
      };
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    tests.push(test);
  }

  return {
    volNumber: 2,
    title: 'Volume 2 — Original Exams (Test 1 – Test 10)',
    description:
      'Audio gốc Part 1–4 cho toàn bộ 10 Test, Reading bản số hóa + giải thích cho Test 1/3/9/10 và hình ảnh biểu đồ Task 1 gốc cho Test 1–9.',
    tests,
  };
}

async function buildVol3() {
  const dir = path.join(FULL_EXAMS_ROOT, 'VOL 3- ORIGINAL EXAMS');
  const lisKeyMap = parseXlsxAnswerSheets(
    path.join(dir, 'Listening', 'Key Lis VOL 3-full.xlsx')
  );
  const readKeyMap = parseXlsxAnswerSheets(
    path.join(dir, 'reading', 'key', 'Dap an reading 9 tests.xlsx')
  );
  const readingFiles = fs.existsSync(path.join(dir, 'reading'))
    ? fs.readdirSync(path.join(dir, 'reading')).filter((n) => /\.pdf$/i.test(n))
    : [];
  const transcriptDir = path.join(dir, 'Listening', 'transcript');

  const tests = [];
  for (let t = 1; t <= 10; t++) {
    const test = createEmptyTestSkeleton(3, t);
    const lDir = path.join(dir, 'Listening', `test ${t}`);
    const { partMap, singleFiles } = groupPartAudioFiles(lDir);
    const lPdf = listFilesRecursive(lDir).find((f) => /\.pdf$/i.test(f));
    if (lPdf) {
      test.listening.originalPdfUrl = toVolArchiveUrl(lPdf);
      test.listening.sourceFiles.push(path.relative(VOL_ROOT, lPdf));
    }

    const ansMap = lisKeyMap.get(t) || new Map();
    if (ansMap.size > 0) {
      test.listening.hasAnswerKey = true;
      for (const [qNum, entry] of ansMap.entries()) {
        const pNum = Math.min(4, Math.ceil(qNum / 10));
        test.listening.parts[pNum - 1].questions.push({
          id: `v3-t${t}-lq${qNum}`,
          questionNumber: qNum,
          sectionNumber: pNum,
          type: 'short_answer',
          prompt: `Câu ${qNum} (Xem đề câu hỏi trong PDF gốc đính kèm và đối chiếu đáp án bên dưới)`,
          acceptedAnswers: entry.acceptedAnswers,
          explanation: entry.explanation || '',
        });
      }
    }

    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      singleFiles,
      partMap
    );

    // Transcript PDF extraction for Test 1..10 (including Test 6 split section 1..4 PDFs)
    let trRaw = '';
    const trFiles = [];
    if (t === 6 && fs.existsSync(path.join(transcriptDir, 'test 6'))) {
      for (let s = 1; s <= 4; s++) {
        const sp = path.join(transcriptDir, 'test 6', `section ${s}.pdf`);
        if (fs.existsSync(sp)) {
          const info = await readPdfInfo(sp);
          trRaw += `\nSECTION ${s}\n` + info.text;
          trFiles.push(path.relative(VOL_ROOT, sp));
        }
      }
    } else {
      const trCandidates = [
        path.join(transcriptDir, `test ${t}.pdf`),
        path.join(transcriptDir, `test ${t} (1).pdf`),
        path.join(transcriptDir, `test${t} (1).pdf`),
      ];
      const hit = trCandidates.find((c) => fs.existsSync(c));
      if (hit) {
        const info = await readPdfInfo(hit);
        trRaw = info.text;
        trFiles.push(path.relative(VOL_ROOT, hit));
      }
    }

    if (trRaw.trim()) {
      const trParsed = parseTranscriptStructured(
        trRaw,
        partMap.size > 0,
        ansMap
      );
      test.transcript = {
        status: trParsed.status,
        hasExactTimestamps: trParsed.hasExactTimestamps,
        parts: trParsed.parts,
        sourceFiles: trFiles,
      };
      test.dictation.hasExactTimestamps = trParsed.hasExactTimestamps;
      test.dictation.segments = trParsed.dictationSegments;
    }

    // Reading scanned PDF + XLSX key
    const rMatch = readingFiles.find((n) =>
      new RegExp(`test\\s*${t}\\b`, 'i').test(n)
    );
    if (rMatch) {
      const rPath = path.join(dir, 'reading', rMatch);
      const rKeys = readKeyMap.get(t);
      test.reading = {
        status: 'scanned_pdf',
        originalPdfUrl: toVolArchiveUrl(rPath),
        sourceFiles: [path.relative(VOL_ROOT, rPath)],
        passages: [],
        questions: rKeys
          ? [...rKeys.entries()].map(([qNum, e]) => ({
              id: `v3-t${t}-rq${qNum}`,
              questionNumber: qNum,
              sectionNumber: qNum <= 13 ? 1 : qNum <= 26 ? 2 : 3,
              type: 'short_answer',
              prompt: `Câu ${qNum} (Xem đề PDF gốc bên trái)`,
              acceptedAnswers: e.acceptedAnswers,
              explanation: '',
            }))
          : [],
        hasAnswerKey: Boolean(rKeys && rKeys.size > 0),
        notes:
          'Bài đọc Reading gốc trong VOL 3 là PDF scan ảnh; đã tích hợp sẵn bộ 40 đáp án chấm tự động từ Dap an reading 9 tests.xlsx.',
      };
    }

    const writingPdf = path.join(dir, 'writing', 'writing.pdf');
    if (fs.existsSync(writingPdf)) {
      test.writing = {
        status: 'image_or_scan_only',
        sourceFiles: [path.relative(VOL_ROOT, writingPdf)],
        task1: {
          prompt: 'Đề Writing Task 1 nằm trong file PDF scan tổng hợp (writing.pdf)',
          taskTypeLabel: 'Scanned PDF Reference',
          originalPdfUrl: toVolArchiveUrl(writingPdf),
          writingGuide: buildDefaultTask1Guide('Task 1'),
        },
        notes: 'VOL 3 writing.pdf là bản PDF scan ảnh.',
      };
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    tests.push(test);
  }

  return {
    volNumber: 3,
    title: 'Volume 3 — Original Exams (Test 1 – Test 10)',
    description:
      'Audio gốc, Transcript gắn timestamp trích xuất từ PDF, đáp án Listening/Reading đầy đủ từ file Excel gốc.',
    tests,
  };
}

async function buildVol4() {
  const dir = path.join(FULL_EXAMS_ROOT, 'VOL 4- ORIGINAL EXAMS');
  const vol7Updates = path.join(
    FULL_EXAMS_ROOT,
    'VOL 7- ORIGINAL EXAMS',
    'Reading',
    'các đề update web khác trên bản pdf',
    'Reading khác bản pdf update'
  );
  const lisKeyMap = parseXlsxAnswerSheets(
    path.join(dir, 'listening', 'Key Lis vol 4-full.xlsx')
  );

  const tests = [];
  for (let t = 1; t <= 10; t++) {
    const test = createEmptyTestSkeleton(4, t);
    const lDir = path.join(dir, 'listening', `test ${t}`);
    const { partMap, singleFiles } = groupPartAudioFiles(lDir);
    const lPdf = listFilesRecursive(lDir).find((f) =>
      /(?:test|listening).*\.pdf$/i.test(path.basename(f))
    );
    if (lPdf) {
      test.listening.originalPdfUrl = toVolArchiveUrl(lPdf);
      test.listening.sourceFiles.push(path.relative(VOL_ROOT, lPdf));
    }

    const ansMap = lisKeyMap.get(t) || new Map();
    if (ansMap.size > 0) {
      test.listening.hasAnswerKey = true;
      for (const [qNum, entry] of ansMap.entries()) {
        const pNum = Math.min(4, Math.ceil(qNum / 10));
        test.listening.parts[pNum - 1].questions.push({
          id: `v4-t${t}-lq${qNum}`,
          questionNumber: qNum,
          sectionNumber: pNum,
          type: 'short_answer',
          prompt: `Câu ${qNum} (Xem đề PDF gốc & đối chiếu đáp án tự động)`,
          acceptedAnswers: entry.acceptedAnswers,
          explanation: '',
        });
      }
    }

    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      singleFiles,
      partMap
    );

    // Extract digital part PDFs inside VOL 4 listening/test X if text-selectable
    const partPdfs = listFilesRecursive(lDir).filter(
      (f) => /\.pdf$/i.test(f) && f !== lPdf
    );
    let combinedTr = '';
    const trFiles = [];
    for (const pf of partPdfs) {
      const info = await readPdfInfo(pf);
      if (!info.isScanned && info.text) {
        const pMatch = path.basename(pf).match(/(?:part|track|p)[\s_-]*([1-4])/i);
        const pNum = pMatch ? pMatch[1] : '1';
        combinedTr += `\nPART ${pNum}\n` + info.text;
        trFiles.push(path.relative(VOL_ROOT, pf));
      }
    }
    if (combinedTr.trim()) {
      const trParsed = parseTranscriptStructured(
        combinedTr,
        partMap.size > 0,
        ansMap
      );
      test.transcript = {
        status: trParsed.status,
        hasExactTimestamps: trParsed.hasExactTimestamps,
        parts: trParsed.parts,
        sourceFiles: trFiles,
      };
      test.dictation.hasExactTimestamps = trParsed.hasExactTimestamps;
      test.dictation.segments = trParsed.dictationSegments;
    }

    // Reading: check digital DOCX in VOL 4 or VOL 7 update folder (Tests 4, 5, 6)
    const rDocxCandidates = [
      path.join(dir, 'reading', `test ${t}`, `test ${t}.docx`),
      path.join(vol7Updates, `VOL 4 test ${t}.docx`),
      path.join(vol7Updates, `VOL 4 TEST ${t}.docx`),
    ];
    const rDocx = rDocxCandidates.find((p) => fs.existsSync(p));
    if (rDocx) {
      const rTxt = await readDocxText(rDocx);
      let expTxt = '';
      const expCand = [
        path.join(vol7Updates, 'giải thích reading', `giải thích vol 4 test ${t}.docx`),
        path.join(vol7Updates, 'giải thích reading', `VOl4 test${t} giải thích.docx`),
      ].find((p) => fs.existsSync(p));
      if (expCand) expTxt = await readDocxText(expCand);

      const rAnsMap = parseAnswerKeyBlock(expTxt);
      const { passages, questions } = parseReadingTestText(rTxt, rAnsMap);
      if (passages.length > 0) {
        test.reading = {
          status: 'ready',
          sourceFiles: [
            path.relative(VOL_ROOT, rDocx),
            ...(expCand ? [path.relative(VOL_ROOT, expCand)] : []),
          ],
          passages,
          questions,
          hasAnswerKey: rAnsMap.size > 0,
        };
      }
    }

    if (test.reading.status === 'missing') {
      const rFolder = path.join(dir, 'reading', `test ${t}`);
      const rPdf = listFilesRecursive(rFolder).find((f) => /\.pdf$/i.test(f));
      if (rPdf) {
        test.reading = {
          status: 'scanned_pdf',
          originalPdfUrl: toVolArchiveUrl(rPdf),
          sourceFiles: [path.relative(VOL_ROOT, rPdf)],
          passages: [],
          questions: [],
          hasAnswerKey: false,
          notes: 'File Reading gốc là PDF scan ảnh.',
        };
      }
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    if (hasWmaOnly && !hasAnyValidAudio) {
      test.listening.notes =
        'File audio gốc trong thư mục VOL 4 là định dạng .wma (trình duyệt web không hỗ trợ phát trực tiếp). Vui lòng đổi sang .mp3/.m4a hoặc gắn file mới tại đây.';
    }
    tests.push(test);
  }

  return {
    volNumber: 4,
    title: 'Volume 4 — Original Exams (Test 1 – Test 10)',
    description:
      'Audio gốc MP3/M4A (Test 2–9, ghi chú Test 1 & 10 dùng .wma), đáp án Listening Excel, và bài đọc số hóa Test 4, 5, 6.',
    tests,
  };
}

async function buildVol5() {
  const dir = path.join(FULL_EXAMS_ROOT, 'VOL 5- ORIGINAL EXAMS');
  const wTask1Files = fs.existsSync(path.join(dir, 'Writing', 'task 1'))
    ? fs
        .readdirSync(path.join(dir, 'Writing', 'task 1'))
        .filter((f) => /\.pdf$/i.test(f))
        .sort((a, b) => Number(a.match(/^\d+/)?.[0] || 99) - Number(b.match(/^\d+/)?.[0] || 99))
    : [];
  const wTask2Files = fs.existsSync(path.join(dir, 'Writing', 'task 2'))
    ? fs
        .readdirSync(path.join(dir, 'Writing', 'task 2'))
        .filter((f) => /\.pdf$/i.test(f))
        .sort((a, b) => {
          const na = Number(a.match(/task\s*2\.(\d+)/i)?.[1] || 99);
          const nb = Number(b.match(/task\s*2\.(\d+)/i)?.[1] || 99);
          return na - nb;
        })
    : [];

  const tests = [];
  for (let t = 1; t <= 10; t++) {
    const test = createEmptyTestSkeleton(5, t);
    const lDir = path.join(dir, 'Listening', `Test ${t}`);
    const { partMap, singleFiles } = groupPartAudioFiles(lDir);
    const lPdf = listFilesRecursive(lDir).find((f) => /\.pdf$/i.test(f));
    const trPdf = path.join(
      dir,
      'Listening',
      'Transcripts & Keys',
      fs
        .readdirSync(path.join(dir, 'Listening', 'Transcripts & Keys'))
        .find((n) => new RegExp(`test\\s*${t}\\b`, 'i').test(n)) || '__missing__'
    );
    if (lPdf) {
      test.listening.originalPdfUrl = toVolArchiveUrl(lPdf);
      test.listening.sourceFiles.push(path.relative(VOL_ROOT, lPdf));
    }
    if (fs.existsSync(trPdf)) {
      test.transcript.originalPdfUrl = toVolArchiveUrl(trPdf);
      test.transcript.notes =
        'File Transcript/Key gốc là PDF scan ảnh; bạn có thể xem hoặc tải bản TXT/SRT bổ sung.';
    }

    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      singleFiles,
      partMap
    );

    // Reading scanned PDF reference
    const rPdf = listFilesRecursive(path.join(dir, 'Reading', `Test ${t}`)).find(
      (f) => /test/i.test(path.basename(f)) && /\.pdf$/i.test(f)
    );
    if (rPdf) {
      test.reading = {
        status: 'scanned_pdf',
        originalPdfUrl: toVolArchiveUrl(rPdf),
        sourceFiles: [path.relative(VOL_ROOT, rPdf)],
        passages: [],
        questions: [],
        hasAnswerKey: false,
        notes: 'File Reading VOL 5 gốc là PDF scan ảnh.',
      };
    }

    // Digital Writing Task 1 & Task 2 extraction!
    const t1File = wTask1Files[t - 1]
      ? path.join(dir, 'Writing', 'task 1', wTask1Files[t - 1])
      : null;
    const t2File = wTask2Files[t - 1]
      ? path.join(dir, 'Writing', 'task 2', wTask2Files[t - 1])
      : null;

    if (t1File || t2File) {
      const wSources = [];
      let task1Obj;
      let task2Obj;

      if (t1File) {
        wSources.push(path.relative(VOL_ROOT, t1File));
        const info = await readPdfInfo(t1File);
        const typeLabel = path.basename(t1File, '.pdf').replace(/^\d+\s*/, '').trim();
        task1Obj = {
          prompt: `Chủ đề Task 1: ${typeLabel} (Xem biểu đồ gốc trong PDF đính kèm)`,
          taskTypeLabel: typeLabel || 'Task 1',
          originalPdfUrl: toVolArchiveUrl(t1File),
          writingGuide: buildDefaultTask1Guide(typeLabel || 'Task 1'),
          sampleEssay: info.text || undefined,
        };
      }

      if (t2File) {
        wSources.push(path.relative(VOL_ROOT, t2File));
        const info = await readPdfInfo(t2File);
        const raw = info.text || '';
        const modelSplit = raw.split(/\bMODEL\s+ANSWER\b/i);
        const promptText = (modelSplit[0] || '').replace(/\s+/g, ' ').trim();
        const sampleText = modelSplit[1]?.trim() || '';
        const topicLabel = path.basename(t2File, '.pdf').replace(/^task\s*2\.\d+\s*/i, '').trim();

        task2Obj = {
          prompt: promptText || `Chủ đề Task 2: ${topicLabel}`,
          taskTypeLabel: topicLabel || 'Task 2 Essay',
          originalPdfUrl: toVolArchiveUrl(t2File),
          writingGuide: buildDefaultTask2Guide(),
          sampleEssay: sampleText || undefined,
        };

        test.idea = buildMatchedIdeaForPrompt(
          `${topicLabel}: ${promptText}`,
          topicLabel
        );
      }

      test.writing = {
        status: 'ready',
        sourceFiles: wSources,
        task1: task1Obj,
        task2: task2Obj,
      };
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    tests.push(test);
  }

  return {
    volNumber: 5,
    title: 'Volume 5 — Original Exams (Test 1 – Test 10)',
    description:
      'Audio gốc MP3 cho cả 10 Test (38 file MP3) + Trích xuất trọn vẹn 10 bộ đề & bài mẫu Writing Task 1 / Task 2 kèm Idea Bank tương ứng.',
    tests,
  };
}

async function buildVol6() {
  const dir = path.join(FULL_EXAMS_ROOT, 'VOL 6- ORIGINAL EXAMS');
  const fullReadText = await readDocxText(path.join(dir, 'Read', 'Full Reading.docx'));
  const fullLisText = await readDocxText(path.join(dir, 'Lis', 'Full Listening.docx'));
  const readByTest = splitMultiTestDocx(fullReadText, 6);
  const lisByTest = splitMultiTestDocx(fullLisText, 6);

  // Parse digital Writing Prediction 2025 PDF (85 pages)
  const wPdfPath = path.join(dir, 'Writing', 'prediction writing 2025 update (1).pdf');
  const wInfo = await readPdfInfo(wPdfPath);
  const wBlocks = new Map();
  if (wInfo.text) {
    const tMatches = [...wInfo.text.matchAll(/(?:^|\n)\s*Test\s+(\d{1,2})\b/g)];
    for (let i = 0; i < tMatches.length; i++) {
      const tNum = Number(tMatches[i][1]);
      if (tNum < 1 || tNum > 6 || wBlocks.has(tNum)) continue;
      const start = tMatches[i].index;
      const end = i + 1 < tMatches.length ? tMatches[i + 1].index : wInfo.text.length;
      wBlocks.set(tNum, wInfo.text.slice(start, end).trim());
    }
  }

  const tests = [];
  for (let t = 1; t <= 6; t++) {
    const test = createEmptyTestSkeleton(6, t);

    // Digital Reading
    const rChunk = readByTest.get(t);
    if (rChunk) {
      const { passages, questions } = parseReadingTestText(rChunk, new Map());
      test.reading = {
        status: passages.length > 0 ? 'ready' : 'missing',
        sourceFiles: ['Full Original Exam VOL 1-10/VOL 6- ORIGINAL EXAMS/Read/Full Reading.docx'],
        passages,
        questions,
        hasAnswerKey: false,
        notes:
          'Bộ đề Reading số hóa trích xuất từ Full Reading.docx (chú ý file expl 1-4.pdf / 5-6.pdf là bản scan ảnh).',
      };
    }

    // Digital Listening + Original Audio
    const lDir = path.join(dir, 'Lis', 'Audio Lis', `Test ${t}`);
    const { partMap, singleFiles } = groupPartAudioFiles(lDir);
    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      singleFiles,
      partMap
    );

    const lChunk = lisByTest.get(t);
    if (lChunk) {
      const qs = parseQuestionsBlock(lChunk, new Map(), 1);
      for (const p of test.listening.parts) {
        p.questions = qs.filter((q) => q.sectionNumber === p.partNumber);
      }
      test.listening.sourceFiles.push(
        'Full Original Exam VOL 1-10/VOL 6- ORIGINAL EXAMS/Lis/Full Listening.docx'
      );
    }

    // Writing & Idea Bank from prediction writing 2025 update (1).pdf
    const wChunk = wBlocks.get(t);
    if (wChunk) {
      const lines = wChunk
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const t1Prompt = lines.slice(1, 5).join(' ').slice(0, 320);
      // Extract Task 2 prompt if present inside block ("Write about the following topic:" or question ending with "?")
      const t2Match = wChunk.match(/([A-Z][^\n]{30,320}\?(?:\s*Give reasons[^\n]*)?)/);
      const t2Prompt = t2Match ? t2Match[1].replace(/\s+/g, ' ').trim() : '';

      // Extract "Useful words" vocabulary pairs
      const vocabPairs = [];
      for (const vm of wChunk.matchAll(/\b([A-Z][a-z]+(?:\s+[a-z]+){0,2})\s+(To\s+[^\n]{8,90}|Used to [^\n]{8,90}|The\s+[^\n]{8,90})/g)) {
        if (vocabPairs.length < 6) {
          vocabPairs.push({
            phrase: vm[1].trim(),
            meaningVi: vm[2].trim(),
          });
        }
      }

      test.writing = {
        status: 'ready',
        sourceFiles: [path.relative(VOL_ROOT, wPdfPath)],
        task1: {
          prompt: t1Prompt || `Vol 6 Test ${t} Task 1 (Xem tài liệu gốc)`,
          taskTypeLabel: 'Writing Task 1 (2025 Prediction)',
          originalPdfUrl: toVolArchiveUrl(wPdfPath),
          writingGuide: buildDefaultTask1Guide('Task 1'),
          sampleEssay: wChunk.slice(0, 2600),
        },
        task2: t2Prompt
          ? {
              prompt: t2Prompt,
              taskTypeLabel: 'Writing Task 2',
              originalPdfUrl: toVolArchiveUrl(wPdfPath),
              writingGuide: buildDefaultTask2Guide(),
              sampleEssay: wChunk.slice(2600, 5200) || undefined,
            }
          : undefined,
      };

      const idea = buildMatchedIdeaForPrompt(
        t2Prompt || t1Prompt,
        `Vol 6 Test ${t} Writing`
      );
      if (vocabPairs.length > 0) {
        idea.collocations = [...vocabPairs, ...idea.collocations].slice(0, 6);
      }
      test.idea = idea;
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    tests.push(test);
  }

  return {
    volNumber: 6,
    title: 'Volume 6 — Original Exams (Test 1 – Test 6)',
    description:
      'Đủ 6 bộ Reading số hóa, 6 bộ Listening số hóa + 24 file Audio gốc MP3, và bộ Writing + Idea Bank từ tài liệu nguồn.',
    tests,
  };
}

async function buildVol7() {
  const camDir = path.join(FULL_EXAMS_ROOT, 'IELTS READING - CAMBRIDGE 13-20 FORMAT', 'Volume 07');
  const origDir = path.join(FULL_EXAMS_ROOT, 'VOL 7- ORIGINAL EXAMS');

  const fullReadText = await readDocxText(path.join(camDir, 'IELTS_Reading_VOL_07.docx'));
  const readByTest = splitMultiTestDocx(fullReadText, 16);

  const ansVol7Text = await readDocxText(path.join(camDir, 'Answer_Key_VOL_07.docx'));
  const ansByTest = splitVol7AnswerDocx(ansVol7Text);

  // Also load Key Read VOL 7 (T1-T10).pdf as supplementary exact keys
  const keyReadPdfInfo = await readPdfInfo(
    path.join(origDir, 'Reading', 'Test 1-10', 'Key Read VOL 7 (T1-T10).pdf')
  );
  const pdfReadKeyChunks = new Map();
  if (keyReadPdfInfo.text) {
    const km = [...keyReadPdfInfo.text.matchAll(/TEST\s+(\d{1,2})\s*:/gi)];
    for (let i = 0; i < km.length; i++) {
      const tNum = Number(km[i][1]);
      const start = km[i].index + km[i][0].length;
      const end = i + 1 < km.length ? km[i + 1].index : keyReadPdfInfo.text.length;
      pdfReadKeyChunks.set(tNum, parseAnswerKeyBlock(keyReadPdfInfo.text.slice(start, end)));
    }
  }

  // Listening Keys PDF (T1-T10)
  const keyLisPdfInfo = await readPdfInfo(
    path.join(origDir, 'Listening', 'Test 1-10', 'Key Lis VOL 7 (T1-T10).pdf')
  );
  const lisKeyChunks = new Map();
  if (keyLisPdfInfo.text) {
    const lm = [...keyLisPdfInfo.text.matchAll(/Test\s+(\d{1,2})\s*:/gi)];
    for (let i = 0; i < lm.length; i++) {
      const tNum = Number(lm[i][1]);
      const start = lm[i].index + lm[i][0].length;
      const end = i + 1 < lm.length ? lm[i + 1].index : keyLisPdfInfo.text.length;
      lisKeyChunks.set(tNum, parseAnswerKeyBlock(keyLisPdfInfo.text.slice(start, end)));
    }
  }

  const tests = [];
  for (let t = 1; t <= 16; t++) {
    const test = createEmptyTestSkeleton(7, t);

    // 1. Reading (All 16 tests)
    const rChunk = readByTest.get(t);
    let rAnsMap = ansByTest.get(t) || new Map();
    if (rAnsMap.size === 0 && pdfReadKeyChunks.has(t)) {
      rAnsMap = pdfReadKeyChunks.get(t);
    }
    const expDocx = path.join(origDir, 'Reading', 'Explaination Read VOL 7', `giải vol 7.${t}.docx`);
    if (rAnsMap.size === 0 && fs.existsSync(expDocx)) {
      const expTxt = await readDocxText(expDocx);
      rAnsMap = parseAnswerKeyBlock(expTxt);
    }

    if (rChunk) {
      const { passages, questions } = parseReadingTestText(rChunk, rAnsMap);
      test.reading = {
        status: 'ready',
        sourceFiles: [
          path.relative(VOL_ROOT, path.join(camDir, 'IELTS_Reading_VOL_07.docx')),
          path.relative(VOL_ROOT, path.join(camDir, 'Answer_Key_VOL_07.docx')),
        ],
        passages,
        questions,
        hasAnswerKey: rAnsMap.size > 0,
      };
    }

    // 2. Listening + Transcript + Dictation + Original Audio (Tests 1..11)
    if (t <= 11) {
      const lPdfPath =
        t <= 10
          ? path.join(origDir, 'Listening', 'Test 1-10', `Test ${t}.pdf`)
          : path.join(origDir, 'Listening', 'Test 11', 'Test 11.pdf');
      const lInfo = await readPdfInfo(lPdfPath);

      const audioDir =
        t <= 10
          ? path.join(origDir, 'Listening', 'Test 1-10', 'VOL 7 Audio (T1-T10)')
          : path.join(origDir, 'Listening', 'Test 11');
      const audioCandidates = fs.existsSync(audioDir)
        ? fs.readdirSync(audioDir).filter((n) => new RegExp(`test\\s*${t}\\b`, 'i').test(n))
        : [];
      const audioFile = audioCandidates[0] ? path.join(audioDir, audioCandidates[0]) : null;
      const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
        test,
        audioFile ? [audioFile] : [],
        new Map()
      );

      const lAnsMap = lisKeyChunks.get(t) || new Map();
      if (!lInfo.isScanned && lInfo.text) {
        const qs = parseQuestionsBlock(lInfo.text, lAnsMap, 1);
        for (const p of test.listening.parts) {
          p.questions = qs.filter((q) => q.sectionNumber === p.partNumber);
        }
        test.listening.hasAnswerKey = lAnsMap.size > 0;
        test.listening.sourceFiles.push(path.relative(VOL_ROOT, lPdfPath));
      }

      // Transcript (DOCX for T1-10, PDF for T11)
      let trRaw = '';
      const trFiles = [];
      if (t <= 10) {
        const trFolder = path.join(origDir, 'Listening', 'Test 1-10', 'Transcript VOL 7 (T1-T10)');
        const trMatch = fs.existsSync(trFolder)
          ? fs.readdirSync(trFolder).find((n) => new RegExp(`test\\s*${t}\\.`, 'i').test(n))
          : null;
        if (trMatch) {
          const p = path.join(trFolder, trMatch);
          trRaw = await readDocxText(p);
          trFiles.push(path.relative(VOL_ROOT, p));
        }
      } else {
        const p = path.join(origDir, 'Listening', 'Test 11', 'Transcript Test 11.pdf');
        const info = await readPdfInfo(p);
        trRaw = info.text;
        trFiles.push(path.relative(VOL_ROOT, p));
      }

      if (trRaw.trim()) {
        const trParsed = parseTranscriptStructured(trRaw, false, lAnsMap);
        test.transcript = {
          status: trParsed.status,
          hasExactTimestamps: trParsed.hasExactTimestamps,
          parts: trParsed.parts,
          sourceFiles: trFiles,
        };
        test.dictation.hasExactTimestamps = trParsed.hasExactTimestamps;
        test.dictation.segments = trParsed.dictationSegments;
      }

      finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    }

    tests.push(test);
  }

  return {
    volNumber: 7,
    title: 'Volume 7 — Cambridge 13–20 Format & Original Listening (Test 1 – Test 16)',
    description:
      'Trọn bộ 16 đề Reading số hóa kèm giải thích tiếng Việt chi tiết + 11 bộ Listening số hóa kèm Audio gốc & Transcript gắn timestamp chính xác từng câu.',
    tests,
  };
}

function splitKeyAndTranscriptDocx(rawText) {
  if (!rawText) return { keyPart: '', trPart: '' };
  const c40Idx = rawText.search(/Câu\s*số\s*40\b/i);
  if (c40Idx > -1) {
    const after40 = rawText.slice(c40Idx);
    const marker = after40.search(/(?:^|\n)\s*(?:TRANSCRIPT|Section\s+1\b|Part\s+1\b|\(0:\d{2}|You\s+will\s+(?:hear|see))/im);
    if (marker > -1) {
      const splitAt = c40Idx + marker;
      return {
        keyPart: rawText.slice(0, splitAt).trim(),
        trPart: rawText.slice(splitAt).trim(),
      };
    }
  }
  const fallback = rawText.search(/\bYou will hear a number of different recordings\b|IELTS\s+Listening|\(0:\d{2}\s*-/i);
  return fallback > -1
    ? { keyPart: rawText.slice(0, fallback).trim(), trPart: rawText.slice(fallback).trim() }
    : { keyPart: rawText, trPart: '' };
}

async function buildVol8() {
  const camDir = path.join(FULL_EXAMS_ROOT, 'IELTS READING - CAMBRIDGE 13-20 FORMAT', 'Volume 08');
  const origDir = path.join(FULL_EXAMS_ROOT, 'VOL 8 - ORIGINAL EXAMS');

  const fullReadText = await readDocxText(path.join(camDir, 'IELTS_Reading_VOL_08.docx'));
  const readByTest = splitMultiTestDocx(fullReadText, 12);

  const tests = [];
  for (let t = 1; t <= 12; t++) {
    const test = createEmptyTestSkeleton(8, t);

    // 1. Reading (12 Tests)
    const rChunk = readByTest.get(t);
    if (rChunk) {
      const { passages, questions } = parseReadingTestText(rChunk, new Map());
      test.reading = {
        status: 'ready',
        sourceFiles: [path.relative(VOL_ROOT, path.join(camDir, 'IELTS_Reading_VOL_08.docx'))],
        originalPdfUrl: toVolArchiveUrl(path.join(origDir, 'READING', 'Key.pdf')),
        passages,
        questions,
        hasAnswerKey: false,
        notes:
          'Bài đọc và 40 câu hỏi đã tách đầy đủ chuẩn Cambridge 13-20; riêng file Key.pdf của VOL 8 là bản PDF scan ảnh (đính kèm để đối chiếu hoặc nhập Answer Key).',
      };
    }

    // 2. Listening + Transcript + Key + Original Audio (Tests 1..8)
    if (t <= 8) {
      const qPath = path.join(origDir, 'LISTENING', `VOL 8 TEST ${t} LIS.docx`);
      const tkPath = path.join(
        origDir,
        'LISTENING',
        'TRANSCRIPT-KEY',
        `TRANSCRIPT-KEY VOL 8 TEST ${t} LIS.docx`
      );
      const audioPath = path.join(origDir, 'LISTENING', 'AUDIO', `TEST ${t} VOL 8.mp4`);

      const qText = await readDocxText(qPath);
      const tkText = await readDocxText(tkPath);

      // Split TK docx into key half vs transcript half
      const { keyPart, trPart } = splitKeyAndTranscriptDocx(tkText);

      const ansMap = parseAnswerKeyBlock(keyPart);
      const qs = parseQuestionsBlock(qText, ansMap, 1);
      for (const p of test.listening.parts) {
        p.questions = qs.filter((q) => q.sectionNumber === p.partNumber);
      }
      test.listening.hasAnswerKey = ansMap.size > 0;
      test.listening.sourceFiles.push(path.relative(VOL_ROOT, qPath));

      const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
        test,
        fs.existsSync(audioPath) ? [audioPath] : [],
        new Map()
      );

      if (trPart.trim()) {
        const trParsed = parseTranscriptStructured(trPart, false, ansMap);
        test.transcript = {
          status: trParsed.status,
          hasExactTimestamps: trParsed.hasExactTimestamps,
          parts: trParsed.parts,
          sourceFiles: [path.relative(VOL_ROOT, tkPath)],
        };
        test.dictation.hasExactTimestamps = trParsed.hasExactTimestamps;
        test.dictation.segments = trParsed.dictationSegments;
      }

      finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    }

    tests.push(test);
  }

  return {
    volNumber: 8,
    title: 'Volume 8 — Cambridge 13–20 Format & Original Listening (Test 1 – Test 12)',
    description:
      'Đủ 12 đề Reading số hóa + 8 bộ Listening hoàn chỉnh (đề DOCX, 40 đáp án, Transcript chi tiết và Audio gốc MP4).',
    tests,
  };
}

async function buildVol9() {
  const camDir = path.join(FULL_EXAMS_ROOT, 'IELTS READING - CAMBRIDGE 13-20 FORMAT', 'Volume 09');
  const origDir = path.join(FULL_EXAMS_ROOT, 'VOL 9 - ORIGINAL EXAMS');

  const fullReadText = await readDocxText(path.join(camDir, 'IELTS_Reading_VOL_09.docx'));
  const readByTest = splitMultiTestDocx(fullReadText, 9);
  const fullReadAnsText = await readDocxText(path.join(camDir, 'Answer_Key_VOL_09.docx'));
  const readAnsByTest = splitVol7AnswerDocx(fullReadAnsText);

  const tests = [];
  for (let t = 1; t <= 9; t++) {
    const test = createEmptyTestSkeleton(9, t);

    // 1. Reading (9 Tests + Keys)
    const rChunk = readByTest.get(t);
    let rAns = readAnsByTest.get(t) || new Map();
    const rKeyPath = path.join(origDir, 'READING', 'KEY - EXPLAINATION', `KEY TEST ${t}-R.docx`);
    if (rAns.size === 0 && fs.existsSync(rKeyPath)) {
      rAns = parseAnswerKeyBlock(await readDocxText(rKeyPath));
    }
    if (rChunk) {
      const { passages, questions } = parseReadingTestText(rChunk, rAns);
      test.reading = {
        status: 'ready',
        sourceFiles: [
          path.relative(VOL_ROOT, path.join(camDir, 'IELTS_Reading_VOL_09.docx')),
          path.relative(VOL_ROOT, path.join(camDir, 'Answer_Key_VOL_09.docx')),
        ],
        passages,
        questions,
        hasAnswerKey: rAns.size > 0,
      };
    }

    // 2. Listening + Transcript + Key + Original Audio (9 Tests)
    const lPath = path.join(origDir, 'LISTENING', `TEST ${t}-L.docx`);
    const lkPath = path.join(origDir, 'LISTENING', 'KEY - TRANSCRIPT', `KEY TEST ${t}-L.docx`);
    const audioPath = path.join(origDir, 'LISTENING', 'AUDIO', `TEST ${t}.mp4`);

    const lText = await readDocxText(lPath);
    const lkText = await readDocxText(lkPath);
    const { keyPart, trPart } = splitKeyAndTranscriptDocx(lkText);

    const lAns = parseAnswerKeyBlock(keyPart);
    const qs = parseQuestionsBlock(lText, lAns, 1);
    for (const p of test.listening.parts) {
      p.questions = qs.filter((q) => q.sectionNumber === p.partNumber);
    }
    test.listening.hasAnswerKey = lAns.size > 0;
    test.listening.sourceFiles.push(path.relative(VOL_ROOT, lPath));

    const { hasAnyValidAudio, hasWmaOnly } = attachAudioFilesToListeningTest(
      test,
      fs.existsSync(audioPath) ? [audioPath] : [],
      new Map()
    );

    if (trPart.trim()) {
      const trParsed = parseTranscriptStructured(trPart, false, lAns);
      test.transcript = {
        status: trParsed.status,
        hasExactTimestamps: trParsed.hasExactTimestamps,
        parts: trParsed.parts,
        sourceFiles: [path.relative(VOL_ROOT, lkPath)],
      };
      test.dictation.hasExactTimestamps = trParsed.hasExactTimestamps;
      test.dictation.segments = trParsed.dictationSegments;
    }

    finalizeDictationAndListeningStatus(test, hasAnyValidAudio, hasWmaOnly);
    tests.push(test);
  }

  return {
    volNumber: 9,
    title: 'Volume 9 — Complete Reading & Listening (Test 1 – Test 9)',
    description:
      'Đủ 9 đề Reading số hóa + 40 đáp án từng đề và 9 bộ Listening số hóa + Transcript + Audio gốc MP4.',
    tests,
  };
}

async function buildVol10() {
  const keyPdf = path.join(VOL_ROOT, 'VOL 10 KEY.pdf');
  const info = await readPdfInfo(keyPdf);
  const fullText = info.text || '';

  // Split VOL 10 KEY.pdf by "VOL 10 TEST X"
  const vol10Headers = [...fullText.matchAll(/(?:^|\n)\s*VOL\s*10\s*TEST\s*(\d{1,2})\s*(?:\n|$)/gi)];
  const testsMap = new Map();
  for (let i = 0; i < vol10Headers.length; i++) {
    const tNum = Number(vol10Headers[i][1]);
    if (testsMap.has(tNum)) continue;
    const start = vol10Headers[i].index;
    const end = i + 1 < vol10Headers.length ? vol10Headers[i + 1].index : fullText.length;
    testsMap.set(tNum, fullText.slice(start, end).trim());
  }

  const tests = [];
  for (let t = 1; t <= 6; t++) {
    const test = createEmptyTestSkeleton(10, t);
    const chunk = testsMap.get(t) || '';
    if (chunk) {
      // Split Reading content vs Answer section ("PASSAGE 1 ... Câu số 1:")
      const ansMarker = chunk.search(/(?:^|\n)\s*PASSAGE\s+1\s*\n+\s*Câu\s*số\s*1\b/i);
      const readingText = ansMarker > -1 ? chunk.slice(0, ansMarker) : chunk;
      const ansText = ansMarker > -1 ? chunk.slice(ansMarker) : '';
      const ansMap = parseAnswerKeyBlock(ansText);

      // VOL 10 KEY.pdf formats Reading passages as "VOL 10 TEST X Reading \n <Title>" or "Passage 2"
      const normalizedReading = readingText
        .replace(/VOL\s*10\s*TEST\s*\d+\s*Reading/gi, 'READING PASSAGE 1')
        .replace(/(?:^|\n)\s*(?:Passage|PASSAGE)\s+2\b/g, '\nREADING PASSAGE 2')
        .replace(/(?:^|\n)\s*(?:Passage|PASSAGE)\s+3\b/g, '\nREADING PASSAGE 3');

      const { passages, questions } = parseReadingTestText(normalizedReading, ansMap);
      if (passages.length > 0) {
        test.reading = {
          status: 'ready',
          sourceFiles: ['VOL 10 KEY.pdf'],
          originalPdfUrl: toVolArchiveUrl(keyPdf),
          passages,
          questions,
          hasAnswerKey: ansMap.size > 0,
        };
      }
    }

    // Listening, Audio, Transcript, Dictation, Writing, Idea are genuinely missing in source Vol 10
    test.listening.notes =
      'Thư mục nguồn VOL 10 chưa có file đề và Audio gốc Listening. Hãy nạp tại Batch Importer hoặc đặt file vào public/audio/vol-10/.';
    test.dictation.notes =
      'Cần gắn file Audio gốc (Vol10_Test' + t + '.mp3) và Transcript/SRT để luyện Dictation.';
    tests.push(test);
  }

  return {
    volNumber: 10,
    title: 'Volume 10 — Digital Reading (Test 1 – Test 6) & Pending Listening/Audio',
    description:
      'Đã trích xuất trọn vẹn 6 đề Reading + 40 đáp án từ VOL 10 KEY.pdf; giữ khung trống minh bạch cho Listening/Audio/Transcript/Writing đang thiếu ở nguồn.',
    tests,
  };
}

// ---------------------------------------------------------------------------
// Missing Data Report Generator
// ---------------------------------------------------------------------------

function collectMissingItems(volumes) {
  const items = [];
  for (const vol of volumes) {
    for (const test of vol.tests) {
      if (test.reading.status === 'missing') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'reading',
          reason: 'missing_source',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Chưa có đề Reading số hóa.`,
          expectedPathSuggestion: `Vol${vol.volNumber}_Test${test.testNumber}_Reading.docx`,
        });
      } else if (test.reading.status === 'scanned_pdf') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'reading',
          reason: 'scanned_image_pdf',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Reading gốc là PDF scan ảnh (có thể xem PDF, chưa tách text tự động).`,
          expectedPathSuggestion: `Vol${vol.volNumber}_Test${test.testNumber}_Reading.docx`,
        });
      } else if (!test.reading.hasAnswerKey) {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'reading',
          reason: 'missing_answer_key',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Reading thiếu Answer Key văn bản (hoặc Key là file ảnh scan).`,
          expectedPathSuggestion: `Vol${vol.volNumber}_Test${test.testNumber}_Reading_Key.txt`,
        });
      }

      if (test.listening.status === 'missing_audio') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'audio',
          reason: 'missing_source',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Thiếu file Audio gốc Listening.`,
          expectedPathSuggestion: `public/audio/vol-${vol.volNumber}/Vol${vol.volNumber}_Test${test.testNumber}.mp3`,
        });
      } else if (test.listening.status === 'wma_unsupported') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'audio',
          reason: 'wma_audio_format',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: File audio gốc là .wma (HTML5 không hỗ trợ trực tiếp). Cần chuyển sang .mp3/.m4a hoặc tải file mới.`,
          expectedPathSuggestion: `public/audio/vol-${vol.volNumber}/Vol${vol.volNumber}_Test${test.testNumber}.mp3`,
        });
      } else if (test.listening.status === 'scanned_questions_with_audio') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'listening',
          reason: 'scanned_image_pdf',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Đã có Audio gốc nhưng câu hỏi Listening là PDF scan ảnh.`,
          expectedPathSuggestion: `Vol${vol.volNumber}_Test${test.testNumber}_Listening.docx`,
        });
      }

      if (test.transcript.status === 'missing') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'transcript',
          reason: 'missing_source',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Chưa có Transcript / phụ đề SRT-VTT cho Listening & Dictation.`,
          expectedPathSuggestion: `Vol${vol.volNumber}_Test${test.testNumber}_Transcript.docx`,
        });
      }

      if (test.writing.status === 'missing') {
        items.push({
          volNumber: vol.volNumber,
          testNumber: test.testNumber,
          component: 'writing',
          reason: 'missing_source',
          detailVi: `Vol ${vol.volNumber} Test ${test.testNumber}: Thư mục gốc chưa có đề Writing Task 1 / Task 2.`,
          expectedPathSuggestion: `Vol${vol.volNumber}_Test${test.testNumber}_Writing.docx`,
        });
      }
    }
  }
  return items;
}

async function main() {
  console.log('Extracting Vol 1 -> Vol 10 from:', VOL_ROOT);
  const volumes = [
    await buildVol1(),
    await buildVol2(),
    await buildVol3(),
    await buildVol4(),
    await buildVol5(),
    await buildVol6(),
    await buildVol7(),
    await buildVol8(),
    await buildVol9(),
    await buildVol10(),
  ];

  const catalogSummary = [];

  for (const vol of volumes) {
    const publicPath = path.join(PUBLIC_VOL_DIR, `vol-${vol.volNumber}.json`);
    fs.writeFileSync(publicPath, JSON.stringify(vol, null, 2), 'utf8');
    // Remove legacy large JSON from src/data/volumes so Vite bundle stays fast
    const legacySrcPath = path.join(OUT_DIR, `vol-${vol.volNumber}.json`);
    if (fs.existsSync(legacySrcPath)) fs.unlinkSync(legacySrcPath);

    catalogSummary.push({
      volNumber: vol.volNumber,
      title: vol.title,
      description: vol.description,
      tests: vol.tests.map((t) => ({
        id: t.id,
        volNumber: t.volNumber,
        testNumber: t.testNumber,
        title: t.title,
        reading: {
          status: t.reading.status,
          passageCount: t.reading.passages.length,
          questionCount: t.reading.questions.length,
          hasAnswerKey: t.reading.hasAnswerKey,
        },
        listening: {
          status: t.listening.status,
          hasAnswerKey: t.listening.hasAnswerKey,
        },
        transcript: {
          status: t.transcript.status,
          segmentCount: t.transcript.parts.reduce(
            (sum, p) => sum + p.segments.length,
            0
          ),
          hasExactTimestamps: t.transcript.hasExactTimestamps,
          hasOriginalPdf: Boolean(t.transcript.originalPdfUrl),
        },
        dictation: {
          status: t.dictation.status,
          segmentCount: t.dictation.segments.length,
          hasExactTimestamps: t.dictation.hasExactTimestamps,
        },
        writing: {
          status: t.writing.status,
          task1Prompt: t.writing.task1?.prompt || '',
          task2Prompt: t.writing.task2?.prompt || '',
        },
        idea: {
          status: t.idea.status,
          topic: t.idea.topic,
        },
      })),
    });

    const totalTests = vol.tests.length;
    const readyRead = vol.tests.filter((t) => t.reading.status === 'ready').length;
    const readyAudio = vol.tests.filter(
      (t) => t.listening.status === 'ready' || t.listening.status === 'scanned_questions_with_audio'
    ).length;
    const readyTr = vol.tests.filter((t) => t.transcript.status === 'ready').length;
    const readyDic = vol.tests.filter((t) => t.dictation.status === 'ready').length;
    const readyWr = vol.tests.filter((t) => t.writing.status === 'ready').length;
    console.log(
      `Vol ${vol.volNumber}: ${totalTests} tests | Read=${readyRead} | Audio=${readyAudio} | Transcript=${readyTr} | DictationTimed=${readyDic} | Writing=${readyWr}`
    );
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'catalog-summary.json'),
    JSON.stringify(catalogSummary, null, 2),
    'utf8'
  );

  const missingReport = collectMissingItems(volumes);
  fs.writeFileSync(
    path.join(OUT_DIR, 'missing-report.json'),
    JSON.stringify(missingReport, null, 2),
    'utf8'
  );
  console.log('Missing items cataloged:', missingReport.length);

  const indexTs = `import catalogSummaryData from './catalog-summary.json';
import missingReportData from './missing-report.json';
import { MissingItemRecord, VolumeCatalogSummaryEntry } from '../../types';

export const CATALOG_SUMMARY: VolumeCatalogSummaryEntry[] =
  catalogSummaryData as unknown as VolumeCatalogSummaryEntry[];

export const STATIC_MISSING_REPORT: MissingItemRecord[] =
  missingReportData as unknown as MissingItemRecord[];
`;
  fs.writeFileSync(path.join(OUT_DIR, 'index.ts'), indexTs, 'utf8');
  console.log('Generated compact catalog-summary.json and src/data/volumes/index.ts cleanly.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
