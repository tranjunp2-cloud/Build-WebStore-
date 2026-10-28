import { describe, expect, it } from "vitest";
import { buildDeltaTracking, storeIssues } from "@/lib/admin/qa/pw1-delta-tracking-reader";

const change = (sourceId: string, action: string, runId: string) => ({
  source_entity: "products", source_id: sourceId, target_collection: "products", target_id: `t${sourceId}`,
  action, run_id: runId, updated_at: "2026-10-27T07:00:00.000Z",
});

describe("[TC-F42-DELTA-08] Delta migration tracking view", () => {
  it("groups the store's latest delta actions and issues by run", () => {
    // Arrange
    const runs = [
      { run_id: "r2", state: "APPLIED", started_at: "2026-10-27T07:00:00.000Z", finished_at: "2026-10-27T07:30:00.000Z",
        summary: { issues: [{ storeId: "332", ref: "@products:products:9", collection: "products", code: "PW2_EDITED_CONFLICT", targetId: 4574 },
          { storeId: "999", ref: "@products:products:1", collection: "products", code: "PW2_EDITED_CONFLICT", targetId: 1 }] } },
      { run_id: "r1", state: "APPLIED", started_at: "2026-10-26T07:00:00.000Z", finished_at: null, summary: {} },
      { run_id: "r0", state: "APPLIED", started_at: "2026-10-25T07:00:00.000Z", finished_at: null, summary: {} },
    ];
    const changes = [change("1", "UPDATE", "r2"), change("2", "RETIRE", "r2"), change("3", "CREATE", "r1"), change("4", "UNKNOWN", "r1")];
    // Act
    // Counts come from the GROUP BY query (here larger than the truncated change list).
    const counts = [{ run_id: "r2", action: "UPDATE", count: "700" }, { run_id: "r2", action: "RETIRE", count: 1 }, { run_id: "r1", action: "CREATE", count: 1 }, { run_id: "r1", action: "UNKNOWN", count: 5 }];
    const view = buildDeltaTracking("332", runs, changes, true, counts);
    // Assert
    expect(view.runs.map((run) => run.runId)).toEqual(["r2", "r1"]);
    expect(view.runs[0]).toMatchObject({ counts: { CREATE: 0, UPDATE: 700, RETIRE: 1, REPORTED: 0 }, finishedAt: "2026-10-27T07:30:00.000Z" });
    expect(view.runs[0].issues).toEqual([{ ref: "@products:products:9", collection: "products", code: "PW2_EDITED_CONFLICT", targetId: 4574 }]);
    expect(view.runs[1].counts.CREATE).toBe(1);
    expect(view.changes).toHaveLength(3);
    expect(view.changesTruncated).toBe(true);
  });

  it("ignores malformed issue entries", () => {
    // Arrange
    const summary = { issues: [null, { storeId: "332" }, { storeId: "332", ref: "r", code: "TARGET_MISSING" }] };
    // Act
    const issues = storeIssues(summary, "332");
    // Assert
    expect(issues).toEqual([{ ref: "r", collection: "", code: "TARGET_MISSING", targetId: null }]);
  });
});
