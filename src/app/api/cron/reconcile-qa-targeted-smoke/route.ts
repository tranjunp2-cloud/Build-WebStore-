import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { blockTargetedSmokeDispatch } from "@/lib/admin/qa/targeted-smoke-dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resolves ambiguous GitHub dispatches conservatively. A run that never makes
 * either never makes its one-time start claim or never reaches terminal ingest
 * before its lease expires is blocked and released; it is never silently
 * re-dispatched against a potentially mutated fixture.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await getPayload({ config });
  const now = new Date();
  const candidates = await payload.find({
    collection: "qa_smoke_dispatches",
    where: {
      status: { equals: "dispatched" },
    },
    limit: 100,
    overrideAccess: true,
  });
  let reconciled = 0;
  for (const dispatch of candidates.docs as Array<{
    id: string | number;
    fixtureKey?: string;
  }>) {
    if (!dispatch.fixtureKey) continue;
    const activeLease = await payload.find({
      collection: "qa_fixture_leases",
      where: {
        and: [
          { dispatch: { equals: dispatch.id } },
          { status: { equals: "active" } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    const expiresAt = activeLease.docs[0]?.expiresAt;
    // A successful one-time claim extends the lease for the entire workflow
    // window. Reconcile from that lease deadline, never from dispatch creation.
    if (expiresAt && Date.parse(expiresAt) > now.getTime()) continue;
    await blockTargetedSmokeDispatch(
      payload,
      { id: dispatch.id, fixtureKey: dispatch.fixtureKey },
      "GITHUB_DISPATCH_UNCONFIRMED",
      "GitHub workflow did not reach signed terminal ingestion before lease expiry; trigger a new staging deploy revision after investigating Actions.",
      now,
    );
    reconciled += 1;
  }
  return NextResponse.json({ reconciled });
}
