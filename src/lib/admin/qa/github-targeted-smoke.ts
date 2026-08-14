import crypto from "crypto";

export type GitHubAppConfig = {
  appId: string;
  installationId: string;
  privateKey: string;
  repository: string;
};

/** A non-2xx GitHub response proves no workflow dispatch was accepted. */
export class GitHubWorkflowDispatchRejectedError extends Error {}
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

async function githubFetch(fetcher: typeof fetch, input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new GitHubWorkflowDispatchRejectedError("GitHub API request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function parseRepository(repository: string): { owner: string; repo: string } {
  const match = repository.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) throw new Error("GITHUB_REPO must be an owner/repository pair");
  return { owner: match[1], repo: match[2] };
}

function createAppJwt(config: GitHubAppConfig, now = Date.now()): string {
  if (!/^\d+$/.test(config.appId)) throw new Error("GITHUB_APP_ID must be numeric");
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iat: Math.floor(now / 1_000) - 60,
    exp: Math.floor(now / 1_000) + 9 * 60,
    iss: config.appId,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(config.privateKey, "base64url")}`;
}

async function readJson(response: Response): Promise<unknown> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response.json(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new GitHubWorkflowDispatchRejectedError("GitHub API response timed out")), GITHUB_REQUEST_TIMEOUT_MS); }),
    ]);
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Server-only GitHub App client. It never exposes an installation token. */
export async function dispatchTargetedSmokeWorkflow(
  config: GitHubAppConfig,
  input: {
    dispatchId: string;
    commitSha: string;
    packId: string;
    workflowNonce: string;
    runProfile?: "targeted-smoke" | "manual-retest" | "manual-smoke" | "manual-regression";
  },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const { owner, repo } = parseRepository(config.repository);
  if (!/^\d+$/.test(config.installationId))
    throw new Error("GITHUB_APP_INSTALLATION_ID must be numeric");
  if (!/^[A-Za-z0-9_.-]+$/.test(input.dispatchId))
    throw new Error("Invalid dispatch ID");
  if (!/^[a-f0-9]{7,64}$/i.test(input.commitSha))
    throw new Error("Invalid commit SHA");
  if (!/^[a-z][a-z0-9-]*$/.test(input.packId))
    throw new Error("Invalid pack ID");
  if (!/^[A-Za-z0-9_-]{32}$/.test(input.workflowNonce))
    throw new Error("Invalid workflow nonce");

  const appJwt = createAppJwt(config);
  const tokenResponse = await githubFetch(fetcher,
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  const tokenBody = await readJson(tokenResponse) as { token?: unknown } | null;
  if (!tokenResponse.ok || typeof tokenBody?.token !== "string")
    throw new GitHubWorkflowDispatchRejectedError("GitHub App installation token request failed");

  const workflowResponse = await githubFetch(fetcher,
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/targeted-smoke.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${tokenBody.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        // GitHub needs a branch containing the workflow. The job itself checks
        // out the immutable deployed SHA supplied by the server.
        ref: "staging",
        inputs: {
          dispatch_id: input.dispatchId,
          commit_sha: input.commitSha,
          pack_id: input.packId,
          workflow_nonce: input.workflowNonce,
          run_profile: input.runProfile ?? "targeted-smoke",
        },
      }),
    },
  );
  if (!workflowResponse.ok)
    throw new GitHubWorkflowDispatchRejectedError("GitHub targeted Smoke workflow dispatch failed");
}

/** Requests cancellation only after a server-bound Actions workflow run exists. */
export async function cancelTargetedSmokeWorkflow(
  config: GitHubAppConfig,
  workflowRunId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!/^\d+(?:-\d+)?$/.test(workflowRunId))
    throw new Error("Invalid workflow run ID");
  const { owner, repo } = parseRepository(config.repository);
  const appJwt = createAppJwt(config);
  const tokenResponse = await githubFetch(fetcher,
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${appJwt}`, "X-GitHub-Api-Version": "2022-11-28" } },
  );
  const tokenBody = await readJson(tokenResponse) as { token?: unknown } | null;
  if (!tokenResponse.ok || typeof tokenBody?.token !== "string")
    throw new GitHubWorkflowDispatchRejectedError("GitHub App installation token request failed");
  const runId = workflowRunId.split("-")[0];
  const response = await githubFetch(fetcher,
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
    { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenBody.token}`, "X-GitHub-Api-Version": "2022-11-28" } },
  );
  if (!response.ok && response.status !== 409)
    throw new GitHubWorkflowDispatchRejectedError("GitHub workflow cancellation failed");
}

/** Returns the safe Actions lifecycle state for reconciliation; never exposes logs or tokens. */
export async function getTargetedSmokeWorkflowState(
  config: GitHubAppConfig,
  workflowRunId: string,
  fetcher: typeof fetch = fetch,
): Promise<"completed" | "in_progress" | "queued" | null> {
  if (!/^\d+(?:-\d+)?$/.test(workflowRunId)) throw new Error("Invalid workflow run ID");
  const { owner, repo } = parseRepository(config.repository);
  const appJwt = createAppJwt(config);
  const tokenResponse = await githubFetch(fetcher,
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    { method: "POST", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${appJwt}`, "X-GitHub-Api-Version": "2022-11-28" } },
  );
  const tokenBody = await readJson(tokenResponse) as { token?: unknown } | null;
  if (!tokenResponse.ok || typeof tokenBody?.token !== "string") return null;
  const runId = workflowRunId.split("-")[0];
  const response = await githubFetch(fetcher,
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
    { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${tokenBody.token}`, "X-GitHub-Api-Version": "2022-11-28" } },
  );
  const body = await readJson(response) as { status?: unknown } | null;
  return response.ok && (body?.status === "completed" || body?.status === "in_progress" || body?.status === "queued") ? body.status : null;
}

export function githubAppConfigFromEnv(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const repository = process.env.GITHUB_REPO;
  if (!appId || !installationId || !privateKey || !repository) return null;
  return { appId, installationId, privateKey, repository };
}
