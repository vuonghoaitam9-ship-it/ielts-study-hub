import catalogSummaryData from './catalog-summary.json';
import missingReportData from './missing-report.json';
import { MissingItemRecord, VolumeCatalogSummaryEntry } from '../../types';

export const CATALOG_SUMMARY: VolumeCatalogSummaryEntry[] =
  catalogSummaryData as unknown as VolumeCatalogSummaryEntry[];

export const STATIC_MISSING_REPORT: MissingItemRecord[] =
  missingReportData as unknown as MissingItemRecord[];
