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
    matchExpected: percentage(counts.match, total),
  };
}
export type FieldEvidenceSummary = {
  generationId: string;
  snapshotId?: string;
  runId: string;
  digest: string;
  verifiedAt: string;
  sourceSnapshotAt: string | null;
  sourceSnapshotId?: string | null;
  sourceInstance?: string;
  targetInstance?: string;
  registryVersion?: string | null;
  targetDriftCheck?: string | null;
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
  byEntity?: Partial<Record<'products' | 'orders' | 'discounts' | 'customers', FieldCounts>>;
  rows: Array<{ key: string; record: string; status: FieldStatus; reason: string; source: string | null; target: string | null; sourcePresence?: 'absent' | 'null' | 'empty' | 'value' | null; disposition: string }>;
  total: number;
  page: number;
};

export type RecordFieldEvidenceResult = {
  state: 'complete' | 'unavailable';
  reason: string | null;
  runId: string;
  generationId: string | null;
  snapshotId: string | null;
  sourceSnapshotAt: string | null;
  verifiedAt: string | null;
  counts: FieldCounts;
  total: number;
  page: number;
  rows: Array<{
    entity: string;
    sourceRecord: string;
    key: string;
    targetKey: string | null;
    elementKey: string;
    source: string | null;
    target: string | null;
    displayAllowed: boolean;
    sourcePresence: 'absent' | 'null' | 'empty' | 'value' | null;
    status: FieldStatus;
    reason: string;
    transform: string;
    disposition: string;
    targetIdentityMatchesLedger: boolean | null;
  }>;
};
