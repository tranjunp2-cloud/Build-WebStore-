import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { current: { id: 7, roles: ["super-admin"] as string[] } as { id: number; roles: string[] } | null },
  preflight: vi.fn(),
  resolvePack: vi.fn(),
  github: vi.fn(),
  claim: vi.fn(),
  dispatch: vi.fn(),
  block: vi.fn(),
  payload: { find: vi.fn(), findByID: vi.fn(), update: vi.fn() },
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => mocks.payload) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => mocks.user.current) }));
vi.mock("@/lib/admin/qa/manual-runs", () => ({
  getManualRunPreflight: mocks.preflight,
  parseManualRunContext: (value: { pullRequest?: number; commitSha?: string }) => value.pullRequest ? value as { pullRequest: number; commitSha: string } : undefined,
  validateManualIdempotencyKey: (value: string) => value,
  manualRunRequestDigest: () => "digest",
}));
vi.mock("@/lib/admin/qa/targeted-smoke-registry", () => ({ resolveManualQaPack: mocks.resolvePack }));
vi.mock("@/lib/admin/qa/targeted-smoke-dispatch", () => ({
  claimTargetedSmokeDispatch: mocks.claim,
  blockTargetedSmokeDispatch: mocks.block,
  TargetedSmokeDispatchConflictError: class extends Error {},
}));
vi.mock("@/lib/admin/qa/github-targeted-smoke", () => ({
  githubAppConfigFromEnv: mocks.github,
  dispatchTargetedSmokeWorkflow: mocks.dispatch,
  GitHubWorkflowDispatchRejectedError: class extends Error {},
}));
vi.mock("@/lib/payload/qa-targeted-dispatch-transaction", () => ({
  withQaTargetedDispatchTransaction: async (_payload: unknown, _environment: string, _fixture: string, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: "test-transaction" }),
}));

import { POST } from "@/app/api/admin/qa/manual-runs/route";

describe("[TC-F40-07-02] POST /api/admin/qa/manual-runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: 7, roles: ["super-admin"] };
    mocks.preflight.mockResolvedValue({ canDispatch: true, context: { pullRequest: 1746, commitSha: "abcdef1" }, pack: { id: "editor-pack", version: 1 } });
    mocks.resolvePack.mockReturnValue({ pack: { packId: "editor-pack", packVersion: 1, fixtureKey: "editor", fixtureCapacity: 1 } });
    mocks.github.mockReturnValue({});
    mocks.claim.mockResolvedValue({ created: true, blocked: false, dispatch: { id: 42, workflowNonce: "x".repeat(32) } });
    mocks.payload.update.mockResolvedValue({});
    mocks.payload.findByID.mockResolvedValue({ status: "queued" });
    mocks.payload.find.mockResolvedValue({ docs: [] });
  });

  it("dispatches exactly the preflighted allow-listed pack", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs", { method: "POST", body: JSON.stringify({ targetId: "editor-productgrid-variants", profile: "smoke", idempotencyKey: "a".repeat(16) }) }));
    expect(response.status).toBe(202);
    expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ profile: "manual-smoke", pullRequest: 1746, commitSha: "abcdef1" }));
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ packId: "editor-pack", runProfile: "manual-smoke" }));
  });

  it("does not create a run when server preflight is blocked", async () => {
    mocks.preflight.mockResolvedValue({ canDispatch: false, reasons: [{ code: "PROFILE_CAPACITY_EXHAUSTED" }] });
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs", { method: "POST", body: JSON.stringify({ targetId: "editor-productgrid-variants", profile: "smoke", idempotencyKey: "a".repeat(16) }) }));
    expect(response.status).toBe(409);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("does not resurrect a queued run cancelled before the protected transition", async () => {
    mocks.payload.findByID.mockResolvedValue({ status: "cancelled" });
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs", { method: "POST", body: JSON.stringify({ targetId: "editor-productgrid-variants", profile: "smoke", idempotencyKey: "a".repeat(16) }) }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ data: { status: "cancelled" } });
    expect(mocks.payload.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { status: "dispatched" } }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("returns a conflict when a confirmation key belongs to different request data", async () => {
    // Arrange
    mocks.payload.find.mockResolvedValue({ docs: [{ id: 42, requestDigest: "other", status: "dispatched" }] });
    // Act
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs", { method: "POST", body: JSON.stringify({ targetId: "editor-productgrid-variants", profile: "smoke", idempotencyKey: "a".repeat(16) }) }));
    // Assert
    expect(response.status).toBe(409);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated dispatch", async () => {
    mocks.user.current = null;
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs", { method: "POST", body: JSON.stringify({ targetId: "editor-productgrid-variants", profile: "smoke", idempotencyKey: "a".repeat(16) }) }));
    expect(response.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
