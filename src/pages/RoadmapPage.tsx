import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  SlidersHorizontal,
} from 'lucide-react';
import { db, recordStudyMinutes } from '../db/database';
import { useProfile } from '../context/ProfileContext';
import {
  formatDateVN,
  generateStudyRoadmap,
  getDailyPaceSummary,
} from '../lib/roadmapGenerator';
import { getTodayLocalISODate } from '../lib/sm2';
import { RoadmapTaskCategory } from '../types';

const CATEGORY_BADGES: Record<
  RoadmapTaskCategory,
  { label: string; cls: string }
> = {
  dictation: { label: 'Dictation', cls: 'bg-purple-50 text-purple-700' },
  listening: { label: 'Listening', cls: 'bg-indigo-50 text-indigo-700' },
  reading: { label: 'Reading', cls: 'bg-sky-50 text-sky-700' },
  writing: { label: 'Writing', cls: 'bg-emerald-50 text-emerald-700' },
  vocab: { label: 'SRS Vocab', cls: 'bg-amber-50 text-amber-700' },
  review: { label: 'Error Log', cls: 'bg-rose-50 text-rose-700' },
};

export const RoadmapPage: React.FC = () => {
  const { profile, effectiveTodayISO, setSettingsModalOpen } = useProfile();
  const completions = useLiveQuery(
    () => db.roadmapCompletions.toArray(),
    [],
    []
  );

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

  const todayDay = useMemo(
    () =>
      roadmap.days.find((d) => d.dateISO === effectiveTodayISO) ||
      roadmap.days[0],
    [roadmap, effectiveTodayISO]
  );

  const [activeTab, setActiveTab] = useState<'today' | 'weekly' | 'phases'>(
    'weekly'
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(
    todayDay?.weekNumber || 1
  );

  const toggleTask = async (taskId: string, minutes: number) => {
    if (completedSet.has(taskId)) {
      await db.roadmapCompletions.delete(taskId);
    } else {
      await db.roadmapCompletions.put({
        taskId,
        completedAt: new Date().toISOString(),
      });
      await recordStudyMinutes(minutes, getTodayLocalISODate());
    }
  };

  const weekDays = useMemo(
    () => roadmap.days.filter((d) => d.weekNumber === selectedWeek),
    [roadmap, selectedWeek]
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <Calendar className="h-4 w-4" />
            Lộ trình học tập cá nhân hóa ({roadmap.totalDays} ngày · ~
            {(roadmap.totalDays / 7).toFixed(1)} tuần)
          </div>
          <h2 className="mt-1 text-2xl font-black text-slate-900">
            {formatDateVN(roadmap.startDateISO)} →{' '}
            {formatDateVN(roadmap.examDateISO)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Mục tiêu Band {profile.targetBandRange} (từ{' '}
            {profile.currentBandRange}) · Phân bổ{' '}
            {Math.round(profile.dailyStudyHours * 60)} phút/ngày (3 kỹ năng:
            Listening, Reading, Writing).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSettingsModalOpen(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
        >
          <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
          Chỉnh ngày thi / Giờ học
        </button>
      </div>

      {/* Daily Workload Reminder Alert */}
      <div
        className={`flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          pace.status === 'behind'
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-indigo-200 bg-indigo-50/70 text-indigo-950'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-indigo-600" />
          <div>
            <p className="text-sm font-bold">{pace.messageVi}</p>
            <p className="text-xs opacity-80 mt-0.5">
              Đã hoàn thành: {pace.completedTasks}/{pace.totalTasks} nhiệm vụ ·
              Còn lại {pace.remainingTasks} nhiệm vụ cho {pace.daysRemaining}{' '}
              ngày tới mốc {formatDateVN(roadmap.examDateISO)}.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center self-start rounded-full bg-white px-3 py-1 text-xs font-bold shadow-xs">
          {pace.status === 'ahead'
            ? 'Vượt tiến độ'
            : pace.status === 'behind'
              ? 'Cần tăng tốc nhẹ'
              : 'Đúng tiến độ'}
        </span>
      </div>

      {/* 3 Phase Progress Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {roadmap.phases.map((phase) => {
          const phaseTasks = roadmap.days
            .filter((d) => d.phaseId === phase.id)
            .flatMap((d) => d.tasks);
          const doneCount = phaseTasks.filter((t) =>
            completedSet.has(t.id)
          ).length;
          const pct =
            phaseTasks.length > 0
              ? Math.round((doneCount / phaseTasks.length) * 100)
              : 0;
          return (
            <div
              key={phase.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>
                    Ngày {phase.startDay}–{phase.endDay}
                  </span>
                  <span>
                    {formatDateVN(phase.startDateISO)} –{' '}
                    {formatDateVN(phase.endDateISO)}
                  </span>
                </div>
                <h3 className="mt-1.5 text-sm font-extrabold text-slate-900">
                  {phase.name}
                </h3>
                <p className="text-[11px] font-medium text-indigo-600">
                  {phase.englishSubtitle}
                </p>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {phase.description}
                </p>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>
                    {doneCount}/{phaseTasks.length} nhiệm vụ
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${phase.colorClass} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'today', label: 'Hôm nay (Today Checklist)' },
          {
            id: 'weekly',
            label: `Lịch chi tiết theo tuần (Tuần 1 – Tuần ${roadmap.totalWeeks})`,
          },
          { id: 'phases', label: 'Toàn bộ 88 ngày (Tìm kiếm theo giai đoạn)' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              setActiveTab(tab.id as 'today' | 'weekly' | 'phases')
            }
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'today' && todayDay && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ngày {todayDay.dayNumber} · {formatDateVN(todayDay.dateISO)} (Tuần{' '}
                {todayDay.weekNumber})
              </h3>
              <p className="text-xs text-slate-500">{todayDay.focusTitle}</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              Tổng ~{todayDay.totalMinutes} phút
            </span>
          </div>

          <div className="space-y-3">
            {todayDay.tasks.map((task) => {
              const done = completedSet.has(task.id);
              const badge = CATEGORY_BADGES[task.category];
              return (
                <div
                  key={task.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    done
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id, task.estimatedMinutes)}
                    className="flex items-start gap-3 text-left flex-1"
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          ~{task.estimatedMinutes} phút
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-sm font-bold ${
                          done ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {task.description}
                      </p>
                    </div>
                  </button>
                  <Link
                    to={task.targetRoute}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 flex-shrink-0"
                  >
                    Thực hành ngay
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'weekly' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3">
            {Array.from({ length: roadmap.totalWeeks }, (_, i) => i + 1).map(
              (wk) => {
                const wkTasks = roadmap.days
                  .filter((d) => d.weekNumber === wk)
                  .flatMap((d) => d.tasks);
                const wkDone = wkTasks.every((t) => completedSet.has(t.id));
                return (
                  <button
                    key={wk}
                    type="button"
                    onClick={() => setSelectedWeek(wk)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      selectedWeek === wk
                        ? 'bg-indigo-600 text-white'
                        : wkDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tuần {wk}
                  </button>
                );
              }
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {weekDays.map((day) => {
              const isExamDay = day.dateISO === roadmap.examDateISO;
              const isToday = day.dateISO === effectiveTodayISO;
              const dayDoneCount = day.tasks.filter((t) =>
                completedSet.has(t.id)
              ).length;
              return (
                <div
                  key={day.dayNumber}
                  className={`rounded-2xl border p-4 shadow-xs ${
                    isExamDay
                      ? 'border-emerald-400 bg-emerald-50/70 lg:col-span-2'
                      : isToday
                        ? 'border-indigo-400 bg-indigo-50/30'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-indigo-700">
                          Ngày {day.dayNumber} · {formatDateVN(day.dateISO)}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Hôm nay
                          </span>
                        )}
                        {isExamDay && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                            <Flag className="h-3 w-3" /> NGÀY THI 14/02/2027
                          </span>
                        )}
                      </div>
                      <h4 className="mt-0.5 text-sm font-bold text-slate-900">
                        {day.focusTitle}
                      </h4>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {dayDoneCount}/{day.tasks.length} · ~{day.totalMinutes}p
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {day.tasks.map((task) => {
                      const done = completedSet.has(task.id);
                      const badge = CATEGORY_BADGES[task.category];
                      return (
                        <div
                          key={task.id}
                          className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleTask(task.id, task.estimatedMinutes)
                            }
                            className="flex items-start gap-2 text-left flex-1"
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {task.estimatedMinutes}p
                                </span>
                              </div>
                              <p
                                className={`mt-0.5 text-xs font-semibold ${
                                  done
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800'
                                }`}
                              >
                                {task.title}
                              </p>
                            </div>
                          </button>
                          <Link
                            to={task.targetRoute}
                            className="rounded-md bg-white border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-indigo-600 hover:text-white flex-shrink-0"
                          >
                            Mở
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'phases' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {roadmap.days.map((day) => {
              const done = day.tasks.filter((t) =>
                completedSet.has(t.id)
              ).length;
              return (
                <div
                  key={day.dayNumber}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50"
                >
                  <div>
                    <span className="text-xs font-bold text-indigo-700">
                      Ngày {day.dayNumber} (Tuần {day.weekNumber}) ·{' '}
                      {formatDateVN(day.dateISO)} · Giai đoạn {day.phaseId}
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {day.focusTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      {done}/{day.tasks.length} hoàn thành
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWeek(day.weekNumber);
                        setActiveTab('weekly');
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Mở Tuần {day.weekNumber}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
