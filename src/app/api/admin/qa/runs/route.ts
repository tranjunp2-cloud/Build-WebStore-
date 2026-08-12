import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = 50;
const MAX_PAGE = 10_000;
const RUN_STATUSES = ["passed", "failed", "cancelled", "blocked"] as const;
const SUITE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/i;

type RunCursor = { finishedAt: string; id: string };

function parseCursor(value: string): RunCursor | null {
  if (value === "0") return { finishedAt: "", id: "0" };
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as RunCursor;
    if (
      typeof parsed.finishedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.finishedAt)) ||
      !/^\d+$/.test(parsed.id)
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function createCursor(run: { finishedAt?: string; id: string | number }): string | undefined {
  if (!run.finishedAt || Number.isNaN(Date.parse(run.finishedAt))) return undefined;
  return Buffer.from(
    JSON.stringify({ finishedAt: run.finishedAt, id: String(run.id) }),
  ).toString("base64url");
}

/** Read-only Studio summary; evidence bodies and raw artifacts are intentionally excluded. */
export const GET = withSuperAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const rawCursor = searchParams.get("cursor")?.trim();
  const usesKeysetCursor = rawCursor !== undefined || !searchParams.has("page");
  const rawPage = searchParams.get("page")?.trim() ?? "1";
  const cursor = rawCursor === undefined ? undefined : parseCursor(rawCursor);
  if (rawCursor !== undefined && !cursor)
    return NextResponse.json(
      { error: "Invalid run-history cursor" },
      { status: 422 },
    );
  const page = Number.parseInt(rawPage, 10);
  if (!/^\d+$/.test(rawPage) || page < 1 || page > MAX_PAGE)
    return NextResponse.json(
      { error: `page must be an integer from 1 to ${MAX_PAGE}` },
      { status: 422 },
    );
  const targetId = searchParams.get("targetId")?.trim();
  const suite = searchParams.get("suite")?.trim();
  const status = searchParams.get("status")?.trim();
  const rawDays = searchParams.get("days")?.trim();
  const days = rawDays ? Number.parseInt(rawDays, 10) : undefined;
  if (
    rawDays &&
    (!/^\d+$/.test(rawDays) || !Number.isSafeInteger(days) || !days || days < 1 || days > 30)
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
  if (status) filters.status = { equals: status };
  if (days)
    filters.finishedAt = {
      greater_than_equal: new Date(
        Date.now() - days * 24 * 60 * 60_000,
      ).toISOString(),
    };

  const where: Where =
    cursor && cursor.finishedAt
      ? {
          and: [
            filters,
            {
              or: [
                { finishedAt: { less_than: cursor.finishedAt } },
                {
                  and: [
                    { finishedAt: { equals: cursor.finishedAt } },
                    { id: { less_than: Number(cursor.id) } },
                  ],
                },
              ],
            },
          ],
        }
      : filters;
  const payload = await getPayload({ config });
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
      ? createCursor(docs[docs.length - 1])
      : undefined;
  return NextResponse.json({
    data: docs.map((run) => ({
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
    })),
    meta: {
      total: result.totalDocs,
      page: usesKeysetCursor ? 1 : page,
      limit: LIMIT,
      pages: result.totalPages,
      nextCursor,
    },
  });
});
