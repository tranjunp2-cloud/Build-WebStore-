import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("[TC-F40-02-09] staging QA workflow safety guards", () => {
  it("runs for every staging push and refuses incomplete or wrong-deploy evidence", () => {
    // Arrange
    const workflow = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/e2e-staging.yml"),
      "utf8",
    );

    // Act / Assert
    expect(workflow).toContain("branches: [staging]");
    expect(workflow).not.toMatch(/push:\n\s+branches: \[staging\]\n\s+paths:/);
    expect(workflow).toContain("id: staging_deploy");
    expect(workflow).toContain("DEPLOYED_SHA=$(printf '%s' \"$HEALTH\"");
    expect(workflow).toContain('[ "$DEPLOYED_SHA" = "$GITHUB_SHA" ]');
    expect(workflow).toContain("steps.staging_deploy.outcome == 'success'");
    expect(workflow).toContain("No source PR could be resolved");
    expect(workflow).toContain("more than 500 paths");
  });
});
