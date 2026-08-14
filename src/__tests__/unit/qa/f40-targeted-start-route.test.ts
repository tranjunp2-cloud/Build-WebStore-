import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findByID: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ findByID: mocks.findByID, find: mocks.find, update: mocks.update })),
}));
vi.mock("@/lib/payload/qa-targeted-dispatch-transaction", () => ({
  withQaTargetedDispatchTransaction: mocks.transaction,
}));
vi.mock("@/lib/admin/qa/contracts", () => ({ verifyQaIngestSignature: vi.fn(() => true) }));
import { POST } from "@/app/api/admin/qa/targeted-start/route";

const originalSecret = process.env.QA_INGEST_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.QA_INGEST_SECRET;
  else process.env.QA_INGEST_SECRET = originalSecret;
});

describe("[TC-F40-03-02] Targeted Smoke workflow claim boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (_payload: unknown, _environment: string, _fixture: string, operation: (req: unknown) => Promise<void>) => operation({}));
    mocks.update.mockResolvedValue({});
  });
  it("rejects an oversized chunked body before signature or database work", async () => {
    // Arrange
    process.env.QA_INGEST_SECRET = "test-secret";
    const request = new NextRequest("http://localhost/api/admin/qa/targeted-start", {
      method: "POST",
      body: "x".repeat(10_001),
      headers: { "content-type": "application/json" },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Payload too large" });
  });

  it("completes a cancellation before the workflow can provision or run the fixture", async () => {
    // Arrange
    process.env.QA_INGEST_SECRET = "test-secret";
    mocks.findByID
      .mockResolvedValueOnce({ id: 42, fixtureKey: "QA-Tshirt-SML" })
      .mockResolvedValueOnce({ id: 42, status: "cancel_requested", workflowNonce: "a".repeat(32) });
    mocks.find.mockResolvedValue({ docs: [{ id: 9 }] });
    const request = new NextRequest("http://localhost/api/admin/qa/targeted-start", {
      method: "POST",
      body: JSON.stringify({ dispatchId: 42, workflowNonce: "a".repeat(32), workflowRunId: "123-1", attempt: 1 }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ claimed: false, cancelled: true });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "qa_smoke_dispatches", data: expect.objectContaining({ status: "cancelled" }) }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ collection: "qa_fixture_leases", data: expect.objectContaining({ status: "released" }) }));
  });
});
