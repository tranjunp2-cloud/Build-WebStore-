// @vitest-environment node
import { mergeFooterSocialsWithSite } from "@/lib/site-settings";
import { describe, it, expect } from "vitest";
import { compareMigrationContent } from "@/lib/admin/qa/website-migration-compare";
describe("[TC-F40-MIG-LIVE-01] source-bound website fields", () => {
  it("ignores AI layout decisions but reports lost text and HTML", () => {
    const fields = compareMigrationContent(
      { variant: "split-left", headline: "Hello", html: "<p>Original</p>" },
      { variant: "centered", headline: "Hello", html: "<p>Changed</p>" },
    );
    expect(fields.map((f) => [f.field, f.status])).toEqual([
      ["headline", "match"],
      ["html", "mismatch"],
    ]);
  });
  it("does not certify a missing destination field", () => {
    expect(compareMigrationContent({ headline: "Source" }, {})).toEqual([
      {
        field: "headline",
        source: "Source",
        current: "(missing)",
        status: "unverified",
      },
    ]);
  });
  it("ignores generated array IDs without ignoring changed links", () => {
    const source = { ctaButtons: [{ label: "Go", url: "/products" }] };
    expect(
      compareMigrationContent(source, {
        ctaButtons: [{ id: "pw2", url: "/products", label: "Go" }],
      })[0].status,
    ).toBe("match");
    expect(
      compareMigrationContent(source, {
        ctaButtons: [{ id: "pw2", url: "/wrong", label: "Go" }],
      })[0].status,
    ).toBe("mismatch");
  });
  it("normalizes same-tab link defaults while preserving meaningful differences", () => {
    const links = [
      { label: "Products", url: "/products" },
      { label: "Articles", url: "/articles" },
    ];
    const actual = links.map((link) => ({
      ...link,
      id: "generated",
      openInNewTab: false,
    }));
    expect(
      compareMigrationContent({ links }, { links: actual })[0].status,
    ).toBe("match");
    expect(
      compareMigrationContent({ links: actual }, { links })[0].status,
    ).toBe("match");
    for (const changed of [
      [{ ...actual[0], openInNewTab: true }, actual[1]],
      [{ ...actual[0], url: "/wrong" }, actual[1]],
      [{ ...actual[0], label: "Wrong" }, actual[1]],
      [...actual].reverse(),
    ]) {
      expect(
        compareMigrationContent({ links }, { links: changed })[0].status,
      ).toBe("mismatch");
    }
  });
  it("accepts an omitted empty social list but never certifies missing blocks or lost links", () => {
    expect(
      compareMigrationContent({ socials: [] }, { blockType: "footer" })[0]
        .status,
    ).toBe("match");
    expect(
      compareMigrationContent(
        { socials: [] },
        { blockType: "footer", socials: null },
      )[0].status,
    ).toBe("match");
    expect(compareMigrationContent({ socials: [] }, {})[0].status).toBe(
      "unverified",
    );
    expect(
      compareMigrationContent(
        {
          socials: [{ platform: "facebook", url: "https://facebook.com/shop" }],
        },
        { blockType: "footer" },
      )[0].status,
    ).toBe("unverified");
    const actual = mergeFooterSocialsWithSite(
      { socials: [] },
      { socialLinks: { facebook: "https://facebook.com/shop" } },
    );
    expect(compareMigrationContent({ socials: [] }, actual)[0].status).toBe(
      "mismatch",
    );
  });
  it("reports changed media URLs for review rather than inferring identity", () => {
    expect(
      compareMigrationContent(
        { image: { url: "https://source.test/a.jpg" } },
        { image: { url: "https://pw2.test/a.jpg" } },
      )[0].status,
    ).toBe("mismatch");
  });
  it("compares category and selected-product configuration", () => {
    expect(
      compareMigrationContent(
        { selectedProductIds: [1, 2], category: "10" },
        { selectedProductIds: [2, 1], category: "10" },
      ).map((f) => f.status),
    ).toEqual(["mismatch", "match"]);
  });
});

import {
  collectWebsiteMediaIds,
  resolveWebsiteMedia,
} from "@/lib/admin/qa/website-migration-media";
describe("[TC-F40-MIG-LIVE-01] destination media evidence", () => {
  it("resolves nested image references in one collected set without treating product/category IDs as media", () => {
    const input = {
      image: 72912,
      slides: [{ image: "72912" }],
      category: 42,
      selectedProductIds: [72912],
    };
    const media = new Map([
      [
        72912,
        {
          id: 72912,
          url: "https://cdn.test/image.png",
          alt: "Banner",
          width: 800,
          height: 600,
          filename: "image.png",
          tenant: 99,
          privateToken: "hidden",
        },
      ],
    ]);
    expect(collectWebsiteMediaIds(input)).toEqual([72912]);
    const resolved = resolveWebsiteMedia(input, media) as Record<
      string,
      unknown
    >;
    expect(resolved.image).toEqual({
      id: 72912,
      url: "https://cdn.test/image.png",
      alt: "Banner",
      width: 800,
      height: 600,
      filename: "image.png",
    });
    expect(resolved.category).toBe(42);
    expect(resolved.selectedProductIds).toEqual([72912]);
  });
  it("keeps a missing media ID visible as unavailable", () => {
    expect(resolveWebsiteMedia({ image: 72912 }, new Map())).toEqual({
      image: { id: 72912, unavailable: true },
    });
  });
});

import { imagePreviews } from "@/lib/admin/qa/website-image-preview";
describe("[TC-F40-MIG-LIVE-01] image presentation", () => {
  it("extracts image metadata and preserves slide positions", () => {
    expect(
      imagePreviews(
        "block[1].slides",
        JSON.stringify([
          {
            image: {
              url: "https://source.test/a.png",
              alt: "Banner",
              width: 800,
              height: 600,
            },
          },
          { image: null },
        ]),
      ),
    ).toEqual([
      {
        path: "$[0].image",
        url: "https://source.test/a.png",
        alt: "Banner",
        width: 800,
        height: 600,
      },
      { path: "$[1].image", url: null, alt: "", width: null, height: null },
    ]);
  });
  it("rejects unsafe image protocols and ignores ordinary text/link fields", () => {
    expect(
      imagePreviews("image", JSON.stringify({ url: "javascript:alert(1)" }))[0]
        .url,
    ).toBeNull();
    expect(imagePreviews("headline", "https://source.test/a.png")).toEqual([]);
  });
});

import sharp from "sharp";
import { compareImageBytes } from "@/lib/admin/qa/website-image-check";
describe("[TC-F40-MIG-LIVE-06] automatic image content checks", () => {
  const image = (color: string, width = 64, height = 48) =>
    sharp({ create: { width, height, channels: 3, background: color } });
  it("certifies identical image files by SHA-256", async () => {
    const bytes = await image("red").png().toBuffer();
    expect((await compareImageBytes(bytes, bytes)).status).toBe("same-file");
  });
  it("certifies all decoded pixels when only lossless encoding differs", async () => {
    const a = await image("blue").png({ compressionLevel: 0 }).toBuffer(),
      b = await image("blue").png({ compressionLevel: 9 }).toBuffer();
    expect(a.equals(b)).toBe(false);
    expect((await compareImageBytes(a, b)).status).toBe("same-pixels");
  });
  it("does not auto-certify resized images from a similarity score", async () => {
    const a = await image("blue").png().toBuffer(),
      b = await image("blue", 32, 24).png().toBuffer();
    expect((await compareImageBytes(a, b)).status).toBe("similar");
  });
  it("detects different image content and rejects unreadable bytes", async () => {
    expect(
      (
        await compareImageBytes(
          await image("red").png().toBuffer(),
          await image("blue").png().toBuffer(),
        )
      ).status,
    ).toBe("different");
    await expect(
      compareImageBytes(Buffer.from("invalid"), Buffer.from("invalid")),
    ).rejects.toThrow();
  });
});

import { effectiveBlockStatus } from "@/lib/admin/qa/website-migration-status";
import type { MigrationBlock } from "@/lib/admin/qa/website-migration-compare";
describe("[TC-F40-MIG-LIVE-06] aggregate current image verdicts", () => {
  const block: MigrationBlock = {
    sourceId: "banner",
    kind: "banner",
    indexes: [1],
    sourceContent: [],
    status: "mismatch",
    fields: compareMigrationContent(
      { image: { url: "https://pw1/a" }, headline: "Hello" },
      { image: { url: "https://pw2/a" }, headline: "Hello" },
      "block[1].",
    ),
  };
  const review = {
    page: "page",
    block: "banner",
    field: "block[1].image",
    path: "$",
  };
  it("updates aggregate after confirmation and restores pending after cancellation", () => {
    expect(effectiveBlockStatus(block, "page", [], [review])).toBe("match");
    expect(effectiveBlockStatus(block, "page", [], [])).toBe("unverified");
    expect(effectiveBlockStatus(block, "other", [], [review])).toBe(
      "unverified",
    );
  });
  it("never hides a changed headline or a missing image", () => {
    const changed = {
      ...block,
      fields: compareMigrationContent(
        { image: { url: "https://pw1/a" }, headline: "Hello" },
        { image: { url: "https://pw2/a" }, headline: "Wrong" },
        "block[1].",
      ),
    };
    expect(effectiveBlockStatus(changed, "page", [], [review])).toBe(
      "mismatch",
    );
    const missing = {
      ...block,
      fields: compareMigrationContent(
        { image: { url: "https://pw1/a" }, headline: "Hello" },
        { headline: "Hello" },
        "block[1].",
      ),
    };
    expect(effectiveBlockStatus(missing, "page", [], [review])).toBe(
      "unverified",
    );
  });
  it("accepts exact automatic image checks, but metadata differences still require review", () => {
    const check = {
      ...review,
      check: { status: "same-file" as const, detail: "SHA" },
      altMatches: true,
      dimensionsMatch: true,
    };
    expect(effectiveBlockStatus(block, "page", [check], [])).toBe("match");
    expect(
      effectiveBlockStatus(
        block,
        "page",
        [{ ...check, dimensionsMatch: false }],
        [],
      ),
    ).toBe("mismatch");
  });
});
