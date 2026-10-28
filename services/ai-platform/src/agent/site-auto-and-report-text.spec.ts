import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { capabilitySet } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps } from "./merchant-tools";

// TC-AICP-280 — website tools away from the site editor (dashboard dock, campaign): the model passes siteId "auto"
// (the workspace's website) instead of refusing because the Context line has no site; the schema accepts it and the
// instructions say so (also in the campaign recipe).
// TC-AICP-281 — report wording: the model names the days in Malaysia time and never promises the dashboard revenue card
// (UTC days) matches its numbers.

const deps = (): MerchantToolDeps =>
	({ runId: "run_1", newChangeSetId: () => "cs_1", now: () => new Date("2026-10-22T04:00:00Z"), stage: vi.fn(async () => undefined), allowEdit: () => true, createdInChat: () => [] }) as unknown as MerchantToolDeps;

describe("site tools without a site in the Context line [TC-AICP-280]", () => {
	const tools = createMerchantTools(deps(), capabilitySet(["site"])) as Record<string, { inputSchema: { safeParse: (v: unknown) => { success: boolean }; description?: string } }>;

	it('accepts siteId "auto" in the read and in the change tools', () => {
		const read = { view: "pages", siteId: "auto", pageId: null, blockId: null, query: null };

		expect(tools.site_read?.inputSchema.safeParse(read).success).toBe(true);
		const description = (z.toJSONSchema(tools.site_read?.inputSchema as unknown as z.ZodType, { io: "input", unrepresentable: "any" }) as { properties: Record<string, { description?: string }> }).properties.siteId?.description;
		expect(description).toContain('pass "auto"');
		expect(description).toContain("several websites");
	});

	it("tells the model what auto means in the instructions of the site capability, and not in a set without it", () => {
		const text = merchantInstructions(capabilitySet(["site"]));

		expect(text).toContain('pass siteId "auto" to every site tool');
		expect(text).toContain("never tell the merchant the page does not identify a website");
		expect(merchantInstructions(capabilitySet(["store_reports"]))).not.toContain('siteId "auto"');
	});

	it("uses auto in the campaign recipe for the homepage banner", () => {
		const text = merchantInstructions(capabilitySet(["campaigns", "store_discounts", "site"]));

		expect(text).toContain('propose_page_patch — insert_block of a promo on the homepage (siteId "auto" away from the editor');
	});
});

describe("report wording [TC-AICP-281]", () => {
	const text = merchantInstructions(capabilitySet(["store_reports"]));

	it("names days in Malaysia time and never promises the dashboard card matches", () => {
		expect(text).toContain("Name the days in Malaysia time (UTC+8)");
		expect(text).toContain("cuts its days in UTC");
		expect(text).toContain("never promise they match");
		expect(text).toContain("quote completedRevenue as the closest figure");
	});
});
