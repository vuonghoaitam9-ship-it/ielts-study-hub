import { describe, expect, it } from 'vitest';
import {
  calculateDaysBetween,
  generateStudyRoadmap,
  getDailyPaceSummary,
} from '../lib/roadmapGenerator';
import { DEFAULT_USER_PROFILE } from '../context/ProfileContext';

describe('roadmapGenerator', () => {
  it('computes exactly 88 days from 2026-11-18 to 2027-02-14', () => {
    expect(calculateDaysBetween('2026-11-18', '2027-02-14')).toBe(88);
  });

  it('generates 3 phases, 88 prep days + exam milestone ending on 2027-02-14', () => {
    const roadmap = generateStudyRoadmap(DEFAULT_USER_PROFILE, '2026-11-18');
    expect(roadmap.totalDays).toBe(88);
    expect(roadmap.daysRemainingFromReference).toBe(88);
    expect(roadmap.phases).toHaveLength(3);
    expect(roadmap.days).toHaveLength(89); // 88 prep days (18/11->13/02) + 14/02 Exam Day

    expect(roadmap.days[0].dateISO).toBe('2026-11-18');
    const lastDay = roadmap.days[roadmap.days.length - 1];
    expect(lastDay.dateISO).toBe('2027-02-14');
    expect(lastDay.tasks[0].isMilestone).toBe(true);
  });

  it('scales daily study minutes proportionally when user customizes dailyStudyHours', () => {
    const intensive = generateStudyRoadmap(
      { ...DEFAULT_USER_PROFILE, dailyStudyHours: 4.0 },
      '2026-11-18'
    );
    const standard = generateStudyRoadmap(
      { ...DEFAULT_USER_PROFILE, dailyStudyHours: 2.0 },
      '2026-11-18'
    );
    expect(intensive.days[0].totalMinutes).toBeGreaterThan(
      standard.days[0].totalMinutes
    );
  });

  it('computes accurate daily pace summary for remaining tasks', () => {
    const roadmap = generateStudyRoadmap(DEFAULT_USER_PROFILE, '2026-11-18');
    const pace = getDailyPaceSummary(roadmap, new Set(), '2026-11-18');
    expect(pace.daysRemaining).toBe(88);
    expect(pace.remainingTasks).toBe(pace.totalTasks);
    expect(pace.recommendedTasksPerDay).toBeGreaterThan(2);
    expect(pace.messageVi).toContain('14/02/2027');
  });
});
