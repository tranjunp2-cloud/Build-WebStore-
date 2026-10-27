import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import * as schema from "../database/schema";
import { formatUsageReport, usageSummaryQuery, withHitRatio } from "./usage-summary";

const row = {
	task: "seo.fix-meta",
	provider: "deepseek",
	model: "deepseek-flash",
	calls: 4,
	errors: 1,
	inputTokens: 4800,
	cachedInputTokens: 3600,
	costUsdMicros: 372,
	unpricedCalls: 0,
};

describe("usage report [TC-AICP-35]", () => {
	it("aggregates per task + provider + model since N days ago, errors counted apart, optional org filter", () => {
		const db = drizzle.mock({ schema });
		const now = new Date("2026-10-20T00:00:00Z");
		const query = usageSummaryQuery(db, { days: 7, organizationId: "org_1", now }).toSQL();

		expect(query.sql).toMatch(/from "ai_usage_events"/);
		expect(query.sql).toMatch(/group by "ai_usage_events"\."task", "ai_usage_events"\."provider", "ai_usage_events"\."model"/);
		expect(query.sql).toMatch(/count\(\*\) filter \(where ("ai_usage_events"\.)?"outcome" <> 'error'\)/);
		expect(query.sql).toMatch(/sum\(("ai_usage_events"\.)?"cached_input_tokens"\)/);
		expect(query.params).toEqual([new Date("2026-10-13T00:00:00Z").toISOString(), "org_1"]);
		expect(usageSummaryQuery(db, { days: 1, now }).toSQL().params).toHaveLength(1);
	});

	it("derives the hit ratio from cached / total input tokens", () => {
		expect(withHitRatio(row).hitRatio).toBe(0.75);
		expect(withHitRatio({ ...row, inputTokens: 0, cachedInputTokens: 0 }).hitRatio).toBe(0);
	});

	it("prints an aligned table with hit %, USD cost and unpriced calls", () => {
		const table = formatUsageReport([
			withHitRatio(row),
			withHitRatio({ ...row, task: "agent.merchant-copilot", provider: "compat-local", model: "gpt-5.4-mini", unpricedCalls: 2, costUsdMicros: 0 }),
		]);
		const lines = table.split("\n");
		expect(lines[0]).toMatch(/^task\s+provider:model\s+calls\s+errors\s+input\s+cached\s+hit %\s+cost USD$/);
		expect(lines[2]).toMatch(/^seo\.fix-meta\s+deepseek:deepseek-flash\s+4\s+1\s+4800\s+3600\s+75\.0\s+0\.0004$/);
		expect(lines[3]).toContain("0.0000 (+2 unpriced)");
		expect(formatUsageReport([])).toBe("No AI usage recorded in this window.");
	});
});
