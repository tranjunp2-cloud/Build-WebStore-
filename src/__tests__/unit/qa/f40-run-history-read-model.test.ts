import { describe, expect, it, vi } from "vitest";
import { getUnifiedRunHistory } from "@/lib/admin/qa/run-history-read-model";

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
