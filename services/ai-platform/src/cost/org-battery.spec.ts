import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { AgentError } from "../agent/agent-errors";
import { ImageService, IMAGE_TASK } from "../images/image.service";
import { InMemoryPictureQuota } from "../images/picture-quota";
import { UNPRICED_FALLBACK_RATES } from "../ledger/price-book";
import { testEnv } from "../testing/test-app";
import { batteryEmptyMessage, computeBattery, DrizzleBatterySource, OrgBattery, type BatterySource, type SpendRow } from "./org-battery";

// TC-AIBAT-01..04 — the per-shop AI battery: spend math, nextFreeAt, 30 s cache, fail-open, the 429 time message.

const NOW = new Date("2026-10-26T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BUDGET = 1_000_000;
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * HOUR);

describe("computeBattery [TC-AIBAT-01]", () => {
	it("is full with no spend and has no next time", () => {
		expect(computeBattery(0, BUDGET, [])).toEqual({ leftPercent: 100, nextFreeAt: null, empty: false });
	});

	it("rounds percent left and clamps to 0..100", () => {
		expect(computeBattery(333_333, BUDGET, [{ createdAt: at(1), micros: 333_333 }]).leftPercent).toBe(67);
		expect(computeBattery(5_000_000, BUDGET, []).leftPercent).toBe(0);
		expect(computeBattery(-5, BUDGET, []).leftPercent).toBe(100);
	});

	it("not empty: nextFreeAt is the oldest spend + 24 h", () => {
		const rows: SpendRow[] = [{ createdAt: at(5), micros: 100_000 }, { createdAt: at(1), micros: 200_000 }];
		const out = computeBattery(300_000, BUDGET, rows);
		expect(out).toEqual({ leftPercent: 70, nextFreeAt: new Date(at(5).getTime() + DAY), empty: false });
	});

	it("empty: nextFreeAt is when enough of the oldest rows age out to drop under the budget", () => {
		// 1.3 USD spent: dropping the 0.2 row leaves 1.1 (still empty); dropping the 0.4 row leaves 0.7 -> free
		const rows: SpendRow[] = [
			{ createdAt: at(20), micros: 200_000 },
			{ createdAt: at(10), micros: 400_000 },
			{ createdAt: at(2), micros: 700_000 },
		];
		const out = computeBattery(1_300_000, BUDGET, rows);
		expect(out.empty).toBe(true);
		expect(out.leftPercent).toBe(0);
		expect(out.nextFreeAt).toEqual(new Date(at(10).getTime() + DAY));
	});

	it("empty with no readable rows: no time", () => {
		expect(computeBattery(2_000_000, BUDGET, []).nextFreeAt).toBeNull();
	});
});

describe("batteryEmptyMessage [TC-AIBAT-02]", () => {
	it("formats the time as HH:MM in Asia/Kuala_Lumpur, 24 h", () => {
		expect(batteryEmptyMessage(new Date("2026-10-26T06:30:00Z"))).toBe("AI is out for today. It's back at 14:30. Upgrade your plan for more.");
		expect(batteryEmptyMessage(new Date("2026-10-26T16:05:00Z"))).toBe("AI is out for today. It's back at 00:05. Upgrade your plan for more.");
	});

	it("falls back to a generic line without a time", () => {
		expect(batteryEmptyMessage(null)).toBe("AI is out for today. Please try again later. Upgrade your plan for more.");
	});
});

describe("OrgBattery [TC-AIBAT-03]", () => {
	const source = (spent: number, rows: SpendRow[] = []) => ({
		spent: vi.fn(async () => spent),
		rows: vi.fn(async () => rows),
	}) satisfies BatterySource;

	it("refuses with 429 and the time when spent reaches the budget", async () => {
		const battery = new OrgBattery(source(1_000_000, [{ createdAt: at(18), micros: 1_000_000 }]), () => NOW.getTime());
		const error = await battery.assertAvailable("org_1", BUDGET).catch((e) => e);
		expect(error).toBeInstanceOf(AgentError);
		expect((error as AgentError).status).toBe(429);
		expect((error as AgentError).message).toBe("AI is out for today. It's back at 00:00. Upgrade your plan for more.");
	});

	it("lets requests through under budget and does not read rows with no spend", async () => {
		const src = source(0);
		await expect(new OrgBattery(src, () => NOW.getTime()).assertAvailable("org_1", BUDGET)).resolves.toBeUndefined();
		expect(src.rows).not.toHaveBeenCalled();
	});

	it("caches per org for 30 s, then reads again", async () => {
		let now = NOW.getTime();
		const src = source(10);
		const battery = new OrgBattery(src, () => now);
		await battery.status("org_1", BUDGET);
		await battery.status("org_1", BUDGET);
		await battery.status("org_2", BUDGET);
		expect(src.spent).toHaveBeenCalledTimes(2);
		now += 31_000;
		await battery.status("org_1", BUDGET);
		expect(src.spent).toHaveBeenCalledTimes(3);
	});

	it("applies the budget passed per call to the one cached spend reading", async () => {
		const src = source(600_000, [{ createdAt: at(3), micros: 600_000 }]);
		const battery = new OrgBattery(src, () => NOW.getTime());
		expect(await battery.status("org_1", 1_000_000)).toMatchObject({ leftPercent: 40, empty: false });
		expect(await battery.status("org_1", 500_000)).toMatchObject({ leftPercent: 0, empty: true });
		expect(await battery.status("org_1", 2_000_000)).toMatchObject({ leftPercent: 70, empty: false });
		expect(src.spent).toHaveBeenCalledTimes(1);
		await expect(battery.assertAvailable("org_1", 500_000)).rejects.toMatchObject({ status: 429 });
	});

	it("unlimited (null) is never empty, reads nothing and shows 100 %", async () => {
		const src = source(99_000_000);
		const battery = new OrgBattery(src, () => NOW.getTime());
		expect(await battery.status("org_1", null)).toEqual({ leftPercent: 100, nextFreeAt: null, empty: false });
		await expect(battery.assertAvailable("org_1", null)).resolves.toBeUndefined();
		expect(src.spent).not.toHaveBeenCalled();
	});

	it("a zero budget is always empty at 0 %", async () => {
		expect(computeBattery(0, 0, [])).toEqual({ leftPercent: 0, nextFreeAt: null, empty: true });
	});

	it("lets the request through when the read fails", async () => {
		const battery = new OrgBattery({ spent: async () => Promise.reject(new Error("db down")), rows: async () => [] });
		await expect(battery.assertAvailable("org_1", BUDGET)).resolves.toBeUndefined();
	});
});

describe("DrizzleBatterySource query [TC-AIBAT-04]", () => {
	function capture() {
		const queries: { sql: string; params: unknown[] }[] = [];
		const dialect = new PgDialect();
		const db = {
			execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
				queries.push(dialect.sqlToQuery(query));
				return { rows: [] };
			},
		};
		return { queries, source: new DrizzleBatterySource(db as never) };
	}

	it("excludes pictures, counts every outcome, and prices null-cost rows at the fallback rates", async () => {
		const { queries, source } = capture();
		await source.spent("org_1", NOW);
		await source.rows("org_1", NOW, 5000);

		for (const q of queries) {
			expect(q.params).toContain(IMAGE_TASK);
			expect(q.sql).toMatch(/"task" <> \$/);
			expect(q.sql).toContain("COALESCE(");
			expect(q.sql).not.toContain('"outcome"');
			expect(q.sql).not.toContain("cache_write_tokens");
			expect(q.params).toEqual(expect.arrayContaining([UNPRICED_FALLBACK_RATES.input, UNPRICED_FALLBACK_RATES.cachedInput, UNPRICED_FALLBACK_RATES.output]));
		}
		expect(queries[1]?.sql).toMatch(/order by .*created_at.* asc limit/i);
	});

	it("an empty battery does not touch picture generation", async () => {
		// ImageService has no battery dependency: pictures stay on their own count
		const empty = new OrgBattery({ spent: async () => 9_000_000, rows: async () => [] });
		await expect(empty.assertAvailable("org_1", BUDGET)).rejects.toBeInstanceOf(AgentError);
		const service = new ImageService({ resolveChain: () => [], resolveImageChain: () => [] }, { record: async () => {}, countSince: async () => 0 }, testEnv(), new InMemoryPictureQuota(0));
		// not refused by the battery: the only refusal is "pictures are off" (no model configured), never the 429
		const error = await service.generate({ organizationId: "org_1", userId: "u" }, { prompt: "a cover photo" }).catch((e) => e);
		expect(error).toBeInstanceOf(AgentError);
		expect((error as AgentError).message).not.toMatch(/out for today/);
	});
});
