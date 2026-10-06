export const FIELD_STATUSES = ['match', 'mismatch', 'missing', 'duplicate', 'unsupported', 'unverified'] as const;
export type FieldStatus = typeof FIELD_STATUSES[number];
export type FieldCounts = Record<FieldStatus, number>;
function percentage(part: number, total: number) {
  if (!total) return null;
  // Reserve 100% for exact completeness, never for rounded partial evidence.
  return part === total ? 100 : Math.min(99.9, Math.round(part / total * 1000) / 10);
}
export function fieldEvidenceRates(counts: FieldCounts) {
  const total = FIELD_STATUSES.reduce((sum, key) => sum + counts[key], 0);
  const checked = counts.match + counts.mismatch + counts.missing + counts.duplicate;
  return {
    total, checked,
    coverage: percentage(checked, total),
    matchRate: percentage(counts.match, checked),
  };
}
export type FieldEvidenceSummary = {
  generationId: string;
  runId: string;
  digest: string;
  verifiedAt: string;
  sourceSnapshotAt: string | null;
  counts: FieldCounts;
  outsideScope: number;
  outsideComparison: number;
  openExceptions: number;
};
export function needsFieldReview(summary: FieldEvidenceSummary | null | undefined) {
  if (!summary) return true;
  const rates = fieldEvidenceRates(summary.counts);
  return rates.total === 0 || summary.counts.match !== rates.total || summary.openExceptions > 0 || summary.outsideScope > 0 || summary.outsideComparison > 0;
}
export type FieldEvidenceResult = {
  summary: FieldEvidenceSummary | null;
  rows: Array<{ key: string; record: string; status: FieldStatus; reason: string; source: string | null; target: string | null; disposition: string }>;
  total: number;
  page: number;
};
