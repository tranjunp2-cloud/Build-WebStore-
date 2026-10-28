import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentError } from "../agent/agent-errors";
import { ctx, runHarness, scripted } from "../agent/run-harness.spec-helper";
import { parseEnv } from "../config/env";
import { TaskEngine } from "../tasks/task-engine.service";
import { dayStart, PAUSED_MESSAGE, SpendGuard } from "./spend-guard";

// TC-AISEC-092..094 — the global daily spend guard (AI_DAILY_BUDGET_USD): 503 "AI is paused for today…" at or
// above the budget before a run or task starts, one cached sum per instance a minute (shared by parallel
// requests, reset at the Malaysia day), fail-open on a failed read, warnings at 50 % / 80 % and one error line a minute.

const usd = (n: number) => n * 1_000_000;

afterEach(() => vi.restoreAllMocks());

describe("refusing above the budget [TC-AISEC-092]", () => {
	it("lets requests through under the budget and refuses with 503 at it", async () => {
		// Arrange
		let spent = usd(9.99);
		let now = Date.parse("2026-10-22T04:00:00Z");
		const guard = new SpendGuard(10, async () => spent, () => now);

		// Act + Assert
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
		spent = usd(10);
		now += 61_000;
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
		await expect(guard.assertWithinBudget()).rejects.toBeInstanceOf(AgentError);
	});

	it("is off when AI_DAILY_BUDGET_USD is unset: no query at all", async () => {
		// Arrange
		const source = vi.fn(async () => usd(1_000));
		const guard = new SpendGuard(undefined, source);

		// Act
		await guard.assertWithinBudget();

		// Assert
		expect(guard.enabled).toBe(false);
		expect(source).not.toHaveBeenCalled();
	});

	it("refuses a copilot run before anything is reserved or any model is called", async () => {
		// Arrange
		const guard = new SpendGuard(5, async () => usd(6));
		const { service, model, store } = runHarness({ turns: [{ text: "ok" }], spend: guard });
		const reserve = vi.spyOn(store, "reserveRunStart");

		// Act + Assert
		await expect(service.reserveStart(ctx)).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
		expect(reserve).not.toHaveBeenCalled();
		expect(model.doGenerateCalls).toHaveLength(0);
	});

	it("refuses a task before its quota check or any model call", async () => {
		// Arrange
		const model = scripted([{ text: "never" }]);
		const countSince = vi.fn(async () => 0);
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
		const engine = new TaskEngine(
			{ resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] },
			{ record: async () => undefined, countSince },
			env,
			new SpendGuard(5, async () => usd(5)),
		);

		// Act + Assert
		await expect(engine.run(ctx, "content.seo-meta", { locale: "en", title: "Batik Scarf", body: "Silk scarf", keywords: ["batik"] })).rejects.toMatchObject({ status: 503, message: PAUSED_MESSAGE });
		expect(countSince).not.toHaveBeenCalled();
		expect(model.doGenerateCalls).toHaveLength(0);
	});
});

describe("one cheap sum a minute [TC-AISEC-093]", () => {
	it("reads today's sum once a minute per instance, shared by parallel requests, from the start of the Malaysia day", async () => {
		// Arrange
		let now = Date.parse("2026-10-22T04:00:00Z");
		const source = vi.fn(async (_since: Date) => usd(1));
		const guard = new SpendGuard(10, source, () => now);

		// Act
		await Promise.all([guard.assertWithinBudget(), guard.assertWithinBudget(), guard.assertWithinBudget()]);
		now += 59_000;
		await guard.assertWithinBudget();
		now += 2_000;
		await guard.assertWithinBudget();

		// Assert
		expect(source).toHaveBeenCalledTimes(2);
		expect(source.mock.calls[0]?.[0].toISOString()).toBe("2026-10-21T16:00:00.000Z");
		expect(dayStart(new Date("2026-10-22T15:59:59Z")).toISOString()).toBe("2026-10-21T16:00:00.000Z");
		expect(dayStart(new Date("2026-10-22T16:00:00Z")).toISOString()).toBe("2026-10-22T16:00:00.000Z");
	});

	it("starts a new day at once (no cached yesterday) and lets requests through when the sum can't be read", async () => {
		// Arrange
		let now = Date.parse("2026-10-22T15:59:00Z");
		let fail = false;
		const source = vi.fn(async (since: Date) => {
			if (fail) throw new Error("db down");
			return since.toISOString().startsWith("2026-10-21") ? usd(50) : 0;
		});
		const guard = new SpendGuard(10, source, () => now);
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

		// Act + Assert
		await expect(guard.assertWithinBudget()).rejects.toMatchObject({ status: 503 });
		now += 2 * 60_000; // 16:01 UTC = 00:01 in Kuala Lumpur
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
		fail = true;
		now += 61_000;
		await expect(guard.assertWithinBudget()).resolves.toBeUndefined();
	});
});

describe("log lines [TC-AISEC-094]", () => {
	it("warns once at 50 % and once at 80 % of the day's budget, and logs the pause at most once a minute", async () => {
		// Arrange
		let now = Date.parse("2026-10-22T04:00:00Z");
		let spent = usd(5);
		const guard = new SpendGuard(10, async () => spent, () => now);
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
		const step = async (usdSpent: number, ms = 61_000) => {
			spent = usd(usdSpent);
			now += ms;
			await guard.assertWithinBudget().catch(() => undefined);
		};

		// Act
		await guard.assertWithinBudget();
		await step(6);
		await step(8.5);
		await step(9);
		await step(10);
		await step(10, 10_000);
		await step(10, 10_000);
		await step(11, 61_000);

		// Assert
		expect(warn.mock.calls.map(([line]) => String(line).match(/is (\d+)% of/)?.[1])).toEqual(["50", "85"]);
		expect(error).toHaveBeenCalledTimes(2);
		expect(String(error.mock.calls[0]?.[0])).toMatch(/AI paused: today's spend 10\.00 USD reached AI_DAILY_BUDGET_USD 10/);
	});
});
