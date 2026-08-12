import { describe, expect, it } from "vitest";
import {
  CMS_TARGET_REGISTRY,
  getAllActiveTargets,
  getTargetById,
  getTargetsByDomain,
} from "@/lib/admin/qa/target-registry";
import {
  calculateProjectHealthSummary,
  calculateTargetHealth,
} from "@/lib/admin/qa/health-calculator";

describe("[US-F40-01] CMS Target Catalog & Project Health", () => {
  // ── AC-1: Full CMS Inventory ─────────────────────────────────────────────
  it("includes all 67 active CMS product targets and excludes internal Studio admin features", () => {
    // Arrange & Act
    const activeTargets = getAllActiveTargets();

    // Assert
    expect(activeTargets.length).toBe(67);
    for (const target of activeTargets) {
      expect(target.domain).not.toContain("Studio Admin");
      expect(target.domain).not.toContain("Admin Internal");
      expect(target.id).toBeTruthy();
      expect(target.name).toBeTruthy();
    }
  });

  it("retrieves targets by ID and domain correctly", () => {
    // Arrange & Act
    const editorTarget = getTargetById("editor-publish-lifecycle");
    const editorDomainTargets = getTargetsByDomain("Editor");

    // Assert
    expect(editorTarget).toBeDefined();
    expect(editorTarget?.name).toBe("Page Publish & Rollback");
    expect(editorDomainTargets.length).toBeGreaterThan(0);
    expect(
      editorDomainTargets.every((t) => t.domain === "Editor"),
    ).toBe(true);
  });

  // ── AC-2: No False Green State ───────────────────────────────────────────
  it("calculates health as Unknown when a target has no valid pack or result", () => {
    // Arrange
    const target = getTargetById("ai-translate-workflow")!;

    // Act
    const result = calculateTargetHealth(target, { runs: [] });

    // Assert
    expect(result.state).toBe("Unknown");
    expect(result.state).not.toBe("Healthy");
    expect(result.reasonCode).toBe("UNMAPPED_TARGET_GAP");
  });

  it("returns Unknown for targets with no recorded run history", () => {
    // Arrange
    const target = getTargetById("products-list-search-filter")!;

    // Act
    const result = calculateTargetHealth(target, { runs: [] });

    // Assert
    expect(result.state).toBe("Unknown");
    expect(result.reasonCode).toBe("NO_EVIDENCE_RECORDED");
  });

  it("returns Unknown when a passing run has an invalid completion timestamp", () => {
    // Arrange
    const target = getTargetById("identity-login-otp")!;

    // Act
    const result = calculateTargetHealth(target, {
      runs: [
        {
          id: "run-incomplete",
          targetId: target.id,
          status: "passed",
          finishedAt: "not-a-timestamp",
        },
      ],
    });

    // Assert
    expect(result.state).toBe("Unknown");
    expect(result.state).not.toBe("Healthy");
    expect(result.reasonCode).toBe("NO_EVIDENCE_RECORDED");
  });

  // ── AC-3: Explainable State Precedence Rules ──────────────────────────────
  it("evaluates precedence rule 2: Needs attention for targets with failed test runs", () => {
    // Arrange
    const target = getTargetById("editor-productgrid-variants")!;

    // Act
    const result = calculateTargetHealth(target, {
      runs: [
        {
          id: "run-fail",
          targetId: target.id,
          status: "failed",
          finishedAt: "2026-08-06T12:00:00.000Z",
        },
      ],
    });

    // Assert
    expect(result.state).toBe("Needs attention");
    expect(result.reasonCode).toBe("LATEST_RUN_FAILED");
    expect(result.links[0].type).toBe("run");
    expect(result.links[0].runId).toBe("run-fail");
    expect(result.links[0].url).toBe(
      "/admin/collections/qa_test_runs/run-fail",
    );
  });

  it("evaluates precedence rule 3: Watch for change-impacted or stale targets", () => {
    // Arrange
    const target = getTargetById("storefront-discount-checkout")!;

    // Act 1: Change impact
    const resultImpact = calculateTargetHealth(target, {
      changeImpacts: [
        {
          id: "snapshot-1742",
          targetId: target.id,
          pullRequest: 1742,
          commitSha: "abc1234",
          createdAt: "2026-08-06T12:00:00.000Z",
        },
      ],
    });

    // Assert 1
    expect(resultImpact.state).toBe("Watch");
    expect(resultImpact.reasonCode).toBe("CHANGE_IMPACT_UNTESTED");
    expect(resultImpact.links[0].url).toBe(
      "/admin/collections/qa_change_snapshots/snapshot-1742",
    );

    // Act 2: Stale evidence (>7 days old)
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const resultStale = calculateTargetHealth(target, {
      runs: [
        {
          id: "run-old",
          targetId: target.id,
          status: "passed",
          finishedAt: oldDate,
        },
      ],
    });

    // Assert 2
    expect(resultStale.state).toBe("Watch");
    expect(resultStale.reasonCode).toBe("EVIDENCE_STALE");
  });

  it("clears a change impact after a newer passing run", () => {
    // Arrange
    const target = getTargetById("storefront-discount-checkout")!;
    const impactCreatedAt = "2026-08-06T12:00:00.000Z";
    const runFinishedAt = "2026-08-07T12:00:00.000Z";

    // Act
    const result = calculateTargetHealth(target, {
      now: Date.parse("2026-08-08T12:00:00.000Z"),
      changeImpacts: [
        {
          id: "snapshot-1742",
          targetId: target.id,
          pullRequest: 1742,
          commitSha: "abc1234",
          createdAt: impactCreatedAt,
        },
      ],
      runs: [
        {
          id: "run-after-impact",
          targetId: target.id,
          status: "passed",
          finishedAt: runFinishedAt,
        },
      ],
    });

    // Assert
    expect(result.state).toBe("Healthy");
    expect(result.reasonCode).toBe("SMOKE_PASSED");
  });

  it("evaluates precedence rule 5: Healthy for fresh passing test runs", () => {
    // Arrange
    const target = getTargetById("identity-login-otp")!;
    const recentDate = new Date(Date.now() - 1 * 3600 * 1000).toISOString();

    // Act
    const result = calculateTargetHealth(target, {
      runs: [
        {
          id: "run-pass",
          targetId: target.id,
          status: "passed",
          finishedAt: recentDate,
        },
      ],
    });

    // Assert
    expect(result.state).toBe("Healthy");
    expect(result.reasonCode).toBe("SMOKE_PASSED");
    expect(result.links[0].type).toBe("run");
  });

  it("computes Project Health Summary metrics across all domains cleanly", () => {
    // Arrange
    const activeTargets = getAllActiveTargets();
    const results = activeTargets.map((target) =>
      calculateTargetHealth(target, {}),
    );

    // Act
    const summary = calculateProjectHealthSummary(results);

    // Assert
    expect(summary.totalTargets).toBe(67);
    expect(summary.counts.Unknown).toBe(67);
    expect(summary.counts.Healthy).toBe(0);
    expect(summary.domainStats.length).toBeGreaterThan(5);
  });
});

describe("[TC-F40-05-05] Confirmed GitHub issue health precedence", () => {
  it("marks a target Critical for a confirmed open P1 issue ahead of a failed run", () => {
    // Arrange
    const target = getTargetById("editor-publish-lifecycle")!;

    // Act
    const result = calculateTargetHealth(target, {
      runs: [{ id: "failed-run", targetId: target.id, status: "failed", finishedAt: "2026-08-11T01:00:00.000Z" }],
      githubIssues: [{ id: "issue-1744", issueNumber: 1744, url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1744", title: "P1 regression", targetId: target.id, state: "open", severity: "P1", mappingStatus: "confirmed" }],
    });

    // Assert
    expect(result).toMatchObject({ state: "Critical", reasonCode: "CONFIRMED_GITHUB_P1_ISSUE" });
    expect(result.links[0]).toMatchObject({ type: "issue", issueNumber: 1744, url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1744" });
  });

  it("keeps unknown, closed, or remapped P1 issues from affecting their former target", () => {
    // Arrange
    const target = getTargetById("editor-publish-lifecycle")!;
    const issue = { id: "issue-1744", issueNumber: 1744, url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1744", title: "P1 regression", severity: "P1" as const };

    // Act
    const unknown = calculateTargetHealth(target, { githubIssues: [{ ...issue, targetId: target.id, state: "open", mappingStatus: "unknown" }] });
    const closed = calculateTargetHealth(target, { githubIssues: [{ ...issue, targetId: target.id, state: "closed", mappingStatus: "confirmed" }] });
    const remapped = calculateTargetHealth(target, { githubIssues: [{ ...issue, targetId: "identity-login-otp", state: "open", mappingStatus: "confirmed" }] });

    // Assert
    expect(unknown.state).toBe("Unknown");
    expect(closed.state).toBe("Unknown");
    expect(remapped.state).toBe("Unknown");
  });
});
