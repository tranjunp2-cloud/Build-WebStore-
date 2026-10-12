import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRecordReferenceCache } from "@/lib/admin/qa/record-reference-resolver";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getSnapshot: vi.fn(),
  sanitize: vi.fn(),
  listRuns: vi.fn(),
  listIssues: vi.fn(),
  readFieldEvidence: vi.fn(),
  readCommerceRecordPreviews: vi.fn(),
  readRecordFieldEvidence: vi.fn(),
  readSourceCoverage: vi.fn(),
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
  F42EvidenceVersionConflict: class F42EvidenceVersionConflict extends Error {},
  readFieldEvidence: mocks.readFieldEvidence,
  readCommerceRecordPreviews: mocks.readCommerceRecordPreviews,
  readRecordFieldEvidence: mocks.readRecordFieldEvidence,
}));
vi.mock("@/lib/admin/qa/reconciliation-record-reference", () => ({
  reconciliationRecordReference: ({ storeId, runId, record }: { storeId: string; runId: string; record: { sourceId: string } }) =>
    storeId === '205' && runId === '3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db' && record.sourceId === '41603'
      ? 'a'.repeat(32) : 'b'.repeat(32),
}));
vi.mock("@/lib/admin/qa/f42-source-coverage-reader", () => ({
  readSourceCoverage: mocks.readSourceCoverage,
}));
vi.mock("@/lib/admin/qa/f42-source-readiness", () => ({
  assertF42SourceReady: mocks.assertF42SourceReady,
}));

import { NextRequest } from "next/server";
import { F42SourceUnavailableError, F42_SOURCE_UNAVAILABLE } from "@/lib/admin/qa/f42-source-contract";
import { F42EvidenceVersionConflict } from "@/lib/admin/qa/f42-field-evidence-reader";
import { GET as reconciliationGet } from "@/app/api/qa/migration-reconciliation/route";
import { GET as runsGet } from "@/app/api/qa/migration-reconciliation/runs/route";
import { GET as issuesGet } from "@/app/api/qa/migration-reconciliation/issues/route";

const RUN_ID = "3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db";
const GEN_ID = "46dcd066-6319-484c-9235-6c23a7acfb8c";
const DIGEST = 'a'.repeat(64);
const VERSION_PARAMS = `generation_id=${GEN_ID}&generation_digest=${DIGEST}`;

beforeEach(() => {
  vi.clearAllMocks();
  clearRecordReferenceCache();
  mocks.getSnapshot.mockResolvedValue({ scope: "commerce", storeId: "205" });
  // Pass-through sanitizer that still honours the route's per-record decorator.
  mocks.sanitize.mockImplementation((snapshot: { records?: Array<Record<string, unknown>> }, options?: { decorateRecord?: (record: Record<string, unknown>) => object }) =>
    Array.isArray(snapshot.records)
      ? { ...snapshot, records: snapshot.records.map(record => ({ ...record, ...options?.decorateRecord?.(record) })) }
      : snapshot);
  mocks.listRuns.mockResolvedValue({
    runs: [{ runId: RUN_ID, storeId: "205", updatedAt: "2026-09-30T03:00:00.000Z" }],
    truncated: false,
  });
  mocks.listIssues.mockResolvedValue([{ id: "8", sourceEntity: "products", isRunLevel: false, severity: "BLOCKER", errorCode: "TARGET_WRITE_FAILED" }]);
  mocks.readSourceCoverage.mockResolvedValue({ state: "unavailable", reason: "Chưa có sidecar", records: 0, buckets: [] });
  mocks.readCommerceRecordPreviews.mockResolvedValue({ version: { generationId: GEN_ID, digest: DIGEST }, previews: new Map() });
});

describe("[TC-F40-14-03] F42 ledger reconciliation API", () => {
  it("TC-F40-14-07: adds bound business values to verified mapping rows", async () => {
    // Arrange
    const record = { sourceEntity: 'products', sourceId: '41603', targetIds: ['1417'] };
    mocks.getSnapshot.mockResolvedValueOnce({ evidence: { available: true, mode: 'verified' }, records: [record] });
    mocks.readCommerceRecordPreviews.mockResolvedValueOnce({ version: { generationId: GEN_ID, digest: DIGEST }, previews: new Map([[
      'products\0' + record.sourceId,
      { label: 'Tên sản phẩm', pw1: 'Fresh Passion Fruits', pw2: 'Fresh Passion Fruits', status: 'match' },
    ]]) });
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?scope=commerce&store_id=205&run_id=${RUN_ID}`);

    // Act
    const response = await reconciliationGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.readCommerceRecordPreviews).toHaveBeenCalledWith('205', RUN_ID);
    expect(body.data.records[0].preview).toEqual({ label: 'Tên sản phẩm', pw1: 'Fresh Passion Fruits', pw2: 'Fresh Passion Fruits', status: 'match' });
    expect(body.data.fieldGeneration).toEqual({ generationId: GEN_ID, digest: DIGEST });
  });
  it("TC-F40-14-07: keeps the ledger when the preview query fails", async () => {
    // Arrange
    const record = { sourceEntity: 'products', sourceId: '41603', targetIds: ['1417'] };
    mocks.getSnapshot.mockResolvedValueOnce({ evidence: { available: true, mode: 'verified' }, records: [record] });
    mocks.readCommerceRecordPreviews.mockRejectedValueOnce(new Error('F42 schema drift'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?scope=commerce&store_id=205&run_id=${RUN_ID}`);

    // Act
    const response = await reconciliationGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.data.records).toHaveLength(1);
    expect(body.data.records[0].preview).toBeUndefined();
    expect(body.data.records[0].reference).toMatch(/^[a-f0-9]{32}$/);
    errorSpy.mockRestore();
  });
  it("TC-F40-14-07: joins Discount mapping to promotion-code evidence", async () => {
    // Arrange
    const record = { sourceEntity: 'discounts', sourceId: '13', targetIds: ['1'] };
    mocks.getSnapshot.mockResolvedValueOnce({ evidence: { available: true, mode: 'verified' }, records: [record] });
    mocks.readCommerceRecordPreviews.mockResolvedValueOnce({ version: { generationId: GEN_ID, digest: DIGEST }, previews: new Map([[
      'promotion_codes\0' + record.sourceId,
      { label: 'Giá trị giảm giá', pw1: 'RM 14.0', pw2: 'RM 14.00', status: 'match', explanation: 'PW2 lưu số sen; hai bên được hiển thị theo RM.' },
    ]]) });
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?scope=commerce&store_id=205&run_id=${RUN_ID}`);

    // Act
    const response = await reconciliationGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.data.records[0].preview).toEqual({ label: 'Giá trị giảm giá', pw1: 'RM 14.0', pw2: 'RM 14.00', status: 'match', explanation: 'PW2 lưu số sen; hai bên được hiển thị theo RM.' });
  });
  it("TC-F40-14-07: resolves field evidence only for a record in the selected verified Store and run", async () => {
    // Arrange
    const record = { sourceEntity: 'products', sourceId: '41603', targetIds: ['1417'] };
    mocks.getSnapshot.mockResolvedValueOnce({ evidence: { available: true, mode: 'verified' }, records: [record] });
    mocks.readRecordFieldEvidence.mockResolvedValueOnce({ state: 'complete', rows: [] });
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=record_fields&store_id=205&run_id=${RUN_ID}&record_ref=${'a'.repeat(32)}&${VERSION_PARAMS}`);

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.readRecordFieldEvidence).toHaveBeenCalledWith({ storeId: '205', runId: RUN_ID,
      entity: 'products', sourceId: '41603', targetIds: ['1417'], page: 1, status: 'all',
      expectedVersion: { generationId: GEN_ID, digest: DIGEST } });
  });

  it("TC-F40-14-07: reuses the verified run's reference index across field pages instead of re-reading the ledger", async () => {
    // Arrange
    const record = { sourceEntity: 'products', sourceId: '41603', targetIds: ['1417'] };
    mocks.getSnapshot.mockResolvedValue({ evidence: { available: true, mode: 'verified' }, records: [record] });
    mocks.readRecordFieldEvidence.mockResolvedValue({ state: 'complete', rows: [] });
    const url = (page: number) => `http://localhost/api/qa/migration-reconciliation?view=record_fields&store_id=205&run_id=${RUN_ID}&record_ref=${'a'.repeat(32)}&page=${page}&${VERSION_PARAMS}`;

    // Act
    const first = await reconciliationGet(new NextRequest(url(1)));
    const second = await reconciliationGet(new NextRequest(url(2)));

    // Assert
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.readRecordFieldEvidence).toHaveBeenLastCalledWith(expect.objectContaining({ sourceId: '41603', page: 2 }));
  });

  it("TC-F40-14-07: rejects an unknown record reference without reading source field values", async () => {
    // Arrange
    mocks.getSnapshot.mockResolvedValueOnce({ evidence: { available: true, mode: 'verified' }, records: [
      { sourceEntity: 'products', sourceId: '41603', targetIds: ['1417'] },
    ] });
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=record_fields&store_id=205&run_id=${RUN_ID}&record_ref=${'c'.repeat(32)}&${VERSION_PARAMS}`);

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(404);
    expect(mocks.readRecordFieldEvidence).not.toHaveBeenCalled();
  });

  it("TC-F40-14-07: requires an explicit verified run before reading a record", async () => {
    // Arrange
    const invalid = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=record_fields&store_id=205&record_ref=${'a'.repeat(32)}`);
    mocks.getSnapshot.mockResolvedValueOnce({ evidence: { available: false, mode: 'unverified' }, records: [] });
    const unverified = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=record_fields&store_id=205&run_id=${RUN_ID}&record_ref=${'a'.repeat(32)}&${VERSION_PARAMS}`);

    // Act
    const responses = await Promise.all([reconciliationGet(invalid), reconciliationGet(unverified)]);

    // Assert
    expect(responses.map(response => response.status)).toEqual([400, 409]);
    expect(mocks.readRecordFieldEvidence).not.toHaveBeenCalled();
  });
  it("TC-F40-14-07: pins field pages to the selected historical run and generation", async () => {
    // Arrange
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=fields&scope=commerce&store_id=205&run_id=${RUN_ID}&page=2&${VERSION_PARAMS}`);
    mocks.readFieldEvidence.mockResolvedValueOnce({ summary: null, rows: [], total: 0, page: 2 });

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.readFieldEvidence).toHaveBeenCalledWith('205', 'commerce', 2, 'all', 'all', RUN_ID,
      { generationId: GEN_ID, digest: DIGEST });
  });
  it("TC-F40-14-07: returns conflict when a selected generation changed", async () => {
    // Arrange
    mocks.readFieldEvidence.mockRejectedValueOnce(new F42EvidenceVersionConflict());
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=fields&scope=commerce&store_id=205&run_id=${RUN_ID}&${VERSION_PARAMS}`);

    // Act
    const response = await reconciliationGet(request);

    // Assert
    expect(response.status).toBe(409);
  });
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

  it("TC-F40-MIG-LIVE-08: reads source coverage for the selected numeric Store and snapshot", async () => {
    // Arrange
    const snapshotId = "0f365d52-049c-40a9-9f60-b7a43b084014";
    const coverage = { state: "complete", snapshotId, records: 3, redactedFields: 1, buckets: [{ entity: "product_skus", disposition: "emitted", records: 3 }] };
    mocks.readSourceCoverage.mockResolvedValueOnce(coverage);
    const request = new NextRequest(`http://localhost/api/qa/migration-reconciliation?view=source_coverage&store_id=205&snapshot_id=${snapshotId}`);

    // Act
    const response = await reconciliationGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.readSourceCoverage).toHaveBeenCalledWith("205", snapshotId);
    expect(body.data).toEqual(coverage);
    expect(mocks.getSnapshot).not.toHaveBeenCalled();
    expect(mocks.readFieldEvidence).not.toHaveBeenCalled();
  });

  it("TC-F40-MIG-LIVE-08: rejects ambiguous or demo source coverage selectors", async () => {
    // Arrange
    const requests = [
      "?view=source_coverage",
      "?view=source_coverage&store_id=SITE-0205",
      "?view=source_coverage&store_id=205&demo=1",
      `?view=source_coverage&store_id=205&run_id=${RUN_ID}`,
      "?view=source_coverage&store_id=205&snapshot_id=latest",
      "?view=source_coverage&store_id=205&scope=settings",
      "?view=fields&store_id=205&snapshot_id=0f365d52-049c-40a9-9f60-b7a43b084014",
    ];

    // Act
    const responses = await Promise.all(requests.map(query => reconciliationGet(new NextRequest(`http://localhost/api/qa/migration-reconciliation${query}`))));

    // Assert
    expect(responses.map(response => response.status)).toEqual([400, 400, 400, 400, 400, 400, 400]);
    expect(mocks.readSourceCoverage).not.toHaveBeenCalled();
  });

  it("TC-F40-MIG-LIVE-08: keeps unavailable source evidence explicit", async () => {
    // Arrange
    const request = new NextRequest("http://localhost/api/qa/migration-reconciliation?view=source_coverage&store_id=205");

    // Act
    const response = await reconciliationGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.readSourceCoverage).toHaveBeenCalledWith("205", undefined);
    expect(body.data).toMatchObject({ state: "unavailable", reason: "Chưa có sidecar" });
  });

  it("TC-F40-MIG-LIVE-08: returns the safe F42 unavailable response when source schema is missing", async () => {
    // Arrange
    mocks.readSourceCoverage.mockRejectedValueOnce(new F42SourceUnavailableError());
    const request = new NextRequest("http://localhost/api/qa/migration-reconciliation?view=source_coverage&store_id=205");

    // Act
    const response = await reconciliationGet(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(503);
    expect(body).toEqual(F42_SOURCE_UNAVAILABLE);
  });
});
