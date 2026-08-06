import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Exposes deploy-impact coverage gaps for the QA Control Center; raw source diffs are never returned. */
export const GET = withSuperAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const pullRequest = Number.parseInt(
    searchParams.get("pullRequest") ?? "",
    10,
  );
  const commitSha = searchParams.get("commitSha")?.trim();
  const where: Where = {};
  if (Number.isInteger(pullRequest) && pullRequest > 0)
    where.pullRequest = { equals: pullRequest };
  if (commitSha) where.commitSha = { equals: commitSha };

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "qa_change_snapshots",
    where,
    limit: 50,
    sort: "-createdAt",
    depth: 0,
  });
  return NextResponse.json({
    data: result.docs.map((snapshot) => ({
      id: snapshot.id,
      pullRequest: snapshot.pullRequest,
      commitSha: snapshot.commitSha,
      environment: snapshot.environment,
      changedPaths: snapshot.changedPaths,
      mappedTargetIds: snapshot.mappedTargetIds,
      unmappedPaths: snapshot.unmappedPaths,
      coverageMapVersion: snapshot.coverageMapVersion,
      createdAt: snapshot.createdAt,
    })),
  });
});
