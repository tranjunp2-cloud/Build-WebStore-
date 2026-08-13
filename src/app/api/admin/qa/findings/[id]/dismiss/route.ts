import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { withQaFindingRowLock } from "@/lib/payload/qa-finding-row-lock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Internal QC decision only. It never calls GitHub or alters evidence. */
export const POST = withSuperAdmin(
  async (_req: NextRequest, { params, user }) => {
    const id = params?.id;
    if (!id || !/^\d+$/.test(id))
      return NextResponse.json(
        { error: "Invalid finding ID" },
        { status: 422 },
      );
    const payload = await getPayload({ config });
    try {
      const finding = await withQaFindingRowLock(payload, id, async (req) => {
        const current = (await payload.findByID({
          collection: "qa_findings",
          id,
          depth: 0,
          overrideAccess: true,
          req,
        })) as unknown as Record<string, unknown>;
        if (current.lifecycle !== "needs_review")
          throw new Error("Finding cannot be dismissed after promotion starts");
        const audit = Array.isArray(current.lifecycleAudit)
          ? current.lifecycleAudit
          : [];
        return payload.update({
          collection: "qa_findings",
          id,
          data: {
            lifecycle: "cancelled",
            promotionState: "not_requested",
            lifecycleAudit: [
              ...audit,
              {
                at: new Date().toISOString(),
                from: current.lifecycle,
                to: "cancelled",
                reason: "qa_review_dismissed",
                actorId: String(user.id),
              },
            ],
          },
          overrideAccess: true,
          req,
        });
      });
      return NextResponse.json({ data: finding });
    } catch (error) {
      if (error instanceof Error && /cannot be dismissed/.test(error.message))
        return NextResponse.json(
          { error: "Finding cannot be dismissed after GitHub promotion" },
          { status: 409 },
        );
      return NextResponse.json(
        { error: "Finding could not be dismissed" },
        { status: 404 },
      );
    }
  },
);
