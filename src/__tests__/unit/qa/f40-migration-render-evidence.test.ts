import { describe, expect, it } from "vitest";
import {
  createDemoRenderEvidence,
  createUnavailableRenderEvidence,
  deriveRenderEvidenceOverall,
  getMigrationRenderEvidence,
  registerMigrationRenderEvidenceProvider,
  sanitizeRenderEvidence,
} from "@/lib/admin/qa/migration-render-evidence";

describe("[TC-F40-13-01][TC-F40-13-02][TC-F40-13-06] Render evidence contract", () => {
  it("TC-F40-13-01: remains unverified when no approved PW1 to PW2 mapping exists", () => {
    // Arrange
    const now = new Date("2026-09-11T03:00:00.000Z");

    // Act
    const snapshot = createUnavailableRenderEvidence({ storeId: "SITE-0001", pageId: "home", legacyIds: ["BLK-1"], now });

    // Assert
    expect(snapshot.blocks[0]).toMatchObject({
      pw2Data: { status: "unverified", reasonCode: "MAPPING_UNAVAILABLE" },
      component: { status: "unverified" },
      liveRender: { status: "unverified" },
      overall: "needs_review",
    });
  });

  it("TC-F40-13-02: only three positive evidence layers can return pass", () => {
    // Arrange
    const positive = { pw2Data: { status: "migrated" as const }, component: { status: "supported" as const }, liveRender: { status: "rendered" as const } };

    // Act / Assert
    expect(deriveRenderEvidenceOverall(positive)).toBe("pass");
    expect(deriveRenderEvidenceOverall({ ...positive, liveRender: { status: "unverified" } })).toBe("needs_review");
    expect(deriveRenderEvidenceOverall({ ...positive, component: { status: "unsupported" } })).toBe("needs_review");
    expect(deriveRenderEvidenceOverall({ ...positive, pw2Data: { status: "missing" } })).toBe("failed");
  });

  it("TC-F40-13-04: demo data never claims a verified live render", () => {
    // Arrange / Act
    const snapshot = createDemoRenderEvidence({
      storeId: "SITE-0001",
      pageId: "home",
      legacyIds: ["BLK-1", "BLK-2"],
    });

    // Assert
    expect(snapshot.blocks.every((block) => block.liveRender.status === "unverified")).toBe(true);
    expect(snapshot.blocks.some((block) => block.overall === "pass")).toBe(false);
  });

  it("TC-F40-13-05: rejects cross-page provider evidence and never serializes a raw PW2 render model", async () => {
    // Arrange
    registerMigrationRenderEvidenceProvider({
      getPageEvidence: async () => {
        const snapshot = createDemoRenderEvidence({
          storeId: "OTHER-STORE",
          pageId: "other-page",
          legacyIds: ["OTHER-BLOCK"],
        });
        snapshot.blocks[0].pw2Data.renderModel = {
          blockType: "banner",
          title: "private source",
          headline: "private source",
          subheadline: null,
          bodyText: "private source",
          imageUrl: null,
          ctaLabel: null,
        };
        return snapshot;
      },
    });

    try {
      // Act
      const scoped = await getMigrationRenderEvidence({
        storeId: "SITE-0001",
        pageId: "home",
        legacyIds: ["BLK-1"],
      });
      const renderModelFixture = createDemoRenderEvidence({
        storeId: "SITE-0001",
        pageId: "home",
        legacyIds: ["BLK-1"],
      });
      renderModelFixture.blocks[0].pw2Data.renderModel = {
        blockType: "banner",
        title: "private source",
        headline: "private source",
        subheadline: null,
        bodyText: "private source",
        imageUrl: null,
        ctaLabel: null,
      };
      const sanitized = sanitizeRenderEvidence(renderModelFixture);

      // Assert
      expect(scoped.blocks[0].pw2Data.status).toBe("unverified");
      expect(sanitized.blocks[0].pw2Data.renderModel).toBeNull();
    } finally {
      registerMigrationRenderEvidenceProvider(null);
    }
  });

  it("TC-F40-13-06: strips sensitive field evidence before it reaches the UI", () => {
    // Arrange
    const snapshot = createDemoRenderEvidence({ storeId: "SITE-0001", pageId: "home", legacyIds: ["BLK-1"] });
    snapshot.blocks[0].pw2Data.fields.push({ label: "API token", pw1: "secret-value", pw2: "secret-value", status: "match" });
    snapshot.blocks[0].pw2Data.fields.push({ label: "Tên khách hàng", pw1: "Nguyễn A", pw2: "Nguyễn A", status: "match" });

    // Act
    const sanitized = sanitizeRenderEvidence(snapshot);

    // Assert
    expect(sanitized.blocks[0].pw2Data.fields).not.toContainEqual(expect.objectContaining({ label: "API token" }));
    expect(sanitized.blocks[0].pw2Data.fields).not.toContainEqual(expect.objectContaining({ label: "Tên khách hàng" }));
    expect(sanitized.blocks[0].pw2Data.fields).toContainEqual(expect.objectContaining({ label: "Tiêu đề" }));
  });
});
