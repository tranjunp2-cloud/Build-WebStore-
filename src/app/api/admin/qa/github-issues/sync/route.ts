import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { fetchGithubIssueMirrorPage, synchronizeGithubIssueMirrors } from "@/lib/admin/qa/github-issues";
import { withQaGithubSyncLock } from "@/lib/payload/qa-github-sync-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sync is manually invokable by a super-admin and safe to retry. */
export const POST = withSuperAdmin(async (req: NextRequest) => {
  const page = Number(new URL(req.url).searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000)
    return NextResponse.json({ error: "Invalid sync page" }, { status: 422 });
  try {
    const payload = await getPayload({ config });
    if (page === 1) {
      const latest = await payload.find({ collection: "qa_github_issues", limit: 1, sort: "-lastSyncedAt", overrideAccess: true });
      const lastSyncedAt = Date.parse(String(latest.docs[0]?.lastSyncedAt ?? ""));
      const retryAfterSeconds = Math.ceil((60_000 - (Date.now() - lastSyncedAt)) / 1_000);
      if (Number.isFinite(lastSyncedAt) && retryAfterSeconds > 0)
        return NextResponse.json({ error: "GitHub issue sync is cooling down", retryAfterSeconds }, { status: 429, headers: { "retry-after": String(retryAfterSeconds) } });
    }
    const result = await withQaGithubSyncLock(payload, async () => {
      const deadline = Date.now() + 45_000;
      let currentPage = page;
      let synchronized = 0;
      let hasNext = false;
      do {
        const mirrorPage = await fetchGithubIssueMirrorPage(currentPage);
        await synchronizeGithubIssueMirrors(payload, mirrorPage.issues);
        synchronized += mirrorPage.issues.length;
        hasNext = mirrorPage.hasNext;
        currentPage += 1;
      } while (hasNext && Date.now() < deadline);
      return { synchronized, hasNext, nextPage: hasNext ? currentPage : undefined };
    });
    return NextResponse.json({ data: { synchronized: result.synchronized, page, complete: !result.hasNext, nextPage: result.nextPage } });
  } catch (error) {
    console.error("[qa-github-sync] failed", { page, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "GitHub issue synchronization is unavailable" }, { status: 503 });
  }
});
