import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }));
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    find: mocks.find,
    create: mocks.create,
    db: {
      drizzle: {
        transaction: async (
          operation: (transaction: {
            execute: () => Promise<void>;
          }) => Promise<unknown>,
        ) => operation({ execute: async () => undefined }),
      },
      sessions: {},
    },
  })),
}));
vi.mock("@payload-config", () => ({ default: {} }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/qa/ingest/route";

const ingestSecret = "test-qa-ingest-secret";
const validSummary = {
  workflowRunId: "123456",
  attempt: 1,
  targetId: "editor.product-grid.variants",
  suite: "visual",
  profile: "visual-regression",
  environment: "staging",
  pullRequest: 1742,
  commitSha: "f91d2c0",
  startedAt: "2026-08-06T01:00:00.000Z",
  finishedAt: "2026-08-06T01:03:00.000Z",
  summary: { passed: 1, failed: 1, skipped: 0, blocked: 0 },
  results: [
    { testCaseId: "TC-F40-02-01", status: "passed", durationMs: 100 },
    {
      testCaseId: "TC-F40-02-02",
      status: "failed",
      durationMs: 300,
      assertionCode: "VARIANT_COUNT_MISMATCH",
      expectedCount: 3,
      actualCount: 1,
    },
  ],
  changeSnapshot: {
    pullRequest: 1742,
    commitSha: "f91d2c0",
    environment: "staging",
    changedPaths: ["src/components/ProductGrid.tsx"],
    mappedTargetIds: ["editor.product-grid.variants"],
    unmappedPaths: [],
    coverageMapVersion: "2026.08.01",
  },
};

function signedRequest(
  body: unknown,
  timestamp = Date.now().toString(),
): NextRequest {
  const raw = JSON.stringify(body);
  const signature = crypto
    .createHmac("sha256", ingestSecret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  return new NextRequest("http://localhost/api/admin/qa/ingest", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      "x-qa-timestamp": timestamp,
      "x-qa-signature": `sha256=${signature}`,
    },
  });
}

function signedRawRequest(
  raw: string,
  headers: Record<string, string> = {},
): NextRequest {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", ingestSecret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  return new NextRequest("http://localhost/api/admin/qa/ingest", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      "x-qa-timestamp": timestamp,
      "x-qa-signature": `sha256=${signature}`,
      ...headers,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.QA_INGEST_SECRET = ingestSecret;
  process.env.QA_ARTIFACT_ALLOWED_HOSTS = "artifacts.example.com";
  mocks.create.mockImplementation(
    async ({ collection }: { collection: string }) => ({
      id: collection === "qa_test_runs" ? 91 : 92,
    }),
  );
});

// ── TC-F40-02-01–03: signed, atomic and retry-safe ingestion ──────────────
describe("[TC-F40-02-01–03] POST /api/admin/qa/ingest", () => {
  it("creates one atomic run, structured results, and an immutable snapshot", async () => {
    // Arrange
    mocks.find.mockResolvedValue({ docs: [] });

    // Act
    const response = await POST(signedRequest(validSummary));
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body).toEqual({
      data: { id: 91, workflowRunId: "123456", attempt: 1 },
      created: true,
    });
    expect(mocks.create).toHaveBeenCalledTimes(4);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "qa_test_runs",
        data: expect.objectContaining({
          status: "failed",
          ingestDigest: expect.any(String),
        }),
      }),
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "qa_change_snapshots",
        data: expect.objectContaining({ snapshotDigest: expect.any(String) }),
      }),
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: true }),
    );
  });

  it("returns an exact retry as a no-op and rejects a divergent terminal payload", async () => {
    // Arrange
    const raw = JSON.stringify(validSummary);
    const digest = crypto.createHash("sha256").update(raw).digest("hex");
    mocks.find.mockResolvedValue({ docs: [{ id: 91, ingestDigest: digest }] });

    // Act
    const exact = await POST(signedRequest(validSummary));
    const divergent = await POST(
      signedRequest({ ...validSummary, profile: "different-profile" }),
    );

    // Assert
    expect(exact.status).toBe(200);
    expect((await exact.json()).created).toBe(false);
    expect(divergent.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects unsigned, stale, and oversized requests before persistence", async () => {
    // Arrange
    const staleTimestamp = (Date.now() - 6 * 60_000).toString();
    const oversized = "x".repeat(1_000_001);

    // Act
    const unsigned = await POST(
      new NextRequest("http://localhost/api/admin/qa/ingest", {
        method: "POST",
        body: JSON.stringify(validSummary),
      }),
    );
    const stale = await POST(signedRequest(validSummary, staleTimestamp));
    const tooLarge = await POST(
      new NextRequest("http://localhost/api/admin/qa/ingest", {
        method: "POST",
        body: oversized,
        headers: { "content-length": "1000001" },
      }),
    );

    // Assert
    expect(unsigned.status).toBe(401);
    expect(stale.status).toBe(401);
    expect(tooLarge.status).toBe(413);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("streams a body without a usable content-length and rejects it at 1 MB", async () => {
    // Arrange
    const raw = "x".repeat(1_000_001);

    // Act
    const response = await POST(
      signedRawRequest(raw, { "content-length": "not-a-number" }),
    );

    // Assert
    expect(response.status).toBe(413);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an absent secret and signed contract violations before persistence", async () => {
    // Arrange
    const invalidSummary = {
      ...validSummary,
      summary: { passed: 2, failed: 0, skipped: 0, blocked: 0 },
    };
    delete process.env.QA_INGEST_SECRET;

    // Act
    const unavailable = await POST(signedRequest(validSummary));
    process.env.QA_INGEST_SECRET = ingestSecret;
    const invalid = await POST(signedRequest(invalidSummary));

    // Assert
    expect(unavailable.status).toBe(503);
    expect(invalid.status).toBe(422);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects a conflicting immutable deploy impact snapshot", async () => {
    mocks.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({
      docs: [{ id: 72, snapshotDigest: "different-digest" }],
    });

    const response = await POST(signedRequest(validSummary));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error:
        "Deploy impact snapshot already exists with different mapping data",
    });
  });

  it("keeps an exact immutable snapshot while creating a new matching run", async () => {
    // Arrange
    const normalizedSnapshot = JSON.stringify({
      ...validSummary.changeSnapshot,
      changedPaths: [...validSummary.changeSnapshot.changedPaths].sort(),
      mappedTargetIds: [...validSummary.changeSnapshot.mappedTargetIds].sort(),
      unmappedPaths: [...validSummary.changeSnapshot.unmappedPaths].sort(),
    });
    const snapshotDigest = crypto
      .createHash("sha256")
      .update(normalizedSnapshot)
      .digest("hex");
    mocks.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 72, snapshotDigest }] });

    // Act
    const response = await POST(signedRequest(validSummary));

    // Assert
    expect(response.status).toBe(201);
    expect(mocks.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: "qa_change_snapshots" }),
    );
  });

  it("recovers a unique-key race only when the committed digest matches", async () => {
    // Arrange
    const raw = JSON.stringify(validSummary);
    const digest = crypto.createHash("sha256").update(raw).digest("hex");
    mocks.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 91, ingestDigest: digest }] });
    mocks.create.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "23505" }),
    );

    // Act
    const response = await POST(signedRequest(validSummary));

    // Assert
    expect(response.status).toBe(200);
    expect((await response.json()).created).toBe(false);
  });
});
