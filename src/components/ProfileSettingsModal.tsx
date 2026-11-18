import React, { useRef, useState } from 'react';
import {
  Download,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import {
  exportProgressBackupJson,
  importProgressBackupJson,
} from '../db/database';
import { removeDemoSamples, restoreDemoSamples } from '../db/seedDemoData';

export const ProfileSettingsModal: React.FC = () => {
  const {
    profile,
    updateProfile,
    resetProfileDefaults,
    isSettingsModalOpen,
    setSettingsModalOpen,
  } = useProfile();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isSettingsModalOpen) return null;

  const handleExport = async () => {
    const json = await exportProgressBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Đã xuất file sao lưu tiến độ JSON thành công.');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { importedCount } = await importProgressBackupJson(text);
      setStatusMsg(`Đã khôi phục ${importedCount} bản ghi vào IndexedDB.`);
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : 'Lỗi khi nhập file JSON.'
      );
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Cấu hình Mục tiêu & Sao lưu Dữ liệu
            </h3>
            <p className="text-xs text-slate-500">
              IELTS Academic · Tự động đồng bộ Lộ trình đến ngày thi
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsModalOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trình độ hiện tại (Band hiện tại)
              </label>
              <select
                value={profile.currentBandRange}
                onChange={(e) => {
                  const val = e.target.value;
                  const numMap: Record<string, number> = {
                    '4.5 - 5.0': 4.5,
                    '5.0 - 5.5': 5.0,
                    '5.5 - 6.0': 5.5,
                    '6.0 - 6.5': 6.0,
                    '6.5 - 7.0': 6.5,
                  };
                  updateProfile({
                    currentBandRange: val,
                    currentBandNumeric: numMap[val] ?? 5.5,
                  });
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="4.5 - 5.0">4.5 - 5.0</option>
                <option value="5.0 - 5.5">5.0 - 5.5</option>
                <option value="5.5 - 6.0">5.5 - 6.0 (Mặc định)</option>
                <option value="6.0 - 6.5">6.0 - 6.5</option>
                <option value="6.5 - 7.0">6.5 - 7.0</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Band mục tiêu (Target Band)
              </label>
              <select
                value={profile.targetBandRange}
                onChange={(e) => {
                  const val = e.target.value;
                  const numMap: Record<string, number> = {
                    '6.0 - 6.5': 6.5,
                    '6.5 - 7.5+': 7.0,
                    '7.0 - 7.5': 7.5,
                    '7.5 - 8.5': 8.0,
                  };
                  updateProfile({
                    targetBandRange: val,
                    targetBandNumeric: numMap[val] ?? 7.0,
                  });
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="6.0 - 6.5">6.0 - 6.5</option>
                <option value="6.5 - 7.5+">6.5 - 7.5+ (Mặc định)</option>
                <option value="7.0 - 7.5">7.0 - 7.5</option>
                <option value="7.5 - 8.5">7.5 - 8.5</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày bắt đầu ôn luyện
              </label>
              <input
                type="date"
                value={profile.startDateISO}
                onChange={(e) =>
                  updateProfile({ startDateISO: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày thi mục tiêu
              </label>
              <input
                type="date"
                value={profile.examDateISO}
                onChange={(e) =>
                  updateProfile({ examDateISO: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Thời lượng học mỗi ngày
              </label>
              <span className="text-xs font-bold text-indigo-700">
                {profile.dailyStudyHours} giờ/ngày (
                {Math.round(profile.dailyStudyHours * 60)} phút)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={0.5}
              value={profile.dailyStudyHours}
              onChange={(e) =>
                updateProfile({ dailyStudyHours: Number(e.target.value) })
              }
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>1.0h</span>
              <span>2.5h (2-3h mặc định)</span>
              <span>4.0h</span>
              <span>6.0h</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Quản lý Dữ liệu & Mẫu minh họa
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5 text-indigo-600" />
                Xuất Backup JSON
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-600" />
                Nhập Backup JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />

              <button
                type="button"
                onClick={async () => {
                  await restoreDemoSamples();
                  setStatusMsg('Đã khôi phục 2 bộ dữ liệu minh họa [DEMO UI].');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5 text-sky-600" />
                Khôi phục mẫu Demo
              </button>

              <button
                type="button"
                onClick={async () => {
                  await removeDemoSamples();
                  setStatusMsg('Đã ẩn/xóa các bộ dữ liệu minh họa khỏi danh sách.');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa mẫu Demo
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
              {statusMsg}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => {
              resetProfileDefaults();
              setStatusMsg('Đã khôi phục thông số mặc định (18/11/2026 → 14/02/2027).');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Về mặc định
          </button>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(false)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Xong & Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};
