import {
  ListeningPart,
  ListeningTranscriptLine,
  QuestionItem,
  QuestionType,
  ReadingParagraph,
  ReadingPassage,
} from '../types';

export interface ParseDocumentInput {
  title?: string;
  skill: 'reading' | 'listening';
  mainText: string;
  answerKeyText?: string;
  transcriptText?: string;
  sourceFileName?: string;
}

export interface ParsedAnswerEntry {
  questionNumber: number;
  acceptedAnswers: string[];
  explanation: string;
  evidenceQuote?: string;
}

export interface ParsedDocumentOutput {
  title: string;
  skill: 'reading' | 'listening';
  passages: ReadingPassage[];
  listeningParts: ListeningPart[];
  questions: QuestionItem[];
  parseWarnings: string[];
  hasFormatErrors: boolean;
}

function splitParagraphsWithLabels(rawText: string): ReadingParagraph[] {
  const blocks = rawText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const labelMatch = block.match(/^(?:\[?([A-H])\]?[\.\)\:\s]+)(.+)$/s);
    if (labelMatch && labelMatch[2].trim().length > 20) {
      return {
        label: labelMatch[1],
        text: labelMatch[2].replace(/\n+/g, ' ').trim(),
      };
    }
    return {
      text: block.replace(/\n+/g, ' ').trim(),
    };
  });
}

function detectInstructionType(line: string): QuestionType | null {
  const upper = line.toUpperCase();
  if (upper.includes('TRUE') && upper.includes('FALSE') && upper.includes('NOT GIVEN')) {
    return 'tfng';
  }
  if (upper.includes('YES') && upper.includes('NO') && upper.includes('NOT GIVEN')) {
    return 'ynng';
  }
  if (
    upper.includes('LIST OF HEADINGS') ||
    upper.includes('CHOOSE THE CORRECT HEADING')
  ) {
    return 'matching_headings';
  }
  if (
    upper.includes('WHICH PARAGRAPH CONTAINS') ||
    upper.includes('MATCH EACH') ||
    upper.includes('CLASSIFY THE FOLLOWING')
  ) {
    return 'matching_info';
  }
  if (
    upper.includes('CHOOSE THE CORRECT LETTER') ||
    upper.includes('CHOOSE TWO LETTERS') ||
    upper.includes('MULTIPLE CHOICE')
  ) {
    return 'mcq';
  }
  if (
    upper.includes('ONE WORD ONLY') ||
    upper.includes('NO MORE THAN') ||
    upper.includes('COMPLETE THE NOTES') ||
    upper.includes('COMPLETE THE SUMMARY') ||
    upper.includes('COMPLETE THE TABLE') ||
    upper.includes('COMPLETE THE SENTENCES')
  ) {
    return 'gap_fill';
  }
  if (upper.includes('ANSWER THE QUESTIONS BELOW')) {
    return 'short_answer';
  }
  return null;
}

export function parseAnswerKeyText(rawKeyText: string): Map<number, ParsedAnswerEntry> {
  const result = new Map<number, ParsedAnswerEntry>();
  if (!rawKeyText || !rawKeyText.trim()) return result;

  const lines = rawKeyText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern A (Vol 8/9/10 Vietnamese multiline): "Câu số 1:" followed by answer on next line
    const vnNumOnly = line.match(/^Câu\s*số\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*:?\s*(.*)$/i);
    if (vnNumOnly) {
      const qStart = Number(vnNumOnly[1]);
      const qEnd = vnNumOnly[2] ? Number(vnNumOnly[2]) : qStart;
      let ansVal = vnNumOnly[3]?.trim() || '';
      if (!ansVal && i + 1 < lines.length) {
        ansVal = lines[i + 1].trim();
        i += 1;
      }
      if (ansVal && !/^\.{3}$/.test(ansVal)) {
        const parts = ansVal
          .split(/\s*(?:\/|;|,|\bor\b)\s*/i)
          .map((s) => s.trim())
          .filter(Boolean);
        if (qEnd > qStart && parts.length >= 2) {
          for (let q = qStart; q <= qEnd; q++) {
            result.set(q, {
              questionNumber: q,
              acceptedAnswers: parts,
              explanation: `Đáp án nhóm câu ${qStart}-${qEnd}: ${ansVal}`,
            });
          }
        } else {
          result.set(qStart, {
            questionNumber: qStart,
            acceptedAnswers: ansVal
              .split(/\s*(?:\/|;|\bor\b)\s*/i)
              .map((s) => s.trim())
              .filter(Boolean),
            explanation: '',
          });
        }
      }
      continue;
    }

    // Pattern B (Vol 7 rich explanation): "Câu hỏi X: ..." followed by "Đáp án: ..."
    const vnRich = line.match(/^Câu\s*hỏi\s*(\d{1,2})\s*:/i);
    if (vnRich) {
      const qNum = Number(vnRich[1]);
      let answer = '';
      let evidenceQuote: string | undefined;
      const expParts: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^Câu\s*(?:hỏi|số)\s*\d+/i.test(lines[j]) && !/^PASSAGE\s+\d+/i.test(lines[j])) {
        const sub = lines[j];
        const ansM = sub.match(/^Đáp\s*án\s*:\s*(.+)$/i);
        const evM = sub.match(/^Câu\s+trong\s+passage[^:]*:\s*["“]?(.+?)["”]?$/i);
        if (ansM) answer = ansM[1].trim();
        else if (evM) {
          evidenceQuote = evM[1].trim();
          expParts.push(sub);
        } else {
          expParts.push(sub);
        }
        j += 1;
      }
      if (answer) {
        result.set(qNum, {
          questionNumber: qNum,
          acceptedAnswers: answer
            .split(/\s*(?:\/|;|\bor\b)\s*/i)
            .map((s) => s.trim())
            .filter(Boolean),
          explanation: expParts.join(' | '),
          evidenceQuote,
        });
      }
      i = j - 1;
      continue;
    }

    // Skip header lines like "ANSWER KEY", "PART 1", "PASSAGE 1"
    if (/^(?:answer\s*key|answers|đáp\s*án|part\s*\d+|section\s*\d+|reading\s*passage\s*\d+)$/i.test(line)) {
      continue;
    }

    // Pattern C: "1. TRUE — Explanation" or "Q1: W4 8PL / W48PL | Giải thích: ..."
    const match = line.match(
      /^(?:Q(?:uestion)?\s*)?(\d{1,2})\s*[\.\)\:\-\]]\s*(.+)$/i
    );
    if (!match) continue;

    const qNum = Number(match[1]);
    if (Number.isNaN(qNum) || qNum < 1 || qNum > 60) continue;

    const rest = match[2].trim();
    let answerPart = rest;
    let explanation = '';
    let evidenceQuote: string | undefined;

    const expSplit = rest.split(/\s*(?:\||—|--|Giải thích:|Explanation:)\s*/i);
    if (expSplit.length > 1) {
      answerPart = expSplit[0].trim();
      explanation = expSplit.slice(1).join(' | ').trim();
    } else {
      const parenMatch = rest.match(/^([^\(\)]+?)\s*\((.{8,})\)$/);
      if (parenMatch) {
        answerPart = parenMatch[1].trim();
        explanation = parenMatch[2].trim();
      }
    }

    const evMatch = explanation.match(/(?:Evidence|Trích dẫn)\s*:\s*["“]?([^"”|]+)["”]?/i);
    if (evMatch) {
      evidenceQuote = evMatch[1].trim();
    }

    const acceptedAnswers = answerPart
      .split(/\s*(?:\/|;|\bor\b)\s*/i)
      .map((s) => s.trim())
      .filter(Boolean);

    if (acceptedAnswers.length > 0) {
      result.set(qNum, {
        questionNumber: qNum,
        acceptedAnswers,
        explanation,
        evidenceQuote,
      });
    }
  }

  return result;
}

function inferQuestionTypeFromContent(
  prompt: string,
  options: string[],
  activeType: QuestionType
): QuestionType {
  if (/_{2,}|\.{3,}|\[blank\]/i.test(prompt)) {
    return 'gap_fill';
  }
  if (options.length >= 2) {
    return 'mcq';
  }
  return activeType;
}

function parseQuestionsSection(
  rawQuestionsText: string,
  answerMap: Map<number, ParsedAnswerEntry>,
  defaultSection: number
): QuestionItem[] {
  const lines = rawQuestionsText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const questions: QuestionItem[] = [];
  let activeSection = defaultSection;
  let activeType: QuestionType = 'gap_fill';
  let activeInstruction = '';

  interface DraftQ {
    questionNumber: number;
    sectionNumber: number;
    type: QuestionType;
    instruction: string;
    promptLines: string[];
    options: string[];
  }

  let current: DraftQ | null = null;

  const flushCurrent = () => {
    if (!current) return;
    const prompt = current.promptLines.join(' ').replace(/\s+/g, ' ').trim();
    const finalType = inferQuestionTypeFromContent(
      prompt,
      current.options,
      current.type
    );
    const keyInfo = answerMap.get(current.questionNumber);
    const options =
      finalType === 'tfng' && current.options.length === 0
        ? ['TRUE', 'FALSE', 'NOT GIVEN']
        : finalType === 'ynng' && current.options.length === 0
          ? ['YES', 'NO', 'NOT GIVEN']
          : current.options.length > 0
            ? current.options
            : undefined;

    questions.push({
      id: `q-${current.questionNumber}-${Math.random().toString(36).slice(2, 7)}`,
      questionNumber: current.questionNumber,
      sectionNumber: current.sectionNumber,
      type: finalType,
      instruction: current.instruction || undefined,
      prompt,
      options,
      acceptedAnswers: keyInfo?.acceptedAnswers ?? [],
      explanation: keyInfo?.explanation ?? '',
      evidenceQuote: keyInfo?.evidenceQuote,
    });
    current = null;
  };

  for (const line of lines) {
    const secMatch = line.match(
      /^(?:READING\s+)?(?:PASSAGE|PART|SECTION)\s+(\d+)/i
    );
    if (secMatch && line.length < 40) {
      flushCurrent();
      activeSection = Math.min(4, Math.max(1, Number(secMatch[1])));
      continue;
    }

    const detectedType = detectInstructionType(line);
    if (detectedType) {
      flushCurrent();
      activeType = detectedType;
      activeInstruction = line;
      continue;
    }

    if (/^Questions?\s+\d+\s*[-–to]+\s*\d+/i.test(line)) {
      flushCurrent();
      activeInstruction = line;
      continue;
    }

    // Check if line starts a new numbered question: e.g. "1. ...", "1) ...", "Q1. ..."
    const qStart = line.match(/^(?:Q(?:uestion)?\s*)?(\d{1,2})\s*[\.\)\:\-]\s+(.+)$/i);
    if (qStart) {
      const qNum = Number(qStart[1]);
      if (qNum >= 1 && qNum <= 60) {
        flushCurrent();
        current = {
          questionNumber: qNum,
          sectionNumber: activeSection,
          type: activeType,
          instruction: activeInstruction,
          promptLines: [qStart[2].trim()],
          options: [],
        };
        continue;
      }
    }

    // Check inline fill-in-the-blank marker like "... until ______ (2) _____" or "2 __________"
    const inlineBlankOnly = line.match(/^(\d{1,2})\s+([_\.]{3,}.*)$/);
    if (inlineBlankOnly) {
      const qNum = Number(inlineBlankOnly[1]);
      if (qNum >= 1 && qNum <= 60) {
        flushCurrent();
        current = {
          questionNumber: qNum,
          sectionNumber: activeSection,
          type: 'gap_fill',
          instruction: activeInstruction,
          promptLines: [inlineBlankOnly[2].trim()],
          options: [],
        };
        continue;
      }
    }

    // Check MCQ option line: "A. text" or "A) text" or "A text" when inside a question
    const optMatch = line.match(/^([A-H])[\.\)\:]\s+(.+)$/);
    if (optMatch && current) {
      current.options.push(`${optMatch[1]}. ${optMatch[2].trim()}`);
      continue;
    }

    // Also support multiple options on a single line: "A. foo   B. bar   C. baz"
    if (current && /\b[A-D][\.\)]\s+\S+.*\b[B-D][\.\)]\s+\S+/.test(line)) {
      const multi = line.split(/(?=\b[A-D][\.\)]\s+)/).map((s) => s.trim());
      current.options.push(...multi.filter(Boolean));
      continue;
    }

    if (current) {
      current.promptLines.push(line);
    }
  }

  flushCurrent();

  // Deduplicate by questionNumber keeping first parsed, and fill any orphan answers from answerMap
  const seen = new Set<number>();
  const deduped: QuestionItem[] = [];
  for (const q of questions) {
    if (!seen.has(q.questionNumber)) {
      seen.add(q.questionNumber);
      deduped.push(q);
    }
  }

  deduped.sort((a, b) => a.questionNumber - b.questionNumber);
  return deduped;
}

function splitReadingPassagesAndQuestions(rawText: string): {
  passageChunks: Array<{ num: number; title: string; body: string }>;
  questionText: string;
} {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const passageRegex =
    /(?:^|\n)\s*(?:READING\s+)?PASSAGE\s+(\d+)(?:\s*[:.\-–—]?\s*(?=\n|$)|\s*[:\-–—]\s+[^\n]+)/gi;
  const matches = [...normalized.matchAll(passageRegex)];

  const passageByNum = new Map<number, { num: number; title: string; body: string }>();
  const questionSegments: string[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end =
        i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
      const slice = normalized.slice(start, end).trim();
      const firstLineEnd = slice.indexOf('\n');
      const header = firstLineEnd > -1 ? slice.slice(0, firstLineEnd).trim() : slice;
      const rest = firstLineEnd > -1 ? slice.slice(firstLineEnd + 1).trim() : '';

      const qMarker = rest.search(
        /(?:^|\n)\s*(?:Questions?\s+\d+|TRUE\s*\/?\s*FALSE|YES\s*\/?\s*NO|Choose the correct letter|1\.\s+\S)/i
      );
      const passageNum = Number(matches[i][1]) || i + 1;
      const rawPassageBody =
        qMarker > -1 ? rest.slice(0, qMarker).trim() : rest;

      // Extract optional standalone passage title line right beneath "READING PASSAGE X"
      let finalTitle = header;
      let finalBody = rawPassageBody;
      const firstBodyLineEnd = rawPassageBody.indexOf('\n');
      if (firstBodyLineEnd > -1) {
        const candidateTitle = rawPassageBody.slice(0, firstBodyLineEnd).trim();
        const afterTitle = rawPassageBody.slice(firstBodyLineEnd + 1).trim();
        const looksLikeParagraph =
          /^(?:[A-H][\.\)\:]\s|You should spend)/i.test(candidateTitle) ||
          candidateTitle.endsWith('.') ||
          candidateTitle.length > 110;
        if (candidateTitle && !looksLikeParagraph && afterTitle.length > 0) {
          finalTitle = candidateTitle;
          finalBody = afterTitle;
        }
      }

      const prev = passageByNum.get(passageNum);
      if (!prev || finalBody.length > prev.body.length) {
        passageByNum.set(passageNum, {
          num: passageNum,
          title: finalTitle,
          body: finalBody,
        });
      }

      if (qMarker > -1) {
        questionSegments.push(`PASSAGE ${passageNum}\n` + rest.slice(qMarker).trim());
      }
    }
    const passageChunks = [...passageByNum.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, chunk]) => chunk);
    return { passageChunks, questionText: questionSegments.join('\n\n') };
  }

  const passageChunks: Array<{ num: number; title: string; body: string }> = [];

  // Fallback single passage: split around Questions marker
  const qMarker = normalized.search(
    /(?:^|\n)\s*(?:Questions?\s+\d+|TRUE\s*\/?\s*FALSE|YES\s*\/?\s*NO|Choose the correct letter|\b1[\.\)]\s+[A-Z])/i
  );

  if (qMarker > 80) {
    const body = normalized.slice(0, qMarker).trim();
    const lines = body.split('\n');
    const title = lines[0]?.length < 110 ? lines[0].trim() : 'Reading Passage 1';
    const content = lines[0]?.length < 110 ? lines.slice(1).join('\n').trim() : body;
    passageChunks.push({
      num: 1,
      title,
      body: content,
    });
    questionSegments.push(normalized.slice(qMarker).trim());
  } else if (qMarker === 0) {
    // Only questions pasted without passage
    questionSegments.push(normalized);
  } else {
    // Only passage text pasted without explicit questions
    const lines = normalized.split('\n');
    const title = lines[0]?.length < 110 ? lines[0].trim() : 'Reading Passage 1';
    const content = lines[0]?.length < 110 ? lines.slice(1).join('\n').trim() : normalized;
    passageChunks.push({
      num: 1,
      title,
      body: content,
    });
  }

  return { passageChunks, questionText: questionSegments.join('\n\n') };
}

function parseHmsToSec(clock: string): number {
  const parts = clock.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseTranscriptIntoParts(rawTranscript: string): ListeningPart[] {
  const clean = rawTranscript.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const partRegex = /(?:^|\n)\s*(?:PART|SECTION)\s+(\d+)\b[^\n]*/gi;
  const matches = [...clean.matchAll(partRegex)];

  const buildLines = (blockText: string, partNumber: number): ListeningTranscriptLine[] => {
    const rawLines = blockText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const out: ListeningTranscriptLine[] = rawLines.map((line, idx) => {
      // Match "Speaker 1 [00:00:01] text"
      const spTime = line.match(
        /^([A-Za-z][A-Za-z0-9\s]{1,22}?)\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)$/
      );
      if (spTime) {
        return {
          id: `p${partNumber}-line-${idx + 1}`,
          speaker: spTime[1].trim(),
          startTime: parseHmsToSec(spTime[2]),
          text: spTime[3].trim(),
        };
      }
      // Match "0:01 text" or "[01:23] text"
      const leadTime = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+(.+)$/);
      if (leadTime) {
        const textBody = leadTime[2].trim();
        const sp = textBody.match(/^([A-Za-z][A-Za-z0-9\s]{1,20}):\s+(.+)$/);
        return {
          id: `p${partNumber}-line-${idx + 1}`,
          speaker: sp ? sp[1].trim() : undefined,
          startTime: parseHmsToSec(leadTime[1]),
          text: sp ? sp[2].trim() : textBody,
        };
      }
      const speakerMatch = line.match(/^([A-Za-z][A-Za-z0-9\s]{1,22}):\s+(.+)$/);
      return {
        id: `p${partNumber}-line-${idx + 1}`,
        speaker: speakerMatch ? speakerMatch[1].trim() : undefined,
        text: speakerMatch ? speakerMatch[2].trim() : line,
      };
    });

    // Compute endTime from next startTime when consecutive timestamps exist
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i].startTime !== undefined && out[i + 1].startTime !== undefined) {
        out[i].endTime = Math.max(out[i].startTime! + 0.5, out[i + 1].startTime!);
      }
    }
    return out;
  };

  if (matches.length === 0) {
    return [
      {
        partNumber: 1,
        title: 'Part 1',
        lines: buildLines(clean, 1),
      },
    ];
  }

  const parts: ListeningPart[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? clean.length) : clean.length;
    const slice = clean.slice(start, end).trim();
    const firstNewline = slice.indexOf('\n');
    const header = firstNewline > -1 ? slice.slice(0, firstNewline).trim() : slice;
    const body = firstNewline > -1 ? slice.slice(firstNewline + 1).trim() : '';
    const partNumber = Math.min(4, Math.max(1, Number(matches[i][1]) || i + 1));

    parts.push({
      partNumber,
      title: header || `Part ${partNumber}`,
      lines: buildLines(body, partNumber),
    });
  }

  return parts;
}

export function parseIeltsDocument(input: ParseDocumentInput): ParsedDocumentOutput {
  const parseWarnings: string[] = [];
  let mainText = (input.mainText || '').replace(/\r\n/g, '\n').trim();
  let embeddedKeyText = '';
  let embeddedTranscriptText = '';

  // Extract embedded Answer Key if not passed separately
  const keyHeadingIdx = mainText.search(
    /(?:^|\n)\s*(?:ANSWER\s*KEY|ANSWERS|ĐÁP\s*ÁN(?:\s*VÀ\s*GIẢI\s*THÍCH)?)\s*(?:\n|:)/i
  );
  if (keyHeadingIdx > -1) {
    embeddedKeyText = mainText.slice(keyHeadingIdx).trim();
    mainText = mainText.slice(0, keyHeadingIdx).trim();
  }

  // Extract embedded Transcript for Listening if present inside mainText
  const transcriptHeadingIdx = mainText.search(
    /(?:^|\n)\s*(?:TAPESCRIPT|TRANSCRIPT|AUDIO\s*SCRIPT)\s*(?:\n|:)/i
  );
  if (transcriptHeadingIdx > -1) {
    embeddedTranscriptText = mainText.slice(transcriptHeadingIdx).trim();
    mainText = mainText.slice(0, transcriptHeadingIdx).trim();
  }

  const combinedKeyText = [embeddedKeyText, input.answerKeyText || '']
    .filter(Boolean)
    .join('\n');
  const answerMap = parseAnswerKeyText(combinedKeyText);

  const combinedTranscriptText = (
    input.transcriptText?.trim() || embeddedTranscriptText
  ).trim();

  let passages: ReadingPassage[] = [];
  let listeningParts: ListeningPart[] = [];
  let questions: QuestionItem[] = [];

  if (input.skill === 'reading') {
    const { passageChunks, questionText } =
      splitReadingPassagesAndQuestions(mainText);
    passages = passageChunks.map((chunk) => ({
      id: `passage-${chunk.num}`,
      passageNumber: chunk.num,
      title: chunk.title,
      paragraphs: splitParagraphsWithLabels(chunk.body),
    }));

    questions = parseQuestionsSection(questionText, answerMap, 1);

    if (
      passages.length === 0 ||
      passages.every((p) => p.paragraphs.length === 0)
    ) {
      parseWarnings.push(
        'Không tách được nội dung bài đọc (Reading Passage). Vui lòng kiểm tra lại tài liệu gốc hoặc nhập/chỉnh sửa bài đọc ở bước Preview & Edit.'
      );
    }
  } else {
    // Listening
    listeningParts = parseTranscriptIntoParts(combinedTranscriptText);
    questions = parseQuestionsSection(mainText, answerMap, 1);

    if (listeningParts.length === 0) {
      parseWarnings.push(
        'Chưa có nội dung Transcript cho bài Listening. Bạn vẫn có thể lưu đề kèm file Audio và bổ sung Transcript thủ công sau.'
      );
    }
  }

  // Validation & Format Warnings
  if (questions.length === 0) {
    parseWarnings.push(
      'Không nhận diện được câu hỏi đánh số (vd: "1. ...", "2) ..."). Hãy kiểm tra định dạng tài liệu hoặc thêm/chỉnh sửa câu hỏi thủ công.'
    );
  } else {
    const missingAnswers = questions
      .filter((q) => q.acceptedAnswers.length === 0)
      .map((q) => q.questionNumber);
    if (missingAnswers.length > 0) {
      parseWarnings.push(
        `Chưa tìm thấy đáp án cho ${missingAnswers.length} câu hỏi (${missingAnswers.slice(0, 12).join(', ')}${missingAnswers.length > 12 ? '...' : ''}). Hãy nhập đáp án thủ công hoặc tải thêm file Answer Key.`
      );
    }

    const emptyPrompts = questions
      .filter((q) => q.prompt.trim().length < 3)
      .map((q) => q.questionNumber);
    if (emptyPrompts.length > 0) {
      parseWarnings.push(
        `Câu hỏi số ${emptyPrompts.join(', ')} có nội dung quá ngắn hoặc bị lỗi xuống dòng.`
      );
    }

    const badMcq = questions
      .filter((q) => q.type === 'mcq' && (!q.options || q.options.length < 2))
      .map((q) => q.questionNumber);
    if (badMcq.length > 0) {
      parseWarnings.push(
        `Câu Multiple Choice số ${badMcq.join(', ')} thiếu các lựa chọn A/B/C/D. Vui lòng rà soát trong trình chỉnh sửa.`
      );
    }

    // Check numbering gaps (e.g., jumps from 2 to 5)
    const nums = questions.map((q) => q.questionNumber);
    const missingSeq: number[] = [];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        for (let k = nums[i - 1] + 1; k < nums[i]; k++) {
          missingSeq.push(k);
        }
      }
    }
    if (missingSeq.length > 0) {
      parseWarnings.push(
        `Phát hiện nhảy số thứ tự câu hỏi (bị thiếu câu: ${missingSeq.slice(0, 10).join(', ')}).`
      );
    }
  }

  const derivedTitle =
    input.title?.trim() ||
    passages[0]?.title ||
    (input.sourceFileName
      ? input.sourceFileName.replace(/\.[^.]+$/, '')
      : `Đề ${input.skill === 'reading' ? 'Reading' : 'Listening'} cá nhân`);

  return {
    title: derivedTitle,
    skill: input.skill,
    passages,
    listeningParts,
    questions,
    parseWarnings,
    hasFormatErrors: parseWarnings.length > 0,
  };
}
