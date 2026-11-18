import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { UserProfile } from '../types';
import {
  DEFAULT_EXAM_DATE,
  DEFAULT_START_DATE,
  calculateDaysBetween,
} from '../lib/roadmapGenerator';
import { getTodayLocalISODate } from '../lib/sm2';
import { recordStudyMinutes } from '../db/database';

const PROFILE_STORAGE_KEY = 'ielts_hub_profile_v1';

export const DEFAULT_USER_PROFILE: UserProfile = {
  examModule: 'Academic',
  currentBandRange: '5.5 - 6.0',
  currentBandNumeric: 5.5,
  targetBandRange: '6.5 - 7.5+',
  targetBandNumeric: 7.0,
  dailyStudyHours: 2.5,
  startDateISO: DEFAULT_START_DATE,
  examDateISO: DEFAULT_EXAM_DATE,
  uiLanguage: 'vi-en',
};

function loadInitialProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...DEFAULT_USER_PROFILE,
      ...parsed,
      examModule: 'Academic',
    };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

interface ProfileContextValue {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  resetProfileDefaults: () => void;
  effectiveTodayISO: string;
  daysLeftToExam: number;
  totalRoadmapDays: number;
  timerSeconds: number;
  isTimerRunning: boolean;
  toggleTimer: () => void;
  commitTimerSession: () => Promise<number>;
  resetTimer: () => void;
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(loadInitialProfile);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore quota errors on private browsing
    }
  }, [profile]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTimerRunning]);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...patch,
      examModule: 'Academic',
    }));
  }, []);

  const resetProfileDefaults = useCallback(() => {
    setProfile(DEFAULT_USER_PROFILE);
  }, []);

  const toggleTimer = useCallback(() => {
    setIsTimerRunning((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
  }, []);

  const commitTimerSession = useCallback(async () => {
    const mins = Math.max(1, Math.round(timerSeconds / 60));
    await recordStudyMinutes(mins, getTodayLocalISODate());
    setIsTimerRunning(false);
    setTimerSeconds(0);
    return mins;
  }, [timerSeconds]);

  const effectiveTodayISO = useMemo(() => {
    const realToday = getTodayLocalISODate();
    if (realToday < profile.startDateISO) return profile.startDateISO;
    return realToday;
  }, [profile.startDateISO]);

  const daysLeftToExam = useMemo(() => {
    return Math.max(
      0,
      calculateDaysBetween(effectiveTodayISO, profile.examDateISO)
    );
  }, [effectiveTodayISO, profile.examDateISO]);

  const totalRoadmapDays = useMemo(() => {
    return Math.max(
      1,
      calculateDaysBetween(profile.startDateISO, profile.examDateISO)
    );
  }, [profile.startDateISO, profile.examDateISO]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      updateProfile,
      resetProfileDefaults,
      effectiveTodayISO,
      daysLeftToExam,
      totalRoadmapDays,
      timerSeconds,
      isTimerRunning,
      toggleTimer,
      commitTimerSession,
      resetTimer,
      isSettingsModalOpen,
      setSettingsModalOpen,
    }),
    [
      profile,
      updateProfile,
      resetProfileDefaults,
      effectiveTodayISO,
      daysLeftToExam,
      totalRoadmapDays,
      timerSeconds,
      isTimerRunning,
      toggleTimer,
      commitTimerSession,
      resetTimer,
      isSettingsModalOpen,
    ]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }
  return ctx;
}
