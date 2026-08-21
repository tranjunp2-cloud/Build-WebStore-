import { describe, expect, it } from "vitest";
import { CMS_TARGET_REGISTRY } from "@/lib/admin/qa/target-registry";
import {
  getTargetQaCoverage,
  isTargetQaPackCertified,
  isTargetQaPackContractCertified,
  TARGET_QA_COVERAGE,
  validateTargetQaCoverage,
} from "@/lib/admin/qa/targeted-qa-coverage";
import { resolveTargetedSmokePacks, TARGETED_SMOKE_PACKS } from "@/lib/admin/qa/targeted-smoke-registry";

describe("[TC-F40-08-01][TC-F40-08-02] Evidence-gated CMS coverage matrix", () => {
  it("provides exactly one validated policy row for every active CMS target", () => {
    // Arrange
    const activeTargetIds = CMS_TARGET_REGISTRY.filter(
      (target) => target.active,
    ).map((target) => target.id);

    // Act / Assert
    expect(() => validateTargetQaCoverage()).not.toThrow();
    expect(TARGET_QA_COVERAGE.map((entry) => entry.targetId).sort()).toEqual(
      [...activeTargetIds].sort(),
    );
    expect(
      TARGET_QA_COVERAGE.every((entry) => entry.priority !== "unassigned"),
    ).toBe(true);
  });

  it("does not turn an uncertified pack or regression profile into execution authority", () => {
    // Arrange
    const target = CMS_TARGET_REGISTRY[0]!;

    // Act
    const isCertifiedForUnapprovedPack = isTargetQaPackCertified(
      target.id,
      "unapproved-pack-id",
      "smoke",
    );
    const isCertifiedForRegression = isTargetQaPackCertified(
      target.id,
      `${target.id}-contract`,
      "regression",
    );

    // Assert
    expect(isCertifiedForUnapprovedPack).toBe(false);
    expect(isCertifiedForRegression).toBe(false);
  });

  it("maps every certified execution contract to one exact allow-listed pack", () => {
    // Arrange
    const certified = TARGET_QA_COVERAGE.filter(
      (entry) => entry.certificationState === "certified_executable",
    );

    // Act / Assert
    for (const entry of certified) {
      for (const execution of entry.executions ?? []) {
        const pack = TARGETED_SMOKE_PACKS.find(
          (candidate) => candidate.packId === execution.packId,
        );
        expect(pack?.targetId).toBe(entry.targetId);
        expect(pack?.packVersion).toBe(execution.packVersion);
        expect(pack?.runner).toBe(execution.runner);
        expect(fs.existsSync(path.join(process.cwd(), execution.spec))).toBe(true);
      }
    }
  });

  it("rejects a pack when an execution-critical field drifts from certification", () => {
    // Arrange
    const certifiedTarget = "editor-productgrid-variants";
    const pack = resolveTargetedSmokePacks([certifiedTarget])[0]!;

    // Act / Assert
    expect(
      isTargetQaPackContractCertified(
        { ...pack, packVersion: pack.packVersion + 1 },
        "smoke",
        pack.manualProfiles?.smoke,
      ),
    ).toBe(false);
  });
});
import fs from "fs";
import path from "path";
