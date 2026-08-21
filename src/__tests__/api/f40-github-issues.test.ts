import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { current: { id: 77, roles: ["super-admin"] as string[] } as { id: number; roles: string[] } | null },
  fetchGithubIssueMirrorPage: vi.fn(),
  synchronizeGithubIssueMirrors: vi.fn(),
  findByID: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mocks.user.current),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: mocks.findByID,
    update: mocks.update,
    create: mocks.create,
    find: mocks.find,
  })),
}));
vi.mock("@/lib/admin/qa/github-issues", () => ({
  fetchGithubIssueMirrorPage: mocks.fetchGithubIssueMirrorPage,
  synchronizeGithubIssueMirrors: mocks.synchronizeGithubIssueMirrors,
}));
vi.mock("@/lib/payload/qa-ingest-transaction", () => ({
  withQaIngestTransaction: vi.fn(async (_payload: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: "tx-1" })),
}));
vi.mock("@/lib/payload/qa-github-sync-transaction", () => ({
  withQaGithubSyncLock: vi.fn(async (_payload: unknown, operation: (req: { transactionID: string }) => Promise<unknown>) => operation({ transactionID: "sync-tx-1" })),
}));

import { POST as sync } from "@/app/api/admin/qa/github-issues/sync/route";
import { POST as confirmMapping } from "@/app/api/admin/qa/github-issues/[id]/mapping/route";

const issue = {
  issueNumber: 1744,
  url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1744",
  title: "P1 regression",
  state: "open" as const,
  labels: ["P1"],
  severity: "P1" as const,
  githubUpdatedAt: "2026-08-11T01:00:00.000Z",
};

function request(url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("[TC-F40-05-03] GitHub issue sync API authorization and safe failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: 77, roles: ["super-admin"] };
    mocks.fetchGithubIssueMirrorPage.mockResolvedValue({ issues: [issue], hasNext: false });
    mocks.synchronizeGithubIssueMirrors.mockResolvedValue(undefined);
    mocks.find.mockResolvedValue({ docs: [] });
  });

  it("rejects unauthenticated and non-super-admin sync attempts before calling GitHub", async () => {
    // Arrange
    mocks.user.current = null;

    // Act
    const anonymous = await sync(request("/api/admin/qa/github-issues/sync"));
    mocks.user.current = { id: 78, roles: ["tenant-owner"] };
    const forbidden = await sync(request("/api/admin/qa/github-issues/sync"));

    // Assert
    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(mocks.fetchGithubIssueMirrorPage).not.toHaveBeenCalled();
  });

  it("synchronizes bounded issue metadata and returns a safe service-unavailable error", async () => {
    // Arrange

    // Act
    const success = await sync(request("/api/admin/qa/github-issues/sync"));
    mocks.fetchGithubIssueMirrorPage.mockRejectedValueOnce(new Error("GitHub token failure"));
    const unavailable = await sync(request("/api/admin/qa/github-issues/sync"));

    // Assert
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual({ data: { synchronized: 1, page: 1, complete: true } });
    expect(mocks.synchronizeGithubIssueMirrors).toHaveBeenCalledWith(expect.anything(), [issue]);
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: "GitHub issue synchronization is unavailable" });
  });
});

describe("[TC-F40-05-04] GitHub issue mapping API validation and audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: 77, roles: ["super-admin"] };
    mocks.findByID.mockResolvedValue({ id: 44 });
    mocks.update.mockResolvedValue({ id: 44, targetId: "editor-publish-lifecycle", mappingStatus: "confirmed" });
  });

  it("rejects an invalid id, malformed JSON, and an unknown target without persistence", async () => {
    // Arrange

    // Act
    const invalidId = await confirmMapping(request("/api/admin/qa/github-issues/not-an-id/mapping", { action: "confirm", targetId: "editor-publish-lifecycle" }), { params: Promise.resolve({ id: "not-an-id" }) });
    const malformed = await confirmMapping(request("/api/admin/qa/github-issues/44/mapping", "not-json"), { params: Promise.resolve({ id: "44" }) });
    const unknownTarget = await confirmMapping(request("/api/admin/qa/github-issues/44/mapping", { action: "confirm", targetId: "made-up-target" }), { params: Promise.resolve({ id: "44" }) });

    // Assert
    expect(invalidId.status).toBe(422);
    expect(malformed.status).toBe(422);
    expect(unknownTarget.status).toBe(422);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("records the actor, timestamp, and prior mapping history when Ary confirms a target", async () => {
    // Arrange

    // Act
    const response = await confirmMapping(
      request("/api/admin/qa/github-issues/44/mapping", { action: "confirm", targetId: "editor-publish-lifecycle" }),
      { params: Promise.resolve({ id: "44" }) },
    );

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "qa_github_issues",
      id: "44",
      data: expect.objectContaining({
        targetId: "editor-publish-lifecycle",
        mappingStatus: "confirmed",
        mappingConfirmedBy: 77,
        mappingConfirmedAt: expect.any(String),
      }),
    }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "qa_github_issue_mapping_events",
      data: expect.objectContaining({ githubIssue: 44, action: "confirmed", targetId: "editor-publish-lifecycle", actor: 77 }),
    }));
  });

  it("returns not found without exposing a persistence error for a missing issue", async () => {
    // Arrange
    mocks.findByID.mockRejectedValueOnce(new Error("Not found"));

    // Act
    const response = await confirmMapping(
      request("/api/admin/qa/github-issues/44/mapping", { action: "confirm", targetId: "editor-publish-lifecycle" }),
      { params: Promise.resolve({ id: "44" }) },
    );

    // Assert
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "GitHub issue was not found" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
