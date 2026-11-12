import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { withStudioPermission } from "@/lib/admin/api-utils";
import { getTargetById } from "@/lib/admin/qa/target-registry";
import { withQaIngestTransaction } from "@/lib/payload/qa-ingest-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MappingSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), targetId: z.string().min(1).max(160) }).strict(),
  z.object({ action: z.literal("dismiss"), reason: z.string().trim().min(3).max(500) }).strict(),
]);

export const POST = withStudioPermission('qa.triage', async (req: NextRequest, { user, params }) => {
  const issueId = params?.id;
  if (!issueId || !/^\d+$/.test(issueId)) return NextResponse.json({ error: "Invalid issue ID" }, { status: 422 });
  const body = await req.json().catch(() => null);
  const parsed = MappingSchema.safeParse(body);
  if (!parsed.success || (parsed.data.action === "confirm" && !getTargetById(parsed.data.targetId))) return NextResponse.json({ error: "Invalid target mapping" }, { status: 422 });
  const payload = await getPayload({ config });
  try {
    const confirmedAt = new Date().toISOString();
    const updated = await withQaIngestTransaction(payload, async (transactionReq) => {
      await payload.findByID({ collection: "qa_github_issues", id: issueId, overrideAccess: true, req: transactionReq });
      const mapped = await payload.update({
        collection: "qa_github_issues",
        id: issueId,
        data: {
          targetId: parsed.data.action === "confirm" ? parsed.data.targetId : null,
          mappingStatus: parsed.data.action === "confirm" ? "confirmed" : "dismissed",
          mappingDismissReason: parsed.data.action === "dismiss" ? parsed.data.reason : null,
          mappingConfirmedAt: confirmedAt,
          mappingConfirmedBy: user.id,
        },
        overrideAccess: true,
        req: transactionReq,
      });
      await payload.create({
        collection: "qa_github_issue_mapping_events",
        data: parsed.data.action === "confirm"
          ? { githubIssue: Number(issueId), action: "confirmed", targetId: parsed.data.targetId, actor: user.id, occurredAt: confirmedAt }
          : { githubIssue: Number(issueId), action: "dismissed", reason: parsed.data.reason, actor: user.id, occurredAt: confirmedAt },
        overrideAccess: true,
        req: transactionReq,
      });
      return mapped;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[qa-github-mapping] failed", {
      issueId,
      action: parsed.data.action,
      message: error instanceof Error ? error.message : "unknown",
    });
    if (error instanceof Error && /not found/i.test(error.message))
      return NextResponse.json({ error: "GitHub issue was not found" }, { status: 404 });
    return NextResponse.json({ error: "GitHub issue mapping could not be saved" }, { status: 500 });
  }
});
