import 'server-only';
import { sql } from 'drizzle-orm';
import { getPayload } from 'payload';
import config from '@payload-config';
import { F42SourceUnavailableError, missingF42SchemaColumns, type F42SchemaColumn, type F42SchemaContract } from './f42-source-contract';

type Db = Awaited<ReturnType<typeof getPayload>>['db']['drizzle'];

/** Read metadata only; do not cache readiness across migrations/deployments. */
export async function isF42SchemaReady(db: Db, required: F42SchemaContract): Promise<boolean> {
  const tables = Object.keys(required);
  if (!tables.length) return true;
  const result = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN (${sql.join(tables.map(table => sql`${table}`), sql`,`)})
  `) as { rows: F42SchemaColumn[] };
  return missingF42SchemaColumns(result.rows, required).length === 0;
}

export async function assertF42SourceReady(required: F42SchemaContract): Promise<void> {
  const { db: { drizzle: db } } = await getPayload({ config });
  if (!await isF42SchemaReady(db, required)) throw new F42SourceUnavailableError();
}
