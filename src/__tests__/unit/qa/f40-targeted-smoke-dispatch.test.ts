import { describe, expect, it, vi } from "vitest";
import {
  claimTargetedSmokeDispatch,
  recordTargetedSmokeCoverageGap,
  targetedSmokeDispatchKey,
} from "@/lib/admin/qa/targeted-smoke-dispatch";
import { TARGETED_SMOKE_PACKS } from "@/lib/admin/qa/targeted-smoke-registry";
import { deriveQaRunStatusForSuite } from "@/lib/admin/qa/contracts";

const request = {
  pullRequest: 1742,
  commitSha: "abcdef1234567",
  environment: "staging" as const,
  profile: "targeted-smoke" as const,
  requestDigest: "request-digest",
  pack: TARGETED_SMOKE_PACKS[0],
};

function payloadFor(
  findResults: Array<{ docs: unknown[] }>,
  created: Array<Record<string, unknown>> = [],
) {
  const find = vi.fn(async () => findResults.shift() ?? { docs: [] });
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const record = { id: created.length + 1, ...data };
    created.push(record);
    return record;
  });
  const update = vi.fn(async () => ({}));
  return {
    find,
    create,
    update,
    db: {
      drizzle: { transaction: async (operation: (tx: { execute: () => Promise<void> }) => Promise<unknown>) => operation({ execute: async () => undefined }) },
      sessions: {},
    },
  };
}

describe("[TC-F40-03-02] Targeted Smoke fixture capacity", () => {
  it("does not produce a passed run when one declared critical case is skipped", () => {
    // Arrange
    const results = [
      { testCaseId: "TC-F09.32", status: "passed" as const },
      { testCaseId: "TC-F09.30", status: "skipped" as const, assertionCode: "TARGETED_SMOKE_SKIPPED" },
    ];

    // Act
    const status = deriveQaRunStatusForSuite("targeted-smoke", results);

    // Assert
    expect(status).toBe("blocked");
  });

  it("creates a queued dispatch and active lease when capacity is available", async () => {
    // Arrange
    const created: Array<Record<string, unknown>> = [];
    const payload = payloadFor([{ docs: [] }, { docs: [] }], created);

    // Act
    const outcome = await claimTargetedSmokeDispatch(
      payload as never,
      request,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    // Assert
    expect(outcome).toMatchObject({ created: true, blocked: false });
    expect(created).toEqual([
      expect.objectContaining({ status: "queued", dispatchKey: targetedSmokeDispatchKey(request) }),
      expect.objectContaining({ status: "active", capacitySlot: 1 }),
    ]);
  });

  it("TC-F40-03-02: records blocked before browser work when capacity is exhausted", async () => {
    // Arrange
    const created: Array<Record<string, unknown>> = [];
    const payload = payloadFor([
      { docs: [] },
      { docs: [{ id: 99, expiresAt: "2026-08-10T01:00:00.000Z" }] },
    ], created);

    // Act
    const outcome = await claimTargetedSmokeDispatch(
      payload as never,
      request,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    // Assert
    expect(outcome).toMatchObject({ created: true, blocked: true });
    expect(created).toEqual([
      expect.objectContaining({
        status: "blocked",
        blockCode: "FIXTURE_CAPACITY_EXHAUSTED",
      }),
    ]);
  });

  it("TC-F40-03-02: returns the same durable decision for a retry", async () => {
    // Arrange
    const existing = { id: 7, requestDigest: request.requestDigest, status: "queued" };
    const payload = payloadFor([{ docs: [existing] }]);

    // Act
    const outcome = await claimTargetedSmokeDispatch(payload as never, request);

    // Assert
    expect(outcome).toEqual({ dispatch: existing, created: false, blocked: false });
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("persists server-owned provenance for an unmapped coverage gap", async () => {
    // Arrange
    const created: Array<Record<string, unknown>> = [];
    const payload = payloadFor([{ docs: [] }], created);

    // Act
    await recordTargetedSmokeCoverageGap(payload as never, {
      pullRequest: 1742,
      commitSha: "abcdef1234567",
      environment: "staging",
      profile: "targeted-smoke",
      requestDigest: "coverage-gap-digest",
      targetId: "unmapped-target",
    });

    // Assert
    expect(created[0]).toMatchObject({
      status: "blocked",
      profile: "targeted-smoke",
      blockCode: "NO_ACTIVE_SMOKE_PACK",
    });
  });
});
