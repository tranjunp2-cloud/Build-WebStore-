/**
 * Read-only adapter from the F42 PW1 migration ledger to the F40
 * reconciliation contract.
 *
 * The ledger proves identity mapping and migration state only. It does not
 * contain PW1/PW2 business-field values, so this adapter deliberately never
 * reports a field-level comparison or infers matches from SKU/email/order code.
 */
import { sql } from "drizzle-orm";
import { getPayload } from "payload";
import config from "@payload-config";
import {
  createUnverifiedReconciliationSnapshot,
  type MigrationEvidenceProvider,
  type ReconciliationEntity,
  type ReconciliationIssue,
  type ReconciliationRecord,
  type ReconciliationRun,
  type ReconciliationScope,
  type ReconciliationSnapshot,
  type ReconciliationStatus,
} from "./migration-reconciliation";

export const F42_LEDGER_CONTRACT_VERSION = "f42-ledger-v1";

const MAX_LEDGER_RECORDS = 5_000;
const MAX_LEDGER_RUNS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSIENT_DATABASE_CODES = new Set(["57014", "ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "ENOTFOUND", "ETIMEDOUT"]);

/**
 * Reviewed F42 source namespaces represented by F40. Source identity, rather
 * than the target value, drives selection so DEFER/BLOCK rows with no target
 * remain visible as unverified instead of disappearing from a successful run.
 */
const ENTITY_BY_SOURCE_ENTITY: Record<string, {
  entity: ReconciliationEntity;
  scope: ReconciliationScope;
  targetCollection: string;
}> = {
  products: { entity: "products", scope: "commerce", targetCollection: "products" },
  orders: { entity: "orders", scope: "commerce", targetCollection: "orders" },
  promotion_codes: { entity: "discounts", scope: "commerce", targetCollection: "discounts" },
  customers: { entity: "customers", scope: "commerce", targetCollection: "customers" },
  sites: { entity: "account_profile", scope: "settings", targetCollection: "sites" },
  users: { entity: "team_members", scope: "settings", targetCollection: "users" },
  store_email_templates: {
    entity: "email_templates",
    scope: "settings",
    targetCollection: "email-template-settings",
  },
};

/** Drizzle expands a plain array into a SQL tuple; PostgreSQL ANY requires an array. */
export function f42LedgerSourceEntityFilter() {
  const entities = Object.keys(ENTITY_BY_SOURCE_ENTITY);
  return sql`m.source_entity IN (${sql.join(entities.map(entity => sql`${entity}`), sql`, `)})`;
}

type LedgerRunRow = {
  run_id: string;
  source_store_id: string;
  run_state: string;
  import_store_state: string;
  updated_at: string | Date;
};

type LedgerMapRow = {
  source_entity: string;
  source_id: string;
  target_collection: string | null;
  target_id: string | null;
  action: string;
  state: string;
  claim_active: boolean;
  mapping_confirmed: boolean;
  has_open_exception: boolean;
};

type LedgerExceptionRow = {
  source_entity: string;
  source_id: string | null;
  state: string;
};

type QueryResult<Row> = { rows: Row[] };

type LedgerRunListRow = {
  run_id: string;
  source_store_id: string;
  updated_at: string | Date;
};

type LedgerIssueRow = {
  id: string | number;
  source_entity: string;
  source_id: string | null;
  severity: "WARNING" | "BLOCKER";
  error_code: string;
};

export type F42LedgerReadResult = {
  run: LedgerRunRow | null;
  maps: LedgerMapRow[];
  exceptions: LedgerExceptionRow[];
  /** More rows existed than F40 can safely render in one snapshot. */
  truncated?: boolean;
};

export type F42LedgerRunList = {
  runs: ReconciliationRun[];
  /** There are older verified runs that are not shown by the selector. */
  truncated: boolean;
};

export type F42LedgerReader = (input: {
  runId: string;
  storeId: string;
}) => Promise<F42LedgerReadResult>;

type ProviderInput = {
  scope: ReconciliationScope;
  storeId: string | null;
  runId?: string | null;
};

function emptyEvidenceSnapshot(input: ProviderInput): ReconciliationSnapshot {
  return createUnverifiedReconciliationSnapshot({
    scope: input.scope,
    storeId: input.storeId,
  });
}

function isF42LedgerUnavailable(error: unknown): boolean {
  const visited = new WeakSet<object>();
  let current: unknown = error;
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; cause?: unknown; name?: unknown };
    if (
      candidate.code === "42P01"
      || candidate.code === "42703"
      || (typeof candidate.code === "string" && TRANSIENT_DATABASE_CODES.has(candidate.code))
      || candidate.name === "TimeoutError"
    ) return true;
    current = candidate.cause;
  }
  return false;
}

function isVerifiedRun(run: LedgerRunRow | null, storeId: string): run is LedgerRunRow {
  return Boolean(
    run
      && run.source_store_id === storeId
      && run.run_state === "VERIFIED"
      && run.import_store_state === "VERIFIED",
  );
}

function bindingForRow(scope: ReconciliationScope, sourceEntity: string): {
  entity: ReconciliationEntity;
  targetCollection: string;
} | null {
  const binding = ENTITY_BY_SOURCE_ENTITY[sourceEntity];
  if (!binding || binding.scope !== scope) return null;
  return binding;
}

function recordStatus(
  row: LedgerMapRow,
  binding: { targetCollection: string },
): ReconciliationStatus {
  if (row.has_open_exception) return "unverified";
  if (
    !row.mapping_confirmed
    || row.target_collection !== binding.targetCollection
    || !row.target_id
  ) return "unverified";
  return "match";
}

function buildRecords(
  scope: ReconciliationScope,
  mapRows: LedgerMapRow[],
  exceptions: LedgerExceptionRow[],
): ReconciliationRecord[] {
  const grouped = new Map<string, {
    entity: ReconciliationEntity;
    targetCollection: string;
    rows: LedgerMapRow[];
  }>();

  for (const row of mapRows) {
    const binding = bindingForRow(scope, row.source_entity);
    if (!binding) continue;
    const key = `${binding.entity}\u0000${row.source_entity}\u0000${row.source_id}`;
    const group = grouped.get(key) ?? { ...binding, rows: [] };
    group.rows.push(row);
    grouped.set(key, group);
  }

  for (const exception of exceptions) {
    if (!exception.source_id) continue;
    const binding = bindingForRow(scope, exception.source_entity);
    if (!binding) continue;
    const key = `${binding.entity}\u0000${exception.source_entity}\u0000${exception.source_id}`;
    const group = grouped.get(key) ?? { ...binding, rows: [] };
    if (!group.rows.length) {
      group.rows.push({
        source_entity: exception.source_entity,
        source_id: exception.source_id,
        target_collection: null,
        target_id: null,
        action: "BLOCK",
        state: "FAILED",
        claim_active: false,
        mapping_confirmed: false,
        has_open_exception: true,
      });
    }
    grouped.set(key, group);
  }

  return [...grouped.values()].map(({ entity, targetCollection: expectedTargetCollection, rows }) => {
    const sourceId = rows[0]?.source_id ?? "";
    const confirmedTargetIds = rows
      .filter((row) => recordStatus(row, { targetCollection: expectedTargetCollection }) === "match" && row.target_id)
      .map((row) => row.target_id as string);
    const uniqueTargetIds = [...new Set(confirmedTargetIds)];
    const hasUnverifiedRow = rows.some((row) => recordStatus(row, { targetCollection: expectedTargetCollection }) !== "match");
    const status: ReconciliationStatus = hasUnverifiedRow
      ? "unverified"
      : uniqueTargetIds.length === 1
        ? "match"
        : uniqueTargetIds.length > 1
          ? "duplicate"
          : "unverified";
    const targetCollection = status === "unverified" ? null : expectedTargetCollection;

    return {
      sourceEntity: entity,
      sourceId,
      targetCollection,
      targetIds: status === "match" || status === "duplicate" ? uniqueTargetIds : [],
      label: "F42 ledger mapping",
      status,
      reason: "F42 ledger mapping evidence",
      fields: [],
    };
  });
}

function summarize(records: ReconciliationRecord[]): ReconciliationSnapshot["summary"] {
  return records.reduce<ReconciliationSnapshot["summary"]>((summary, record) => {
    summary.pw1Total += 1;
    summary.pw2Total += record.targetIds.length;
    summary[record.status] += 1;
    return summary;
  }, {
    pw1Total: 0,
    pw2Total: 0,
    match: 0,
    missing: 0,
    mismatch: 0,
    duplicate: 0,
    unsupported: 0,
    unverified: 0,
  });
}

/**
 * Creates the provider with an injected reader so ledger-to-contract behavior
 * can be unit tested without a database. The production reader is below.
 */
export function createF42LedgerEvidenceProvider(reader: F42LedgerReader): MigrationEvidenceProvider {
  return {
    async getSnapshot(input: ProviderInput): Promise<ReconciliationSnapshot> {
      if (!input.storeId || !input.runId || !UUID_PATTERN.test(input.runId)) {
        return emptyEvidenceSnapshot(input);
      }

      try {
        const evidence = await reader({ runId: input.runId, storeId: input.storeId });
        if (!isVerifiedRun(evidence.run, input.storeId)) return emptyEvidenceSnapshot(input);
        if (evidence.truncated) return emptyEvidenceSnapshot(input);
        if (evidence.exceptions.some((exception) => exception.state === "OPEN" && exception.source_id === null)) {
          return emptyEvidenceSnapshot(input);
        }

        const records = buildRecords(input.scope, evidence.maps, evidence.exceptions);
        const generatedAt = new Date(evidence.run.updated_at);
        if (Number.isNaN(generatedAt.valueOf())) return emptyEvidenceSnapshot(input);
        return {
          scope: input.scope,
          storeId: input.storeId,
          generatedAt: generatedAt.toISOString(),
          evidence: {
            available: true,
            mode: "verified",
            contractVersion: F42_LEDGER_CONTRACT_VERSION,
            message: "F42 ledger đã xác nhận mapping định danh; chưa bao gồm đối soát giá trị từng trường.",
          },
          summary: summarize(records),
          records,
        };
      } catch (error) {
        if (isF42LedgerUnavailable(error)) return emptyEvidenceSnapshot(input);
        throw error;
      }
    },
  };
}

/**
 * Production reader. It uses Payload's existing database connection and
 * parameterised Drizzle SQL; no new database credentials or write path exist.
 */
export const readF42LedgerEvidence: F42LedgerReader = async ({ runId, storeId }) => {
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;
  const [runResult, mapResult, exceptionResult] = await Promise.all([
    db.execute(sql`
      SELECT r.run_id::text, r.source_store_id, r.state AS run_state,
        s.state AS import_store_state, r.updated_at
      FROM migration_runs r
      JOIN migration_import_stores s ON s.run_id = r.run_id
      WHERE r.run_id = ${runId}::uuid
        AND r.source_store_id = ${storeId}
        AND s.source_store_id = ${storeId}
      LIMIT 1
    `) as Promise<QueryResult<LedgerRunRow>>,
    db.execute(sql`
      SELECT m.source_entity, m.source_id, m.target_collection, m.target_id,
        m.action, m.state, m.claim_active,
        (
          (m.action = 'CREATE' AND m.state = 'VERIFIED' AND m.claim_active = true)
          OR (
            m.action = 'SKIP' AND m.state = 'SKIPPED' AND m.claim_active = false
            AND m.detail->>'disposition' = 'VERIFIED_REUSE'
            AND owner.claim_active = true
            AND owner.state IN ('CREATED', 'VERIFIED', 'SKIPPED')
            AND owner.source_system = m.source_system
            AND owner.source_instance_id = m.source_instance_id
            AND owner.source_entity = m.source_entity
            AND owner.source_id = m.source_id
            AND owner.target_collection = m.target_collection
            AND owner.target_id = m.target_id
          )
        ) AS mapping_confirmed,
        EXISTS (
          SELECT 1 FROM migration_exceptions exception
          WHERE exception.run_id = m.run_id
            AND exception.source_entity = m.source_entity
            AND exception.source_id = m.source_id
            AND exception.state = 'OPEN'
        ) AS has_open_exception
      FROM migration_entity_map m
      LEFT JOIN migration_entity_map owner ON owner.id = m.depends_on_entity_map_id
      WHERE m.run_id = ${runId}::uuid
        AND m.source_system = 'pw1'
        AND ${f42LedgerSourceEntityFilter()}
      ORDER BY m.source_entity, m.source_id, m.id
      LIMIT ${MAX_LEDGER_RECORDS + 1}
    `) as Promise<QueryResult<LedgerMapRow>>,
    db.execute(sql`
      SELECT source_entity, source_id, state
      FROM migration_exceptions
      WHERE run_id = ${runId}::uuid
        AND state = 'OPEN'
      ORDER BY id
      LIMIT ${MAX_LEDGER_RECORDS + 1}
    `) as Promise<QueryResult<LedgerExceptionRow>>,
  ]);

  return {
    run: runResult.rows[0] ?? null,
    maps: mapResult.rows.slice(0, MAX_LEDGER_RECORDS),
    exceptions: exceptionResult.rows.slice(0, MAX_LEDGER_RECORDS),
    truncated: mapResult.rows.length > MAX_LEDGER_RECORDS || exceptionResult.rows.length > MAX_LEDGER_RECORDS,
  };
};

/** Lists only verified child runs for one explicitly selected store. */
export async function listVerifiedF42LedgerRuns(storeId: string): Promise<F42LedgerRunList> {
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;

  try {
    const result = await db.execute(sql`
      SELECT r.run_id::text, r.source_store_id, r.updated_at
      FROM migration_runs r
      JOIN migration_import_stores s ON s.run_id = r.run_id
      WHERE r.source_store_id = ${storeId}
        AND s.source_store_id = ${storeId}
        AND r.state = 'VERIFIED'
        AND s.state = 'VERIFIED'
      ORDER BY r.updated_at DESC
      LIMIT ${MAX_LEDGER_RUNS + 1}
    `) as QueryResult<LedgerRunListRow>;

    const runs = result.rows.slice(0, MAX_LEDGER_RUNS).flatMap((row) => {
      const updatedAt = new Date(row.updated_at);
      if (!UUID_PATTERN.test(row.run_id) || row.source_store_id !== storeId || Number.isNaN(updatedAt.valueOf())) {
        return [];
      }
      return [{ runId: row.run_id, storeId: row.source_store_id, updatedAt: updatedAt.toISOString() }];
    });
    return { runs, truncated: result.rows.length > MAX_LEDGER_RUNS };
  } catch (error) {
    throw error;
  }
}

/**
 * Safe exception read model for one verified child run. It deliberately omits
 * `detail`, `masked_identity`, and the source identifier.
 */
export async function listOpenF42LedgerIssues(input: {
  runId: string;
  storeId: string;
}): Promise<ReconciliationIssue[]> {
  if (!UUID_PATTERN.test(input.runId)) return [];
  const payload = await getPayload({ config });
  const db = payload.db.drizzle;

  try {
    const result = await db.execute(sql`
      SELECT e.id, e.source_entity, e.source_id, e.severity, e.error_code
      FROM migration_exceptions e
      JOIN migration_runs r ON r.run_id = e.run_id
      JOIN migration_import_stores s ON s.run_id = r.run_id
      WHERE e.run_id = ${input.runId}::uuid
        AND r.source_store_id = ${input.storeId}
        AND s.source_store_id = ${input.storeId}
        AND r.state = 'VERIFIED'
        AND s.state = 'VERIFIED'
        AND e.state = 'OPEN'
      ORDER BY e.id
      LIMIT ${MAX_LEDGER_RECORDS + 1}
    `) as QueryResult<LedgerIssueRow>;

    const issues = result.rows.slice(0, MAX_LEDGER_RECORDS).flatMap((row) => {
      if (
        !Number.isSafeInteger(Number(row.id))
        || Number(row.id) <= 0
        || !["WARNING", "BLOCKER"].includes(row.severity)
        || !/^[A-Z0-9_]{1,128}$/.test(row.error_code)
        || !/^[a-z0-9_]{1,128}$/i.test(row.source_entity)
      ) return [];
      return [{
        id: String(row.id),
        sourceEntity: row.source_entity,
        isRunLevel: row.source_id === null,
        severity: row.severity,
        errorCode: row.error_code,
      }];
    });
    if (result.rows.length > MAX_LEDGER_RECORDS) {
      issues.push({
        id: "issue-list-truncated",
        sourceEntity: "migration_run",
        isRunLevel: true,
        severity: "BLOCKER",
        errorCode: "ISSUE_LIST_TRUNCATED",
      });
    }
    return issues;
  } catch (error) {
    throw error;
  }
}

/** The production provider is registered by the F40 API integration phase. */
export const f42LedgerEvidenceProvider = createF42LedgerEvidenceProvider(readF42LedgerEvidence);
