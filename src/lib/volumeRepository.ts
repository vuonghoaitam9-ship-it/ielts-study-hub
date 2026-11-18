import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CATALOG_SUMMARY,
  STATIC_MISSING_REPORT,
} from '../data/volumes';
import { createObjectUrlForBlobId, db } from '../db/database';
import {
  MissingItemRecord,
  VolSkillProgress,
  VolSkillTabKey,
  VolTestOverride,
  VolumeCatalogSummaryEntry,
  VolumeEntry,
  VolumeTestEntry,
  VolumeTestSummaryEntry,
} from '../types';

const VOLUME_CACHE = new Map<number, VolumeEntry>();

async function loadVolumeJson(volNumber: number): Promise<VolumeEntry | null> {
  if (VOLUME_CACHE.has(volNumber)) {
    return VOLUME_CACHE.get(volNumber)!;
  }
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const res = await fetch(`${baseUrl}data/volumes/vol-${volNumber}.json`);
  if (!res.ok) return null;
  const data = (await res.json()) as VolumeEntry;
  VOLUME_CACHE.set(volNumber, data);
  return data;
}

function mergeSummaryWithOverride(
  base: VolumeTestSummaryEntry,
  override?: VolTestOverride
): VolumeTestSummaryEntry {
  if (!override) return base;

  const next: VolumeTestSummaryEntry = {
    ...base,
    reading: { ...base.reading },
    listening: { ...base.listening },
    transcript: { ...base.transcript },
    dictation: { ...base.dictation },
    writing: { ...base.writing },
    idea: { ...base.idea },
  };

  if (override.reading?.status === 'ready') {
    next.reading.status = 'ready';
    next.reading.passageCount = override.reading.passages?.length ?? next.reading.passageCount;
    next.reading.questionCount = override.reading.questions?.length ?? next.reading.questionCount;
    next.reading.hasAnswerKey = override.reading.hasAnswerKey ?? next.reading.hasAnswerKey;
  }

  if (
    override.listeningPatch?.fullAudioBlobId ||
    (override.listeningPatch?.partAudioBlobIds &&
      Object.keys(override.listeningPatch.partAudioBlobIds).length > 0)
  ) {
    const hasQ = Boolean(override.listeningPatch?.questions?.length);
    next.listening.status = hasQ ? 'ready' : 'scanned_questions_with_audio';
  }
  if (override.listeningPatch?.hasAnswerKey !== undefined) {
    next.listening.hasAnswerKey = override.listeningPatch.hasAnswerKey;
  }

  if (override.transcript?.status === 'ready') {
    next.transcript.status = 'ready';
    next.transcript.segmentCount = override.transcript.parts.reduce(
      (s, p) => s + p.segments.length,
      0
    );
    next.transcript.hasExactTimestamps = override.transcript.hasExactTimestamps;
  }

  if (override.dictationSegments) {
    const hasTs = override.dictationSegments.some(
      (s) => s.startTime !== undefined && s.endTime !== undefined
    );
    next.dictation.segmentCount = override.dictationSegments.length;
    next.dictation.hasExactTimestamps = hasTs;
    next.dictation.status = hasTs ? 'ready' : 'needs_timestamps';
  }

  if (override.writing?.status === 'ready') {
    next.writing.status = 'ready';
    if (override.writing.task1?.prompt) {
      next.writing.task1Prompt = override.writing.task1.prompt;
    }
    if (override.writing.task2?.prompt) {
      next.writing.task2Prompt = override.writing.task2.prompt;
    }
  }

  if (override.idea?.status === 'ready') {
    next.idea.status = 'ready';
    next.idea.topic = override.idea.topic;
  }

  return next;
}

function mergeTestWithOverride(
  base: VolumeTestEntry,
  override?: VolTestOverride
): VolumeTestEntry {
  if (!override) return base;

  const merged: VolumeTestEntry = {
    ...base,
    reading: override.reading
      ? { ...base.reading, ...override.reading }
      : base.reading,
    listening: {
      ...base.listening,
      parts: base.listening.parts.map((p) => ({ ...p })),
    },
    transcript: override.transcript || base.transcript,
    dictation: {
      ...base.dictation,
      partAudioMap: { ...base.dictation.partAudioMap },
      segments: override.dictationSegments || base.dictation.segments,
    },
    writing: override.writing || base.writing,
    idea: override.idea || base.idea,
  };

  if (override.dictationSegments) {
    const hasTs = override.dictationSegments.some(
      (s) => s.startTime !== undefined && s.endTime !== undefined
    );
    merged.dictation.hasExactTimestamps = hasTs;
    merged.dictation.status = hasTs ? 'ready' : 'needs_timestamps';
    if (merged.transcript.parts.length > 0) {
      merged.transcript = {
        ...merged.transcript,
        hasExactTimestamps: hasTs,
        parts: merged.transcript.parts.map((tp) => ({
          ...tp,
          segments: tp.segments.map((seg) => {
            const match = override.dictationSegments!.find(
              (ds) => ds.index === seg.index
            );
            return match
              ? {
                  ...seg,
                  startTime: match.startTime,
                  endTime: match.endTime,
                }
              : seg;
          }),
        })),
      };
    }
  }

  if (override.listeningPatch) {
    if (override.listeningPatch.questions) {
      for (const part of merged.listening.parts) {
        part.questions = override.listeningPatch.questions.filter(
          (q) => q.sectionNumber === part.partNumber
        );
      }
      if (override.listeningPatch.hasAnswerKey !== undefined) {
        merged.listening.hasAnswerKey = override.listeningPatch.hasAnswerKey;
      }
    }
    if (
      override.listeningPatch.fullAudioBlobId ||
      (override.listeningPatch.partAudioBlobIds &&
        Object.keys(override.listeningPatch.partAudioBlobIds).length > 0)
    ) {
      const hasDigitalQ = merged.listening.parts.some(
        (p) => p.questions.length > 0
      );
      merged.listening.status = hasDigitalQ
        ? 'ready'
        : merged.listening.originalPdfUrl
          ? 'scanned_questions_with_audio'
          : 'ready';
      if (merged.transcript.status === 'ready') {
        merged.dictation.status = merged.dictation.hasExactTimestamps
          ? 'ready'
          : 'needs_timestamps';
      }
    }
  }

  return merged;
}

export function useVolumeCatalog(): {
  volumes: VolumeCatalogSummaryEntry[];
  progressMap: Map<string, VolSkillProgress>;
  overridesMap: Map<string, VolTestOverride>;
  missingReport: MissingItemRecord[];
} {
  const overrides = useLiveQuery(() => db.volOverrides.toArray(), [], []);
  const progressList = useLiveQuery(() => db.volProgress.toArray(), [], []);

  const overridesMap = useMemo(
    () => new Map(overrides.map((o) => [o.id, o])),
    [overrides]
  );

  const progressMap = useMemo(
    () => new Map(progressList.map((p) => [p.id, p])),
    [progressList]
  );

  const volumes = useMemo<VolumeCatalogSummaryEntry[]>(() => {
    return CATALOG_SUMMARY.map((vol) => ({
      ...vol,
      tests: vol.tests.map((test) =>
        mergeSummaryWithOverride(test, overridesMap.get(test.id))
      ),
    }));
  }, [overridesMap]);

  const missingReport = useMemo<MissingItemRecord[]>(() => {
    return STATIC_MISSING_REPORT.filter((item) => {
      const ov = overridesMap.get(
        `vol-${item.volNumber}-test-${item.testNumber}`
      );
      if (!ov) return true;
      if (item.component === 'reading' && ov.reading?.status === 'ready') {
        return false;
      }
      if (
        item.component === 'audio' &&
        (ov.listeningPatch?.fullAudioBlobId ||
          (ov.listeningPatch?.partAudioBlobIds &&
            Object.keys(ov.listeningPatch.partAudioBlobIds).length > 0))
      ) {
        return false;
      }
      if (item.component === 'transcript' && ov.transcript?.status === 'ready') {
        return false;
      }
      if (item.component === 'writing' && ov.writing?.status === 'ready') {
        return false;
      }
      return true;
    });
  }, [overridesMap]);

  return { volumes, progressMap, overridesMap, missingReport };
}

export function useResolvedVolumeTest(
  volNumber: number | null,
  testNumber: number | null
): {
  test: VolumeTestEntry | null;
  loading: boolean;
  progressBySkill: Record<VolSkillTabKey, VolSkillProgress | undefined>;
} {
  const { progressMap, overridesMap } = useVolumeCatalog();
  const [loadedVol, setLoadedVol] = useState<VolumeEntry | null>(() =>
    volNumber ? VOLUME_CACHE.get(volNumber) || null : null
  );
  const [loading, setLoading] = useState<boolean>(
    Boolean(volNumber && !VOLUME_CACHE.has(volNumber))
  );

  useEffect(() => {
    if (!volNumber) {
      setLoadedVol(null);
      setLoading(false);
      return;
    }
    const cached = VOLUME_CACHE.get(volNumber);
    if (cached) {
      setLoadedVol(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadVolumeJson(volNumber)
      .then((vol) => {
        if (!cancelled) {
          setLoadedVol(vol);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [volNumber]);

  const rawTest = useMemo(() => {
    if (!loadedVol || !testNumber) return null;
    const base = loadedVol.tests.find((t) => t.testNumber === testNumber);
    if (!base) return null;
    return mergeTestWithOverride(base, overridesMap.get(base.id));
  }, [loadedVol, testNumber, overridesMap]);

  const override = rawTest ? overridesMap.get(rawTest.id) : undefined;
  const [blobAudioUrls, setBlobAudioUrls] = useState<{
    full?: string;
    parts: Record<number, string>;
  }>({ parts: {} });

  useEffect(() => {
    if (!override?.listeningPatch) {
      setBlobAudioUrls({ parts: {} });
      return;
    }

    let cancelled = false;
    const created: string[] = [];

    const loadBlobs = async () => {
      let full: string | undefined;
      const parts: Record<number, string> = {};

      if (override.listeningPatch?.fullAudioBlobId) {
        const u = await createObjectUrlForBlobId(
          override.listeningPatch.fullAudioBlobId
        );
        if (u) {
          created.push(u);
          full = u;
        }
      }

      if (override.listeningPatch?.partAudioBlobIds) {
        for (const [pKey, blobId] of Object.entries(
          override.listeningPatch.partAudioBlobIds
        )) {
          const u = await createObjectUrlForBlobId(blobId);
          if (u) {
            created.push(u);
            parts[Number(pKey)] = u;
          }
        }
      }

      if (!cancelled) {
        setBlobAudioUrls({ full, parts });
      } else {
        created.forEach((u) => URL.revokeObjectURL(u));
      }
    };

    loadBlobs();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [override?.id, override?.updatedAt]);

  const test = useMemo<VolumeTestEntry | null>(() => {
    if (!rawTest) return null;
    if (!blobAudioUrls.full && Object.keys(blobAudioUrls.parts).length === 0) {
      return rawTest;
    }
    return {
      ...rawTest,
      listening: {
        ...rawTest.listening,
        fullAudioSrc: blobAudioUrls.full || rawTest.listening.fullAudioSrc,
        parts: rawTest.listening.parts.map((p) => ({
          ...p,
          audioSrc: blobAudioUrls.parts[p.partNumber] || p.audioSrc,
          isWmaUnsupported: blobAudioUrls.parts[p.partNumber]
            ? false
            : p.isWmaUnsupported,
        })),
      },
      dictation: {
        ...rawTest.dictation,
        fullAudioSrc: blobAudioUrls.full || rawTest.dictation.fullAudioSrc,
        partAudioMap: {
          ...rawTest.dictation.partAudioMap,
          ...blobAudioUrls.parts,
        },
      },
    };
  }, [rawTest, blobAudioUrls]);

  const progressBySkill = useMemo(() => {
    const empty: Record<VolSkillTabKey, VolSkillProgress | undefined> = {
      reading: undefined,
      listening: undefined,
      transcript: undefined,
      dictation: undefined,
      writing: undefined,
      idea: undefined,
    };
    if (!volNumber || !testNumber) return empty;
    (['reading', 'listening', 'transcript', 'dictation', 'writing', 'idea'] as VolSkillTabKey[]).forEach(
      (sk) => {
        empty[sk] = progressMap.get(`vol-${volNumber}-test-${testNumber}-${sk}`);
      }
    );
    return empty;
  }, [progressMap, volNumber, testNumber]);

  return { test, loading, progressBySkill };
}
