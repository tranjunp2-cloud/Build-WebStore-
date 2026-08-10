import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { verifyQaEvidenceLink } from "@/lib/admin/qa/safe-evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Expiring, metadata-only evidence endpoint; never returns Playwright artifacts. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const secret = process.env.QA_INGEST_SECRET;
  const { runId } = await params;
  if (!secret || !verifyQaEvidenceLink(runId, req.nextUrl.searchParams.get("expiresAt"), req.nextUrl.searchParams.get("signature"), secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await getPayload({ config });
  try {
    const run = await payload.findByID({ collection: "qa_test_runs", id: runId, depth: 0, overrideAccess: true });
    return NextResponse.json({
      data: {
        workflowRunId: run.workflowRunId,
        targetId: run.targetId,
        pullRequest: run.pullRequest,
        commitSha: run.commitSha,
        status: run.status,
        finishedAt: run.finishedAt,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
