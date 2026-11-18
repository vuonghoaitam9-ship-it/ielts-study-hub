import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

let workerInitialized = false;

function ensurePdfWorker(): void {
  if (!workerInitialized && typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerInitialized = true;
  }
}

export interface FileExtractionResult {
  text: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'unsupported';
  pageCount?: number;
  isScannedPdf: boolean;
  errorReason?: 'SCANNED_OR_IMAGE_PDF' | 'LEGACY_DOC_FORMAT' | 'UNSUPPORTED_FILE' | 'READ_ERROR';
  errorMessage?: string;
}

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

export async function extractTextFromFile(
  file: File
): Promise<FileExtractionResult> {
  const fileName = file.name;
  const lower = fileName.toLowerCase();

  try {
    if (lower.endsWith('.txt') || lower.endsWith('.md') || file.type === 'text/plain') {
      const text = await file.text();
      return {
        text: text.replace(/\r\n/g, '\n'),
        fileName,
        fileType: 'txt',
        isScannedPdf: false,
      };
    }

    if (lower.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const cleanText = (result.value || '').replace(/\r\n/g, '\n').trim();
      if (!cleanText) {
        return {
          text: '',
          fileName,
          fileType: 'docx',
          isScannedPdf: false,
          errorReason: 'READ_ERROR',
          errorMessage:
            'File DOCX không chứa văn bản có thể đọc được (có thể chỉ chứa ảnh chụp). Vui lòng dán văn bản trực tiếp hoặc dùng file DOCX dạng văn bản.',
        };
      }
      return {
        text: cleanText,
        fileName,
        fileType: 'docx',
        isScannedPdf: false,
      };
    }

    if (lower.endsWith('.doc')) {
      return {
        text: '',
        fileName,
        fileType: 'unsupported',
        isScannedPdf: false,
        errorReason: 'LEGACY_DOC_FORMAT',
        errorMessage:
          'Định dạng .doc cũ (binary Word 97-2003) không hỗ trợ đọc trực tiếp trên trình duyệt. Vui lòng mở bằng Word/Google Docs và lưu lại dưới dạng .docx, .pdf (văn bản) hoặc dán nội dung trực tiếp.',
      };
    }

    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      ensurePdfWorker();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const pageTexts: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        let pageOut = '';
        let lastY: number | null = null;

        for (const rawItem of content.items) {
          const item = rawItem as PdfTextItemLike;
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
          if (item.hasEOL) {
            pageOut += '\n';
          }
          if (y !== null) {
            lastY = y;
          }
        }

        pageTexts.push(pageOut.trim());
      }

      const fullText = pageTexts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
      const nonWhitespaceLength = fullText.replace(/\s+/g, '').length;
      const minExpectedChars = Math.min(50, Math.max(1, pdf.numPages) * 25);

      if (pdf.numPages >= 1 && nonWhitespaceLength < minExpectedChars) {
        return {
          text: '',
          fileName,
          fileType: 'pdf',
          pageCount: pdf.numPages,
          isScannedPdf: true,
          errorReason: 'SCANNED_OR_IMAGE_PDF',
          errorMessage: `File PDF (${pdf.numPages} trang) là file scan dạng ảnh hoặc không có lớp văn bản chọn được (chỉ tìm thấy ${nonWhitespaceLength} ký tự). Hệ thống không tự bịa nội dung đề thi. Vui lòng chuyển đổi OCR sang .docx/.txt, hoặc sao chép và dán văn bản vào ô nhập thủ công.`,
        };
      }

      return {
        text: fullText,
        fileName,
        fileType: 'pdf',
        pageCount: pdf.numPages,
        isScannedPdf: false,
      };
    }

    return {
      text: '',
      fileName,
      fileType: 'unsupported',
      isScannedPdf: false,
      errorReason: 'UNSUPPORTED_FILE',
      errorMessage: `Định dạng file "${fileName}" chưa được hỗ trợ. Vui lòng dùng .pdf (dạng văn bản), .docx hoặc .txt.`,
    };
  } catch (err) {
    return {
      text: '',
      fileName,
      fileType: 'unsupported',
      isScannedPdf: false,
      errorReason: 'READ_ERROR',
      errorMessage:
        err instanceof Error
          ? `Không thể đọc file "${fileName}": ${err.message}`
          : `Không thể đọc file "${fileName}".`,
    };
  }
}
