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
      "http://localhost/api/admin/qa/runs?targetId=editor.product-grid&suite=smoke&status=passed&page=2",
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
          suite: { equals: "smoke" },
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

  it("limits an explicit history window to a safe maximum of 30 days", async () => {
    // Arrange
    const request = new NextRequest(
      "http://localhost/api/admin/qa/runs?days=7",
    );

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          finishedAt: {
            greater_than_equal: expect.any(String),
          },
        },
      }),
    );
  });

  it("uses a stable keyset cursor from the first 50 matching runs", async () => {
    // Arrange
    mocks.find.mockResolvedValueOnce({
      docs: Array.from({ length: 51 }, (_, index) => ({
        id: 100 - index,
        finishedAt: `2026-08-06T01:${String(59 - index).padStart(2, "0")}:00.000Z`,
      })),
      totalDocs: 150,
      totalPages: 3,
    });

    // Act
    const response = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs?suite=smoke"),
    );
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 51,
        sort: "-finishedAt,-id",
        where: { suite: { equals: "smoke" } },
      }),
    );
    expect(body.data).toHaveLength(50);
    expect(body.meta.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);

    mocks.find.mockResolvedValueOnce({ docs: [], totalDocs: 0, totalPages: 0 });
    const secondResponse = await GET(
      new NextRequest(
        `http://localhost/api/admin/qa/runs?cursor=${body.meta.nextCursor}&suite=smoke`,
      ),
    );
    expect(secondResponse.status).toBe(200);
    expect(mocks.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 51,
        sort: "-finishedAt,-id",
        where: expect.objectContaining({ and: expect.any(Array) }),
      }),
    );
  });

  it("rejects invalid status and unbounded page offsets", async () => {
    // Arrange / Act
    const invalidStatus = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs?status=all"),
    );
    const hugePage = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs?page=2147483647"),
    );
    const malformedDays = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs?days=7junk"),
    );
    const invalidSuite = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs?suite=smoke%20pack"),
    );
    const invalidCursor = await GET(
      new NextRequest("http://localhost/api/admin/qa/runs?cursor=not-a-cursor"),
    );

    // Assert
    expect(invalidStatus.status).toBe(422);
    expect(hugePage.status).toBe(422);
    expect(malformedDays.status).toBe(422);
    expect(invalidSuite.status).toBe(422);
    expect(invalidCursor.status).toBe(422);
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
