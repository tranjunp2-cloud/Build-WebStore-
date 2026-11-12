import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";
import config from "@payload-config";
import { withStudioPermission } from "@/lib/admin/api-utils";
import { hasApprovedArtifactUrl } from "@/lib/admin/qa/contracts";
import { withQaResultRowLock } from "@/lib/payload/qa-result-row-lock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VisualReviewSchema = z.object({
  status: z.enum(["confirmed_regression", "expected_change"]),
});

/** Records a human visual decision only. GitHub issue creation remains F40-05. */
export const POST = withStudioPermission('qa.visual', 
  async (req: NextRequest, { user, params }) => {
    const id = params?.id;
    if (!id || !/^\d+$/.test(id))
      return NextResponse.json(
        { error: "Invalid QA result ID" },
        { status: 422 },
      );
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
    }
    const parsed = VisualReviewSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid visual review status" },
        { status: 422 },
      );

    const payload = await getPayload({ config });
    const outcome = await withQaResultRowLock(
      payload,
      id,
      async (transactionReq) => {
        // Re-read inside the row lock. This makes the pending-review check a
        // compare-and-set: a second tester cannot overwrite the first decision.
        const found = await payload.find({
          collection: "qa_test_results",
          where: { id: { equals: id } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req: transactionReq,
        });
        const result = found.docs[0];
        if (!result) return { notFound: true as const };
        if (
          !result.visualBaselineUrl ||
          !result.visualCurrentUrl ||
          !result.visualDiffUrl ||
          result.visualReviewStatus !== "pending_review"
        )
          return { error: "Visual comparison is not pending review" };

        const allowedHosts = (process.env.QA_ARTIFACT_ALLOWED_HOSTS ?? "")
          .split(",")
          .map((host) => host.trim().toLowerCase())
          .filter(Boolean);
        if (process.env.NODE_ENV === "development")
          allowedHosts.push("qa-e2e.local");
        if (
          result.status !== "failed" ||
          result.assertionCode !== "VISUAL_THRESHOLD_EXCEEDED" ||
          !result.visualBaselineExpiresAt ||
          !result.visualCurrentExpiresAt ||
          !result.visualDiffExpiresAt ||
          !hasApprovedArtifactUrl(
            result.visualBaselineUrl,
            allowedHosts,
            result.visualBaselineExpiresAt,
          ) ||
          !hasApprovedArtifactUrl(
            result.visualCurrentUrl,
            allowedHosts,
            result.visualCurrentExpiresAt,
          ) ||
          !hasApprovedArtifactUrl(
            result.visualDiffUrl,
            allowedHosts,
            result.visualDiffExpiresAt,
          ) ||
          typeof result.visualDifferencePercent !== "number" ||
          typeof result.visualThresholdPercent !== "number" ||
          result.visualDifferencePercent <= result.visualThresholdPercent
        )
          return {
            error:
              "Visual evidence is unavailable or does not exceed its threshold",
          };

        const updated = await payload.update({
          collection: "qa_test_results",
          id,
          data: {
            visualReviewStatus: parsed.data.status,
            visualReviewedBy: user.id,
            visualReviewedAt: new Date().toISOString(),
          },
          overrideAccess: true,
          req: transactionReq,
        });
        return { updated };
      },
    );
    if ("notFound" in outcome)
      return NextResponse.json(
        { error: "QA result not found" },
        { status: 404 },
      );
    if ("error" in outcome)
      return NextResponse.json({ error: outcome.error }, { status: 409 });
    const updated = outcome.updated;
    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.visualReviewStatus,
        reviewedAt: updated.visualReviewedAt,
      },
    });
  },
);
