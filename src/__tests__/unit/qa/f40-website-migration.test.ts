// @vitest-environment node
import { mergeFooterSocialsWithSite } from "@/lib/site-settings";
import { describe, it, expect } from "vitest";
import { compareMigrationContent } from "@/lib/admin/qa/website-migration-compare";
import { sanitizeMigrationSourceUrl } from "@/lib/admin/qa/website-migration-url";
import { parsePw1ConnectionInput } from "@/lib/admin/qa/pw1-connection-input";
import { fieldEvidenceRates, needsFieldReview } from '@/lib/admin/qa/field-evidence-summary';

describe('[TC-F40-MIG-LIVE-08] field evidence rates', () => {
  it('reserves 100 percent for exact match and complete coverage', () => {
    // Arrange
    const counts = { match: 19999, mismatch: 1, missing: 0, duplicate: 0, unsupported: 0, unverified: 0 };

    // Act
    const rates = fieldEvidenceRates(counts);

    // Assert
    expect(rates.matchExpected).toBe(99.9);
    expect(rates.matchRate).toBe(99.9);
    expect(fieldEvidenceRates({ ...counts, mismatch: 0, unverified: 1 }).coverage).toBe(99.9);
    expect(fieldEvidenceRates({ ...counts, mismatch: 0 })).toEqual({ total: 19999, checked: 19999, coverage: 100, matchRate: 100, matchExpected: 100 });
  });
  it('does not inflate coverage by excluding unsupported or unverified fields', () => {
    // Arrange
    const counts = { match: 76, mismatch: 2, missing: 1, duplicate: 1, unsupported: 15, unverified: 5 };

    // Act
    const rates = fieldEvidenceRates(counts);

    // Assert
    expect(rates).toEqual({ total: 100, checked: 80, coverage: 80, matchRate: 95, matchExpected: 76 });
  });
  it('does not claim pass when nothing was checked or evidence is unavailable', () => {
    // Arrange / Act
    const unchecked = fieldEvidenceRates({ match: 0, mismatch: 0, missing: 0, duplicate: 0, unsupported: 5, unverified: 1 });
    const empty = fieldEvidenceRates({ match: 0, mismatch: 0, missing: 0, duplicate: 0, unsupported: 0, unverified: 0 });

    // Assert
    expect(unchecked.matchRate).toBeNull();
    expect(unchecked.matchExpected).toBe(0);
    expect(empty.coverage).toBeNull();
    expect(empty.matchExpected).toBeNull();
    expect(needsFieldReview(null)).toBe(true);
  });
});

describe("[TC-F40-MIG-LIVE-02] PW1 connection form validation", () => {
  const approved = "mysql://server-user:server-password@pw1.example:3306/legacy";
  it("uses entered credentials without changing the approved endpoint", () => {
    expect(parsePw1ConnectionInput({ url: "mysql://tester:test%40password@pw1.example/qa" }, approved)).toEqual({ host: "pw1.example", port: 3306, user: "tester", password: "test@password", database: "qa" });
  });
  it("rejects arbitrary hosts, ports and URL options", () => {
    for (const url of ["mysql://user:pw@127.0.0.1/db", "mysql://user:pw@pw1.example:1234/db", "mysql://user:pw@pw1.example/db?socketPath=/tmp/mysql.sock", "https://pw1.example/db"]) {
      expect(() => parsePw1ConnectionInput({ url }, approved)).toThrow();
    }
  });
  it("rejects missing configuration or incomplete fields", () => {
    expect(() => parsePw1ConnectionInput({}, undefined)).toThrow();
    expect(() => parsePw1ConnectionInput({ host: "pw1.example", user: "tester" }, approved)).toThrow();
  });
});

describe("[TC-F40-MIG-LIVE-07] source URL safety", () => {
  it('accepts public DNS names starting with fc and fd', () => {
    for (const url of ['https://fcoffee.example/', 'https://fdesign.example/']) {
      expect(sanitizeMigrationSourceUrl(url)).toBe(url);
    }
  });
  it("retains only clean public HTTPS URLs for explicit click-through", () => {
    expect(sanitizeMigrationSourceUrl("https://merchant.example/path")).toBe(
      "https://merchant.example/path",
    );
    for (const value of [
      "javascript:alert(1)",
      "http://merchant.example/path",
      "https://user:password@merchant.example/path",
      "https://merchant.example/path?token=secret",
      "https://127.0.0.1/private",
      "https://192.168.1.10/private",
      "https://localhost/private",
      "https://[::ffff:127.0.0.1]/private",
      "https://[::ffff:192.168.1.1]/private",
    ]) expect(sanitizeMigrationSourceUrl(value)).toBeNull();
  });
});

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
  it("treats an omitted optional field and a null destination field as the same", () => {
    const source = { items: [{ title: "Slide", description: "" }] };
    expect(
      compareMigrationContent(source, {
        items: [{ id: "pw2", title: "Slide", description: "", linkUrl: null }],
      })[0].status,
    ).toBe("match");
    expect(
      compareMigrationContent(
        { items: [{ title: "Slide", linkUrl: "/products" }] },
        { items: [{ title: "Slide", linkUrl: null }] },
      )[0].status,
    ).toBe("mismatch");
    expect(
      compareMigrationContent(
        { items: [{ title: "Slide" }] },
        { items: [{ title: "Slide", linkUrl: "/extra" }] },
      )[0].status,
    ).toBe("mismatch");
  });
  it("applies the null-equals-omitted rule inside nested objects but not to a missing top-level field", () => {
    expect(
      compareMigrationContent(
        { items: [{ cta: { label: "Buy" } }] },
        { items: [{ cta: { label: "Buy", url: null } }] },
      )[0].status,
    ).toBe("match");
    expect(
      compareMigrationContent(
        { items: [{ cta: { label: "Buy", url: "/shop" } }] },
        { items: [{ cta: { label: "Buy", url: null } }] },
      )[0].status,
    ).toBe("mismatch");
    expect(compareMigrationContent({ logo: "/a.png" }, {})[0].status).toBe(
      "unverified",
    );
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

describe("[TC-F40-MIG-LIVE-01] reported T006 carousel evidence", () => {
  const source = JSON.stringify([
    {
      image: {
        alt: "Where does it come from?",
        url: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/f009-4/banner/banner_3.png",
      },
      title: "Where does it come from?",
      description: "",
    },
  ]);
  const current = JSON.stringify([
    {
      id: "6ac95226e77979e1f42905fd",
      image: {
        id: 90726,
        url: "https://sgp1.digitaloceanspaces.com/tm-prime-web-dev/pw1-159-1b8f22436989eb6ed882.jpg",
        alt: "Where does it come from?",
        filename: "pw1-159-1b8f22436989eb6ed882.jpg",
        mimeType: "image/png",
        filesize: 244272,
        width: 1170,
        height: 780,
      },
      title: "Where does it come from?",
      description: "",
      linkUrl: null,
    },
  ]);
  const field = "block[5].items";
  const block = (): MigrationBlock => ({
    sourceId: "273",
    kind: "banner",
    indexes: [5],
    sourceContent: [],
    status: "mismatch",
    fields: [
      {
        field,
        source,
        current,
        status: compareMigrationContent(
          { items: JSON.parse(source) },
          { items: JSON.parse(current) },
        )[0].status,
      },
    ],
  });
  it("is no longer a data mismatch; the re-hosted image still needs verification", () => {
    // Raw comparison still differs because the re-hosted image has new media
    // metadata; only the image-aware layer may resolve it.
    expect(block().fields[0].status).toBe("mismatch");
    expect(
      compareMigrationContent(
        {
          items: JSON.parse(source).map((item: Record<string, unknown>) => ({
            ...item,
            image: "[image]",
          })),
        },
        {
          items: JSON.parse(current).map((item: Record<string, unknown>) => ({
            ...item,
            image: "[image]",
          })),
        },
      )[0].status,
    ).toBe("match");
    expect(effectiveBlockStatus(block(), "page", [], [])).toBe("unverified");
  });
  it("matches once the re-hosted image is confirmed", () => {
    const [image] = imagePreviews(field, source);
    const review = { page: "page", block: "273", field, path: image.path };
    expect(effectiveBlockStatus(block(), "page", [], [review])).toBe("match");
  });
});
