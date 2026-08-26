import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn() }));
const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
const artifactUrl = (name: string) =>
  `https://artifacts.example.com/sanitized/${name}?expiresAt=${encodeURIComponent(expiresAt)}`;
const validVisualResult = () => ({
  id: 91,
  status: "failed",
  assertionCode: "VISUAL_THRESHOLD_EXCEEDED",
  visualBaselineUrl: artifactUrl("baseline"),
  visualCurrentUrl: artifactUrl("current"),
  visualDiffUrl: artifactUrl("diff"),
  visualReviewStatus: "pending_review",
  visualThresholdPercent: 0.5,
  visualDifferencePercent: 1,
  visualBaselineExpiresAt: expiresAt,
  visualCurrentExpiresAt: expiresAt,
  visualDiffExpiresAt: expiresAt,
});
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ find: mocks.find, update: mocks.update })),
}));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: 7, roles: ["super-admin"] })),
}));
vi.mock("@/lib/payload/qa-result-row-lock", () => ({
  withQaResultRowLock: vi.fn(
    async (
      _payload: unknown,
      _id: unknown,
      operation: (req: { transactionID: string }) => unknown,
    ) => operation({ transactionID: "test" }),
  ),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/qa/results/[id]/visual-review/route";

describe("[TC-F40-04-03] POST visual review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QA_ARTIFACT_ALLOWED_HOSTS = "artifacts.example.com";
    mocks.find.mockResolvedValue({ docs: [validVisualResult()] });
    mocks.update.mockResolvedValue({
      id: 91,
      visualReviewStatus: "confirmed_regression",
      visualReviewedAt: "2026-08-10T01:00:00.000Z",
    });
  });

  it("stores a super-admin confirmation without creating a GitHub issue", async () => {
    // Arrange
    const request = new NextRequest(
      "http://localhost/api/admin/qa/results/91/visual-review",
      {
        method: "POST",
        body: JSON.stringify({ status: "confirmed_regression" }),
      },
    );

    // Act
    const response = await POST(request, { params: { id: "91" } });

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "qa_test_results",
        data: expect.objectContaining({
          visualReviewStatus: "confirmed_regression",
          visualReviewedBy: 7,
        }),
      }),
    );
  });

  it("rejects an incomplete or already-reviewed visual record", async () => {
    // Arrange
    mocks.find.mockResolvedValue({
      docs: [{ id: 91, visualReviewStatus: "expected_change" }],
    });
    const request = new NextRequest(
      "http://localhost/api/admin/qa/results/91/visual-review",
      { method: "POST", body: JSON.stringify({ status: "expected_change" }) },
    );

    // Act
    const response = await POST(request, { params: { id: "91" } });

    // Assert
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a non-threshold failure even when stale data marks it pending", async () => {
    // Arrange
    mocks.find.mockResolvedValue({
      docs: [
        { ...validVisualResult(), assertionCode: "VARIANT_COUNT_MISMATCH" },
      ],
    });
    const request = new NextRequest(
      "http://localhost/api/admin/qa/results/91/visual-review",
      {
        method: "POST",
        body: JSON.stringify({ status: "confirmed_regression" }),
      },
    );

    // Act
    const response = await POST(request, { params: { id: "91" } });

    // Assert
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the QA result no longer exists", async () => {
    // Arrange
    mocks.find.mockResolvedValue({ docs: [] });
    const request = new NextRequest(
      "http://localhost/api/admin/qa/results/404/visual-review",
      {
        method: "POST",
        body: JSON.stringify({ status: "confirmed_regression" }),
      },
    );

    // Act
    const response = await POST(request, { params: { id: "404" } });

    // Assert
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
