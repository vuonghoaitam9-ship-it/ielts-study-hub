import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProfileProvider } from './context/ProfileContext';
import { ensureDemoDataSeeded } from './db/seedDemoData';
import { Layout } from './components/Layout';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { DashboardPage } from './pages/DashboardPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { ParserPage } from './pages/ParserPage';
import { TestBankPage } from './pages/TestBankPage';
import { ReadingTestPage } from './pages/ReadingTestPage';
import { ListeningTestPage } from './pages/ListeningTestPage';
import { DictationPage } from './pages/DictationPage';
import { WritingPage } from './pages/WritingPage';
import { VocabSrsPage } from './pages/VocabSrsPage';
import { ErrorLogPage } from './pages/ErrorLogPage';
import { VolumeHubPage } from './pages/VolumeHubPage';
import { VolBatchImporterPage } from './pages/VolBatchImporterPage';

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureDemoDataSeeded()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-semibold">
        Đang khởi tạo cơ sở dữ liệu học tập cục bộ (IndexedDB)...
      </div>
    );
  }

  return (
    <ProfileProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/volumes" element={<VolumeHubPage />} />
            <Route path="/volumes/import" element={<VolBatchImporterPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/parser" element={<ParserPage />} />
            <Route path="/tests" element={<TestBankPage />} />
            <Route path="/reading" element={<ReadingTestPage />} />
            <Route path="/listening" element={<ListeningTestPage />} />
            <Route path="/dictation" element={<DictationPage />} />
            <Route path="/writing" element={<WritingPage />} />
            <Route path="/vocab" element={<VocabSrsPage />} />
            <Route path="/errors" element={<ErrorLogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ProfileSettingsModal />
      </BrowserRouter>
    </ProfileProvider>
  );
};

export default App;
