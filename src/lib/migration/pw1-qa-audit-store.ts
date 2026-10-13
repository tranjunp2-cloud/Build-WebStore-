import { Client } from "pg";
import { batchEntryHash, type BatchEntry } from "./pw1-batch-input";
import type { AuditPage } from "./pw1-quality-audit";

export type StoredAudit = {
  storeId: string;
  status: string;
  errors: number;
  warnings: number;
  waitingBe: number;
};
/** Never attach a report to a different input or an uncommitted generation. */
export async function persistWebsiteAudits(
  entries: BatchEntry[],
  report: {
    createdAt: string;
    baseUrl: string;
    stores: StoredAudit[];
    pages: AuditPage[];
  },
  pageVersions: Record<string, string | null> = {},
  attempts: Record<string, string> = {},
) {
  const client = new Client({
    connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    for (const store of report.stores) {
      const entry = entries.find(
        (item) => item.sourceStoreId === store.storeId,
      );
      if (!entry) continue;
      const evidence = {
        ...store,
        pages: report.pages
          .filter((page) => page.storeId === store.storeId)
          .map((page) => ({
            ...page,
            updatedAt: page.pageId
              ? (pageVersions[String(page.pageId)] ?? null)
              : null,
          })),
      };
      await client.query(
        `INSERT INTO pw1_migration_qa_audits(source_store_id,input_hash,attempt_id,checked_at,base_url,report)
                SELECT m.source_store_id,m.input_hash,c.attempt_id,$3,$4,$5::jsonb
                FROM pw1_migration_stores m JOIN LATERAL (
                    SELECT attempt_id FROM pw1_migration_commits WHERE source_store_id=m.source_store_id AND input_hash=m.input_hash ORDER BY committed_at DESC LIMIT 1
                ) c ON true WHERE m.source_store_id=$1 AND m.input_hash=$2 AND m.status='completed' AND c.attempt_id=$6::uuid AND (SELECT committed_at FROM pw1_migration_commits WHERE attempt_id=c.attempt_id) <= $3::timestamptz
                ON CONFLICT(source_store_id,input_hash,attempt_id) DO UPDATE SET checked_at=EXCLUDED.checked_at,base_url=EXCLUDED.base_url,report=EXCLUDED.report
                WHERE EXCLUDED.checked_at > pw1_migration_qa_audits.checked_at`,
        [
          store.storeId,
          batchEntryHash(entry),
          report.createdAt,
          report.baseUrl,
          JSON.stringify(evidence),
          attempts[store.storeId] ?? null,
        ],
      );
    }
  } finally {
    await client.end();
  }
}
