import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  Headphones,
  Keyboard,
  Lightbulb,
  PenTool,
} from 'lucide-react';
import { VolSkillProgress, VolSkillTabKey, VolumeTestEntry } from '../types';

interface VolTestCrossNavProps {
  test: VolumeTestEntry;
  activeTab: VolSkillTabKey;
  progressBySkill: Record<VolSkillTabKey, VolSkillProgress | undefined>;
  compact?: boolean;
}

export const VolTestCrossNav: React.FC<VolTestCrossNavProps> = ({
  test,
  activeTab,
  progressBySkill,
  compact = false,
}) => {
  const v = test.volNumber;
  const t = test.testNumber;

  const tabs: Array<{
    key: VolSkillTabKey;
    label: string;
    to: string;
    icon: React.FC<{ className?: string }>;
    ready: boolean;
  }> = [
    {
      key: 'reading',
      label: 'Reading',
      to: `/reading?vol=${v}&test=${t}`,
      icon: BookOpen,
      ready: test.reading.status === 'ready' || test.reading.status === 'scanned_pdf',
    },
    {
      key: 'listening',
      label: 'Listening',
      to: `/listening?vol=${v}&test=${t}`,
      icon: Headphones,
      ready:
        test.listening.status === 'ready' ||
        test.listening.status === 'scanned_questions_with_audio',
    },
    {
      key: 'transcript',
      label: 'Transcript',
      to: `/listening?vol=${v}&test=${t}&view=transcript`,
      icon: FileText,
      ready: test.transcript.status === 'ready',
    },
    {
      key: 'dictation',
      label: 'Dictation',
      to: `/dictation?vol=${v}&test=${t}`,
      icon: Keyboard,
      ready:
        test.dictation.status === 'ready' ||
        test.dictation.status === 'needs_timestamps',
    },
    {
      key: 'writing',
      label: 'Writing',
      to: `/writing?vol=${v}&test=${t}&tab=writing`,
      icon: PenTool,
      ready:
        test.writing.status === 'ready' ||
        test.writing.status === 'image_or_scan_only',
    },
    {
      key: 'idea',
      label: 'Idea Bank',
      to: `/writing?vol=${v}&test=${t}&tab=idea`,
      icon: Lightbulb,
      ready: test.idea.status === 'ready',
    },
  ];

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 bg-indigo-50/80 px-4 ${
        compact ? 'py-1.5' : 'py-2.5'
      }`}
    >
      <div className="flex items-center gap-2">
        <Link
          to={`/volumes?vol=${v}`}
          className="inline-flex items-center gap-1 rounded-lg bg-white border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Vol {v}
        </Link>
        <span className="text-xs font-extrabold text-slate-900">
          {test.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.key;
          const isDone = Boolean(progressBySkill[tab.key]?.completed);

          return (
            <Link
              key={tab.key}
              to={tab.to}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                isCurrent
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : tab.ready
                    ? 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-700'
                    : 'bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {isDone && (
                <CheckCircle2
                  className={`h-3 w-3 ${
                    isCurrent ? 'text-emerald-300' : 'text-emerald-600'
                  }`}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
