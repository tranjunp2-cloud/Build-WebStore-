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
import { GET } from "@/app/api/admin/qa/change-snapshots/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.current = { id: 1, roles: ["super-admin"] };
  mocks.find.mockResolvedValue({
    docs: [
      {
        id: 5,
        pullRequest: 1742,
        commitSha: "abcdef1",
        environment: "staging",
        changedPaths: ["src/a.ts"],
        mappedTargetIds: ["editor.product-grid"],
        unmappedPaths: ["src/b.ts"],
        coverageMapVersion: "v1",
        createdAt: "2026-08-06T01:00:00.000Z",
      },
    ],
  });
});

// ── TC-F40-02-06: QA can see deploy coverage gaps ─────────────────────────
describe("[TC-F40-02-06] GET /api/admin/qa/change-snapshots", () => {
  it("returns mapped targets and unmapped paths for a filtered PR", async () => {
    // Arrange
    const request = new NextRequest(
      "http://localhost/api/admin/qa/change-snapshots?pullRequest=1742",
    );

    // Act
    const response = await GET(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pullRequest: { equals: 1742 } } }),
    );
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        unmappedPaths: ["src/b.ts"],
        mappedTargetIds: ["editor.product-grid"],
      }),
    );
  });

  it("rejects unauthenticated and non-super-admin access", async () => {
    // Arrange / Act
    mocks.user.current = null;
    const unauthenticated = await GET(
      new NextRequest("http://localhost/api/admin/qa/change-snapshots"),
    );
    mocks.user.current = { id: 2, roles: ["tenant-owner"] };
    const forbidden = await GET(
      new NextRequest("http://localhost/api/admin/qa/change-snapshots"),
    );

    // Assert
    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
