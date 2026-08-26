import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getManualRunPreflight, parseManualRunContext } from "@/lib/admin/qa/manual-runs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withSuperAdmin(async (req: NextRequest) => {
  const query = new URL(req.url).searchParams;
  const targetId = query.get("targetId")?.trim() ?? "";
  const profile = query.get("profile");
  if (!targetId || (profile !== "smoke" && profile !== "regression"))
    return NextResponse.json({ error: "Invalid target or profile" }, { status: 422 });
  let context;
  try {
    const pullRequest = query.get("pullRequest");
    context = parseManualRunContext({
      pullRequest: pullRequest === null ? undefined : Number(pullRequest),
      commitSha: query.get("commitSha") ?? undefined,
    });
  } catch {
    return NextResponse.json({ error: "Invalid PR/SHA context" }, { status: 422 });
  }
  const payload = await getPayload({ config });
  const data = await getManualRunPreflight(payload, { targetId, profile, context });
  return NextResponse.json({ data });
});
