# IELTS Academic Study Hub (Mục tiêu 14/02/2027)

Ứng dụng web học tiếng Anh & luyện thi **IELTS Academic** cá nhân hóa với lộ trình **88 ngày (18/11/2026 – 14/02/2027)** và **Kho bộ đề Vol 1 – Vol 10** tích hợp 6 hợp phần liên kết chặt chẽ cho từng bài Test:

> **Reading → Listening (100% Audio gốc) → Transcript → Dictation (cắt đoạn theo timestamp audio gốc) → Writing → Idea Bank**

---

## 1. Stack công nghệ & Kiến trúc
- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Lucide Icons + React Router v7
- **Lưu trữ cục bộ 100% (Local-First)**:
  - **IndexedDB (`Dexie.js v2`)**: Lưu bộ đề cá nhân, `volOverrides` (audio/transcript/VTT/SRT bổ sung cho từng Test thuộc Vol 1–10), `volProgress` (tiến độ từng hợp phần), file audio nhị phân (`Blob` MP3/M4A/WAV), bài làm (`TestAttempt`), thẻ từ vựng SM-2, Sổ tay lỗi sai (`ErrorLog`), tiến độ Lộ trình và nhật ký giờ học.
  - **LocalStorage**: Lưu cấu hình mục tiêu cá nhân (Band hiện tại `5.5 – 6.0`, Target `6.5 – 7.5+`, thời lượng `2.5h/ngày`, ngày bắt đầu `18/11/2026`, ngày thi `14/02/2027`).
- **Tách tài liệu & Phụ đề phía trình duyệt**:
  - `pdfjs-dist` (tách văn bản PDF & phát hiện PDF scan dạng ảnh)
  - `mammoth` (tách văn bản Word `.docx`)
  - `src/lib/subtitleParser.ts` (parse `.srt`, `.vtt`, `.lrc`, tự động khớp tên file audio/transcript theo mẫu `Vol X Test Y Part Z`)
- **Strict Original Audio Policy**:
  - Tuyệt đối không dùng Text-to-Speech (`speechSynthesis`), Web Speech API hay audio tạo bởi AI.
  - Hỗ trợ phát **100% file audio gốc** qua hai kênh:
    1. Vite read-only middleware `/vol-archive/*` đọc trực tiếp từ `F:\IELTS\Vol` (hỗ trợ HTTP `206 Partial Content` tua chính xác tới từng mili-giây).
    2. Thư mục `public/audio/vol-1/` đến `public/audio/vol-10/` hoặc kéo-thả trực tiếp trong trình duyệt (`Batch Import Vol 1–10` / modal gắn file inline, lưu thẳng `Blob` vào IndexedDB).

---

## 2. Cấu trúc dữ liệu Vol 1 – Vol 10
- **Metadata tổng quan**: [`src/data/volumes/catalog-summary.json`](src/data/volumes/catalog-summary.json) & [`src/data/volumes/missing-report.json`](src/data/volumes/missing-report.json)
- **Dữ liệu chi tiết theo từng Vol (lazy-load)**: `public/data/volumes/vol-1.json` ... `public/data/volumes/vol-10.json`
- **Schema chuẩn (`src/types/volumes.ts`)**: `Vol (1-10) → Test → 6 Skills`:
  - `reading`: passages (nhãn đoạn `A/B/C...`), questions, answers, explanations, hoặc `originalPdfUrl` cho bài PDF scan.
  - `listening`: part (1–4), `tracks[]` (`audioSrc` tới file gốc), `duration`, `questions`, `answers`, `explanation`.
  - `transcript`: phân đoạn theo Part gồm `startTime`, `endTime`, `speaker`, `text`, `answerRef`.
  - `dictation`: tái sử dụng **chính `audioSrc` gốc của Listening**, cắt từng câu theo `(startTime, endTime)` hoặc mở **Timestamp / SRT Editor** nếu transcript gốc chưa có timestamp.
  - `writing`: đề bài `Task 1` (kèm ảnh biểu đồ gốc `.jpg` / PDF nếu có), `Task 2`, hướng dẫn lập dàn ý và bài mẫu tham khảo.
  - `idea`: Kho ý tưởng riêng theo đề (Side A / Side B, ví dụ cụ thể, collocations lưu 1-click sang Flashcard SM-2).

---

## 3. Cấu trúc thư mục chính
```text
f:\IELTS\ielts-study-hub\
├── public/
│   ├── audio/vol-1/ .. vol-10/  # Thư mục đặt audio gốc MP3/M4A/WAV (tùy chọn)
│   └── data/volumes/vol-1..10.json
├── scripts/
│   └── extract-vol-1-10.mjs     # Script đọc-chỉ F:\IELTS\Vol (DOCX/PDF/XLSX/JPG/Audio) -> JSON
└── src/
    ├── components/              # Layout, VolTestCrossNav, AudioPlayerBar, TimestampEditorModal, HighlightedPassage...
    ├── context/                 # ProfileContext & bộ đếm giờ học
    ├── data/volumes/            # catalog-summary.json, missing-report.json, index.ts
    ├── db/                      # database.ts (Dexie v2: volOverrides, volProgress), seedDemoData.ts
    ├── lib/                     # volumeRepository.ts, subtitleParser.ts, roadmapGenerator.ts, documentParser.ts, grading.ts, dictationDiff.ts, sm2.ts
    ├── pages/                   # VolumeHubPage, VolBatchImporterPage, ReadingTestPage, ListeningTestPage, DictationPage, WritingPage...
    └── __tests__/               # Vitest unit tests
```

---

## 4. Hướng dẫn cài đặt, nạp dữ liệu & chạy ứng dụng

1. Di chuyển vào thư mục ứng dụng:
   ```powershell
   cd f:\IELTS\ielts-study-hub
   ```
2. Cài đặt dependencies (PowerShell dùng `npm.cmd`):
   ```powershell
   npm.cmd install
   ```
3. *(Tùy chọn)* Nạp lại JSON Vol 1–10 từ `F:\IELTS\Vol` (chỉ đọc, không sửa file gốc):
   ```powershell
   node scripts/extract-vol-1-10.mjs
   ```
4. Chạy dev server (kích hoạt middleware `/vol-archive/*` phát file audio/PDF/ảnh gốc từ `F:\IELTS\Vol`):
   ```powershell
   npm.cmd run dev
   ```
5. Mở trình duyệt tại `http://localhost:5173/volumes` để truy cập **Kho đề Vol 1 – Vol 10**, hoặc `/volumes/import` để kéo-thả hàng loạt file audio gốc / file `.srt`/`.vtt`/`.docx` bổ sung cho các mục `.wma` hay thiếu.
6. Chạy kiểm thử tự động & build kiểm tra sản phẩm:
   ```powershell
   npm.cmd run test -- --run
   npm.cmd run build
   ```

---

## 5. Công cụ bổ sung dữ liệu thiếu & Timestamp
- **Timestamp / SRT Editor**: Ngay trên trang `/dictation?vol=X&test=Y`, nếu bài nghe chưa có timestamp từng câu, bạn có thể nhập file `.srt`/`.vtt`/`.lrc`, dùng nút phân bổ đều hoặc nghe audio gốc và bấm **Đặt Start / End + Câu tiếp theo** trực tiếp.
- **Batch Import Vol 1–10 (`/volumes/import`)**: Hỗ trợ kéo-thả nhiều file một lúc (ví dụ `Vol4_Test1_Part1.mp3`, `Vol7_Test2_transcript.srt`), tự nhận diện Vol/Test/Part và hiển thị **Báo cáo mục thiếu (Missing Report)** cho toàn bộ 10 Vol (PDF scan, `.wma` cần chuyển sang `.mp3`, đề chưa số hóa).
