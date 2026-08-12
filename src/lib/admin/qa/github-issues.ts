import crypto from "crypto";
import type { Payload } from "payload";

export type GithubIssueMirror = {
  issueNumber: number;
  url: string;
  title: string;
  state: "open" | "closed";
  labels: string[];
  severity: "P1" | "other" | "unknown";
  githubUpdatedAt: string;
};

type GithubConfig = { appId: string; installationId: string; privateKey: string; repository: string };
type GithubApiIssue = { number?: unknown; html_url?: unknown; title?: unknown; state?: unknown; updated_at?: unknown; pull_request?: unknown; labels?: unknown };

function base64Url(value: string): string { return Buffer.from(value).toString("base64url"); }

function appJwt(config: GithubConfig): string {
  if (!/^\d+$/.test(config.appId)) throw new Error("GITHUB_APP_ID must be numeric");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: config.appId }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`); signer.end();
  return `${header}.${payload}.${signer.sign(config.privateKey, "base64url")}`;
}

function configFromEnv(): GithubConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const repository = process.env.GITHUB_REPO;
  if (!appId || !installationId || !privateKey || !repository) return null;
  if (!/^[-.\w]+\/[-.\w]+$/.test(repository) || !/^\d+$/.test(installationId)) return null;
  return { appId, installationId, privateKey, repository };
}

export function normalizeGithubIssue(raw: GithubApiIssue): GithubIssueMirror | null {
  const issueNumber = raw.number;
  if (typeof issueNumber !== "number" || !Number.isSafeInteger(issueNumber) || issueNumber <= 0 || typeof raw.html_url !== "string" || typeof raw.title !== "string" || (raw.state !== "open" && raw.state !== "closed") || typeof raw.updated_at !== "string" || !Number.isFinite(Date.parse(raw.updated_at))) return null;
  const labels = Array.isArray(raw.labels) ? raw.labels.flatMap((label) => typeof label === "object" && label && typeof (label as { name?: unknown }).name === "string" ? [(label as { name: string }).name] : []) : [];
  return { issueNumber, url: raw.html_url, title: raw.title.slice(0, 500), state: raw.state, labels, severity: labels.includes("P1") ? "P1" : labels.length ? "other" : "unknown", githubUpdatedAt: raw.updated_at };
}

/** Retrieves bounded metadata only; pull requests are excluded from the issue mirror. */
async function requestWithRetry(fetcher: typeof fetch, input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetcher(input, { ...init, signal: AbortSignal.timeout(10_000) });
      const rateLimited = response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
      if (response.ok || (response.status < 500 && !rateLimited) || attempt === 2) return response;
      lastError = new Error(`GitHub returned ${response.status}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1_000, 15_000)));
        continue;
      }
      const resetAt = Number(response.headers.get("x-ratelimit-reset"));
      if (rateLimited && Number.isFinite(resetAt) && resetAt * 1_000 > Date.now()) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(resetAt * 1_000 - Date.now(), 15_000)));
        continue;
      }
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("GitHub request failed");
}

export type GithubIssueMirrorPage = { issues: GithubIssueMirror[]; hasNext: boolean };

/** Retrieves one GitHub page so callers can resume reconciliation within Vercel's time budget. */
export async function fetchGithubIssueMirrorPage(page: number, fetcher: typeof fetch = fetch): Promise<GithubIssueMirrorPage> {
  const config = configFromEnv();
  if (!config) throw new Error("GitHub App is not configured");
  const tokenResponse = await requestWithRetry(fetcher, `https://api.github.com/app/installations/${config.installationId}/access_tokens`, { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${appJwt(config)}`, "X-GitHub-Api-Version": "2022-11-28" } });
  const tokenJson = await tokenResponse.json().catch(() => null) as { token?: unknown } | null;
  if (!tokenResponse.ok || typeof tokenJson?.token !== "string") throw new Error("GitHub App token request failed");
  const expectedUrlPrefix = `https://github.com/${config.repository}/issues/`;
  const response = await requestWithRetry(fetcher, `https://api.github.com/repos/${config.repository}/issues?state=all&per_page=100&sort=updated&direction=desc&page=${page}`, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenJson.token}`, "X-GitHub-Api-Version": "2022-11-28" } });
  const json = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(json)) throw new Error("GitHub issue synchronization failed");
  const issues = json.filter((item): item is GithubApiIssue => Boolean(item) && typeof item === "object" && !("pull_request" in item)).map(normalizeGithubIssue).filter((issue): issue is GithubIssueMirror => issue !== null).filter((issue) => issue.url.startsWith(expectedUrlPrefix));
  return { issues, hasNext: /(?:^|,)\s*<[^>]+>;\s*rel="?next"?/.test(response.headers.get("link") ?? "") };
}

/** Compatibility helper for controlled jobs; HTTP routes must use one page at a time. */
export async function fetchGithubIssueMirrors(fetcher: typeof fetch = fetch): Promise<GithubIssueMirror[]> {
  const issues: GithubIssueMirror[] = [];
  for (let page = 1; ; page += 1) {
    const result = await fetchGithubIssueMirrorPage(page, fetcher);
    issues.push(...result.issues);
    if (!result.hasNext) return issues;
  }
}

/** Upserts one mirror by GitHub number without writing body/comment content. */
export async function synchronizeGithubIssueMirror(payload: Payload, issue: GithubIssueMirror): Promise<void> {
  const existing = await payload.find({ collection: "qa_github_issues", where: { issueNumber: { equals: issue.issueNumber } }, limit: 1, overrideAccess: true });
  const data = { ...issue, lastSyncedAt: new Date().toISOString() };
  if (existing.docs[0]) {
    const currentUpdatedAt = Date.parse(String(existing.docs[0].githubUpdatedAt ?? ""));
    if (Number.isFinite(currentUpdatedAt) && currentUpdatedAt > Date.parse(issue.githubUpdatedAt)) return;
    await payload.update({ collection: "qa_github_issues", id: existing.docs[0].id, data, overrideAccess: true });
    return;
  }
  try {
    await payload.create({ collection: "qa_github_issues", data: { ...data, mappingStatus: "unknown", mappingHistory: [] }, overrideAccess: true });
  } catch {
    const winner = await payload.find({ collection: "qa_github_issues", where: { issueNumber: { equals: issue.issueNumber } }, limit: 1, overrideAccess: true });
    if (!winner.docs[0]) throw new Error("GitHub issue mirror write failed");
    const winnerUpdatedAt = Date.parse(String(winner.docs[0].githubUpdatedAt ?? ""));
    if (Number.isFinite(winnerUpdatedAt) && winnerUpdatedAt > Date.parse(issue.githubUpdatedAt)) return;
    await payload.update({ collection: "qa_github_issues", id: winner.docs[0].id, data, overrideAccess: true });
  }
}

/** Bounded parallelism avoids both N+1 latency and database connection bursts. */
export async function synchronizeGithubIssueMirrors(payload: Payload, issues: GithubIssueMirror[], concurrency = 8): Promise<void> {
  for (let index = 0; index < issues.length; index += concurrency) {
    await Promise.all(issues.slice(index, index + concurrency).map((issue) => synchronizeGithubIssueMirror(payload, issue)));
  }
}
