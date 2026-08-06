import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = 50;

/** Read-only Studio summary; evidence bodies and raw artifacts are intentionally excluded. */
export const GET = withSuperAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );
  const targetId = searchParams.get("targetId")?.trim();
  const status = searchParams.get("status")?.trim();
  const where: Where = {};
  if (targetId) where.targetId = { equals: targetId };
  if (status && ["passed", "failed", "cancelled", "blocked"].includes(status))
    where.status = { equals: status };

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "qa_test_runs",
    where,
    page,
    limit: LIMIT,
    sort: "-finishedAt",
    depth: 0,
  });
  return NextResponse.json({
    data: result.docs.map((run) => ({
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
      page,
      limit: LIMIT,
      pages: result.totalPages,
    },
  });
});
