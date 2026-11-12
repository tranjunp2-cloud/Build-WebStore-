import { Controller, Get, Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { MockImageModelV4, MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentThreadService } from "../agent/agent-thread.service";
import { maxQueueWaitMs, queueCaps } from "../agent/run-queue";
import type { AiRequestContext } from "../auth/context-token";
import { DecisionService } from "../decide/decision.service";
import { ImageService } from "../images/image.service";
import { InMemoryPictureQuota } from "../images/picture-quota";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelAlias, ModelRegistry } from "../models/model-registry";
import { TASK_DEFINITIONS } from "../tasks/catalog";
import { TaskEngine } from "../tasks/task-engine.service";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { startTestApp } from "../testing/test-app";
import { ACTOR, makeSettings } from "./settings.spec-helper";
import { SettingsService } from "./settings.service";

// TC-AIPROV-15..16 — the services read Studio's values first and behave exactly as before when nothing is set.

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1" };
const usage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const jsonModel = () =>
	new MockLanguageModelV4({
		doGenerate: async () => ({ content: [{ type: "text", text: JSON.stringify({ fields: { name: "x" } }) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] }),
	});

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	vi.restoreAllMocks();
	await app?.close();
	app = undefined;
});

function engineOn(settings: SettingsService | undefined, env: SettingsService["env"], counted = 0) {
	const aliases: ModelAlias[] = [];
	const registry: ModelRegistry = { resolveChain: (alias) => (aliases.push(alias), [{ provider: "openai", modelId: "gpt-4.1-nano", model: jsonModel() }]) };
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => counted };
	return { engine: new TaskEngine(registry, ledger, env, undefined, undefined, undefined, settings), aliases };
}

describe("task engine [TC-AIPROV-15]", () => {
	const input = { targetLocale: "ms-MY", fields: { name: "Batik scarf" } };

	it("TC-AIPROV-15: a task runs on its catalog tier, and on the tier Studio moved it to", async () => {
		const { admin, settings, env } = await makeSettings();
		const plain = engineOn(settings, env);
		await plain.engine.run(ctx, "content.translate", input);
		await admin.setTasks({ overrides: { "content.translate": "quality" } }, ACTOR);
		const moved = engineOn(settings, env);
		await moved.engine.run(ctx, "content.translate", input);
		expect(plain.aliases).toEqual([TASK_DEFINITIONS["content.translate"].alias]);
		expect(moved.aliases).toEqual(["quality"]);
		expect(TASK_DEFINITIONS["content.translate"].alias).not.toBe("quality");
	});

	it("TC-AIPROV-15: without settings the engine is unchanged", async () => {
		const { env } = await makeSettings();
		const bare = engineOn(undefined, env);
		await bare.engine.run(ctx, "content.translate", input);
		expect(bare.aliases).toHaveLength(1);
	});

	it("TC-AIPROV-15: the daily task limit is Studio's when set, env's otherwise", async () => {
		const { admin, settings, env } = await makeSettings({ vars: { AI_DAILY_TASK_LIMIT_PER_ORG: "100" } });
		await expect(engineOn(settings, env, 5).engine.run(ctx, "content.translate", input)).resolves.toBeTruthy();
		await admin.setRuntime({ values: { tasksPerDayPerShop: 5 } }, ACTOR);
		await expect(engineOn(settings, env, 5).engine.run(ctx, "content.translate", input)).rejects.toMatchObject({ status: 429 });
		await admin.setRuntime({ values: { tasksPerDayPerShop: null } }, ACTOR);
		await expect(engineOn(settings, env, 5).engine.run(ctx, "content.translate", input)).resolves.toBeTruthy();
	});
});

describe("runtime knobs at their call sites [TC-AIPROV-16]", () => {
	it("TC-AIPROV-16: chat retention, queue caps and queue wait follow Studio", async () => {
		// Arrange
		const { admin, settings, env } = await makeSettings();
		const threads = new AgentThreadService(new InMemoryAgentStore(), env, settings);
		const now = new Date("2026-10-30T00:00:00Z");
		expect(threads.activeSince(now).toISOString()).toBe("2026-08-01T00:00:00.000Z"); // 90 days (default)

		// Act
		await admin.setRuntime({ values: { threadRetentionDays: 30, maxRunningPerUser: 1, maxRunningPerShop: 2, queueMaxWaitMs: 40_000, runBudgetMs: 250_000 } }, ACTOR);

		// Assert
		expect(threads.activeSince(now).toISOString()).toBe("2026-09-30T00:00:00.000Z");
		expect(queueCaps(settings.runtimeEnv())).toEqual({ org: 2, user: 1 });
		expect(maxQueueWaitMs(settings.runtimeEnv())).toBe(40_000);
	});

	it("TC-AIPROV-16: without Studio data the services keep reading env", async () => {
		const { env, settings } = await makeSettings({ vars: { AI_MAX_RUNNING_RUNS_PER_ORG: "7", AI_THREAD_RETENTION_DAYS: "10" } });
		expect(queueCaps(settings.runtimeEnv())).toEqual(queueCaps(env));
		expect(new AgentThreadService(new InMemoryAgentStore(), env, settings).activeSince(new Date("2026-10-30T00:00:00Z")).toISOString()).toBe("2026-10-20T00:00:00.000Z");
	});

	it("TC-AIPROV-16: pictures use Studio's timeout and format, else env's", async () => {
		const { admin, settings, env } = await makeSettings();
		const calls: Array<{ abortSignal?: AbortSignal; providerOptions?: { openai?: Record<string, unknown> } }> = [];
		const model = new MockImageModelV4({
			doGenerate: async (options) => (calls.push(options as never), { images: ["UklGRg=="], warnings: [], response: { timestamp: new Date(), modelId: "img", headers: undefined } }),
			maxImagesPerCall: 1,
		});
		const registry: ModelRegistry = { resolveChain: () => [], resolveImageChain: () => [{ model, provider: "openai", modelId: "gpt-image-1" }] };
		const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
		const images = new ImageService(registry, ledger, env, new InMemoryPictureQuota(), undefined, settings);

		await images.generate(ctx, { prompt: "batik scarf" });
		await admin.setRouting({ tiers: { image: { chain: ["openai:gpt-image-1"], timeoutMs: 20_000, format: "jpeg" } } }, ACTOR);
		await images.generate(ctx, { prompt: "batik scarf" });

		expect(calls[0]?.providerOptions?.openai).toEqual({ quality: "medium" });
		expect(calls[1]?.providerOptions?.openai).toMatchObject({ outputFormat: "jpeg" });
		expect(settings.imageTimeoutMs()).toBe(20_000);
	});

	it("TC-AIPROV-16: System One follows Studio's key and its on/off switch", async () => {
		const { admin, settings, env } = await makeSettings();
		const decisions = new DecisionService(new InMemoryAgentStore() as never, {} as never, env, undefined, settings);
		expect(decisions.modelBacked).toBe(false);
		await admin.setKey("typesafe", { apiKey: "typesafe-key-12345678" }, ACTOR);
		expect(decisions.modelBacked).toBe(true);
		await admin.setProvider("typesafe", { enabled: false }, ACTOR);
		expect(decisions.modelBacked).toBe(false);
	});

	it("TC-AIPROV-16: request logging follows Studio's mode", async () => {
		// Arrange
		@Controller("probe")
		class Probe {
			@Get("ok")
			ok() {
				return { ok: true };
			}
		}
		const { admin, settings, env } = await makeSettings();
		@Module({ controllers: [Probe], providers: [{ provide: SettingsService, useValue: settings }] })
		class ProbeModule {}
		app = await startTestApp(ProbeModule, env);
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const get = () => app?.getHttpAdapter().getInstance().inject({ method: "GET", url: "/probe/ok" });

		// Act
		await get();
		await admin.setRuntime({ values: { logRequests: "default" } }, ACTOR);
		await get();

		// Assert: logged while `all`, silent once Studio asks for failures only
		expect(log).toHaveBeenCalledTimes(1);
	});
});
