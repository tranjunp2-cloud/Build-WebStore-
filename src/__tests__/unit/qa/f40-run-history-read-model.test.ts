import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { getUnifiedRunHistory, type UnifiedHistoryFilters } from "@/lib/admin/qa/run-history-read-model";

const historyWindow = { since: "2026-11-02T00:00:00.000Z", snapshot: "2026-11-09T02:00:00.000Z" };

/** Renders the exact query the read model sends, as node-postgres receives it. */
async function renderHistoryQuery(filters: UnifiedHistoryFilters) {
  let captured: SQL | undefined;
  const execute = vi.fn(async (query: SQL) => {
    captured = query;
    return { rows: [] };
  });
  await getUnifiedRunHistory({ db: { drizzle: { execute } } } as never, filters);
  if (!captured) throw new Error("read model did not execute a query");
  return new PgDialect().sqlToQuery(captured);
}

/** The expression in front of every `::text[]` cast, e.g. `$7` or the broken `)`. */
function textArrayCastOperands(sqlText: string) {
  return [...sqlText.matchAll(/([^\s(]+)::text\[\]/g)].map(([, operand]) => operand);
}

function paramFor(query: { sql: string; params: unknown[] }, pattern: RegExp) {
  const placeholder = query.sql.match(pattern)?.[1];
  if (!placeholder) throw new Error(`no placeholder for ${pattern}`);
  return query.params[Number(placeholder.slice(1)) - 1];
}

describe("[TC-F40-07-06] run-history SQL binds array filters as single Postgres array params", () => {
  it("renders a parseable query when no test-case pack IDs or profiles are filtered", async () => {
    // Arrange: the default history request, which returned 500 on staging.
    // Act
    const query = await renderHistoryQuery(historyWindow);

    // Assert
    expect(query.sql).not.toMatch(/\(\s*\)/);
    const operands = textArrayCastOperands(query.sql);
    expect(operands).toHaveLength(3);
    for (const operand of operands) expect(operand).toMatch(/^\$\d+$/);
    expect(paramFor(query, /pack_id = ANY\((\$\d+)::text\[\]\)/)).toEqual([]);
  });

  it("passes each non-empty array as one array param, not an expanded value list", async () => {
    // Arrange: one profile (was `($1)::text[]`) and two pack IDs (was a row constructor).
    const filters = { ...historyWindow, profiles: ["smoke"], testCaseId: "TC-F40-04-02", testCasePackIds: ["editor-product-grid-variants-smoke", "orders-smoke"] };

    // Act
    const query = await renderHistoryQuery(filters);

    // Assert
    for (const operand of textArrayCastOperands(query.sql)) expect(operand).toMatch(/^\$\d+$/);
    expect(paramFor(query, /pack_id = ANY\((\$\d+)::text\[\]\)/)).toEqual(["editor-product-grid-variants-smoke", "orders-smoke"]);
    expect(paramFor(query, /profile = ANY\((\$\d+)::text\[\]\)/)).toEqual(["smoke"]);
    expect(paramFor(query, /AND \((\$\d+)::text\[\] IS NULL/)).toEqual(["smoke"]);
  });
});

describe("[TC-F40-07-04] unified QA run-history read model", () => {
  it("uses one bounded SQL timeline and keeps an immutable cursor tie-breaker", async () => {
    const execute = vi.fn(async () => ({ rows: [{ source: "dispatch", id: 19, target_id: "editor-productgrid-variants", pack_id: "editor-product-grid-variants-smoke", pack_version: 1, profile: "manual-smoke", status: "dispatched", pull_request: 1746, commit_sha: "abcdef1", started_at: "2026-08-13T01:00:00.000Z", finished_at: null, cursor_at: "2026-08-13T01:00:00.000Z", evidence_state: "unavailable" }] }));
    const snapshot = "2026-08-13T02:00:00.000Z";
    const result = await getUnifiedRunHistory({ db: { drizzle: { execute } } } as never, { since: "2026-08-06T00:00:00.000Z", snapshot }, { at: "2026-08-13T01:00:00.000Z", source: "dispatch", id: 20, snapshot });
    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({ source: "dispatch", id: 19, cursor_at: "2026-08-13T01:00:00.000Z" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("falls back cleanly when the Payload adapter is mocked without Drizzle", async () => {
    await expect(getUnifiedRunHistory({} as never, { since: "2026-08-06T00:00:00.000Z", snapshot: "2026-08-13T02:00:00.000Z" })).resolves.toBeNull();
  });
});
