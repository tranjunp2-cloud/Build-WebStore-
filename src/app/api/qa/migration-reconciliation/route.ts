import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import {
  getReconciliationSnapshot,
  RECONCILIATION_SCOPES,
  registerMigrationEvidenceProvider,
  sanitizeReconciliationSnapshot,
} from "@/lib/admin/qa/migration-reconciliation";
import { f42LedgerEvidenceProvider } from "@/lib/admin/qa/f42-ledger-evidence-provider";
import { F42EvidenceVersionConflict, readCommerceRecordPreviews, readFieldEvidence, readRecordFieldEvidence } from "@/lib/admin/qa/f42-field-evidence-reader";
import { indexRecordReferences, lookupRecordReference } from "@/lib/admin/qa/record-reference-resolver";
import { reconciliationRecordReference } from "@/lib/admin/qa/reconciliation-record-reference";
import { readSourceCoverage } from "@/lib/admin/qa/f42-source-coverage-reader";
import { FIELD_STATUSES } from "@/lib/admin/qa/field-evidence-summary";
import { assertF42SourceReady } from "@/lib/admin/qa/f42-source-readiness";
import { F42_SOURCE_UNAVAILABLE, F42_FIELD_SCHEMA, isF42SourceUnavailable } from "@/lib/admin/qa/f42-source-contract";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  scope: z.enum(RECONCILIATION_SCOPES).default("commerce"),
  store_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  run_id: z.string().uuid().optional(),
  snapshot_id: z.string().uuid().optional(),
  generation_id: z.string().uuid().optional(),
  generation_digest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  demo: z.enum(["0", "1"]).default("0"),
  view: z.enum(["ledger", "fields", "source_coverage", "record_fields"]).default("ledger"),
  record_ref: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  status: z.enum(['all', ...FIELD_STATUSES]).default('all'),
  entity: z.enum(['all', 'products', 'orders', 'discounts', 'customers']).default('all'),
}).superRefine((value, context) => {
  if (value.demo === "0" && value.store_id && !/^\d+$/.test(value.store_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["store_id"], message: "F42 source store ID must be numeric" });
  }
  if (value.snapshot_id && value.view !== 'source_coverage') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['snapshot_id'], message: 'Snapshot selector requires source coverage view' });
  }
  if (value.view === 'source_coverage' && value.scope !== 'commerce') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['scope'], message: 'Source coverage view is Commerce only' });
  }
  if (value.record_ref && value.view !== 'record_fields') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['record_ref'], message: 'Record reference requires record_fields view' });
  }
  if (Boolean(value.generation_id) !== Boolean(value.generation_digest)
    || ((value.generation_id || value.generation_digest) && !['fields', 'record_fields'].includes(value.view))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['generation_id'], message: 'Generation and digest must be supplied together for field evidence' });
  }
});

// This is the only production registration point. The adapter itself performs
// read-only ledger access and fails closed when the F42 schema is unavailable.
registerMigrationEvidenceProvider(f42LedgerEvidenceProvider);

/**
 * GET /api/qa/migration-reconciliation
 *
 * A Super Admin-only, read-only source for the Commerce/Settings reconciliation
 * shell. Before versioned PW1→PW2 evidence is registered it responds only with
 * the safe `unverified` state; it never guesses a match from business fields.
 */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse({
    scope: searchParams.get("scope") ?? undefined,
    store_id: searchParams.get("store_id") ?? undefined,
    run_id: searchParams.get("run_id") ?? undefined,
    snapshot_id: searchParams.get("snapshot_id") ?? undefined,
    generation_id: searchParams.get("generation_id") ?? undefined,
    generation_digest: searchParams.get("generation_digest") ?? undefined,
    demo: searchParams.get("demo") ?? undefined,
    view: searchParams.get("view") ?? undefined,
    record_ref: searchParams.get("record_ref") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    entity: searchParams.get("entity") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "Invalid reconciliation query" }, { status: 400 });
  if (query.data.run_id && !query.data.store_id) {
    return NextResponse.json({ error: "A store is required when selecting a migration run" }, { status: 400 });
  }

  try {
    if (query.data.view === 'source_coverage') {
      if (!query.data.store_id || !/^\d+$/.test(query.data.store_id) || query.data.demo !== '0' || query.data.run_id) {
        return NextResponse.json({ error: 'Numeric source store required for source coverage' }, { status: 400 });
      }
      return NextResponse.json({ data: await readSourceCoverage(query.data.store_id, query.data.snapshot_id) });
    }
    if (query.data.view === 'fields') {
      if (!query.data.store_id || !/^\d+$/.test(query.data.store_id) || query.data.demo !== '0') {
        return NextResponse.json({ error: 'Numeric source store required for real field evidence' }, { status: 400 });
      }
      await assertF42SourceReady(F42_FIELD_SCHEMA);
      const expectedVersion = query.data.generation_id && query.data.generation_digest
        ? { generationId: query.data.generation_id, digest: query.data.generation_digest } : undefined;
      return NextResponse.json({ data: await readFieldEvidence(query.data.store_id, query.data.scope, query.data.page, query.data.status,
        query.data.scope === 'commerce' ? query.data.entity : 'all', query.data.run_id, expectedVersion) });
    }
    if (query.data.view === 'record_fields') {
      if (!query.data.store_id || !/^\d+$/.test(query.data.store_id) || !query.data.run_id
        || !query.data.record_ref || !query.data.generation_id || !query.data.generation_digest
        || query.data.scope !== 'commerce' || query.data.demo !== '0') {
        return NextResponse.json({ error: 'Store, verified run and record reference are required' }, { status: 400 });
      }
      const { store_id: refStoreId, run_id: refRunId, record_ref: refValue } = query.data;
      let record = lookupRecordReference(refStoreId, refRunId, refValue);
      if (record === undefined) {
        const snapshot = await getReconciliationSnapshot({ scope: 'commerce', storeId: refStoreId, runId: refRunId });
        if (!snapshot.evidence.available || snapshot.evidence.mode !== 'verified') {
          return NextResponse.json({ error: 'Verified mapping evidence is unavailable for this run' }, { status: 409 });
        }
        indexRecordReferences(refStoreId, refRunId, snapshot.records);
        record = lookupRecordReference(refStoreId, refRunId, refValue) ?? null;
      }
      if (!record) return NextResponse.json({ error: 'Record does not belong to the selected Store and run' }, { status: 404 });
      await assertF42SourceReady(F42_FIELD_SCHEMA);
      return NextResponse.json({ data: await readRecordFieldEvidence({
        storeId: query.data.store_id, runId: query.data.run_id, entity: record.sourceEntity,
        sourceId: record.sourceId, targetIds: record.targetIds, page: query.data.page,
        status: query.data.status,
        expectedVersion: { generationId: query.data.generation_id, digest: query.data.generation_digest },
      }) });
    }
    const snapshot = await getReconciliationSnapshot({
      scope: query.data.scope,
      storeId: query.data.store_id ?? null,
      runId: query.data.run_id ?? null,
      demo: query.data.demo === "1",
    });

    const { run_id: runId, store_id: storeId, scope } = query.data;
    const verifiedRun = Boolean(runId && storeId && snapshot.evidence?.available && snapshot.evidence.mode === 'verified');
    // Previews are decoration: a failing F42 query must degrade to "no preview", not hide the ledger.
    let previewResult: Awaited<ReturnType<typeof readCommerceRecordPreviews>> | null = null;
    if (verifiedRun && scope === 'commerce') {
      try {
        previewResult = await readCommerceRecordPreviews(storeId!, runId!);
      } catch (error) {
        console.error("[migration-reconciliation] Record previews unavailable", error instanceof Error ? error.name : "unknown error");
      }
    }
    const safe = sanitizeReconciliationSnapshot(snapshot, {
      allowDemoFixture: query.data.demo === "1",
      decorateRecord: verifiedRun ? (record) => ({
        reference: reconciliationRecordReference({ storeId: storeId!, runId: runId!, record }),
        preview: previewResult?.previews.get(`${record.sourceEntity === 'discounts' ? 'promotion_codes' : record.sourceEntity}\0${record.sourceId}`),
      }) : undefined,
    });
    if (verifiedRun && previewResult?.version) safe.fieldGeneration = previewResult.version;
    return NextResponse.json({ data: safe });
  } catch (error) {
    if (error instanceof F42EvidenceVersionConflict) return NextResponse.json({ error: 'F42 evidence changed; reload this run' }, { status: 409 });
    if (isF42SourceUnavailable(error)) return NextResponse.json(F42_SOURCE_UNAVAILABLE, { status: 503 });
    console.error("[migration-reconciliation] Failed to read evidence", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: query.data.view === 'source_coverage'
      ? 'Source coverage is temporarily unavailable'
      : "Migration ledger is temporarily unavailable" }, { status: 503 });
  }
});
