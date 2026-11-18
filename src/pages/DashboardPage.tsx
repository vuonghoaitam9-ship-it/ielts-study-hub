import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  FileUp,
  Flame,
  FolderArchive,
  Headphones,
  Layers,
  PenTool,
  SlidersHorizontal,
} from 'lucide-react';
import { db, recordStudyMinutes } from '../db/database';
import { useProfile } from '../context/ProfileContext';
import {
  formatDateVN,
  generateStudyRoadmap,
  getDailyPaceSummary,
} from '../lib/roadmapGenerator';
import { addDaysToISODate, getTodayLocalISODate } from '../lib/sm2';

function computeStreak(studyLogs: Array<{ dateISO: string; minutesStudied: number }>, todayISO: string): number {
  const activeDates = new Set(
    studyLogs.filter((l) => l.minutesStudied > 0).map((l) => l.dateISO)
  );
  if (activeDates.size === 0) return 0;

  let streak = 0;
  let cursor = activeDates.has(todayISO)
    ? todayISO
    : addDaysToISODate(todayISO, -1);

  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = addDaysToISODate(cursor, -1);
  }
  return streak;
}

export const DashboardPage: React.FC = () => {
  const {
    profile,
    effectiveTodayISO,
    daysLeftToExam,
    totalRoadmapDays,
    setSettingsModalOpen,
  } = useProfile();

  const tests = useLiveQuery(() => db.tests.toArray(), [], []);
  const attempts = useLiveQuery(
    () => db.attempts.orderBy('submittedAt').toArray(),
    [],
    []
  );
  const vocabCards = useLiveQuery(() => db.vocabCards.toArray(), [], []);
  const errorLogs = useLiveQuery(() => db.errorLogs.toArray(), [], []);
  const completions = useLiveQuery(
    () => db.roadmapCompletions.toArray(),
    [],
    []
  );
  const studyLogs = useLiveQuery(() => db.studyLogs.toArray(), [], []);

  const realTodayISO = getTodayLocalISODate();

  const roadmap = useMemo(
    () => generateStudyRoadmap(profile, effectiveTodayISO),
    [profile, effectiveTodayISO]
  );

  const completedSet = useMemo(
    () => new Set(completions.map((c) => c.taskId)),
    [completions]
  );

  const pace = useMemo(
    () => getDailyPaceSummary(roadmap, completedSet, effectiveTodayISO),
    [roadmap, completedSet, effectiveTodayISO]
  );

  const todayDay = useMemo(() => {
    return (
      roadmap.days.find((d) => d.dateISO === effectiveTodayISO) ||
      roadmap.days[0]
    );
  }, [roadmap, effectiveTodayISO]);

  const totalMinutes = useMemo(
    () => studyLogs.reduce((sum, l) => sum + l.minutesStudied, 0),
    [studyLogs]
  );
  const totalHoursText = (totalMinutes / 60).toFixed(1);

  const streakDays = useMemo(
    () => computeStreak(studyLogs, realTodayISO),
    [studyLogs, realTodayISO]
  );

  const dueCardsCount = useMemo(
    () => vocabCards.filter((c) => c.nextReviewDate <= realTodayISO).length,
    [vocabCards, realTodayISO]
  );

  const openErrorsCount = useMemo(
    () => errorLogs.filter((e) => !e.mastered).length,
    [errorLogs]
  );

  const readingAttempts = attempts.filter((a) => a.skill === 'reading');
  const listeningAttempts = attempts.filter((a) => a.skill === 'listening');
  const avgBand = useMemo(() => {
    if (attempts.length === 0) return null;
    const sum = attempts.reduce((acc, a) => acc + a.estimatedBand, 0);
    return (sum / attempts.length).toFixed(1);
  }, [attempts]);

  // Last 14 days study bar chart data
  const last14Days = useMemo(() => {
    const map = new Map(studyLogs.map((l) => [l.dateISO, l.minutesStudied]));
    const rows: Array<{ dateISO: string; label: string; minutes: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const iso = addDaysToISODate(realTodayISO, -i);
      const [, m, d] = iso.split('-');
      rows.push({
        dateISO: iso,
        label: `${d}/${m}`,
        minutes: map.get(iso) ?? 0,
      });
    }
    return rows;
  }, [studyLogs, realTodayISO]);

  const dailyGoalMins = Math.round(profile.dailyStudyHours * 60);
  const maxBarMins = Math.max(
    dailyGoalMins,
    ...last14Days.map((d) => d.minutes),
    60
  );

  const toggleRoadmapTask = async (taskId: string, minutes: number) => {
    if (completedSet.has(taskId)) {
      await db.roadmapCompletions.delete(taskId);
    } else {
      await db.roadmapCompletions.put({
        taskId,
        completedAt: new Date().toISOString(),
      });
      await recordStudyMinutes(minutes, realTodayISO);
    }
  };

  // Band SVG chart coords
  const recentAttempts = attempts.slice(-12);
  const chartW = 540;
  const chartH = 190;
  const padL = 36;
  const padR = 20;
  const padT = 16;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const bandToY = (b: number) => {
    const clamped = Math.min(9, Math.max(3, b));
    return padT + plotH - ((clamped - 3) / 6) * plotH;
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      {/* Hero Banner */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200">
              <CalendarDays className="h-3.5 w-3.5" />
              Lộ trình {totalRoadmapDays} ngày (~12.5 tuần):{' '}
              {formatDateVN(profile.startDateISO)} →{' '}
              {formatDateVN(profile.examDateISO)}
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
              Còn <span className="text-amber-300">{daysLeftToExam} ngày</span>{' '}
              đến kỳ thi IELTS Academic ({formatDateVN(profile.examDateISO)})
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl">
              Trình độ hiện tại:{' '}
              <strong className="text-white">{profile.currentBandRange}</strong>{' '}
              → Mục tiêu:{' '}
              <strong className="text-emerald-300">
                {profile.targetBandRange}
              </strong>{' '}
              · Cường độ:{' '}
              <strong className="text-white">
                {profile.dailyStudyHours} giờ/ngày
              </strong>{' '}
              (Listening · Reading · Writing).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/25 transition"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Tùy chỉnh Band & Giờ học
            </button>
            <Link
              to="/parser"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-400 transition"
            >
              <FileUp className="h-4 w-4" />
              Nạp đề cá nhân (PDF/DOCX)
            </Link>
          </div>
        </div>

        {/* Overall Roadmap Bar */}
        <div className="mt-5 rounded-xl bg-white/5 p-3.5 border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-200">
              Tiến độ Lộ trình tổng thể: {pace.completedTasks}/{pace.totalTasks}{' '}
              nhiệm vụ (
              {pace.totalTasks > 0
                ? Math.round((pace.completedTasks / pace.totalTasks) * 100)
                : 0}
              %)
            </span>
            <span className="text-sky-200">{pace.messageVi}</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
              style={{
                width: `${
                  pace.totalTasks > 0
                    ? Math.round((pace.completedTasks / pace.totalTasks) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Chuỗi ngày học (Streak)
            </span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Flame className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {streakDays} ngày
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tính tự động khi làm đề, Dictation, SRS hoặc tích Roadmap.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Tổng thời gian tự học
            </span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {totalHoursText} giờ
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ({totalMinutes} phút đã ghi nhận · Mục tiêu {dailyGoalMins}{' '}
            phút/ngày)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Band trung bình bài làm
            </span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {avgBand ?? '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {attempts.length} lượt nộp ({readingAttempts.length} Reading ·{' '}
            {listeningAttempts.length} Listening)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Cần ôn hôm nay (SRS & Lỗi sai)
            </span>
            <span className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {dueCardsCount} thẻ · {openErrorsCount} lỗi
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs font-semibold">
            <Link to="/vocab" className="text-indigo-600 hover:underline">
              Ôn Flashcard →
            </Link>
            <Link to="/errors" className="text-rose-600 hover:underline">
              Xử lý lỗi sai →
            </Link>
          </div>
        </div>
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Band Progress SVG Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Biểu đồ tiến bộ Band Score (Reading & Listening)
              </h3>
              <p className="text-xs text-slate-500">
                Đường nét đứt: Mục tiêu Band {profile.targetBandNumeric.toFixed(1)}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-sky-700">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
                Reading
              </span>
              <span className="flex items-center gap-1 text-indigo-700">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                Listening
              </span>
            </div>
          </div>

          {recentAttempts.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center p-4">
              <p className="text-xs font-medium text-slate-600">
                Chưa có lượt làm bài test nào được ghi nhận.
              </p>
              <Link
                to="/tests"
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Mở Ngân hàng đề để làm bài đầu tiên
              </Link>
            </div>
          ) : (
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-48">
              {[4, 5, 6, 7, 8, 9].map((b) => {
                const y = bandToY(b);
                return (
                  <g key={b}>
                    <line
                      x1={padL}
                      x2={chartW - padR}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                    <text
                      x={6}
                      y={y + 4}
                      fontSize="10"
                      fill="#64748b"
                      fontWeight="600"
                    >
                      {b.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Target line */}
              <line
                x1={padL}
                x2={chartW - padR}
                y1={bandToY(profile.targetBandNumeric)}
                y2={bandToY(profile.targetBandNumeric)}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />

              {/* Polyline across chronological attempts */}
              {recentAttempts.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  points={recentAttempts
                    .map((a, idx) => {
                      const x =
                        padL +
                        (idx / Math.max(1, recentAttempts.length - 1)) * plotW;
                      return `${x},${bandToY(a.estimatedBand)}`;
                    })
                    .join(' ')}
                />
              )}

              {recentAttempts.map((a, idx) => {
                const x =
                  recentAttempts.length === 1
                    ? padL + plotW / 2
                    : padL + (idx / (recentAttempts.length - 1)) * plotW;
                const y = bandToY(a.estimatedBand);
                const color = a.skill === 'reading' ? '#0284c7' : '#4f46e5';
                return (
                  <g key={a.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={5}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      <title>{`${a.testTitle} (${a.skill}): Band ${a.estimatedBand}`}</title>
                    </circle>
                    <text
                      x={x}
                      y={y - 9}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={color}
                    >
                      {a.estimatedBand.toFixed(1)}
                    </text>
                    <text
                      x={x}
                      y={chartH - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#64748b"
                    >
                      #{idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* 14-Day Study Minutes SVG Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Thời gian học 14 ngày gần nhất (phút)
              </h3>
              <p className="text-xs text-slate-500">
                Mục tiêu hằng ngày: {dailyGoalMins} phút ({profile.dailyStudyHours}h)
              </p>
            </div>
          </div>

          <svg viewBox="0 0 540 190" className="w-full h-48">
            {/* Goal horizontal line */}
            {(() => {
              const goalY =
                16 + 146 - Math.min(1, dailyGoalMins / maxBarMins) * 146;
              return (
                <line
                  x1={24}
                  x2={528}
                  y1={goalY}
                  y2={goalY}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              );
            })()}

            {last14Days.map((day, idx) => {
              const barSlotW = 500 / 14;
              const barW = 22;
              const x = 28 + idx * barSlotW + (barSlotW - barW) / 2;
              const barH = Math.max(
                3,
                Math.round((day.minutes / maxBarMins) * 146)
              );
              const y = 16 + (146 - barH);
              const metGoal = day.minutes >= dailyGoalMins;
              return (
                <g key={day.dateISO}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={4}
                    fill={
                      day.minutes === 0
                        ? '#e2e8f0'
                        : metGoal
                          ? '#10b981'
                          : '#4f46e5'
                    }
                  >
                    <title>{`${day.dateISO}: ${day.minutes} phút`}</title>
                  </rect>
                  {day.minutes > 0 && (
                    <text
                      x={x + barW / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#334155"
                    >
                      {day.minutes}
                    </text>
                  )}
                  <text
                    x={x + barW / 2}
                    y={180}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="#64748b"
                  >
                    {idx % 2 === 0 ? day.label : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Today's Tasks + Quick Module Cards */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nhiệm vụ hôm nay — Ngày {todayDay?.dayNumber}/{roadmap.totalDays} (
                {formatDateVN(todayDay?.dateISO || effectiveTodayISO)})
              </h3>
              <p className="text-xs text-slate-500">{todayDay?.focusTitle}</p>
            </div>
            <Link
              to="/roadmap"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
            >
              Xem đủ {roadmap.totalDays} ngày <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 space-y-2.5">
            {todayDay?.tasks.map((task) => {
              const done = completedSet.has(task.id);
              return (
                <div
                  key={task.id}
                  className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${
                    done
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200 bg-white hover:border-indigo-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleRoadmapTask(task.id, task.estimatedMinutes)
                    }
                    className="flex items-start gap-2.5 text-left flex-1"
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          done ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {task.description} · ~{task.estimatedMinutes} phút
                      </p>
                    </div>
                  </button>

                  <Link
                    to={task.targetRoute}
                    className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-600 hover:text-white transition flex-shrink-0"
                  >
                    Mở
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Launch Tools */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            Lối tắt Luyện tập nhanh
          </h3>
          <p className="text-xs text-slate-500">
            Hiện có {tests.length} bộ đề trong Ngân hàng cá nhân.
          </p>

          <div className="space-y-2">
            <Link
              to="/volumes"
              className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 hover:border-indigo-400 hover:bg-indigo-50 transition"
            >
              <div className="flex items-center gap-2.5">
                <FolderArchive className="h-5 w-5 text-indigo-700" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Bộ đề Vol 1–10 (6 Hợp phần)
                  </p>
                  <p className="text-xs text-slate-600">
                    Reading, Listening 100% Audio gốc, Transcript, Dictation, Writing &amp; Ideas
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-indigo-500" />
            </Link>

            <Link
              to="/reading"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-sky-600" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Reading chuẩn IDP
                  </p>
                  <p className="text-xs text-slate-500">
                    Split-screen, Highlight 3 màu, Palette
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              to="/listening"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <Headphones className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Listening & Transcript
                  </p>
                  <p className="text-xs text-slate-500">
                    Audio 0.75x-1.5x, Highlight từ khóa đáp án
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              to="/writing"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <PenTool className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Writing Guide & Idea Bank
                  </p>
                  <p className="text-xs text-slate-500">
                    Task 1 (6 dạng), Task 2 (5 dạng) & 8 chủ đề
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              to="/vocab"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-amber-300 hover:bg-amber-50/40 transition"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Flashcard SM-2 ({dueCardsCount} đến hạn)
                  </p>
                  <p className="text-xs text-slate-500">
                    Lặp lại ngắt quãng & từ vựng AWL
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
