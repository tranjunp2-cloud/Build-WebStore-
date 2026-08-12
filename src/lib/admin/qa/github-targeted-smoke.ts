import crypto from "crypto";

type GitHubAppConfig = {
  appId: string;
  installationId: string;
  privateKey: string;
  repository: string;
};

/** A non-2xx GitHub response proves no workflow dispatch was accepted. */
export class GitHubWorkflowDispatchRejectedError extends Error {}

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
  try {
    return await response.json();
  } catch {
    return null;
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
    runProfile?: "targeted-smoke" | "manual-retest";
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
  const tokenResponse = await fetcher(
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

  const workflowResponse = await fetcher(
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

export function githubAppConfigFromEnv(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const repository = process.env.GITHUB_REPO;
  if (!appId || !installationId || !privateKey || !repository) return null;
  return { appId, installationId, privateKey, repository };
}
