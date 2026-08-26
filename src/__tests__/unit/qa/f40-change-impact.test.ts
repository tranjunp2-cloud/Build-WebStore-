import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCoverageMap,
  resolveChangeImpact,
} from "@/lib/admin/qa/change-impact";

const coverageMap = parseCoverageMap(`version: 1
rules:
  - { source: 'src/app/(dashboard)/orders/**', targets: [orders-list, order-shipping], evidence: [] }
  - { source: 'src/app/api/orders/**', targets: [order-shipping], evidence: [] }
`);

describe("[TC-F40-02-04] QA change-impact mapping", () => {
  it("maps every matching source path to stable targets and keeps only gaps as unmapped", () => {
    // Arrange
    const changedPaths = [
      "src/app/(dashboard)/orders/page.tsx",
      "src/app/api/orders/route.ts",
      "src/lib/unmapped.ts",
    ];

    // Act
    const impact = resolveChangeImpact(changedPaths, coverageMap);

    // Assert
    expect(impact).toEqual({
      coverageMapVersion: "v1",
      mappedTargetIds: ["order-shipping", "orders-list"],
      unmappedPaths: ["src/lib/unmapped.ts"],
    });
  });

  it("parses the checked-in multiline map and handles route groups, dynamics and gaps", () => {
    // Arrange
    const source = fs.readFileSync(
      path.join(process.cwd(), "qa/coverage-map.yml"),
      "utf8",
    );
    const productionMap = parseCoverageMap(source);

    // Act
    const impact = resolveChangeImpact(
      ["src/app/(dashboard)/orders/[id]/page.tsx", "src/lib/unknown.ts"],
      productionMap,
    );

    // Assert
    expect(impact.coverageMapVersion).toBe("v1");
    expect(impact.mappedTargetIds).toContain("order-shipping-label");
    expect(impact.unmappedPaths).toEqual(["src/lib/unknown.ts"]);
  });

  it("uses the cancel-route rule instead of the broad Orders fallback", () => {
    // Arrange
    const source = fs.readFileSync(
      path.join(process.cwd(), "qa/coverage-map.yml"),
      "utf8",
    );
    const productionMap = parseCoverageMap(source);

    // Act
    const impact = resolveChangeImpact(
      ["src/app/api/orders/[id]/cancel/route.ts"],
      productionMap,
    );

    // Assert
    expect(impact.mappedTargetIds).toEqual(["order-refund-cancel-retry"]);
    expect(impact.unmappedPaths).toEqual([]);
  });
});
