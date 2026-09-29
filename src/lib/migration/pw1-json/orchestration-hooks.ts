import type { LedgerBatch } from './ledger'

/** Internal orchestration hooks; never populated directly from CLI arguments. */
export interface ImportOrchestrationOptions {
  /** Allocated and persisted by the orchestrator before creating the DB batch. */
  batchId?: string
  /** Called after batch commit and before acquiring its lease or writing entities. */
  onBatch?: (batch: LedgerBatch) => Promise<void>
  /** The orchestrator exports its compact destination map from the ledger. */
  compactOutput?: boolean
  /** Suppress per-user summary rows containing personal data. */
  quietUsers?: boolean
}
