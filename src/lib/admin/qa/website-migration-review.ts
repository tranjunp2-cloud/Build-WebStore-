import { sql } from "drizzle-orm";
import { getPayload } from "payload";
import config from "@payload-config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

// Version covers migration, site settings/status, all pages and persisted audit.
export const evidenceVersionSql = sql`md5(m.input_hash || COALESCE(c.attempt_id::text,'') || (s.updated_at AT TIME ZONE 'UTC')::text || COALESCE((q.checked_at AT TIME ZONE 'UTC')::text,'') || COALESCE((SELECT string_agg(p.id::text || ':' || (p.updated_at AT TIME ZONE 'UTC')::text,',' ORDER BY p.id) FROM pages p WHERE p.site_id=m.site_id),'') )`;
export async function readWebsiteReviews(storeIds: string[]) {
  if (!storeIds.length) return [];
  const payload = await getPayload({ config });
  const db = payload.db.drizzle as unknown as {
    execute(query: unknown): Promise<{
      rows: Array<{
        storeId: string;
        version: string;
        verdict: string | null;
        note: string | null;
        reviewedAt: string | null;
        current: boolean | null;
        checks: Record<string, boolean> | null;
      }>;
    }>;
  };
  return (
    (
      await db.execute(sql`SELECT m.source_store_id AS "storeId",${evidenceVersionSql} AS version,r.verdict,r.note,r.checks,r.reviewed_at AS "reviewedAt",r.evidence_version=${evidenceVersionSql} AS current
      FROM pw1_migration_stores m JOIN sites s ON s.id=m.site_id
      LEFT JOIN LATERAL(SELECT attempt_id FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1)c ON true
      LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id
      LEFT JOIN LATERAL(SELECT * FROM pw1_migration_qa_reviews WHERE source_store_id=m.source_store_id ORDER BY reviewed_at DESC,id DESC LIMIT 1)r ON true
      WHERE m.source_store_id IN (${sql.join(storeIds.map(id => sql`${id}`), sql`,`)})`)
    ).rows
  );
}
export async function readWebsiteReview(storeId: string) {
  return (await readWebsiteReviews([storeId]))[0] ?? null;
}
export async function saveWebsiteReview(
  input: {
    checks: {
      content: boolean;
      media: boolean;
      mapping: boolean;
      visual: boolean;
      audit: boolean;
    };
    store: string;
    version: string;
    verdict: "passed" | "warning" | "failed";
    note: string;
  },
  reviewerId: number,
) {
  const client = new Client({
    connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    // One statement checks the exact evidence revision; never apply an old verdict to a new rerun.
    const result = await client.query(
      `INSERT INTO pw1_migration_qa_reviews(id,source_store_id,input_hash,attempt_id,evidence_version,verdict,note,reviewer_id,checks)
          SELECT $1,m.source_store_id,m.input_hash,c.attempt_id,$3,$4,$5,$6,$7::jsonb
          FROM pw1_migration_stores m JOIN sites s ON s.id=m.site_id
          JOIN LATERAL(SELECT attempt_id FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1)c ON true
          LEFT JOIN pw1_migration_qa_audits q ON q.source_store_id=m.source_store_id AND q.input_hash=m.input_hash AND q.attempt_id=c.attempt_id
          WHERE m.source_store_id=$2 AND m.status='completed' AND
          md5(m.input_hash || COALESCE(c.attempt_id::text,'') || (s.updated_at AT TIME ZONE 'UTC')::text || COALESCE((q.checked_at AT TIME ZONE 'UTC')::text,'') || COALESCE((SELECT string_agg(p.id::text || ':' || (p.updated_at AT TIME ZONE 'UTC')::text,',' ORDER BY p.id) FROM pages p WHERE p.site_id=m.site_id),''))=$3`,
      [
        randomUUID(),
        input.store,
        input.version,
        input.verdict,
        input.note,
        reviewerId,
        JSON.stringify(input.checks),
      ],
    );
    return result.rowCount === 1;
  } finally {
    await client.end();
  }
}
