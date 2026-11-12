import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getManualRunPreflight, parseManualRunContext } from "@/lib/admin/qa/manual-runs";
import type { ManualQaProfile } from "@/lib/admin/qa/targeted-smoke-registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_PROFILES: readonly ManualQaProfile[] = [
  "smoke",
  "regression",
  "user_flow",
  "impact",
  "security",
];

function isManualQaProfile(value: unknown): value is ManualQaProfile {
  return typeof value === "string" && (VALID_PROFILES as readonly string[]).includes(value);
}

export const GET = withSuperAdmin(async (req: NextRequest) => {
  const query = new URL(req.url).searchParams;
  const targetId = query.get("targetId")?.trim() ?? "";
  const rawProfile = query.get("profile");
  if (!targetId || !isManualQaProfile(rawProfile))
    return NextResponse.json({ error: "Invalid target or profile" }, { status: 422 });
  const profile: ManualQaProfile = rawProfile;
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
