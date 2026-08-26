import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { TARGETED_SMOKE_PACKS } from "@/lib/admin/qa/targeted-smoke-registry";
import { getUnifiedRunHistory } from "@/lib/admin/qa/run-history-read-model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = 50;
const MAX_PAGE = 10_000;
const RUN_STATUSES = ["passed", "failed", "cancelled", "blocked", "queued", "dispatched", "cancel_requested"] as const;
const SUITE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/i;
const SHA_PATTERN = /^[a-f0-9]{7,64}$/i;

type RunCursor = { at: string; source: "dispatch" | "run"; id: string; snapshot: string };

function parseCursor(value: string): RunCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as RunCursor;
    if (
      typeof parsed.at !== "string" ||
      Number.isNaN(Date.parse(parsed.at)) ||
      typeof parsed.snapshot !== "string" ||
      Number.isNaN(Date.parse(parsed.snapshot)) ||
      (parsed.source !== "dispatch" && parsed.source !== "run") ||
      !/^\d+$/.test(parsed.id)
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function createCursor(run: { at?: string; source: "dispatch" | "run"; id: string | number; snapshot: string }): string | undefined {
  if (!run.at || Number.isNaN(Date.parse(run.at))) return undefined;
  return Buffer.from(
    JSON.stringify({ at: run.at, source: run.source, id: String(run.id), snapshot: run.snapshot }),
  ).toString("base64url");
}

/** Read-only Studio summary; evidence bodies and raw artifacts are intentionally excluded. */
export const GET = withSuperAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const rawCursor = searchParams.get("cursor")?.trim();
  const usesKeysetCursor = rawCursor !== undefined || !searchParams.has("page");
  const rawPage = searchParams.get("page")?.trim() ?? "1";
  const rawCompletedPage = searchParams.get("completedPage")?.trim() ?? "1";
  const rawDispatchPage = searchParams.get("dispatchPage")?.trim() ?? "1";
  const cursor = rawCursor === undefined ? undefined : parseCursor(rawCursor);
  if (rawCursor !== undefined && !cursor)
    return NextResponse.json(
      { error: "Invalid run-history cursor" },
      { status: 422 },
    );
  const page = Number.parseInt(rawPage, 10);
  const completedPage = Number.parseInt(rawCompletedPage, 10);
  const dispatchPage = Number.parseInt(rawDispatchPage, 10);
  if (!/^\d+$/.test(rawPage) || page < 1 || page > MAX_PAGE)
    return NextResponse.json(
      { error: `page must be an integer from 1 to ${MAX_PAGE}` },
      { status: 422 },
    );
  if (!/^\d+$/.test(rawCompletedPage) || completedPage < 1 || completedPage > MAX_PAGE)
    return NextResponse.json(
      { error: `completedPage must be an integer from 1 to ${MAX_PAGE}` },
      { status: 422 },
    );
  if (!/^\d+$/.test(rawDispatchPage) || dispatchPage < 1 || dispatchPage > MAX_PAGE)
    return NextResponse.json({ error: `dispatchPage must be an integer from 1 to ${MAX_PAGE}` }, { status: 422 });
  const targetId = searchParams.get("targetId")?.trim();
  const suite = searchParams.get("suite")?.trim();
  const status = searchParams.get("status")?.trim();
  const rawDays = searchParams.get("days")?.trim() ?? "7";
  const days = Number.parseInt(rawDays, 10);
  if (
    !/^\d+$/.test(rawDays) || !Number.isSafeInteger(days) || !days || days < 1 || days > 30
  )
    return NextResponse.json(
      { error: "days must be an integer from 1 to 30" },
      { status: 422 },
    );
  const filters: Where = {};
  if (targetId) filters.targetId = { equals: targetId };
  if (suite && !SUITE_PATTERN.test(suite))
    return NextResponse.json({ error: "Invalid test suite" }, { status: 422 });
  if (suite) filters.suite = { equals: suite };
  if (status && !RUN_STATUSES.includes(status as (typeof RUN_STATUSES)[number]))
    return NextResponse.json({ error: "Invalid run status" }, { status: 422 });
  // Ledger state `terminal` and in-flight states do not exist in qa_test_runs.
  // Apply only genuine terminal result statuses to that collection.
  if (status && ["passed", "failed", "cancelled", "blocked"].includes(status))
    filters.status = { equals: status };
  if (status && ["queued", "dispatched", "cancel_requested"].includes(status))
    filters.id = { in: [] };
  filters.finishedAt = { greater_than_equal: new Date(Date.now() - days * 24 * 60 * 60_000).toISOString() };
  const profile = searchParams.get("profile")?.trim();
  const packId = searchParams.get("packId")?.trim();
  const pullRequest = searchParams.get("pullRequest")?.trim();
  const commitSha = searchParams.get("commitSha")?.trim();
  const testCaseId = searchParams.get("testCaseId")?.trim();
  if (profile && !SUITE_PATTERN.test(profile)) return NextResponse.json({ error: "Invalid run profile" }, { status: 422 });
  if (packId && !SUITE_PATTERN.test(packId)) return NextResponse.json({ error: "Invalid pack ID" }, { status: 422 });
  if (pullRequest && (!/^\d+$/.test(pullRequest) || Number(pullRequest) < 1)) return NextResponse.json({ error: "Invalid pull request" }, { status: 422 });
  if (commitSha && !SHA_PATTERN.test(commitSha)) return NextResponse.json({ error: "Invalid commit SHA" }, { status: 422 });
  if (testCaseId && !/^TC-[A-Za-z0-9_.-]+$/.test(testCaseId)) return NextResponse.json({ error: "Invalid test case ID" }, { status: 422 });
  const persistedProfiles = profile === "smoke" ? ["targeted-smoke", "manual-retest", "manual-smoke", "smoke"] : profile === "regression" ? ["manual-regression", "regression"] : profile ? [profile] : undefined;
  if (persistedProfiles) filters.profile = { in: persistedProfiles };
  if (pullRequest) filters.pullRequest = { equals: Number(pullRequest) };
  if (commitSha) filters.commitSha = { equals: commitSha };

  const payload = await getPayload({ config });
  const snapshot = cursor?.snapshot ?? new Date().toISOString();
  // PostgreSQL production path: one stable ledger/run timeline. The legacy
  // Payload path below remains only for adapter-mocked unit tests.
  const unified = await getUnifiedRunHistory(payload, {
    since: new Date(Date.now() - days * 24 * 60 * 60_000).toISOString(), snapshot, targetId, suite,
    profiles: persistedProfiles, pullRequest: pullRequest ? Number(pullRequest) : undefined,
    commitSha, packId, testCaseId, testCasePackIds: testCaseId ? TARGETED_SMOKE_PACKS.filter((pack) => pack.testCases.some((testCase) => testCase.id === testCaseId)).map((pack) => pack.packId) : undefined, status,
  }, cursor ? { at: cursor.at, source: cursor.source, id: Number(cursor.id), snapshot: cursor.snapshot } : undefined);
  if (unified) {
    const pageRows = unified.slice(0, LIMIT);
    const last = pageRows.at(-1);
    const nextCursor = unified.length > LIMIT && last
      ? createCursor({ at: last.cursor_at, source: last.source, id: last.id, snapshot })
      : undefined;
    return NextResponse.json({ data: pageRows.map((row) => ({ id: `${row.source}-${row.id}`, targetId: row.target_id, packId: row.pack_id ?? undefined, packVersion: row.pack_version ?? undefined, profile: row.profile, status: row.status, pullRequest: row.pull_request ?? undefined, commitSha: row.commit_sha, startedAt: row.started_at, finishedAt: row.finished_at ?? undefined, evidenceState: row.evidence_state, canCancel: row.source === "dispatch" && ["queued", "dispatched", "cancel_requested"].includes(row.status) })), meta: { limit: LIMIT, nextCursor } });
  }
  const terminalRunIds = new Set<number>();
  if (testCaseId) {
    const resultDocs: Array<{ run?: unknown }> = [];
    for (let resultPage = 1, totalPages = 1; resultPage <= totalPages; resultPage += 1) {
      const resultPageData = await payload.find({ collection: "qa_test_results", where: { testCaseId: { equals: testCaseId } }, page: resultPage, limit: 500, depth: 0, overrideAccess: true });
      resultDocs.push(...(resultPageData.docs as Array<{ run?: unknown }>));
      totalPages = resultPageData.totalPages ?? 1;
    }
    const runIds = resultDocs.map((result) => typeof result.run === "object" && result.run ? (result.run as { id?: unknown }).id : result.run).filter((id): id is number => typeof id === "number");
    filters.id = { in: runIds };
  }
  if (packId) {
    const dispatchDocs: Array<{ terminalRun?: unknown }> = [];
    for (let dispatchPage = 1, totalPages = 1; dispatchPage <= totalPages; dispatchPage += 1) {
      const dispatchPageData = await payload.find({ collection: "qa_smoke_dispatches", where: { packId: { equals: packId } }, page: dispatchPage, limit: 500, depth: 0, overrideAccess: true });
      dispatchDocs.push(...(dispatchPageData.docs as Array<{ terminalRun?: unknown }>));
      totalPages = dispatchPageData.totalPages ?? 1;
    }
    for (const dispatch of dispatchDocs) {
      const runId = typeof dispatch.terminalRun === "number" ? dispatch.terminalRun :
        typeof dispatch.terminalRun === "object" && dispatch.terminalRun ? Number((dispatch.terminalRun as { id?: unknown }).id) : NaN;
      if (Number.isSafeInteger(runId)) terminalRunIds.add(runId);
    }
    const existing = filters.id;
    filters.id = existing ? { in: [...terminalRunIds].filter((id) => Array.isArray((existing as { in?: unknown }).in) && ((existing as { in: number[] }).in).includes(id)) } : { in: [...terminalRunIds] };
  }
  const where: Where =
    cursor && cursor.at
      ? {
          and: [
            filters,
            {
              or: [
                { finishedAt: { less_than: cursor.at } },
                { and: [{ finishedAt: { equals: cursor.at } }, { id: { less_than: Number(cursor.id) } }] },
              ],
            },
          ],
        }
      : filters;
  const result = await payload.find({
    collection: "qa_test_runs",
    where,
    page: usesKeysetCursor ? 1 : page,
    limit: usesKeysetCursor ? LIMIT + 1 : LIMIT,
    sort: "-finishedAt,-id",
    depth: 0,
  });
  const docs = usesKeysetCursor ? result.docs.slice(0, LIMIT) : result.docs;
  const nextCursor =
    usesKeysetCursor && result.docs.length > LIMIT
      ? Buffer.from(JSON.stringify({ at: docs[docs.length - 1].finishedAt, source: "run", id: String(docs[docs.length - 1].id), snapshot })).toString("base64url")
      : undefined;
  const runIds = docs.map((run) => Number(run.id)).filter(Number.isSafeInteger);
  const evidenceDocs: Array<{ run?: unknown; artifactExpiresAt?: unknown }> = [];
  if (runIds.length) {
    for (let evidencePage = 1, totalPages = 1; evidencePage <= totalPages; evidencePage += 1) {
      const evidencePageData = await payload.find({ collection: "qa_test_results", where: { run: { in: runIds } }, page: evidencePage, limit: 500, depth: 0, overrideAccess: true });
      evidenceDocs.push(...(evidencePageData.docs as Array<{ run?: unknown; artifactExpiresAt?: unknown }>));
      totalPages = evidencePageData.totalPages ?? 1;
    }
  }
  const evidenceByRun = new Map<number, "available" | "expiring" | "expired" | "unavailable">();
  for (const result of evidenceDocs) {
    const runId = typeof result.run === "number" ? result.run : typeof result.run === "object" && result.run ? Number((result.run as { id?: unknown }).id) : NaN;
    const expiry = typeof result.artifactExpiresAt === "string" ? Date.parse(result.artifactExpiresAt) : NaN;
    if (!Number.isSafeInteger(runId) || !Number.isFinite(expiry)) continue;
    const next = expiry <= Date.now() ? "expired" : expiry - Date.now() < 60 * 60_000 ? "expiring" : "available";
    const current = evidenceByRun.get(runId);
    if (!current || ["available", "expiring", "expired", "unavailable"].indexOf(next) > ["available", "expiring", "expired", "unavailable"].indexOf(current)) evidenceByRun.set(runId, next);
  }
  const terminal = docs.map((run) => ({
      id: run.id,
      workflowRunId: run.workflowRunId,
      attempt: run.attempt,
      targetId: run.targetId,
      suite: run.suite,
      profile: run.profile,
      environment: run.environment,
      status: run.status,
      pullRequest: run.pullRequest,
      commitSha: run.commitSha,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      summary: run.summary,
      evidenceState: evidenceByRun.get(Number(run.id)) ?? "unavailable",
      canCancel: false,
    }));
  const dispatchFilters: Where = { createdAt: { greater_than_equal: new Date(Date.now() - days * 24 * 60 * 60_000).toISOString() } };
  if (targetId) dispatchFilters.targetId = { equals: targetId };
  if (persistedProfiles) dispatchFilters.profile = { in: persistedProfiles };
  if (packId) dispatchFilters.packId = { equals: packId };
  if (pullRequest) dispatchFilters.pullRequest = { equals: Number(pullRequest) };
  if (commitSha) dispatchFilters.commitSha = { equals: commitSha };
  if (testCaseId) {
    const matchingPacks = TARGETED_SMOKE_PACKS.filter((pack) => pack.testCases.some((testCase) => testCase.id === testCaseId)).map((pack) => pack.packId);
    // A supplied pack and TC filter are conjunctive, never a broadening OR.
    if (packId && !matchingPacks.includes(packId)) dispatchFilters.packId = { in: [] };
    else dispatchFilters.packId = { in: packId ? [packId] : matchingPacks };
  }
  const activeStatuses = ["queued", "dispatched", "cancel_requested"];
  const completedDispatchStatuses = ["blocked", "cancelled"];
  // Active dispatches are a bounded, separately-labelled section. They appear
  // only on the first cursor page so terminal pagination cannot duplicate them.
  const includeDispatches = !usesKeysetCursor || rawCursor === undefined || rawCursor === "0";
  if (status) {
    if (!activeStatuses.includes(status) && !completedDispatchStatuses.includes(status)) {
      return NextResponse.json({
        data: terminal,
        active: [],
        meta: { total: result.totalDocs, page: usesKeysetCursor ? 1 : page, limit: LIMIT, pages: result.totalPages, nextCursor },
      });
    }
    dispatchFilters.status = { equals: status };
  } else dispatchFilters.status = { in: [...activeStatuses, ...completedDispatchStatuses] };
  const isCompletedDispatchFilter = Boolean(status && completedDispatchStatuses.includes(status));
  const dispatches = includeDispatches || isCompletedDispatchFilter
    ? await payload.find({ collection: "qa_smoke_dispatches", where: dispatchFilters, page: isCompletedDispatchFilter ? completedPage : dispatchPage, limit: LIMIT, sort: "-createdAt", depth: 0, overrideAccess: true })
    : { docs: [], totalDocs: 0, page: 1, totalPages: 0 };
  const dispatchSummaries = dispatches.docs
    .map((dispatch) => ({
      id: `dispatch-${dispatch.id}`,
      targetId: dispatch.targetId,
      packId: dispatch.packId,
      packVersion: dispatch.packVersion,
      profile: dispatch.profile,
      environment: dispatch.environment,
      status: dispatch.status,
      pullRequest: dispatch.pullRequest,
      commitSha: dispatch.commitSha,
      startedAt: dispatch.createdAt,
      // Ledger-only decisions have no qa_test_runs row. Do not present their
      // creation timestamp as completion time in the history UI.
      finishedAt: dispatch.status === "cancelled" ? dispatch.cancelledAt : dispatch.status === "blocked" ? dispatch.updatedAt : undefined,
      evidenceState: "unavailable",
      canCancel: activeStatuses.includes(dispatch.status),
    }));
  const active = isCompletedDispatchFilter ? [] : dispatchSummaries.filter((dispatch) => activeStatuses.includes(dispatch.status));
  const completed = isCompletedDispatchFilter ? dispatchSummaries : dispatchSummaries.filter((dispatch) => completedDispatchStatuses.includes(dispatch.status));
  const data = terminal;
  return NextResponse.json({
    data,
    active,
    completed,
    completedMeta: isCompletedDispatchFilter
      ? { total: dispatches.totalDocs, page: dispatches.page ?? 1, pages: dispatches.totalPages ?? 0, limit: LIMIT, nextPage: (dispatches.page ?? 1) < (dispatches.totalPages ?? 0) ? (dispatches.page ?? 1) + 1 : undefined }
      : undefined,
    dispatchMeta: !isCompletedDispatchFilter
      ? { total: dispatches.totalDocs, page: dispatches.page ?? 1, pages: dispatches.totalPages ?? 0, limit: LIMIT, nextPage: (dispatches.page ?? 1) < (dispatches.totalPages ?? 0) ? (dispatches.page ?? 1) + 1 : undefined }
      : undefined,
    meta: {
      total: result.totalDocs,
      page: usesKeysetCursor ? 1 : page,
      limit: LIMIT,
      pages: result.totalPages,
      nextCursor,
    },
  });
});
