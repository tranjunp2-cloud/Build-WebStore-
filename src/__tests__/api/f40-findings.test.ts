import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: {
    current: { id: 77, roles: ["super-admin"] as string[] } as {
      id: number;
      roles: string[];
    } | null,
  },
  find: vi.fn(),
  findByID: vi.fn(),
  update: vi.fn(),
  createGithubFindingIssue: vi.fn(),
  findGithubFindingIssue: vi.fn(),
  synchronizeGithubIssueMirror: vi.fn(),
  withQaFindingRowLock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => mocks.user.current),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    find: mocks.find,
    findByID: mocks.findByID,
    update: mocks.update,
  })),
}));
vi.mock("@/lib/admin/qa/github-issues", () => ({
  createGithubFindingIssue: mocks.createGithubFindingIssue,
  findGithubFindingIssue: mocks.findGithubFindingIssue,
  synchronizeGithubIssueMirror: mocks.synchronizeGithubIssueMirror,
}));
vi.mock("@/lib/payload/qa-finding-row-lock", () => ({
  withQaFindingRowLock: mocks.withQaFindingRowLock,
}));

import { GET as listFindings } from "@/app/api/admin/qa/findings/route";
import { POST as promoteFinding } from "@/app/api/admin/qa/findings/[id]/promote/route";
import { POST as dismissFinding } from "@/app/api/admin/qa/findings/[id]/dismiss/route";

const fingerprint =
  "qaf_v1_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const finding = {
  id: 42,
  fingerprint,
  targetId: "editor-productgrid-variants",
  suite: "editor-product-grid-variants-smoke",
  testCaseId: "TC-F40-04-02",
  assertionCode: "VARIANT_COUNT_MISMATCH",
  severity: "P1",
  lifecycle: "needs_review",
  lifecycleAudit: [],
};

function request(url: string, method = "POST") {
  return new NextRequest(`http://localhost${url}`, { method });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("[TC-F40-06-03] Finding reads and promotions are super-admin protected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QA_ARTIFACT_ALLOWED_HOSTS = "safe.example";
    mocks.user.current = { id: 77, roles: ["super-admin"] };
    mocks.find.mockResolvedValue({ docs: [] });
    mocks.withQaFindingRowLock.mockImplementation(
      async (
        _payload: unknown,
        _id: unknown,
        operation: (request: object) => unknown,
      ) => operation({ transactionID: "test" }),
    );
    mocks.update.mockImplementation(async ({ data }: { data: object }) => ({
      ...finding,
      ...data,
    }));
  });

  it("rejects anonymous and non-super-admin reads before accessing findings", async () => {
    // Arrange
    mocks.user.current = null;

    // Act
    const anonymous = await listFindings(
      request("/api/admin/qa/findings", "GET"),
    );
    mocks.user.current = { id: 78, roles: ["tenant-owner"] };
    const forbidden = await listFindings(
      request("/api/admin/qa/findings", "GET"),
    );

    // Assert
    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("returns a bounded review projection without Payload relationship objects", async () => {
    // Arrange
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    mocks.find.mockResolvedValue({
      docs: [
        {
          ...finding,
          latestRun: { id: 9, pullRequest: 12, commitSha: "abc" },
          latestResult: {
            artifactUrl: `https://safe.example/sanitized/evidence?expiresAt=${encodeURIComponent(expiresAt)}`,
            artifactExpiresAt: expiresAt,
          },
        },
      ],
    });

    // Act
    const response = await listFindings(
      request("/api/admin/qa/findings", "GET"),
    );

    // Assert
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        items: [
          expect.objectContaining({
            id: "42",
            run: expect.objectContaining({ id: "9" }),
            evidence: {
              kind: "report",
              availability: "available",
              url: `https://safe.example/sanitized/evidence?expiresAt=${encodeURIComponent(expiresAt)}`,
              expiresAt,
            },
          }),
        ],
      },
    });
  });

  it("rejects an invalid promotion id before reading the finding or contacting GitHub", async () => {
    // Arrange

    // Act
    const response = await promoteFinding(
      request("/api/admin/qa/findings/nope/promote"),
      context("nope"),
    );

    // Assert
    expect(response.status).toBe(422);
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.createGithubFindingIssue).not.toHaveBeenCalled();
  });

  it("dismisses an internal finding without contacting GitHub", async () => {
    // Arrange
    mocks.findByID.mockResolvedValue({ ...finding });

    // Act
    const response = await dismissFinding(
      request("/api/admin/qa/findings/42/dismiss"),
      context("42"),
    );

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.createGithubFindingIssue).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lifecycle: "cancelled" }),
      }),
    );
  });
});

describe("[TC-F40-06-04] Confirmed finding promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: 77, roles: ["super-admin"] };
    mocks.findByID.mockResolvedValue({ ...finding });
    mocks.createGithubFindingIssue.mockResolvedValue({ issueNumber: 1745 });
    mocks.findGithubFindingIssue.mockResolvedValue(null);
    mocks.synchronizeGithubIssueMirror.mockResolvedValue(undefined);
    mocks.find.mockResolvedValue({ docs: [{ id: 501 }] });
    mocks.update.mockImplementation(async ({ data }: { data: object }) => ({
      ...finding,
      ...data,
    }));
    mocks.withQaFindingRowLock.mockImplementation(
      async (
        _payload: unknown,
        _id: unknown,
        operation: (request: object) => unknown,
      ) => operation({ transactionID: "test" }),
    );
  });

  it("creates exactly one marked GitHub issue only after explicit promotion", async () => {
    // Arrange

    // Act
    const response = await promoteFinding(
      request("/api/admin/qa/findings/42/promote"),
      context("42"),
    );

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.createGithubFindingIssue).toHaveBeenCalledTimes(1);
    expect(mocks.createGithubFindingIssue).toHaveBeenCalledWith(
      expect.objectContaining({ marker: `qa-finding:42:${fingerprint}` }),
    );
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "qa_findings",
        id: "42",
        data: expect.objectContaining({
          lifecycle: "github_created",
          promotionState: "created",
          githubIssue: 501,
        }),
      }),
    );
  });

  it("retains the internal finding and does not mark it created when GitHub is unavailable", async () => {
    // Arrange
    mocks.createGithubFindingIssue.mockRejectedValueOnce(
      new Error("GitHub unavailable"),
    );

    // Act
    const response = await promoteFinding(
      request("/api/admin/qa/findings/42/promote"),
      context("42"),
    );

    // Assert
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "GitHub ticket creation is awaiting reconciliation; no retry was sent.",
    });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifecycle: "promoting",
          promotionState: "leased",
        }),
      }),
    );
    expect(mocks.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lifecycle: "github_created" }),
      }),
    );
  });

  it("preserves a verified fix when the GitHub create completes after a qualifying retest", async () => {
    // Arrange: the first lock reserves promotion; a targeted retest verifies
    // the same finding before the second lock binds the returned issue.
    mocks.findByID
      .mockResolvedValueOnce({ ...finding })
      .mockResolvedValueOnce({
        ...finding,
        lifecycle: "verify_fix",
        promotionState: "leased",
        githubMarker: `qa-finding:42:${fingerprint}`,
      });

    // Act
    const response = await promoteFinding(
      request("/api/admin/qa/findings/42/promote"),
      context("42"),
    );

    // Assert: the external ticket is linked, but AC-3's verified lifecycle
    // remains authoritative.
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifecycle: "verify_fix",
          promotionState: "created",
          githubIssue: 501,
        }),
      }),
    );
  });
});
