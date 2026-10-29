/**
 * Read-only view of the PW1 delta migration (`migrate:pw1:delta`) for one PW1 store.
 * Source: the delta's own ledger (`pw1_delta_runs`, `pw1_delta_map`). The original import ledger
 * (`migration_*`) is not read here and never mixed in, so import evidence screens stay unchanged.
 * `pw1_delta_map` keeps the latest delta action per source document (one row per document).
 */
import { sql } from "drizzle-orm";
import { getPayload } from "payload";
import config from "@payload-config";

const MAX_CHANGES = 500;
const MAX_RUNS = 50;

export type DeltaAction = "CREATE" | "UPDATE" | "RETIRE" | "REPORTED";

export interface DeltaStoreIssue { ref: string; collection: string; code: string; targetId: number | null }
export interface DeltaRunView {
  runId: string; state: string; startedAt: string; finishedAt: string | null
  /** Changes this run recorded for the store (latest action per document). */
  counts: Record<DeltaAction, number>
  /** Conflicts / failures of this run for the store (not written; need a manual decision). */
  issues: DeltaStoreIssue[]
}
export interface DeltaChangeView {
  sourceEntity: string; sourceId: string; targetCollection: string; targetId: string
  action: DeltaAction; runId: string; updatedAt: string
}
export interface DeltaTracking {
  available: boolean
  runs: DeltaRunView[]
  changes: DeltaChangeView[]
  changesTruncated: boolean
}

interface RunRow { run_id: string; state: string; started_at: string | Date; finished_at: string | Date | null; summary: unknown }
interface CountRow { run_id: string; action: string; count: number | string }
interface ChangeRow { source_entity: string; source_id: string; target_collection: string; target_id: string; action: string; run_id: string; updated_at: string | Date }

const ACTIONS: DeltaAction[] = ["CREATE", "UPDATE", "RETIRE", "REPORTED"];
const iso = (value: string | Date) => new Date(value).toISOString();

/** Issues stored in `pw1_delta_runs.summary.issues`, filtered to one store. */
export function storeIssues(summary: unknown, storeId: string): DeltaStoreIssue[] {
  const issues = summary && typeof summary === "object" ? (summary as { issues?: unknown }).issues : undefined;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (row.storeId !== storeId || typeof row.ref !== "string" || typeof row.code !== "string") return [];
    return [{ ref: row.ref, collection: String(row.collection ?? ""), code: row.code, targetId: typeof row.targetId === "number" ? row.targetId : null }];
  });
}

/**
 * Pure assembly of the store view from ledger rows; runs without changes or issues for the store are dropped.
 * Counts come from a separate GROUP BY query, so they stay exact when the change list is truncated.
 */
export function buildDeltaTracking(storeId: string, runRows: RunRow[], changeRows: ChangeRow[], truncated: boolean, countRows: CountRow[]): DeltaTracking {
  const changes: DeltaChangeView[] = changeRows.flatMap((row) => ACTIONS.includes(row.action as DeltaAction)
    ? [{ sourceEntity: row.source_entity, sourceId: row.source_id, targetCollection: row.target_collection, targetId: row.target_id,
      action: row.action as DeltaAction, runId: row.run_id, updatedAt: iso(row.updated_at) }]
    : []);
  const runs = runRows.flatMap((row) => {
    const counts = { CREATE: 0, UPDATE: 0, RETIRE: 0, REPORTED: 0 } as Record<DeltaAction, number>;
    for (const count of countRows) if (count.run_id === row.run_id && ACTIONS.includes(count.action as DeltaAction)) counts[count.action as DeltaAction] += Number(count.count);
    const issues = storeIssues(row.summary, storeId);
    if (!issues.length && ACTIONS.every((action) => counts[action] === 0)) return [];
    return [{ runId: row.run_id, state: row.state, startedAt: iso(row.started_at), finishedAt: row.finished_at ? iso(row.finished_at) : null, counts, issues }];
  });
  return { available: true, runs, changes, changesTruncated: truncated };
}

export async function readPw1DeltaTracking(storeId: string): Promise<DeltaTracking> {
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  const exists = await db.execute(sql`SELECT to_regclass('public.pw1_delta_map') IS NOT NULL AS ok`) as unknown as { rows: { ok: boolean }[] };
  if (!exists.rows[0]?.ok) return { available: false, runs: [], changes: [], changesTruncated: false };

  const changes = await db.execute(sql`
    SELECT source_entity, source_id, target_collection, target_id, action, run_id, updated_at
    FROM pw1_delta_map
    WHERE store_id = ${storeId}
    ORDER BY updated_at DESC, source_entity, source_id
    LIMIT ${MAX_CHANGES + 1}
  `) as unknown as { rows: ChangeRow[] };
  // Runs that changed this store, plus runs whose summary lists an issue for it.
  const runs = await db.execute(sql`
    SELECT run_id, state, started_at, finished_at, summary
    FROM pw1_delta_runs r
    WHERE EXISTS (SELECT 1 FROM pw1_delta_map m WHERE m.run_id = r.run_id AND m.store_id = ${storeId})
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(r.summary->'issues', '[]'::jsonb)) issue WHERE issue->>'storeId' = ${storeId})
    ORDER BY started_at DESC
    LIMIT ${MAX_RUNS}
  `) as unknown as { rows: RunRow[] };
  const counts = await db.execute(sql`
    SELECT run_id, action, count(*)::int AS count FROM pw1_delta_map WHERE store_id = ${storeId} GROUP BY run_id, action
  `) as unknown as { rows: CountRow[] };
  return buildDeltaTracking(storeId, runs.rows, changes.rows.slice(0, MAX_CHANGES), changes.rows.length > MAX_CHANGES, counts.rows);
}
