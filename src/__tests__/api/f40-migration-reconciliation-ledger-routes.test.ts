import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getSnapshot: vi.fn(),
  sanitize: vi.fn(),
  listRuns: vi.fn(),
  listIssues: vi.fn(),
  readFieldEvidence: vi.fn(),
  assertF42SourceReady: vi.fn(),
}));

vi.mock("@/lib/admin/api-utils", () => ({
  withSuperAdmin: (handler: (request: Request) => Promise<Response>) => handler,
}));
vi.mock("@/lib/admin/qa/migration-reconciliation", () => ({
  RECONCILIATION_SCOPES: ["commerce", "settings"],
  registerMigrationEvidenceProvider: mocks.register,
  getReconciliationSnapshot: mocks.getSnapshot,
  sanitizeReconciliationSnapshot: mocks.sanitize,
}));
vi.mock("@/lib/admin/qa/f42-ledger-evidence-provider", () => ({
  f42LedgerEvidenceProvider: {},
  listVerifiedF42LedgerRuns: mocks.listRuns,
  listOpenF42LedgerIssues: mocks.listIssues,
}));
vi.mock("@/lib/admin/qa/f42-field-evidence-reader", () => ({
  readFieldEvidence: mocks.readFieldEvidence,
}));
vi.mock("@/lib/admin/qa/f42-source-readiness", () => ({
  assertF42SourceReady: mocks.assertF42SourceReady,
}));

import { NextRequest } from "next/server";
import { GET as reconciliationGet } from "@/app/api/qa/migration-reconciliation/route";
import { GET as runsGet } from "@/app/api/qa/migration-reconciliation/runs/route";
import { GET as issuesGet } from "@/app/api/qa/migration-reconciliation/issues/route";

const RUN_ID = "3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSnapshot.mockResolvedValue({ scope: "commerce", storeId: "205" });
  mocks.sanitize.mockImplementation((snapshot: unknown) => snapshot);
  mocks.listRuns.mockResolvedValue({
    runs: [{ runId: RUN_ID, storeId: "205", updatedAt: "2026-09-30T03:00:00.000Z" }],
    truncated: false,
  });
  mocks.listIssues.mockResolvedValue([{ id: "8", sourceEntity: "products", isRunLevel: false, severity: "BLOCKER", errorCode: "TARGET_WRITE_FAILED" }]);
});

describe("[TC-F40-14-03] F42 ledger reconciliation API", () => {
  it("TC-F40-14-03: registers the F42 provider and forwards an explicit store/run pair", async () => {
    // Arrange
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?scope=commerce&store_id=205&run_id=${RUN_ID}`);

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.getSnapshot).toHaveBeenCalledWith({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
      demo: false,
    });
    expect(mocks.readFieldEvidence).not.toHaveBeenCalled();
    expect(mocks.assertF42SourceReady).not.toHaveBeenCalled();
  });

  it("TC-F40-14-01: rejects a selected run without its store boundary", async () => {
    // Arrange
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?run_id=${RUN_ID}`);

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(400);
    expect(mocks.getSnapshot).not.toHaveBeenCalled();
  });

  it("TC-F40-14-02: keeps the existing synthetic store ID available for explicit demo mode", async () => {
    // Arrange
    const request = new NextRequest("http://localhost/api/qa/migration-reconciliation?scope=commerce&store_id=SITE-0001&demo=1");

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.getSnapshot).toHaveBeenCalledWith({
      scope: "commerce",
      storeId: "SITE-0001",
      runId: null,
      demo: true,
    });
  });

  it("TC-F40-14-03: returns only verified runs for an explicit store", async () => {
    // Arrange
    const request = new NextRequest("http://localhost/api/qa/migration-reconciliation/runs?store_id=205");

    // Act
    const response = await runsGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.listRuns).toHaveBeenCalledWith("205");
    expect(body.data).toEqual([{ runId: RUN_ID, storeId: "205", updatedAt: "2026-09-30T03:00:00.000Z" }]);
    expect(body.meta).toEqual({ truncated: false });
  });

  it("TC-F40-14-01: rejects malformed run and issue selectors", async () => {
    // Arrange / Act
    const invalidRuns = await runsGet(new NextRequest("http://localhost/api/qa/migration-reconciliation/runs"));
    const nonNumericStore = await runsGet(new NextRequest("http://localhost/api/qa/migration-reconciliation/runs?store_id=SITE-0205"));
    const nonDemoSyntheticStore = await reconciliationGet(new NextRequest("http://localhost/api/qa/migration-reconciliation?store_id=SITE-0205"));
    const invalidIssues = await issuesGet(new NextRequest("http://localhost/api/qa/migration-reconciliation/issues?store_id=205&run_id=latest"));

    // Assert
    expect(invalidRuns.status).toBe(400);
    expect(nonNumericStore.status).toBe(400);
    expect(nonDemoSyntheticStore.status).toBe(400);
    expect(invalidIssues.status).toBe(400);
    expect(mocks.listRuns).not.toHaveBeenCalled();
    expect(mocks.listIssues).not.toHaveBeenCalled();
  });

  it("TC-F40-14-03: returns only the safe issue DTO for an explicit run/store pair", async () => {
    // Arrange
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation/issues?store_id=205&run_id=${RUN_ID}`);

    // Act
    const response = await issuesGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.listIssues).toHaveBeenCalledWith({ storeId: "205", runId: RUN_ID });
    expect(body.data[0]).toEqual({ id: "8", sourceEntity: "products", isRunLevel: false, severity: "BLOCKER", errorCode: "TARGET_WRITE_FAILED" });
    expect(body.data[0]).not.toHaveProperty("sourceId");
  });

  it("TC-F40-14-01: returns a safe service error when the ledger reader fails", async () => {
    // Arrange
    mocks.getSnapshot.mockRejectedValueOnce(new Error("database outage"));
    mocks.listRuns.mockRejectedValueOnce(new Error("database outage"));
    mocks.listIssues.mockRejectedValueOnce(new Error("database outage"));

    // Act
    const snapshotResponse = await reconciliationGet(new NextRequest(`http://localhost/api/qa/migration-reconciliation?store_id=205&run_id=${RUN_ID}`));
    const runsResponse = await runsGet(new NextRequest("http://localhost/api/qa/migration-reconciliation/runs?store_id=205"));
    const issuesResponse = await issuesGet(new NextRequest(`http://localhost/api/qa/migration-reconciliation/issues?store_id=205&run_id=${RUN_ID}`));

    // Assert
    expect(snapshotResponse.status).toBe(503);
    expect(await snapshotResponse.json()).toEqual({ error: "Migration ledger is temporarily unavailable" });
    expect(runsResponse.status).toBe(503);
    expect(await runsResponse.json()).toEqual({ error: "Migration ledger is temporarily unavailable" });
    expect(issuesResponse.status).toBe(503);
    expect(await issuesResponse.json()).toEqual({ error: "Migration ledger is temporarily unavailable" });
  });
});
