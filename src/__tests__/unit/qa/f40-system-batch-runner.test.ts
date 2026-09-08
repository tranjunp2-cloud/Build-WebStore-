import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  startSystemBatchRun,
  runSystemPreflightAudit,
  cancelSystemBatchRun,
  getSystemBatchRun,
  getActiveSystemBatchRun,
} from "@/lib/admin/qa/system-batch-runner";

describe("[US-F40-System-Run] System Preflight Audit Engine", () => {
  let mockPayload: Payload;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPayload = {
      create: vi.fn().mockResolvedValue({ id: 101 }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update: vi.fn().mockResolvedValue({}),
    } as unknown as Payload;
  });

  it("executes a full system contract & preflight audit across all 67 active targets", async () => {
    const report = await runSystemPreflightAudit(mockPayload, {
      scope: "all",
      profile: "smoke",
    });

    expect(report.auditId).toMatch(/^audit-/);
    expect(report.totalTargets).toBe(67);
    expect(report.verifiedTargets).toBeGreaterThan(0);
    expect(report.profile).toBe("smoke");
    expect(report.environment).toBe("staging");
  });

  it("filters targets by domain when scope is domain", async () => {
    const report = await runSystemPreflightAudit(mockPayload, {
      scope: "domain",
      domain: "Orders",
      profile: "regression",
    });

    expect(report.scope).toBe("domain");
    expect(report.domain).toBe("Orders");
    expect(report.totalTargets).toBeGreaterThan(0);
    expect(report.totalTargets).toBeLessThan(67);
  });

  it("handles cancel request gracefully", () => {
    const cancelled = cancelSystemBatchRun("test-id");
    expect(cancelled).toBe(true);
  });

  it("initializes master all-profiles full suite audit across all 351 test cases with audit_only status", async () => {
    const batch = await startSystemBatchRun(mockPayload, {
      scope: "all",
      profile: "all",
    });

    expect(batch.id).toMatch(/^audit-/);
    expect(batch.totalTargets).toBe(67);
    expect(batch.status).toBe("audit_only");
    expect(batch.profile).toBe("all");
    expect(batch.results.length).toBe(67);
    expect(batch.results[0].status).toBe("verified");
    expect(batch.results[0].durationMs).toBe(0);

    // Verifies persistence into memory store
    const retrieved = getSystemBatchRun(batch.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(batch.id);

    const active = getActiveSystemBatchRun();
    expect(active).toBeDefined();
    expect(active?.id).toBe(batch.id);
  });
});
