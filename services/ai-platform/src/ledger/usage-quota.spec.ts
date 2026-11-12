import { describe, expect, it, vi } from "vitest";
import { OrgBattery } from "../cost/org-battery";
import { SpendGuard } from "../cost/spend-guard";
import { testEnv } from "../testing/test-app";
import { type Meter, type UsageMeters, UsageQuotaService } from "./usage-quota";

// TC-AIUSE-01..03 — GET /agent/usage: { ai: { leftPercent, nextFreeAt }, pictures: { used, limit, nextFreeAt }, paused }.
// No dollars, no request counts; pictures keep their count; paused comes from the global spend guard.

const NOW = new Date("2026-10-26T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const empty: Meter = { used: 0, oldest: null };

function meters(pictures: Meter = empty) {
	const calls: { org: string; since: Date }[] = [];
	return {
		calls,
		meters: {
			pictures: async (org: string, since: Date) => {
				calls.push({ org, since });
				return pictures;
			},
		} satisfies UsageMeters,
	};
}

const ctx = { organizationId: "org_1" };
const battery = (spentMicros: number, rows: { createdAt: Date; micros: number }[] = []) =>
	new OrgBattery({ spent: async () => spentMicros, rows: async () => rows }, () => NOW.getTime());

describe("UsageQuotaService shape [TC-AIUSE-01]", () => {
	it("reports the AI battery in percent and the pictures as a count over a rolling 24 h window", async () => {
		// Arrange
		const oldest = new Date("2026-10-25T14:30:00Z");
		const oldestAi = new Date("2026-10-26T09:00:00Z");
		const { meters: m, calls } = meters({ used: 3, oldest });
		const service = new UsageQuotaService(m, testEnv({ AI_DAILY_IMAGE_LIMIT_PER_ORG: "20" }), undefined, battery(250_000, [{ createdAt: oldestAi, micros: 250_000 }]));

		// Act
		const usage = await service.read(ctx, NOW);

		// Assert
		expect(usage).toEqual({
			ai: { leftPercent: 75, nextFreeAt: "2026-10-27T09:00:00.000Z" },
			pictures: { used: 3, limit: 20, nextFreeAt: "2026-10-26T14:30:00.000Z" },
			paused: false,
			plan: null,
		});
		expect(calls).toEqual([{ org: "org_1", since: new Date(NOW.getTime() - DAY) }]);
	});

	it("is full with no spend, empty with a time when spent, and has no assistant/writing/dollar fields", async () => {
		const fresh = await new UsageQuotaService(meters().meters, testEnv(), undefined, battery(0)).read(ctx, NOW);
		expect(fresh).toEqual({ ai: { leftPercent: 100, nextFreeAt: null }, pictures: { used: 0, limit: 20, nextFreeAt: null }, paused: false, plan: null });

		const rows = [{ createdAt: new Date("2026-10-26T01:00:00Z"), micros: 600_000 }, { createdAt: new Date("2026-10-26T02:00:00Z"), micros: 600_000 }];
		const out = await new UsageQuotaService(meters().meters, testEnv(), undefined, battery(1_200_000, rows)).read(ctx, NOW);
		expect(out.ai).toEqual({ leftPercent: 0, nextFreeAt: "2026-10-27T01:00:00.000Z" });
		expect(Object.keys(out).sort()).toEqual(["ai", "paused", "pictures", "plan"]);
	});

	it("shows a full battery when the ledger cannot be read", async () => {
		const broken = new OrgBattery({ spent: async () => Promise.reject(new Error("db down")), rows: async () => [] });
		const out = await new UsageQuotaService(meters().meters, testEnv(), undefined, broken).read(ctx, NOW);
		expect(out.ai).toEqual({ leftPercent: 100, nextFreeAt: null });
	});
});

describe("plan limits from the token [TC-AIUSE-04]", () => {
	const limited = (aiBudgetUsd: number | null, picturesPerDay: number | null) => ({ organizationId: "org_1", limits: { plan: "pro", aiBudgetUsd, picturesPerDay } });

	it("reports the plan, measures the battery against its budget and the pictures against its cap", async () => {
		const service = new UsageQuotaService(meters({ used: 4, oldest: null }).meters, testEnv(), undefined, battery(500_000));
		const out = await service.read(limited(2, 40), NOW);
		expect(out.plan).toBe("pro");
		expect(out.ai.leftPercent).toBe(75);
		expect(out.pictures.limit).toBe(40);
	});

	it("unlimited: pictures limit null and a full battery whatever was spent", async () => {
		const service = new UsageQuotaService(meters({ used: 4, oldest: null }).meters, testEnv(), undefined, battery(900_000_000));
		const out = await service.read(limited(null, null), NOW);
		expect(out.pictures.limit).toBeNull();
		expect(out.ai).toEqual({ leftPercent: 100, nextFreeAt: null });
	});

	it("falls back to the env limits with no claim", async () => {
		const service = new UsageQuotaService(meters().meters, testEnv({ AI_DAILY_IMAGE_LIMIT_PER_ORG: "7", AI_DAILY_BUDGET_USD_PER_ORG: "2" }), undefined, battery(1_000_000));
		const out = await service.read(ctx, NOW);
		expect(out.pictures.limit).toBe(7);
		expect(out.ai.leftPercent).toBe(50);
	});
});

describe("paused [TC-AIUSE-02]", () => {
	const guard = (budget: number | undefined, spent: () => Promise<number>) => new SpendGuard(budget, spent, () => NOW.getTime());
	const read = (spend?: SpendGuard) => new UsageQuotaService(meters().meters, testEnv(), spend).read(ctx, NOW);

	it("is true at or above the budget, false under it, off or unreadable", async () => {
		expect((await read(guard(5, async () => 5_000_000))).paused).toBe(true);
		expect((await read(guard(5, async () => 4_990_000))).paused).toBe(false);
		expect((await read(guard(undefined, async () => 99_000_000))).paused).toBe(false);
		expect((await read(guard(5, async () => Promise.reject(new Error("db down"))))).paused).toBe(false);
		expect((await read()).paused).toBe(false);
	});

	it("shares the guard's 60 s cache", async () => {
		const source = vi.fn(async () => 1_000_000);
		const spend = guard(5, source);
		await read(spend);
		await read(spend);
		expect(source).toHaveBeenCalledTimes(1);
	});
});
