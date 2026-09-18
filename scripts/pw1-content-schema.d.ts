import type { SqlClient } from '../src/lib/migration/pw1-json/ledger'
export function assertTargetContentSchema(db: SqlClient): Promise<void>
export function runContentSlugTenantMigration(pool: { connect(): Promise<SqlClient & {release(): void}> }): Promise<void>
