import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Clock,
  FileUp,
  FolderArchive,
  FolderKanban,
  Headphones,
  Keyboard,
  LayoutDashboard,
  Layers,
  Menu,
  Pause,
  PenTool,
  Play,
  Save,
  Settings,
  UploadCloud,
  X,
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { formatDateVN } from '../lib/roadmapGenerator';
import { formatAudioTime } from './AudioPlayerBar';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan (Dashboard)', icon: LayoutDashboard },
  { to: '/volumes', label: 'Bộ đề Vol 1 – Vol 10', icon: FolderArchive },
  { to: '/volumes/import', label: 'Batch Import Vol 1–10', icon: UploadCloud },
  { to: '/roadmap', label: 'Lộ trình 14/02/2027', icon: CalendarDays },
  { to: '/parser', label: 'Tách đề từ Tài liệu', icon: FileUp },
  { to: '/tests', label: 'Ngân hàng đề cá nhân', icon: FolderKanban },
  { to: '/reading', label: 'Reading (Chuẩn IDP)', icon: BookOpen },
  { to: '/listening', label: 'Listening & Transcript', icon: Headphones },
  { to: '/dictation', label: 'Dictation (Chính tả)', icon: Keyboard },
  { to: '/writing', label: 'Writing Guide & Ideas', icon: PenTool },
  { to: '/vocab', label: 'Flashcards (SM-2)', icon: Layers },
  { to: '/errors', label: 'Sổ tay lỗi sai', icon: AlertTriangle },
];

export const Layout: React.FC = () => {
  const {
    profile,
    daysLeftToExam,
    totalRoadmapDays,
    timerSeconds,
    isTimerRunning,
    toggleTimer,
    commitTimerSession,
    setSettingsModalOpen,
  } = useProfile();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const location = useLocation();

  // In active Reading IDP test view, collapse sidebar on desktop automatically unless toggled
  const isReadingExamRoute = location.pathname.startsWith('/reading');
  const [collapseSidebar, setCollapseSidebar] = useState(false);

  const handleSaveTimer = async () => {
    if (timerSeconds < 10) return;
    const mins = await commitTimerSession();
    setSavedToast(`+${mins} phút đã lưu!`);
    window.setTimeout(() => setSavedToast(null), 3000);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-68 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapseSidebar ? 'lg:hidden' : ''}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white shadow-sm">
                IE
              </span>
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-slate-900">
                  IELTS Academic Hub
                </h1>
                <p className="text-[11px] font-medium text-slate-500">
                  Target {profile.targetBandRange} · L/R/W
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Countdown Banner */}
        <div className="mx-3 mt-3 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 p-3 text-white shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-medium text-indigo-100">
            <span>Mốc thi {formatDateVN(profile.examDateISO)}</span>
            <span>{totalRoadmapDays} ngày tổng</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black tracking-tight">
              Còn {daysLeftToExam} ngày
            </span>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/25"
            >
              Sửa
            </button>
          </div>
          <p className="mt-1 text-[11px] text-indigo-100">
            Hiện tại: {profile.currentBandRange} · {profile.dailyStudyHours}h/ngày
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3 custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Live Study Stopwatch & Settings */}
        <div className="border-t border-slate-100 p-3 space-y-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                Đếm giờ tự học
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatAudioTime(timerSeconds)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTimer}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  isTimerRunning
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isTimerRunning ? (
                  <>
                    <Pause className="h-3 w-3" /> Tạm dừng
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" /> Bắt đầu
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={timerSeconds < 10}
                onClick={handleSaveTimer}
                title="Lưu thời gian học vào Dashboard"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <Save className="h-3 w-3 text-emerald-600" />
                Lưu
              </button>
            </div>
            {savedToast && (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
                {savedToast}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Settings className="h-3.5 w-3.5" />
            Tùy chỉnh Lộ trình & Backup
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Bar for Mobile or IDP Focus Toggle */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {isReadingExamRoute && (
              <button
                type="button"
                onClick={() => setCollapseSidebar((c) => !c)}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Menu className="h-3.5 w-3.5" />
                {collapseSidebar ? 'Hiện Menu' : 'Chế độ Toàn màn hình IDP'}
              </button>
            )}
            <span className="text-xs font-medium text-slate-500">
              IELTS Academic · Listening · Reading · Writing
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              Thi: {formatDateVN(profile.examDateISO)} (Còn {daysLeftToExam} ngày)
            </span>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Cài đặt"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
