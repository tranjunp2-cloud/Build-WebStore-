import { createHmac } from 'node:crypto';
import type { ReconciliationRecord } from './migration-reconciliation';

/** An opaque selector bound to one Store and child run, never a reversible source ID. */
export function reconciliationRecordReference(input: {
  storeId: string;
  runId: string;
  record: Pick<ReconciliationRecord, 'sourceEntity' | 'sourceId'>;
}): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error('Payload secret is unavailable');
  return createHmac('sha256', secret)
    .update(['f40-record-v1', input.storeId, input.runId, input.record.sourceEntity, input.record.sourceId].join('\0'))
    .digest('hex')
    .slice(0, 32);
}
