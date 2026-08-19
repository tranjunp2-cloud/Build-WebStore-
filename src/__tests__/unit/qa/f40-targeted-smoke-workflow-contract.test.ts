import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  dispatchTargetedSmokeWorkflow,
  GitHubWorkflowDispatchRejectedError,
} from "@/lib/admin/qa/github-targeted-smoke";
import { TARGETED_SMOKE_PACKS } from "@/lib/admin/qa/targeted-smoke-registry";
import { getTargetQaCoverage } from "@/lib/admin/qa/targeted-qa-coverage";

const workflowPath = path.join(
  process.cwd(),
  ".github/workflows/targeted-smoke.yml",
);

describe("[TC-F40-08-03] Targeted Smoke workflow contract parity", () => {
  it("binds every certified Smoke pack to its exact target, version, spec and test cases", () => {
    // Arrange
    const workflow = fs.readFileSync(workflowPath, "utf8");

    // Act / Assert
    for (const pack of TARGETED_SMOKE_PACKS) {
      const coverage = getTargetQaCoverage(pack.targetId)?.executions?.find(
        (execution) => execution.packId === pack.packId,
      );
      expect(coverage).toBeDefined();
      const branchStart = workflow.indexOf(`            ${pack.packId})`);
      const branchEnd = workflow.indexOf("            *)", branchStart + 1);
      const branch =
        branchStart >= 0 && branchEnd > branchStart
          ? workflow.slice(branchStart, branchEnd)
          : undefined;
      expect(
        branch,
        `missing workflow branch for ${pack.packId}`,
      ).toBeDefined();
      expect(branch).toContain(`target_id=${pack.targetId}`);
      expect(branch).toContain(`pack_version=${pack.packVersion}`);
      expect(branch).toContain(`spec=${pack.spec}`);
      expect(branch).toContain(
        `tc_ids=${pack.testCases.map((item) => item.id).join(",")}`,
      );
      expect(coverage?.packId).toBe(pack.packId);
      expect(coverage?.packVersion).toBe(pack.packVersion);
      expect(branch).toContain(`runner=${pack.runner}`);
    }
  });

  it("fails closed instead of assigning an unknown pack to a default target", () => {
    // Arrange
    const workflow = fs.readFileSync(workflowPath, "utf8");

    // Act / Assert
    expect(workflow).toContain("*) echo 'Pack is not allow-listed'; exit 1 ;;");
    expect(workflow).not.toContain("|| 'storefront-discount-checkout'");
    expect(workflow).not.toContain("Upload raw Playwright artifacts");
    expect(workflow).not.toContain("- manual-regression");
  });

  it("rejects Regression before it can enter the Smoke workflow", async () => {
    // Arrange
    const fetcher = async () => {
      throw new Error("fetch must not be reached");
    };

    // Act / Assert
    await expect(
      dispatchTargetedSmokeWorkflow(
        {
          appId: "1",
          installationId: "1",
          privateKey: "not-used-before-validation",
          repository: "primeproduction/ech-prime-web-v2",
        },
        {
          dispatchId: "1",
          commitSha: "abcdef1",
          packId: "editor-product-grid-variants-smoke",
          workflowNonce: "a".repeat(32),
          runProfile: "manual-regression",
        },
        fetcher,
      ),
    ).rejects.toBeInstanceOf(GitHubWorkflowDispatchRejectedError);
  });
});
