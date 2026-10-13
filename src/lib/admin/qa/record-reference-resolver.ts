import type { ReconciliationRecord } from './migration-reconciliation';
import { reconciliationRecordReference } from './reconciliation-record-reference';

export type ResolvedRecord = Pick<ReconciliationRecord, 'sourceEntity' | 'sourceId' | 'targetIds'>;

const TTL_MS = 60_000;
const MAX_ENTRIES = 20;
const cache = new Map<string, { expiresAt: number; byRef: Map<string, ResolvedRecord> }>();
const cacheKey = (storeId: string, runId: string) => `${storeId}\0${runId}`;

/**
 * record_ref -> record index for one VERIFIED run. A verified run's ledger is
 * immutable, so the HMAC index is kept briefly instead of rebuilding the whole
 * ledger snapshot on every field page or status click.
 * Returns undefined when no fresh index exists (caller must build one), null when
 * the index exists but the reference is not part of this Store and run.
 */
export function lookupRecordReference(storeId: string, runId: string, reference: string, now = Date.now()): ResolvedRecord | null | undefined {
  const entry = cache.get(cacheKey(storeId, runId));
  if (!entry || entry.expiresAt <= now) return undefined;
  return entry.byRef.get(reference) ?? null;
}

/** Callers must only index records from a VERIFIED run. */
export function indexRecordReferences(storeId: string, runId: string, records: readonly ReconciliationRecord[], now = Date.now()): void {
  const byRef = new Map<string, ResolvedRecord>();
  for (const record of records) {
    byRef.set(reconciliationRecordReference({ storeId, runId, record }), record);
  }
  const key = cacheKey(storeId, runId);
  cache.delete(key);
  cache.set(key, { expiresAt: now + TTL_MS, byRef });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

export function clearRecordReferenceCache(): void {
  cache.clear();
}
