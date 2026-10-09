import { assertTargetContentSchema } from '../../../../scripts/pw1-content-schema'
import { verifyPw1EvidenceSchema } from '../../../../scripts/pw1-evidence-schema'
import { MigrationError } from './errors'
import type { SqlClient } from './ledger'
/** Read-only v2 gate, independent of db-setup's catch-and-continue migration loop. */
export async function assertTargetSchema(db: SqlClient): Promise<void> {
  try {
    await assertTargetContentSchema(db)
    await verifyPw1EvidenceSchema(db)
  } catch (error) {
    if (error instanceof Error && /^(CONTENT_|PRODUCT_DESCRIPTION_SCHEMA_|ORDER_HISTORY_PRODUCT_SCHEMA_)/.test(error.message)) {
      throw new MigrationError('TARGET_SCHEMA_CONFLICT', error.message)
    }
    if (error instanceof Error && error.message.startsWith('PW1_EVIDENCE_SCHEMA_INVALID:')) {
      throw new MigrationError('TARGET_EVIDENCE_SCHEMA_MISSING', error.message)
    }
    throw error
  }
}
