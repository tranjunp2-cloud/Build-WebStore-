import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { current: { id: 7, roles: ["super-admin"] as string[] } as { id: number; roles: string[] } | null },
  findByID: vi.fn(), find: vi.fn(), update: vi.fn(), transaction: vi.fn(), github: vi.fn(), cancelWorkflow: vi.fn(),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ findByID: mocks.findByID, find: mocks.find, update: mocks.update })) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => mocks.user.current) }));
vi.mock("@/lib/payload/qa-targeted-dispatch-transaction", () => ({ withQaTargetedDispatchTransaction: mocks.transaction }));
vi.mock("@/lib/admin/qa/github-targeted-smoke", () => ({ githubAppConfigFromEnv: mocks.github, cancelTargetedSmokeWorkflow: mocks.cancelWorkflow }));

import { POST } from "@/app/api/admin/qa/manual-runs/[id]/cancel/route";

describe("[TC-F40-07-04] POST manual-run cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: 7, roles: ["super-admin"] };
    mocks.transaction.mockImplementation(async (_payload: unknown, _environment: string, _fixture: string, callback: (req: unknown) => Promise<void>) => callback({}));
    mocks.find.mockResolvedValue({ docs: [] });
    mocks.update.mockResolvedValue({});
  });

  it("releases a queued lease and records a terminal cancellation", async () => {
    // Arrange
    mocks.findByID.mockResolvedValueOnce({ fixtureKey: "editor", profile: "manual-smoke" }).mockResolvedValueOnce({ id: 42, status: "queued" });
    // Act
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs/42/cancel", { method: "POST", body: JSON.stringify({ reason: "tester stopped it" }) }), { params: { id: "42" } });
    // Assert
    expect(response.status).toBe(202);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }));
  });

  it("keeps an in-flight lease while cancellation awaits reconciliation", async () => {
    // Arrange
    mocks.findByID
      .mockResolvedValueOnce({ fixtureKey: "editor", profile: "manual-smoke" })
      .mockResolvedValueOnce({ id: 42, status: "dispatched", workflowRunId: "123456" });
    // Act
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs/42/cancel", { method: "POST", body: JSON.stringify({ reason: "tester stopped it" }) }), { params: { id: "42" } });
    // Assert
    expect(response.status).toBe(202);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "cancel_requested" }) }));
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("rejects a terminal run", async () => {
    // Arrange
    mocks.findByID.mockResolvedValueOnce({ fixtureKey: "editor", profile: "manual-smoke" }).mockResolvedValueOnce({ id: 42, status: "terminal" });
    // Act
    const response = await POST(new NextRequest("http://localhost/api/admin/qa/manual-runs/42/cancel", { method: "POST", body: JSON.stringify({ reason: "tester stopped it" }) }), { params: { id: "42" } });
    // Assert
    expect(response.status).toBe(409);
  });
});
