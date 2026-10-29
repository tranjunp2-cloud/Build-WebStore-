import { Logger } from "@nestjs/common";
import { SignJWT } from "jose";
import { MockImageModelV4, MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentError } from "../agent/agent-errors";
import { AgentRunService } from "../agent/agent-run.service";
import { AgentThreadService } from "../agent/agent-thread.service";
import { type AiRequestContext, CONTEXT_TOKEN_AUDIENCE, CONTEXT_TOKEN_ISSUER, verifyContextToken } from "../auth/context-token";
import { ImageService } from "../images/image.service";
import { InMemoryPictureQuota } from "../images/picture-quota";
import { UsageQuotaService } from "../ledger/usage-quota";
import type { ModelRegistry } from "../models/model-registry";
import { TaskEngine } from "../tasks/task-engine.service";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AiConfigService, parseAiConfig } from "../ai-config/ai-config.service";
import { toPlatformCaps, type PlatformCaps } from "./platform-caps";
import { AI_BLOCKED_MESSAGE, AI_DISABLED_MESSAGE, assertAiEnabled } from "./shop-limits";
import { MONTH_EMPTY_MESSAGE, SITE_EMPTY_MESSAGE, ShopCaps, type ShopCapsSource } from "./shop-caps";
import { monthStart, PAUSED_MESSAGE, PAUSED_MONTH_MESSAGE, SpendGuard } from "./spend-guard";

// TC-AICAP-01..11 — AI caps in layers: the `lim` claim (old tokens still work), AI off for a plan (403), the shop's
// calendar-month and website-setup allowances (429), the platform caps from Payload (daily override of the env,
// null = off, monthly, pause Free first, runtime change).

const usd = (n: number) => n * 1_000_000;
const NOW = new Date("2026-10-29T04:00:00Z"); // 12:00 in Kuala Lumpur
const secret = "test-context-secret-at-least-32-characters";

const base: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "o@shop.my", role: "owner" };
const withLimits = (limits: Partial<NonNullable<AiRequestContext["limits"]>> = {}): AiRequestContext => ({
	...base,
	limits: { plan: "PRO", aiBudgetUsd: null, picturesPerDay: null, ...limits },
});

const caps = (over: Partial<PlatformCaps> = {}): PlatformCaps => ({ dailyUsd: undefined, monthlyUsd: undefined, alertPercents: [50, 80, 100], pauseFreeAtPercent: null, ...over });

afterEach(() => vi.restoreAllMocks());

async function sign(claims: Record<string, unknown>) {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(CONTEXT_TOKEN_ISSUER)
		.setAudience(CONTEXT_TOKEN_AUDIENCE)
		.setSubject("usr_1")
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(new TextEncoder().encode(secret));
}

// ---------------------------------------------------------------- harnesses

const model = () => new MockLanguageModelV4();
const registry: ModelRegistry = { resolveChain: () => [{ provider: "openai", modelId: "gpt-4.1-mini", model: model() }] };
const ledger = { record: async () => undefined, countSince: async () => 0 };

function runs(parts: { spend?: SpendGuard; caps?: ShopCaps } = {}) {
	const env = testEnv();
	const store = new InMemoryAgentStore();
	const reserve = vi.spyOn(store, "reserveRunStart");
	const service = new AgentRunService(store, registry, ledger, env, new AgentThreadService(store, env), undefined, undefined, undefined, parts.spend, undefined, parts.caps);
	return { service, reserve };
}

function tasks(parts: { spend?: SpendGuard; caps?: ShopCaps } = {}) {
	const countSince = vi.fn(async () => 0);
	const resolveChain = vi.fn(() => []);
	const engine = new TaskEngine({ resolveChain }, { record: async () => undefined, countSince }, testEnv(), parts.spend, undefined, parts.caps);
	return { engine, countSince, resolveChain };
}

function pictures(parts: { spend?: SpendGuard } = {}) {
	const doGenerate = vi.fn(async () => ({ images: ["iVBORw0KGgo="], warnings: [], response: { timestamp: new Date(), modelId: "img", headers: undefined } }));
	const imageModel = new MockImageModelV4({ doGenerate, maxImagesPerCall: 2 });
	const reg: ModelRegistry = { resolveChain: () => [], resolveImageChain: () => [{ model: imageModel, provider: "openai", modelId: "gpt-image-1" }] };
	const quota = new InMemoryPictureQuota();
	return { service: new ImageService(reg, ledger, testEnv(), quota, parts.spend), doGenerate, quota };
}

const TRANSLATE = ["content.translate", { targetLocale: "ms-MY", fields: { name: "x" } }] as const;

// ---------------------------------------------------------------- 01 token

describe("the `lim` claim [TC-AICAP-01]", () => {
	const lim = { plan: "PRO", aiBudgetUsd: 5, picturesPerDay: 50 };

	it("TC-AICAP-01: parses enabled, monthly budget, site budget and source", async () => {
		// Arrange
		const full = { ...lim, enabled: false, aiBudgetUsdMonthly: 40, siteBudgetUsd: null, source: "shop" };

		// Act
		const ctx = await verifyContextToken(await sign({ org: "o", lim: full }), secret);

		// Assert
		expect(ctx.limits).toEqual(full);
	});

	it("TC-AICAP-01: an old token without the new fields still works and runs as enabled and unlimited", async () => {
		// Arrange / Act
		const ctx = await verifyContextToken(await sign({ org: "o", lim }), secret);

		// Assert
		expect(ctx.limits).toEqual(lim);
		await expect(runs().service.reserve(ctx, {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
	});

	it.each([
		["negative monthly budget", { ...lim, aiBudgetUsdMonthly: -1 }],
		["unknown source", { ...lim, source: "admin" }],
		["non-boolean enabled", { ...lim, enabled: "no" }],
	])("TC-AICAP-01: refuses a malformed claim (%s)", async (_name, bad) => {
		await expect(verifyContextToken(await sign({ org: "o", lim: bad }), secret)).rejects.toThrow("missing required claims");
	});
});

// ---------------------------------------------------------------- 02 disabled

describe("AI off for the plan [TC-AICAP-02]", () => {
	const off = withLimits({ enabled: false, aiBudgetUsd: 5 });

	it("TC-AICAP-02: a shop blocked by an override is told so, not sent to upgrade its plan", () => {
		// Arrange
		const blocked = withLimits({ enabled: false, aiBudgetUsd: 5, source: "shop" });
		// Act + Assert
		expect(() => assertAiEnabled(blocked)).toThrow(AI_BLOCKED_MESSAGE);
		expect(() => assertAiEnabled(off)).toThrow(AI_DISABLED_MESSAGE);
	});

	it("TC-AICAP-02: refuses a copilot start with 403 before anything is reserved or any guard is read", async () => {
		// Arrange
		const source = vi.fn(async () => 0);
		const { service, reserve } = runs({ spend: new SpendGuard(10, source, () => NOW.getTime()) });

		// Act + Assert
		await expect(service.reserve(off, {}, NOW)).rejects.toMatchObject({ status: 403, message: AI_DISABLED_MESSAGE });
		await expect(service.reserve(off, {}, NOW)).rejects.toBeInstanceOf(AgentError);
		expect(reserve).not.toHaveBeenCalled();
		expect(source).not.toHaveBeenCalled();
	});

	it("TC-AICAP-02: refuses a task with 403 before its quota check or any model call", async () => {
		// Arrange
		const { engine, countSince, resolveChain } = tasks();

		// Act + Assert
		await expect(engine.run(off, ...TRANSLATE)).rejects.toMatchObject({ status: 403, message: AI_DISABLED_MESSAGE });
		expect(countSince).not.toHaveBeenCalled();
		expect(resolveChain).not.toHaveBeenCalled();
	});

	it("TC-AICAP-02: refuses a picture with 403, nothing reserved, no provider call", async () => {
		// Arrange
		const { service, doGenerate, quota } = pictures();

		// Act + Assert
		await expect(service.generate(off, { prompt: "a batik scarf on a table" })).rejects.toMatchObject({ status: 403, message: AI_DISABLED_MESSAGE });
		expect(doGenerate).not.toHaveBeenCalled();
		expect(quota.reservations).toHaveLength(0);
	});

	it("TC-AICAP-02: enabled true and an absent flag both pass", async () => {
		// Arrange / Act / Assert
		await expect(runs().service.reserve(withLimits({ enabled: true }), {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
		await expect(runs().service.reserve(withLimits(), {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
		await expect(pictures().service.generate(withLimits({ enabled: true }), { prompt: "a batik scarf on a table" })).resolves.toHaveLength(1);
	});

	it("TC-AICAP-02: /agent/usage reports paused with reason disabled and keeps its other fields", async () => {
		// Arrange
		const meters = { pictures: async () => ({ used: 3, oldest: null }) };
		const service = new UsageQuotaService(meters, testEnv());

		// Act
		const out = await service.read(off, NOW);

		// Assert
		expect(out).toMatchObject({ paused: true, reason: "disabled", plan: "PRO", ai: { leftPercent: 100 }, pictures: { used: 3 } });
		expect(await service.read(withLimits(), NOW)).not.toHaveProperty("reason");
		expect((await service.read(withLimits(), NOW)).paused).toBe(false);
	});
});

// ---------------------------------------------------------------- 03 monthly

describe("the shop's monthly budget [TC-AICAP-03]", () => {
	const source = (spent: number | (() => Promise<number>)): ShopCapsSource & { spent: ReturnType<typeof vi.fn> } => ({
		spent: vi.fn(async () => (typeof spent === "function" ? spent() : spent)),
	});
	const shopCaps = (src: ShopCapsSource, at = NOW) => new ShopCaps(src, () => at.getTime());

	it("TC-AICAP-03: refuses with 429 and the first-of-the-month line once the month's spend reached the budget", async () => {
		// Arrange
		const guard = shopCaps(source(usd(10)));

		// Act + Assert
		await expect(guard.assertAvailable(withLimits({ aiBudgetUsdMonthly: 10 }))).rejects.toMatchObject({ status: 429, message: MONTH_EMPTY_MESSAGE });
		expect(MONTH_EMPTY_MESSAGE).toMatch(/out for this month\. It's back on the 1st/);
		await expect(shopCaps(source(usd(9.99))).assertAvailable(withLimits({ aiBudgetUsdMonthly: 10 }))).resolves.toBeUndefined();
	});

	it("TC-AICAP-03: null or absent means unlimited and reads nothing", async () => {
		// Arrange
		const src = source(usd(999));
		const guard = shopCaps(src);

		// Act
		await guard.assertAvailable(withLimits({ aiBudgetUsdMonthly: null }));
		await guard.assertAvailable(withLimits());
		await guard.assertAvailable(base);

		// Assert
		expect(src.spent).not.toHaveBeenCalled();
	});

	it("TC-AICAP-03: sums from the start of the Malaysia calendar month", async () => {
		// Arrange
		const src = source(0);

		// Act (15:59Z on the 30th is still September in Kuala Lumpur, 16:00Z is October 1st there)
		await shopCaps(src, new Date("2026-09-30T15:59:00Z")).assertAvailable(withLimits({ aiBudgetUsdMonthly: 1 }));
		await shopCaps(src, new Date("2026-09-30T16:00:00Z")).assertAvailable(withLimits({ aiBudgetUsdMonthly: 1 }));

		// Assert
		expect((src.spent.mock.calls[0]?.[1] as Date).toISOString()).toBe("2026-08-31T16:00:00.000Z");
		expect((src.spent.mock.calls[1]?.[1] as Date).toISOString()).toBe("2026-09-30T16:00:00.000Z");
		expect(src.spent.mock.calls[0]?.[2]).toBeUndefined(); // every task counts, no prefix
		expect(monthStart(new Date("2026-10-29T04:00:00Z")).toISOString()).toBe("2026-09-30T16:00:00.000Z");
		expect(monthStart(new Date("2026-12-31T16:30:00Z")).toISOString()).toBe("2026-12-31T16:00:00.000Z");
	});

	it("TC-AICAP-03: a new month starts at 0 at once, the reading is cached 30 s per org, and an unreadable ledger lets the request through", async () => {
		// Arrange
		let at = new Date("2026-09-30T15:00:00Z");
		const src = source(async () => (at.getTime() < Date.parse("2026-09-30T16:00:00Z") ? usd(50) : 0));
		const guard = new ShopCaps(src, () => at.getTime());
		const lim = withLimits({ aiBudgetUsdMonthly: 10 });

		// Act + Assert
		await expect(guard.assertAvailable(lim)).rejects.toMatchObject({ status: 429 });
		await expect(guard.assertAvailable(lim)).rejects.toMatchObject({ status: 429 });
		expect(src.spent).toHaveBeenCalledTimes(1);
		at = new Date("2026-09-30T16:01:00Z");
		await expect(guard.assertAvailable(lim)).resolves.toBeUndefined();
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const broken = shopCaps(source(async () => Promise.reject(new Error("db down"))));
		await expect(broken.assertAvailable(lim)).resolves.toBeUndefined();
	});

	it("TC-AICAP-03: refuses a copilot start (nothing reserved) and a task before any model call", async () => {
		// Arrange
		const full = shopCaps(source(usd(20)));
		const lim = withLimits({ aiBudgetUsdMonthly: 10 });
		const run = runs({ caps: full });
		const task = tasks({ caps: full });

		// Act + Assert
		await expect(run.service.reserve(lim, {}, NOW)).rejects.toMatchObject({ status: 429, message: MONTH_EMPTY_MESSAGE });
		expect(run.reserve).not.toHaveBeenCalled();
		await expect(task.engine.run(lim, ...TRANSLATE)).rejects.toMatchObject({ status: 429, message: MONTH_EMPTY_MESSAGE });
		expect(task.resolveChain).not.toHaveBeenCalled();
	});

	it("TC-AICAP-03: /agent/usage reports month-empty", async () => {
		// Arrange
		const service = new UsageQuotaService({ pictures: async () => ({ used: 0, oldest: null }) }, testEnv(), undefined, undefined, shopCaps(source(usd(11))));

		// Act
		const out = await service.read(withLimits({ aiBudgetUsdMonthly: 10 }), NOW);

		// Assert
		expect(out).toMatchObject({ paused: true, reason: "month-empty" });
	});
});

// ---------------------------------------------------------------- 04 site

describe("the website-setup budget [TC-AICAP-04]", () => {
	const src = (spent: number) => ({ spent: vi.fn(async (_org: string, _since: Date, prefix?: string) => (prefix ? spent : 0)) });

	it("TC-AICAP-04: refuses a sitegen.* task with 429 when the last 24 h of website-setup spend reached the budget", async () => {
		// Arrange
		const source = src(usd(2));
		const caps429 = new ShopCaps(source, () => NOW.getTime());
		const { engine, resolveChain } = tasks({ caps: caps429 });

		// Act + Assert
		await expect(engine.run(withLimits({ siteBudgetUsd: 2 }), "sitegen.personalize", { system: "Personalize.", user: "Kopi, Teh tarik" })).rejects.toMatchObject({ status: 429 });
		await expect(caps429.assertAvailable(withLimits({ siteBudgetUsd: 2 }), "sitegen.site-plan")).rejects.toMatchObject({ status: 429, message: SITE_EMPTY_MESSAGE });
		expect(resolveChain).not.toHaveBeenCalled();
		const [, since, prefix] = source.spent.mock.calls[0] as [string, Date, string];
		expect(prefix).toBe("sitegen.");
		expect(NOW.getTime() - since.getTime()).toBe(24 * 60 * 60 * 1000);
	});

	it("TC-AICAP-04: is not checked for other tasks or the copilot", async () => {
		// Arrange
		const source = src(usd(99));
		const guard = new ShopCaps(source, () => NOW.getTime());
		const lim = withLimits({ siteBudgetUsd: 1 });

		// Act
		await guard.assertAvailable(lim, "content.translate");
		await guard.assertAvailable(lim);
		await expect(runs({ caps: guard }).service.reserve(lim, {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });

		// Assert
		expect(source.spent).not.toHaveBeenCalled();
	});

	it("TC-AICAP-04: under the budget, null or absent lets a sitegen.* task through", async () => {
		// Arrange
		const guard = new ShopCaps(src(usd(0.5)), () => NOW.getTime());

		// Act + Assert
		await expect(guard.assertAvailable(withLimits({ siteBudgetUsd: 1 }), "sitegen.page-blocks")).resolves.toBeUndefined();
		await expect(guard.assertAvailable(withLimits({ siteBudgetUsd: null }), "sitegen.page-blocks")).resolves.toBeUndefined();
		await expect(guard.assertAvailable(withLimits(), "sitegen.page-blocks")).resolves.toBeUndefined();
	});

	it("TC-AICAP-04: the month check still applies to a sitegen.* task and wins when both are empty", async () => {
		// Arrange
		const guard = new ShopCaps({ spent: async () => usd(50) }, () => NOW.getTime());

		// Act + Assert
		await expect(guard.assertAvailable(withLimits({ aiBudgetUsdMonthly: 10, siteBudgetUsd: 1 }), "sitegen.site-plan")).rejects.toMatchObject({ message: MONTH_EMPTY_MESSAGE });
	});
});

// ---------------------------------------------------------------- 05 ai-config caps

describe("platform caps from Payload [TC-AICAP-05]", () => {
	const URL_ENV = { PRIME_WEB_INTERNAL_URL: "https://web.test" };
	const body = (extra: Record<string, unknown> = {}) => ({ prices: {}, images: {}, models: {}, ...extra });
	const service = (fetchFn: unknown) => new AiConfigService(testEnv(URL_ENV), fetchFn as typeof fetch, Date.now);

	it("TC-AICAP-05: parses caps with defaults, keeping absent daily apart from null", () => {
		// Arrange / Act
		const full = parseAiConfig(body({ caps: { dailyUsd: 30, monthlyUsd: 500, alertPercents: [90, 50], pauseFreeAtPercent: 80 } })).config.caps;
		const absent = parseAiConfig(body({ caps: { monthlyUsd: 100 } })).config.caps;
		const off = parseAiConfig(body({ caps: { dailyUsd: null } })).config.caps;

		// Assert
		expect(full).toEqual({ dailyUsd: 30, monthlyUsd: 500, alertPercents: [50, 90], pauseFreeAtPercent: 80 });
		expect(absent).toEqual({ dailyUsd: undefined, monthlyUsd: 100, alertPercents: [50, 80, 100], pauseFreeAtPercent: null });
		expect(off?.dailyUsd).toBeNull();
		expect(parseAiConfig(body()).config.caps).toBeUndefined();
	});

	it("TC-AICAP-05: serves the caps and keeps the last good ones when a later body has invalid caps or the fetch fails", async () => {
		// Arrange
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const fetchFn = vi
			.fn()
			.mockImplementationOnce(async () => new Response(JSON.stringify(body({ caps: { dailyUsd: 12 } })), { status: 200 }))
			.mockImplementationOnce(async () => new Response(JSON.stringify(body({ caps: { dailyUsd: -5 } })), { status: 200 }))
			.mockImplementationOnce(async () => new Response("no", { status: 500 }));
		const svc = service(fetchFn);

		// Act + Assert
		await svc.refresh();
		expect(svc.caps()?.dailyUsd).toBe(12);
		expect(await svc.refresh()).toBe(true);
		expect(svc.caps()?.dailyUsd).toBe(12);
		expect(await svc.refresh()).toBe(false);
		expect(svc.caps()?.dailyUsd).toBe(12);
	});

	it("TC-AICAP-05: a valid body without caps clears them (env defaults apply again)", async () => {
		// Arrange
		const fetchFn = vi
			.fn()
			.mockImplementationOnce(async () => new Response(JSON.stringify(body({ caps: { dailyUsd: 12 } })), { status: 200 }))
			.mockImplementationOnce(async () => new Response(JSON.stringify(body()), { status: 200 }));
		const svc = service(fetchFn);

		// Act
		await svc.refresh();
		await svc.refresh();

		// Assert
		expect(svc.caps()).toBeUndefined();
		expect(toPlatformCaps({}).alertPercents).toEqual([50, 80, 100]);
	});
});

// ---------------------------------------------------------------- 06..09 spend guard

describe("daily cap from Payload over the env [TC-AICAP-06]", () => {
	it("TC-AICAP-06: Payload's dailyUsd replaces AI_DAILY_BUDGET_USD when the key is present", async () => {
		// Arrange
		let current: PlatformCaps | undefined = caps({ dailyUsd: 50 });
		const guard = new SpendGuard(10, async () => usd(20), () => NOW.getTime(), () => current);

		// Act + Assert (20 USD spent: over the env's 10, under Payload's 50)
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
		current = caps({ dailyUsd: 15 });
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
	});

	it("TC-AICAP-06: null turns the daily cap off, absent falls back to the env, no config falls back to the env", async () => {
		// Arrange
		let current: PlatformCaps | undefined = caps({ dailyUsd: null });
		const source = vi.fn(async () => usd(20));
		const guard = new SpendGuard(10, source, () => NOW.getTime(), () => current);

		// Act + Assert
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
		expect(source).not.toHaveBeenCalled();
		expect(guard.enabled).toBe(false);
		current = caps({ dailyUsd: undefined });
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503 });
		current = undefined;
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503 });
		expect(guard.enabled).toBe(true);
	});

	it("TC-AICAP-06: a cap set in Payload works when the env has none", async () => {
		// Arrange
		const guard = new SpendGuard(undefined, async () => usd(5), () => NOW.getTime(), () => caps({ dailyUsd: 5 }));

		// Act + Assert
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
	});
});

describe("monthly platform cap [TC-AICAP-07]", () => {
	it("TC-AICAP-07: sums from the Malaysia month start, refuses at the cap with the first-of-the-month line, daily untouched", async () => {
		// Arrange
		const source = vi.fn(async (since: Date) => (since.getTime() === monthStart(NOW).getTime() ? usd(300) : usd(1)));
		const guard = new SpendGuard(undefined, source, () => NOW.getTime(), () => caps({ monthlyUsd: 300 }));
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

		// Act + Assert
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503, message: PAUSED_MONTH_MESSAGE });
		expect(PAUSED_MONTH_MESSAGE).toContain("1st");
		expect(source).toHaveBeenCalledTimes(1); // no daily cap on: only the month is read
		expect((source.mock.calls[0]?.[0] as Date).toISOString()).toBe("2026-09-30T16:00:00.000Z");
	});

	it("TC-AICAP-07: under it lets requests through, null/absent is off, and the window rolls over on the 1st", async () => {
		// Arrange
		let now = Date.parse("2026-10-31T15:59:00Z");
		const source = vi.fn(async (since: Date) => (since.toISOString() === "2026-09-30T16:00:00.000Z" ? usd(300) : 0));
		const guard = new SpendGuard(undefined, source, () => now, () => caps({ monthlyUsd: 300 }));
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

		// Act + Assert
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503 });
		now = Date.parse("2026-10-31T16:00:30Z"); // November 1st in Kuala Lumpur
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
		expect((source.mock.calls[1]?.[0] as Date).toISOString()).toBe("2026-10-31T16:00:00.000Z");
		const off = vi.fn(async () => usd(999));
		await new SpendGuard(undefined, off, () => now, () => caps({ monthlyUsd: null })).assertWithinBudget();
		expect(off).not.toHaveBeenCalled();
	});

	it("TC-AICAP-07: both caps on: the daily one refuses first, and the month still refuses when the day is fine", async () => {
		// Arrange
		const spent = { day: usd(1), month: usd(500) };
		const source = async (since: Date) => (since.getTime() === monthStart(NOW).getTime() ? spent.month : spent.day);
		const guard = new SpendGuard(10, source, () => NOW.getTime(), () => caps({ monthlyUsd: 400 }));
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

		// Act + Assert
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ message: PAUSED_MONTH_MESSAGE });
	});
});

describe("pause Free first [TC-AICAP-08]", () => {
	const guard = (spent: number, over: Partial<PlatformCaps> = {}) =>
		new SpendGuard(undefined, async () => usd(spent), () => NOW.getTime(), () => caps({ dailyUsd: 100, pauseFreeAtPercent: 80, ...over }));

	// the guard logs one error line per refusal; keep the test output clean
	beforeEach(() => void vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined));

	it("TC-AICAP-08: at the threshold a FREEMIUM shop gets the 503 paused message, other plans keep going", async () => {
		// Arrange
		const g = guard(80);

		// Act + Assert
		await expect(g.assertWithinBudget("FREEMIUM")).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
		await expect(g.assertWithinBudget("freemium")).rejects.toMatchObject({ status: 503 });
		await expect(g.assertWithinBudget("PRO")).resolves.toBeUndefined();
		await expect(g.assertWithinBudget()).resolves.toBeUndefined();
	});

	it("TC-AICAP-08: below the threshold nobody is paused; at 100 % everyone is", async () => {
		// Act + Assert
		await expect(guard(79.9).assertWithinBudget("FREEMIUM")).resolves.toBeUndefined();
		await expect(guard(100).assertWithinBudget("PRO")).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
		await expect(guard(100).assertWithinBudget()).rejects.toMatchObject({ status: 503 });
	});

	it("TC-AICAP-08: off (null) means Free is paused only with everyone else", async () => {
		// Act + Assert
		await expect(guard(95, { pauseFreeAtPercent: null }).assertWithinBudget("FREEMIUM")).resolves.toBeUndefined();
	});

	it("TC-AICAP-08: applies to the monthly cap too, with the month message", async () => {
		// Arrange
		const g = new SpendGuard(undefined, async () => usd(85), () => NOW.getTime(), () => caps({ monthlyUsd: 100, pauseFreeAtPercent: 80 }));

		// Act + Assert
		await expect(g.assertWithinBudget("FREEMIUM")).rejects.toMatchObject({ status: 503, message: PAUSED_MONTH_MESSAGE });
		await expect(g.assertWithinBudget("PRO")).resolves.toBeUndefined();
	});

	it("TC-AICAP-08: the callers pass the request's plan (run, task, picture) and /agent/usage shows the pause", async () => {
		// Arrange
		const g = guard(90);
		const free = withLimits({ plan: "FREEMIUM" });

		// Act + Assert
		await expect(runs({ spend: g }).service.reserve(free, {}, NOW)).rejects.toMatchObject({ status: 503 });
		await expect(tasks({ spend: g }).engine.run(free, ...TRANSLATE)).rejects.toMatchObject({ status: 503 });
		await expect(pictures({ spend: g }).service.generate(free, { prompt: "a batik scarf on a table" })).rejects.toMatchObject({ status: 503 });
		await expect(runs({ spend: g }).service.reserve(withLimits({ plan: "PRO" }), {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
		const usage = new UsageQuotaService({ pictures: async () => ({ used: 0, oldest: null }) }, testEnv(), g);
		expect(await usage.read(free, NOW)).toMatchObject({ paused: true, reason: "platform" });
		expect((await usage.read(withLimits({ plan: "PRO" }), NOW)).paused).toBe(false);
	});
});

describe("caps change at runtime [TC-AICAP-09]", () => {
	it("TC-AICAP-09: the guard reads the caps per call, so a new cap applies without a restart (spend cached 60 s)", async () => {
		// Arrange
		const source = vi.fn(async () => usd(40));
		let current = caps({ dailyUsd: 100 });
		const guard = new SpendGuard(undefined, source, () => NOW.getTime(), () => current);
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

		// Act + Assert
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
		current = caps({ dailyUsd: 40 });
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503 });
		expect(source).toHaveBeenCalledTimes(1);
	});

	it("TC-AICAP-09: warns at the configured alert levels below 100 %, once per level per period", async () => {
		// Arrange
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const guard = new SpendGuard(undefined, async () => usd(95), () => NOW.getTime(), () => caps({ dailyUsd: 100, alertPercents: [90, 100] }));

		// Act
		await guard.assertWithinBudget();
		await guard.assertWithinBudget();

		// Assert
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]?.[0])).toMatch(/is 95% of the platform daily cap/);
	});
});
