import {
  RoadmapDay,
  RoadmapPhase,
  RoadmapTask,
  RoadmapTaskCategory,
  StudyRoadmap,
  UserProfile,
} from '../types';
import { addDaysToISODate } from './sm2';

export const DEFAULT_START_DATE = '2026-11-18';
export const DEFAULT_EXAM_DATE = '2027-02-14';

/**
 * Computes exact calendar days between two YYYY-MM-DD strings using UTC midnight
 * so DST transitions never cause off-by-one errors.
 * calculateDaysBetween('2026-11-18', '2027-02-14') === 88.
 */
export function calculateDaysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86_400_000);
}

export function formatDateVN(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  if (!y || !m || !d) return dateISO;
  return `${d}/${m}/${y}`;
}

interface DayBlueprint {
  focusTitle: string;
  items: Array<{
    title: string;
    description: string;
    category: RoadmapTaskCategory;
    targetRoute: string;
    weight: number;
  }>;
}

const PHASE_1_TEMPLATES: DayBlueprint[] = [
  {
    focusTitle: 'Listening Part 1-2 & Dictation Nền tảng',
    items: [
      {
        title: 'Dictation: Nghe chép chính tả 1 đoạn ngắn (Word-level diff)',
        description:
          'Luyện nghe chính xác số đếm, đánh vần tên riêng, ngày tháng và nối âm cơ bản.',
        category: 'dictation',
        targetRoute: '/dictation',
        weight: 0.35,
      },
      {
        title: 'Reading: Skimming & Scanning + Gap Fill',
        description:
          'Đọc bài đọc học thuật, gạch chân từ khóa định vị (keywords) và luyện điền từ giới hạn.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.35,
      },
      {
        title: 'SRS Vocab: Ôn & Lưu 15 từ vựng học thuật (AWL)',
        description:
          'Hoàn thành thẻ Flashcard đến hạn hôm nay bằng thuật toán SM-2.',
        category: 'vocab',
        targetRoute: '/vocab',
        weight: 0.3,
      },
    ],
  },
  {
    focusTitle: 'Reading True/False/Not Given & Writing Task 1 Overview',
    items: [
      {
        title: 'Reading: Chiến lược phân biệt False vs Not Given',
        description:
          'Thực hành đọc đối chiếu câu hỏi với bằng chứng trong đoạn văn, tránh suy diễn.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.4,
      },
      {
        title: 'Writing Task 1: Phân tích Line Graph & Viết Overview',
        description:
          'Nắm vững cấu trúc 4 đoạn và mẫu câu mô tả xu hướng tăng/giảm đạt Band 7.0+.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.35,
      },
      {
        title: 'Listening: Nghe Part 1-2 & Kiểm tra Transcript',
        description:
          'Tập trung bắt bẫy thông tin tự sửa (self-correction) trong hội thoại.',
        category: 'listening',
        targetRoute: '/listening',
        weight: 0.25,
      },
    ],
  },
  {
    focusTitle: 'Củng cố Ngữ pháp Writing Task 2 & Nghe chép chính tả',
    items: [
      {
        title: 'Writing Task 2: Phân tích 4 tiêu chí chấm & Câu phức',
        description:
          'Đọc kỹ chuẩn Task Response, Coherence & Cohesion, Lexical Resource và GRA.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.4,
      },
      {
        title: 'Dictation: Cải thiện độ chính xác > 85%',
        description:
          'Nghe chép từng câu có timestamp, chú ý đuôi -s/-ed và mạo từ a/an/the.',
        category: 'dictation',
        targetRoute: '/dictation',
        weight: 0.35,
      },
      {
        title: 'Error Log & SRS: Ôn lại các câu sai & từ vựng mới',
        description:
          'Xem lại Sổ tay lỗi sai để không lặp lại lỗi chính tả hoặc hiểu nhầm ngữ cảnh.',
        category: 'review',
        targetRoute: '/errors',
        weight: 0.25,
      },
    ],
  },
  {
    focusTitle: 'Nạp tài liệu cá nhân & Luyện đọc Passage 1-2',
    items: [
      {
        title: 'Document Parser: Tách 1 đề cá nhân (PDF/DOCX) vào Ngân hàng đề',
        description:
          'Tải tài liệu cá nhân, kiểm tra Preview & Edit để sẵn sàng giải đề trên giao diện IDP.',
        category: 'reading',
        targetRoute: '/parser',
        weight: 0.25,
      },
      {
        title: 'Reading: Hoàn thành 1 Passage bấm giờ 20 phút',
        description:
          'Sử dụng công cụ Highlight 2 màu & Note trực tiếp trên văn bản thi máy.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.45,
      },
      {
        title: 'SRS Vocab: Lưu collocations chủ đề Education & Environment',
        description:
          'Trích xuất từ vựng từ bài đọc và Idea Bank vào kho Flashcard SM-2.',
        category: 'vocab',
        targetRoute: '/vocab',
        weight: 0.3,
      },
    ],
  },
];

const PHASE_2_TEMPLATES: DayBlueprint[] = [
  {
    focusTitle: 'Chuyên sâu Reading Matching Headings & Listening Part 3',
    items: [
      {
        title: 'Reading: Chinh phục Matching Headings & Matching Information',
        description:
          'Đọc câu chủ đề (topic sentence) và tóm tắt ý chính đoạn văn trước khi chọn heading.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.4,
      },
      {
        title: 'Listening Part 3: Thảo luận học thuật & Multiple Choice',
        description:
          'Luyện nhận diện thái độ đồng tình/phản đối và bẫy paraphrasing trong bài nghe.',
        category: 'listening',
        targetRoute: '/listening',
        weight: 0.35,
      },
      {
        title: 'SRS Vocab: Ôn thẻ đến hạn & Củng cố Academic Collocations',
        description: 'Duy trì retention rate trên 85% với thẻ SM-2.',
        category: 'vocab',
        targetRoute: '/vocab',
        weight: 0.25,
      },
    ],
  },
  {
    focusTitle: 'Writing Task 1 (Bar / Pie / Table / Map / Process) & Idea Bank',
    items: [
      {
        title: 'Writing Task 1: Luyện dạng so sánh (Bar/Pie/Table) hoặc Map/Process',
        description:
          'Áp dụng cấu trúc bị động cho Process và ngôn ngữ định hướng cho Map.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.45,
      },
      {
        title: 'Dictation: Nghe chép tốc độ 1.0x - 1.25x đoạn bài giảng Part 4',
        description:
          'Nâng cao tốc độ nhận diện từ nối học thuật và thuật ngữ chuyên ngành.',
        category: 'dictation',
        targetRoute: '/dictation',
        weight: 0.3,
      },
      {
        title: 'Error Log: Xử lý dứt điểm lỗi sai dạng Multiple Choice & Matching',
        description: 'Làm lại các câu sai trong Sổ tay lỗi sai và ghi chú lý do.',
        category: 'review',
        targetRoute: '/errors',
        weight: 0.25,
      },
    ],
  },
  {
    focusTitle: 'Writing Task 2 (Opinion / Discussion / Two-part) & Reading YNNG',
    items: [
      {
        title: 'Writing Task 2: Lập dàn ý PEEL + Viết bài hoàn chỉnh trong 40 phút',
        description:
          'Khai thác Idea Bank theo chủ đề Technology, Government & Society.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.45,
      },
      {
        title: 'Reading: Thực hành Yes / No / Not Given (Nhận diện quan điểm tác giả)',
        description:
          'Phân biệt sự khác nhau giữa Fact (TFNG) và Author Claim (YNNG).',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.35,
      },
      {
        title: 'SRS Vocab: Lưu từ vựng Topic-specific từ Writing Idea Bank',
        description: 'Đảm bảo mỗi bài luận có 5-7 collocations tự nhiên.',
        category: 'vocab',
        targetRoute: '/vocab',
        weight: 0.2,
      },
    ],
  },
  {
    focusTitle: 'Listening Part 4 Note Completion & Reading Full 2 Passages',
    items: [
      {
        title: 'Listening Part 4: Note Completion không ngắt quãng',
        description:
          'Dự đoán từ loại (noun/adj/verb) trước khi nghe và kiểm tra transcript sau khi nộp.',
        category: 'listening',
        targetRoute: '/listening',
        weight: 0.4,
      },
      {
        title: 'Reading: Giải liên tiếp Passage 2 & 3 trong 40 phút',
        description:
          'Quản lý thời gian, sử dụng Flag for Review ở bảng điều hướng IDP.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.4,
      },
      {
        title: 'Writing Idea Bank: Hệ thống hóa luận điểm Problem/Solution',
        description:
          'Đọc mẫu lập luận và ví dụ thực tế để tăng tốc độ brainstorm trong phòng thi.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.2,
      },
    ],
  },
];

const PHASE_3_TEMPLATES: DayBlueprint[] = [
  {
    focusTitle: 'Full Test Simulation (IDP Reading 60p + Listening)',
    items: [
      {
        title: 'Reading Full Test bấm giờ 60 phút chuẩn thi máy IDP',
        description:
          'Làm trọn vẹn 40 câu (hoặc bộ đề cá nhân) không gián đoạn, rà soát Flag trước khi nộp.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.45,
      },
      {
        title: 'Listening Full Test & Phân tích Transcript chi tiết',
        description:
          'Chỉ nghe 1 lần tốc độ 1.0x như thi thật, sau đó mở Transcript đối chiếu từ khóa.',
        category: 'listening',
        targetRoute: '/listening',
        weight: 0.35,
      },
      {
        title: 'Error Log: Tổng kết lỗi sai ngay sau bài thi thử',
        description:
          'Phân loại câu sai (bẫy paraphrase, đọc lướt, thiếu s/es) vào Sổ tay lỗi sai.',
        category: 'review',
        targetRoute: '/errors',
        weight: 0.2,
      },
    ],
  },
  {
    focusTitle: 'Timed Writing Full (Task 1 + Task 2 in 60 mins) & SRS',
    items: [
      {
        title: 'Writing Simulation: Hoàn thành Task 1 (20p) + Task 2 (40p)',
        description:
          'Canh giờ nghiêm ngặt bằng đồng hồ Writing Scratchpad và tự chấm theo 4 tiêu chí.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.5,
      },
      {
        title: 'Dictation Speed Drill: Nghe chép 1.25x tăng phản xạ',
        description: 'Giữ tai nhạy với tốc độ nhanh để làm chủ phòng thi Listening.',
        category: 'dictation',
        targetRoute: '/dictation',
        weight: 0.25,
      },
      {
        title: 'SRS Vocab: Quét toàn bộ thẻ từ khó (Ease Factor thấp)',
        description: 'Ôn dứt điểm từ vựng học thuật hay quên.',
        category: 'vocab',
        targetRoute: '/vocab',
        weight: 0.25,
      },
    ],
  },
  {
    focusTitle: 'Sprint Giải đề & Triệt tiêu Sổ tay lỗi sai',
    items: [
      {
        title: 'Error Log Re-try: Giải lại toàn bộ câu sai chưa Mastered',
        description:
          'Mục tiêu đưa số lỗi chưa xử lý về 0 trước ngày thi 14/02/2027.',
        category: 'review',
        targetRoute: '/errors',
        weight: 0.4,
      },
      {
        title: 'Reading Passage 3 Drilling: Khắc phục dạng bài mất nhiều thời gian',
        description: 'Rèn kỹ năng bỏ qua bẫy câu khó để tối ưu Band 7.0 - 7.5+.',
        category: 'reading',
        targetRoute: '/reading',
        weight: 0.35,
      },
      {
        title: 'Writing Idea Bank: Ôn nhanh collocations & câu mở/kết bài',
        description: 'Chuẩn bị sẵn khung diễn đạt cho cả 5 dạng Task 2.',
        category: 'writing',
        targetRoute: '/writing',
        weight: 0.25,
      },
    ],
  },
];

export function generateStudyRoadmap(
  profile: UserProfile,
  referenceDateISO: string = profile.startDateISO || DEFAULT_START_DATE
): StudyRoadmap {
  const startDateISO = profile.startDateISO || DEFAULT_START_DATE;
  const examDateISO = profile.examDateISO || DEFAULT_EXAM_DATE;

  const rawDays = calculateDaysBetween(startDateISO, examDateISO);
  const totalDays = Math.max(7, rawDays);
  const totalScheduleSlots = totalDays + 1; // 88 prep days + Exam Day (14/02/2027)
  const daysRemainingFromReference = calculateDaysBetween(
    referenceDateISO,
    examDateISO
  );

  // Split 88 days into 3 proportional phases:
  // ~32% Phase 1 (28 days for 88), ~40% Phase 2 (35 days for 88), ~28% Phase 3 (25 days for 88)
  const phase1Days = Math.max(1, Math.round(totalDays * (28 / 88)));
  const phase2Days = Math.max(1, Math.round(totalDays * (35 / 88)));
  const phase1End = phase1Days;
  const phase2End = Math.min(totalDays - 1, phase1End + phase2Days);

  const phases: RoadmapPhase[] = [
    {
      id: 1,
      name: 'Giai đoạn 1: Củng cố nền tảng & Dictation',
      englishSubtitle: 'Foundation, Academic Vocabulary & Precision Listening',
      description:
        'Xây dựng phản xạ âm thanh bằng Dictation có word-level diff, nắm vững kỹ thuật Skim/Scan cho Reading, khung cấu trúc Writing Task 1/2 và tích lũy từ vựng AWL qua SM-2.',
      startDay: 1,
      endDay: phase1End,
      startDateISO,
      endDateISO: addDaysToISODate(startDateISO, phase1End - 1),
      colorClass: 'bg-sky-600',
    },
    {
      id: 2,
      name: 'Giai đoạn 2: Luyện chuyên sâu từng dạng bài',
      englishSubtitle: 'Question-Type Mastery (Reading, Listening, Writing)',
      description:
        'Xử lý triệt để các dạng câu hỏi khó (Matching Headings, YNNG, Listening Part 3-4), viết trọn vẹn 6 dạng Task 1 & 5 dạng Task 2 với kho Idea Bank.',
      startDay: phase1End + 1,
      endDay: phase2End,
      startDateISO: addDaysToISODate(startDateISO, phase1End),
      endDateISO: addDaysToISODate(startDateISO, phase2End - 1),
      colorClass: 'bg-indigo-600',
    },
    {
      id: 3,
      name: 'Giai đoạn 3: Giải đề Full Test bấm giờ & Tổng ôn lỗi sai',
      englishSubtitle: 'Timed Mock Tests, Error Log Clearance & Exam Taper',
      description:
        'Thi thử nghiêm ngặt trên giao diện chuẩn IDP, phân tích Transcript sau khi nộp bài, xử lý sạch Sổ tay lỗi sai và giữ phong độ tới ngày thi 14/02/2027.',
      startDay: phase2End + 1,
      endDay: totalDays,
      startDateISO: addDaysToISODate(startDateISO, phase2End),
      endDateISO: examDateISO,
      colorClass: 'bg-emerald-600',
    },
  ];

  const dailyMinutesBudget = Math.max(
    60,
    Math.round((profile.dailyStudyHours || 2.5) * 60)
  );
  const days: RoadmapDay[] = [];

  for (let d = 1; d <= totalScheduleSlots; d++) {
    const dateISO = addDaysToISODate(startDateISO, d - 1);
    const weekNumber = Math.ceil(d / 7);
    const phaseId: 1 | 2 | 3 =
      d <= phase1End ? 1 : d <= phase2End ? 2 : 3;

    let focusTitle = '';
    let tasks: RoadmapTask[] = [];

    if (d === totalScheduleSlots) {
      focusTitle = `Ngày thi chính thức IELTS Academic (${formatDateVN(examDateISO)})`;
      tasks = [
        {
          id: `day-${d}-exam-milestone`,
          dayNumber: d,
          dateISO,
          phaseId: 3,
          title: `Mốc mục tiêu thi IELTS Academic (${formatDateVN(examDateISO)}) — Band ${profile.targetBandRange}`,
          description:
            'Giữ tâm lý vững vàng, kiểm tra giấy tờ tùy thân, áp dụng chiến thuật phân bổ thời gian Listening - Reading - Writing đã luyện.',
          category: 'review',
          targetRoute: '/',
          estimatedMinutes: 30,
          isMilestone: true,
        },
      ];
    } else if (d >= totalScheduleSlots - 2) {
      focusTitle = 'Ôn nhẹ trước ngày thi (Taper & Consolidation)';
      tasks = [
        {
          id: `day-${d}-taper-1`,
          dayNumber: d,
          dateISO,
          phaseId: 3,
          title: 'Ôn nhanh Sổ tay lỗi sai & Checklist chiến thuật phòng thi',
          description:
            'Chỉ xem lại các lỗi thường gặp, tuyệt đối không nhồi nhét đề mới gây quá tải.',
          category: 'review',
          targetRoute: '/errors',
          estimatedMinutes: Math.round(dailyMinutesBudget * 0.45),
        },
        {
          id: `day-${d}-taper-2`,
          dayNumber: d,
          dateISO,
          phaseId: 3,
          title: 'Đọc lướt dàn ý Writing Idea Bank & Ôn thẻ SRS đến hạn',
          description:
            'Giữ nhịp từ vựng tự nhiên và thư giãn nghỉ ngơi đầy đủ.',
          category: 'vocab',
          targetRoute: '/vocab',
          estimatedMinutes: Math.round(dailyMinutesBudget * 0.35),
        },
      ];
    } else {
      const pool =
        phaseId === 1
          ? PHASE_1_TEMPLATES
          : phaseId === 2
            ? PHASE_2_TEMPLATES
            : PHASE_3_TEMPLATES;
      const blueprint = pool[(d - 1) % pool.length];
      focusTitle = blueprint.focusTitle;
      tasks = blueprint.items.map((item, idx) => ({
        id: `day-${d}-task-${idx + 1}`,
        dayNumber: d,
        dateISO,
        phaseId,
        title: item.title,
        description: item.description,
        category: item.category,
        targetRoute: item.targetRoute,
        estimatedMinutes: Math.max(15, Math.round(dailyMinutesBudget * item.weight)),
      }));
    }

    const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    days.push({
      dayNumber: d,
      dateISO,
      weekNumber,
      phaseId,
      focusTitle,
      tasks,
      totalMinutes,
    });
  }

  return {
    startDateISO,
    examDateISO,
    totalDays,
    daysRemainingFromReference,
    totalWeeks: Math.ceil(totalScheduleSlots / 7),
    phases,
    days,
  };
}

export interface DailyPaceSummary {
  daysRemaining: number;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  tasksDueUntilToday: number;
  completedUntilToday: number;
  recommendedTasksPerDay: number;
  recommendedMinutesPerDay: number;
  status: 'ahead' | 'on_track' | 'behind';
  messageVi: string;
}

export function getDailyPaceSummary(
  roadmap: StudyRoadmap,
  completedTaskIds: Set<string>,
  todayISO: string
): DailyPaceSummary {
  const allTasks = roadmap.days.flatMap((d) => d.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) =>
    completedTaskIds.has(t.id)
  ).length;
  const remainingTasks = Math.max(0, totalTasks - completedTasks);

  const daysRemaining = Math.max(
    1,
    calculateDaysBetween(todayISO, roadmap.examDateISO)
  );

  const tasksUpToToday = allTasks.filter((t) => t.dateISO <= todayISO);
  const completedUntilToday = tasksUpToToday.filter((t) =>
    completedTaskIds.has(t.id)
  ).length;

  const remainingMinutes = allTasks
    .filter((t) => !completedTaskIds.has(t.id))
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const recommendedTasksPerDay = Number(
    (remainingTasks / daysRemaining).toFixed(1)
  );
  const recommendedMinutesPerDay = Math.round(remainingMinutes / daysRemaining);

  const delta = completedTasks - tasksUpToToday.length;
  let status: 'ahead' | 'on_track' | 'behind' = 'on_track';
  if (delta >= 2) status = 'ahead';
  else if (delta <= -3) status = 'behind';

  const messageVi =
    remainingTasks === 0
      ? `Tuyệt vời! Bạn đã hoàn thành toàn bộ ${totalTasks} nhiệm vụ trong lộ trình đến ngày ${formatDateVN(roadmap.examDateISO)}.`
      : `Còn ${daysRemaining} ngày tới mốc thi ${formatDateVN(roadmap.examDateISO)}. Để kịp tiến độ, bạn cần duy trì trung bình ${recommendedTasksPerDay} nhiệm vụ/ngày (~${recommendedMinutesPerDay} phút/ngày).`;

  return {
    daysRemaining,
    totalTasks,
    completedTasks,
    remainingTasks,
    tasksDueUntilToday: tasksUpToToday.length,
    completedUntilToday,
    recommendedTasksPerDay,
    recommendedMinutesPerDay,
    status,
    messageVi,
  };
}
