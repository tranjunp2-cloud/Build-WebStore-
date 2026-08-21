import { sql } from "drizzle-orm";
import type { Payload } from "payload";

export type UnifiedHistoryCursor = { at: string; source: "dispatch" | "run"; id: number; snapshot: string };
export type UnifiedHistoryFilters = { since: string; snapshot: string; targetId?: string; suite?: string; profiles?: string[]; pullRequest?: number; commitSha?: string; packId?: string; testCaseId?: string; testCasePackIds?: string[]; status?: string };

export type UnifiedRunHistoryRow = { source: "dispatch" | "run"; id: number; target_id: string; pack_id: string | null; pack_version: number | null; profile: string; status: string; pull_request: number | null; commit_sha: string; started_at: string; finished_at: string | null; cursor_at: string; evidence_state: "available" | "expiring" | "expired" | "unavailable" };
type Db = { drizzle?: { execute: (query: unknown) => Promise<{ rows: UnifiedRunHistoryRow[] }> } };

/**
 * A snapshot-stable SQL timeline. Dispatch status changes are append-only events,
 * so a page cursor cannot move when a queued run later reaches a terminal state.
 */
export async function getUnifiedRunHistory(payload: Payload, filters: UnifiedHistoryFilters, cursor?: UnifiedHistoryCursor): Promise<UnifiedRunHistoryRow[] | null> {
  const db = payload.db as unknown as Db | undefined;
  // Local `next dev` deliberately uses the Payload path: a developer can run
  // against a database before migrations, while deployed builds always use
  // the snapshot-stable SQL read model installed by db-setup.
  if (process.env.NODE_ENV === "development" || !db?.drizzle) return null;
  const result = await db.drizzle.execute(sql`
    WITH dispatch_snapshot AS (
      SELECT DISTINCT ON (d.id) d.*, e.status AS event_status, e.occurred_at AS cursor_at
      FROM qa_smoke_dispatches d
      JOIN qa_smoke_dispatch_history_events e ON e.dispatch_id = d.id
      WHERE e.occurred_at <= ${filters.snapshot}::timestamptz
      ORDER BY d.id, e.occurred_at DESC, e.sequence DESC
    ), history AS (
      SELECT 'dispatch'::text AS source, d.id, d.target_id, d.pack_id, d.pack_version, d.profile, 'targeted-smoke'::text AS suite, CASE WHEN d.event_status = 'terminal' THEN r.status ELSE d.event_status END AS status,
        d.pull_request, d.commit_sha, d.created_at AS started_at,
        CASE WHEN d.event_status IN ('cancelled', 'blocked', 'terminal') THEN d.cursor_at END AS finished_at,
        d.cursor_at,
        COALESCE((SELECT CASE WHEN max(x.artifact_expires_at) <= ${filters.snapshot}::timestamptz THEN 'expired' WHEN max(x.artifact_expires_at) < ${filters.snapshot}::timestamptz + interval '1 hour' THEN 'expiring' ELSE 'available' END FROM qa_test_results x WHERE x.run_id = d.terminal_run_id AND x.created_at <= ${filters.snapshot}::timestamptz), 'unavailable') AS evidence_state
      -- A snapshot must not read terminal metadata attached after the selected
      -- lifecycle event. Only a terminal event is allowed to join its run.
      FROM dispatch_snapshot d LEFT JOIN qa_test_runs r ON d.event_status = 'terminal' AND r.id = d.terminal_run_id
      WHERE d.cursor_at >= ${filters.since}
      UNION ALL
      SELECT 'run'::text, r.id, r.target_id, NULL, NULL, r.profile, r.suite, r.status, r.pull_request, r.commit_sha, r.started_at, r.finished_at, r.finished_at,
        COALESCE((SELECT CASE WHEN max(x.artifact_expires_at) <= ${filters.snapshot}::timestamptz THEN 'expired' WHEN max(x.artifact_expires_at) < ${filters.snapshot}::timestamptz + interval '1 hour' THEN 'expiring' ELSE 'available' END FROM qa_test_results x WHERE x.run_id = r.id AND x.created_at <= ${filters.snapshot}::timestamptz), 'unavailable')
      FROM qa_test_runs r WHERE r.finished_at >= ${filters.since} AND r.finished_at <= ${filters.snapshot}::timestamptz AND NOT EXISTS (SELECT 1 FROM qa_smoke_dispatches d WHERE d.terminal_run_id = r.id)
    ) SELECT * FROM history WHERE (${filters.targetId ?? null}::text IS NULL OR target_id = ${filters.targetId ?? null})
      AND (${filters.suite ?? null}::text IS NULL OR suite = ${filters.suite ?? null})
      AND (${filters.profiles?.length ? filters.profiles : null}::text[] IS NULL OR profile = ANY(${filters.profiles?.length ? filters.profiles : null}::text[]))
      AND (${filters.pullRequest ?? null}::numeric IS NULL OR pull_request = ${filters.pullRequest ?? null})
      AND (${filters.commitSha ?? null}::text IS NULL OR commit_sha = ${filters.commitSha ?? null})
      AND (${filters.packId ?? null}::text IS NULL OR pack_id = ${filters.packId ?? null})
      AND (${filters.status ?? null}::text IS NULL OR status = ${filters.status ?? null})
      AND (${filters.testCaseId ?? null}::text IS NULL OR (source = 'run' AND EXISTS (SELECT 1 FROM qa_test_results x WHERE x.run_id = history.id AND x.test_case_id = ${filters.testCaseId ?? null})) OR (source = 'dispatch' AND pack_id = ANY(${filters.testCasePackIds?.length ? filters.testCasePackIds : []}::text[])))
      AND (${cursor?.at ?? null}::timestamptz IS NULL OR (cursor_at, source, id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.source ?? "run"}, ${cursor?.id ?? 0}))
    ORDER BY cursor_at DESC, source DESC, id DESC LIMIT 51`);
  return result.rows;
}
