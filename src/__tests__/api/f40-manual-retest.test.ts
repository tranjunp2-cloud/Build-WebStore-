import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  find: vi.fn(), update: vi.fn(), claim: vi.fn(), block: vi.fn(), dispatch: vi.fn(), github: vi.fn(), packs: vi.fn(),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ find: mocks.find, update: mocks.update })) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: 1, roles: ["super-admin"] })) }));
vi.mock("@/lib/admin/qa/targeted-smoke-registry", () => ({ resolveTargetedSmokePacks: mocks.packs }));
vi.mock("@/lib/admin/qa/targeted-smoke-dispatch", () => ({ claimTargetedSmokeDispatch: mocks.claim, blockTargetedSmokeDispatch: mocks.block }));
vi.mock("@/lib/admin/qa/github-targeted-smoke", () => ({ githubAppConfigFromEnv: mocks.github, dispatchTargetedSmokeWorkflow: mocks.dispatch, GitHubWorkflowDispatchRejectedError: class extends Error {} }));

import { POST } from "@/app/api/admin/qa/targets/[targetId]/retest/route";

describe("[TC-F40-04-04] manual targeted Retest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VERCEL_GIT_COMMIT_SHA = "abcdef1";
    mocks.github.mockReturnValue({});
    mocks.packs.mockReturnValue([{ targetId: "editor-productgrid-variants", packId: "editor-product-grid-variants-smoke", packVersion: 1, fixtureKey: "fixture", fixtureCapacity: 1 }]);
    mocks.find.mockResolvedValue({ docs: [{ pullRequest: 1743 }] });
    mocks.claim.mockResolvedValue({ dispatch: { id: 42, workflowNonce: "x".repeat(32) }, blocked: false });
    mocks.update.mockResolvedValue({});
  });

  it("creates one server-owned allow-listed dispatch for the current staging PR/SHA", async () => {
    // Arrange
    const request = new NextRequest("http://localhost/api/admin/qa/targets/editor-productgrid-variants/retest", { method: "POST" });
    // Act
    const response = await POST(request, { params: { targetId: "editor-productgrid-variants" } });
    // Assert
    expect(response.status).toBe(202);
    expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ commitSha: "abcdef1", pullRequest: 1743, retestNonce: expect.any(String) }));
    expect(mocks.dispatch).toHaveBeenCalled();
  });

  it("rejects a target without an approved pack", async () => {
    // Arrange
    mocks.packs.mockReturnValue([]);
    const request = new NextRequest("http://localhost/api/admin/qa/targets/editor-productgrid-variants/retest", { method: "POST" });
    // Act
    const response = await POST(request, { params: { targetId: "editor-productgrid-variants" } });
    // Assert
    expect(response.status).toBe(409);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("releases the queued lease when local state cannot be marked dispatched", async () => {
    // Arrange
    mocks.update.mockRejectedValueOnce(new Error("database unavailable"));
    const request = new NextRequest("http://localhost/api/admin/qa/targets/editor-productgrid-variants/retest", { method: "POST" });

    // Act
    const response = await POST(request, { params: { targetId: "editor-productgrid-variants" } });

    // Assert
    expect(response.status).toBe(503);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.block).toHaveBeenCalledWith(
      expect.anything(),
      { id: 42, fixtureKey: "fixture" },
      "GITHUB_DISPATCH_FAILED",
      expect.any(String),
    );
  });
});
