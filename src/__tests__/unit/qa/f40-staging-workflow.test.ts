import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("[TC-F40-02-09] staging QA workflow safety guards", () => {
  it("runs on manual dispatch only and refuses incomplete or wrong-deploy evidence", () => {
    // Arrange
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/e2e-staging.yml"),
      "utf8",
    );

    // Act / Assert
    // #2474: per-push runs were cancelled by the next push and never finished green — manual dispatch only now
    // (the nightly e2e-full-regression.yml covers the same specs).
    expect(workflow).toMatch(/\non:\n\s+workflow_dispatch:/);
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).toContain("id: staging_deploy");
    expect(workflow).toContain("DEPLOYED_SHA=$(printf '%s' \"$HEALTH\"");
    expect(workflow).toContain('[ "$DEPLOYED_SHA" = "$GITHUB_SHA" ]');
    expect(workflow).toContain("steps.staging_deploy.outcome == 'success'");
    expect(workflow).toContain("No source PR could be resolved");
    expect(workflow).toContain("more than 500 paths");
    expect(workflow).toContain("Dispatch allow-listed targeted Smoke packs");
    expect(workflow).toContain("F40_TARGETED_SMOKE_ENABLED");
    expect(workflow).toContain("QA_TARGETED_DISPATCH_SECRET");
    expect(workflow).toContain("/api/internal/qa/targeted-dispatch");
    expect(workflow).toContain("Verify targeted Smoke API security boundaries");
    expect(workflow).not.toContain(
      "STAGING_E2E_TERMINAL_FAILURE",
    );
  });
});
