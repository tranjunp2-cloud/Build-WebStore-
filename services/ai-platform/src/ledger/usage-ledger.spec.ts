import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { UNPRICED_FALLBACK_RATES } from "./price-book";
import { DrizzleUsageLedger } from "./usage-ledger";

// TC-AIPRC-10 — the global spend guard counts unpriced rows exactly as the shop battery does; record() prices cache writes without storing them.

function fakeDb() {
	const dialect = new PgDialect();
	const out: { query?: { sql: string; params: unknown[] }; inserted?: Record<string, unknown> } = {};
	const db = {
		select: (fields: { value: Parameters<PgDialect["sqlToQuery"]>[0] }) => {
			out.query = dialect.sqlToQuery(fields.value);
			return { from: () => ({ where: async () => [{ value: "123" }] }) };
		},
		insert: () => ({ values: async (row: Record<string, unknown>) => void (out.inserted = row) }),
	};
	return { out, ledger: new DrizzleUsageLedger(db as never) };
}

describe("DrizzleUsageLedger [TC-AIPRC-10]", () => {
	it("costSinceMicros sums the recorded price, else tokens at the fallback rates", async () => {
		const { ledger, out } = fakeDb();
		expect(await ledger.costSinceMicros(new Date("2026-10-26T00:00:00Z"))).toBe(123);
		expect(out.query?.sql).toContain("COALESCE(");
		expect(out.query?.sql).toContain('"cost_usd_micros"');
		expect(out.query?.params).toEqual(expect.arrayContaining([UNPRICED_FALLBACK_RATES.input, UNPRICED_FALLBACK_RATES.cachedInput, UNPRICED_FALLBACK_RATES.output]));
	});

	it("record stores the price including cache writes, and no cache-write column", async () => {
		const { ledger, out } = fakeDb();
		await ledger.record({
			organizationId: "org_1", surface: "merchant", task: "agent.step", provider: "anthropic", model: "claude-sonnet-5-5",
			inputTokens: 1_000_000, cacheWriteTokens: 1_000_000, outputTokens: 0, latencyMs: 1, outcome: "ok",
		});
		expect(out.inserted?.costUsdMicros).toBe(2_500_000);
		expect(out.inserted).not.toHaveProperty("cacheWriteTokens");
	});
});
