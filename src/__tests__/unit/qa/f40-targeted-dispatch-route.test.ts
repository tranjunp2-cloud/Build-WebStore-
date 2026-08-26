import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@payload-config", () => ({ default: {} }));

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  resolveChangeImpact: vi.fn(),
  validateTargetedSmokePacks: vi.fn(),
  resolveTargetedSmokePacks: vi.fn(),
  claimTargetedSmokeDispatch: vi.fn(),
  recordTargetedSmokeCoverageGap: vi.fn(),
  githubAppConfigFromEnv: vi.fn(),
  dispatchTargetedSmokeWorkflow: vi.fn(),
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ find: mocks.find, create: mocks.create, update: mocks.update })),
}));
vi.mock("fs", () => ({ default: { readFileSync: vi.fn(() => "version: 1\nrules: []") } }));
vi.mock("@/lib/admin/qa/change-impact", () => ({
  parseCoverageMap: vi.fn(() => ({ rules: [], version: "1" })),
  resolveChangeImpact: mocks.resolveChangeImpact,
}));
vi.mock("@/lib/admin/qa/targeted-smoke-registry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/qa/targeted-smoke-registry")>("@/lib/admin/qa/targeted-smoke-registry");
  return { ...actual, validateTargetedSmokePacks: mocks.validateTargetedSmokePacks, resolveTargetedSmokePacks: mocks.resolveTargetedSmokePacks };
});
vi.mock("@/lib/admin/qa/targeted-smoke-dispatch", () => ({
  claimTargetedSmokeDispatch: mocks.claimTargetedSmokeDispatch,
  recordTargetedSmokeCoverageGap: mocks.recordTargetedSmokeCoverageGap,
  blockTargetedSmokeDispatch: vi.fn(),
}));
vi.mock("@/lib/admin/qa/github-targeted-smoke", () => ({
  githubAppConfigFromEnv: mocks.githubAppConfigFromEnv,
  dispatchTargetedSmokeWorkflow: mocks.dispatchTargetedSmokeWorkflow,
  GitHubWorkflowDispatchRejectedError: class extends Error {},
}));

import { POST } from "@/app/api/internal/qa/targeted-dispatch/route";

const secret = "targeted-test-secret";
const body = { pullRequest: 1742, commitSha: "abcdef1", environment: "staging", changedPaths: ["src/app/products/page.tsx"] };

function signedRequest() {
  const raw = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return new NextRequest("http://localhost/api/internal/qa/targeted-dispatch", {
    method: "POST", body: raw,
    headers: { "content-type": "application/json", "x-qa-timestamp": timestamp, "x-qa-signature": `sha256=${signature}` },
  });
}

describe("[TC-F40-03-01] Targeted Smoke deployment dispatch API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.F40_TARGETED_SMOKE_ENABLED = "true";
    process.env.QA_TARGETED_DISPATCH_SECRET = secret;
    process.env.VERCEL_GIT_COMMIT_SHA = body.commitSha;
    mocks.find.mockResolvedValue({ docs: [] });
    mocks.create.mockResolvedValue({ id: 1 });
    mocks.update.mockResolvedValue({});
    mocks.githubAppConfigFromEnv.mockReturnValue({});
    mocks.resolveChangeImpact.mockReturnValue({ coverageMapVersion: "1", mappedTargetIds: [], unmappedPaths: body.changedPaths });
    mocks.resolveTargetedSmokePacks.mockReturnValue([]);
  });

  it("records an unmapped deployment as a coverage gap without a workflow dispatch", async () => {
    // Arrange

    // Act
    const response = await POST(signedRequest());

    // Assert
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ coverageGap: true, data: [] });
    expect(mocks.dispatchTargetedSmokeWorkflow).not.toHaveBeenCalled();
  });

  it("records a fixture-capacity block before a mapped workflow can execute", async () => {
    // Arrange
    const pack = { targetId: "products-variants-inventory", packId: "product-variants-critical-flow", packVersion: 1, fixtureKey: "fixture", fixtureCapacity: 1, spec: "tests/targeted-smoke/product-variants.smoke.spec.ts", project: "f40-targeted-smoke", testCases: [{ id: "TC-F09.64", assertion: "variant required" }] };
    mocks.resolveChangeImpact.mockReturnValue({ coverageMapVersion: "1", mappedTargetIds: [pack.targetId], unmappedPaths: [] });
    mocks.resolveTargetedSmokePacks.mockReturnValue([pack]);
    mocks.claimTargetedSmokeDispatch.mockResolvedValue({ dispatch: { id: 7 }, created: true, blocked: true });

    // Act
    const response = await POST(signedRequest());

    // Assert
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ coverageGap: false, data: [{ id: 7, targetId: pack.targetId, status: "blocked" }] });
    expect(mocks.dispatchTargetedSmokeWorkflow).not.toHaveBeenCalled();
  });

  it("rejects an unsigned deploy event before it can persist or dispatch", async () => {
    // Arrange
    const request = new NextRequest("http://localhost/api/internal/qa/targeted-dispatch", {
      method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.dispatchTargetedSmokeWorkflow).not.toHaveBeenCalled();
  });
});
