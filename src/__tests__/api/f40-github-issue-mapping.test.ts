import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    current: { id: 7, roles: ["super-admin"] as string[] } as {
      id: number;
      roles: string[];
    } | null,
  },
  findByID: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mocks.user.current),
}));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ findByID: mocks.findByID, update: mocks.update, create: mocks.create })),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/lib/payload/qa-ingest-transaction", () => ({
  withQaIngestTransaction: vi.fn(async (_payload: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: "tx-1" })),
}));

import { POST } from "@/app/api/admin/qa/github-issues/[id]/mapping/route";

function mappingRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/qa/github-issues/1744/mapping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("[TC-F40-05-03] GitHub issue mapping and dismissal API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: 7, roles: ["super-admin"] };
    mocks.findByID.mockResolvedValue({ id: 1744, mappingHistory: [] });
    mocks.update.mockResolvedValue({ id: 1744 });
  });

  it("rejects unauthenticated and malformed action requests before persistence", async () => {
    // Arrange
    mocks.user.current = null;

    // Act
    const unauthenticated = await POST(mappingRequest({ action: "dismiss", reason: "Not applicable" }), { params: { id: "1744" } });
    mocks.user.current = { id: 7, roles: ["super-admin"] };
    const missingAction = await POST(mappingRequest({ targetId: "editor-publish-lifecycle" }), { params: { id: "1744" } });
    const shortDismissal = await POST(mappingRequest({ action: "dismiss", reason: "no" }), { params: { id: "1744" } });

    // Assert
    expect(unauthenticated.status).toBe(401);
    expect(missingAction.status).toBe(422);
    expect(shortDismissal.status).toBe(422);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("confirms a valid target mapping with an append-only audit event", async () => {
    // Arrange
    const request = mappingRequest({ action: "confirm", targetId: "editor-publish-lifecycle" });

    // Act
    const response = await POST(request, { params: { id: "1744" } });

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        targetId: "editor-publish-lifecycle",
        mappingStatus: "confirmed",
        mappingConfirmedBy: 7,
      }),
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "qa_github_issue_mapping_events",
      data: expect.objectContaining({ action: "confirmed", targetId: "editor-publish-lifecycle", actor: 7, occurredAt: expect.any(String) }),
    }));
  });

  it("dismisses an issue with its reason and auditable actor without assigning a target", async () => {
    // Arrange
    mocks.findByID.mockResolvedValue({ id: 1744 });
    const request = mappingRequest({ action: "dismiss", reason: "Duplicate of issue #1700" });

    // Act
    const response = await POST(request, { params: { id: "1744" } });

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        targetId: null,
        mappingStatus: "dismissed",
        mappingDismissReason: "Duplicate of issue #1700",
        mappingConfirmedBy: 7,
      }),
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "qa_github_issue_mapping_events",
      data: expect.objectContaining({ action: "dismissed", reason: "Duplicate of issue #1700", actor: 7, occurredAt: expect.any(String) }),
    }));
  });
});
