import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    current: { id: 1, roles: ["super-admin"] as string[] } as {
      id: number;
      roles: string[];
    } | null,
  },
  find: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mocks.user.current),
}));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ find: mocks.find })),
}));
vi.mock("@payload-config", () => ({ default: {} }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/qa/runs/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.current = { id: 1, roles: ["super-admin"] };
  mocks.find.mockResolvedValue({
    docs: [
      {
        id: 91,
        workflowRunId: "123",
        attempt: 1,
        targetId: "editor.product-grid",
        suite: "smoke",
        profile: "smoke",
        environment: "staging",
        status: "passed",
        pullRequest: 1742,
        commitSha: "abcdef1",
        startedAt: "2026-08-06T01:00:00.000Z",
        finishedAt: "2026-08-06T01:01:00.000Z",
        summary: { passed: 1 },
        artifactUrl: "must-not-leak",
        message: "must-not-leak",
      },
    ],
    totalDocs: 1,
    totalPages: 1,
  });
});

// ── TC-F40-02-05: Studio receives only the safe run summary ────────────────
describe("[TC-F40-02-05] GET /api/admin/qa/runs", () => {
  it("filters a super-admin summary list and omits result evidence", async () => {
    // Arrange
    const request = new NextRequest(
      "http://localhost/api/admin/qa/runs?targetId=editor.product-grid&status=passed&page=2",
    );

    // Act
    const response = await GET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 50,
        where: {
          targetId: { equals: "editor.product-grid" },
          status: { equals: "passed" },
        },
      }),
    );
    expect(body.data[0]).not.toHaveProperty("artifactUrl");
    expect(body.data[0]).not.toHaveProperty("message");
    expect(body.meta).toEqual({ total: 1, page: 2, limit: 50, pages: 1 });
  });

  it("rejects unauthenticated list access", async () => {
    // Arrange
    mocks.user.current = null;

    // Act
    const response = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs"),
    );

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user without the super-admin role", async () => {
    // Arrange
    mocks.user.current = { id: 2, roles: ["tenant-owner"] };

    // Act
    const response = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs"),
    );

    // Assert
    expect(response.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
