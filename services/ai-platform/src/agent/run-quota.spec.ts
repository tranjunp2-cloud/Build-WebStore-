import type { AgentRun } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { MIGRATIONS } from "../database/migrations";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { RUN_START_KEEP_MS, ThreadRetentionService } from "./thread-retention.service";

/**
 * TC-AISEC-019..021 — the run quota counts starts that survive chat deletes and retention,
 * is checked and reserved in one step (parallel starts cannot all pass), and caps how many
 * requests one user may have working at once (beyond the cap a start queues: see run-queue.spec.ts).
 */

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", locale: "en-MY" };
const other: AiRequestContext = { ...ctx, userId: "usr_2" };

function textModel() {
	return new MockLanguageModelV4({
		doGenerate: async () => ({
			content: [{ type: "text" as const, text: "Done." }],
			finishReason: { unified: "stop" as const, raw: undefined },
			usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: undefined } },
			warnings: [],
		}),
	});
}

function setup(env: Record<string, string> = {}) {
	const parsed = testEnv(env);
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model: textModel(), provider: "openai", modelId: "gpt-4.1-mini" }] };
	const threads = new AgentThreadService(store, parsed);
	const service = new AgentRunService(store, models, ledger, parsed, threads);
	/** what the controller does: reserve, then start the run under the reserved id */
	const startRun = async (who: AiRequestContext = ctx) => service.start(who, { prompt: "write a post" }, () => undefined, undefined, await service.reserveStart(who));
	return { service, store, threads, startRun, retention: new ThreadRetentionService(store, threads, parsed) };
}

/** A run of `who` in the store as a process left it, last written `ageMs` ago. */
async function seedRun(store: InMemoryAgentStore, who: AiRequestContext, id: string, status: AgentRun["status"], ageMs = 0) {
	await store.createRun(who, { id, role: "merchant", domain: "cms", prompt: "x", status, steps: [], receipts: [], changeSetIds: [], startedAt: new Date().toISOString() });
	const row = store.runs.get(id);
	if (row) row.updatedAt = new Date(Date.now() - ageMs);
}

describe("run quota survives deletes [TC-AISEC-019]", () => {
	it("deleting the chat does not give the per-minute quota back", async () => {
		// Arrange
		const { service, startRun } = setup({ AI_RUNS_PER_MINUTE_PER_USER: "1" });
		const run = await startRun();

		// Act
		await service.removeThread(ctx, run.threadId as string);

		// Assert
		await expect(service.reserveStart(ctx)).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/in a minute/) });
	});

	it("deleting every chat (or the retention sweep) does not reset the org's daily quota", async () => {
		// Arrange
		const { service, store, startRun, retention } = setup({ AI_DAILY_RUN_LIMIT_PER_ORG: "2" });
		const first = await startRun(ctx);
		await startRun(other);

		// Act
		await service.removeThread(ctx, first.threadId as string);
		await store.purgeThreadsInactiveSince(new Date(Date.now() + 1000)); // every chat and run gone
		await retention.sweep();

		// Assert
		expect(store.runs.size).toBe(0);
		await expect(service.reserveStart(ctx)).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/today's AI request limit/) });
	});

	it("still counts runs that have no start row (written before the start table existed)", async () => {
		// Arrange
		const { service, store } = setup({ AI_RUNS_PER_MINUTE_PER_USER: "1" });
		await seedRun(store, ctx, "run_legacy", "applied");

		// Act + Assert
		await expect(service.reserveStart(ctx)).rejects.toMatchObject({ status: 429 });
	});

	it("retention keeps starts for 2 days, then prunes them", async () => {
		// Arrange
		const { store, retention } = setup();
		const now = new Date();
		store.runStarts.push(
			{ runId: "run_old", orgId: "org_1", userId: "usr_1", createdAt: new Date(now.getTime() - RUN_START_KEEP_MS - 1000) },
			{ runId: "run_recent", orgId: "org_1", userId: "usr_1", createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) },
		);

		// Act
		await retention.sweep(now);

		// Assert
		expect(store.runStarts.map((s) => s.runId)).toEqual(["run_recent"]);
	});

	it("ships the start table as an idempotent migration", () => {
		const migration = MIGRATIONS.find((m) => m.name === "010_ai_run_starts");
		const statements = (migration?.sql ?? "").split(";").map((s) => s.trim()).filter(Boolean);
		expect(statements.length).toBeGreaterThan(0);
		for (const statement of statements) expect(statement).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS/);
	});
});

describe("run quota is checked and reserved in one step [TC-AISEC-020]", () => {
	it("lets exactly the allowed number of parallel starts through", async () => {
		// Arrange
		const { service } = setup({ AI_RUNS_PER_MINUTE_PER_USER: "3", AI_MAX_RUNNING_RUNS_PER_USER: "0" });

		// Act
		const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.reserveStart(ctx)));

		// Assert
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
		expect(results.filter((r) => r.status === "rejected")).toHaveLength(7);
	});

	it("uses the reserved id for the run, and a refused start reserves nothing", async () => {
		// Arrange
		const { service, store } = setup({ AI_DAILY_RUN_LIMIT_PER_ORG: "1" });
		const runId = await service.reserveStart(ctx);

		// Act
		const run = await service.start(ctx, { prompt: "hi" }, () => undefined, undefined, runId);
		await expect(service.reserveStart(other)).rejects.toMatchObject({ status: 429 });

		// Assert
		expect(run.id).toBe(runId);
		expect(store.runStarts.map((s) => s.runId)).toEqual([runId]);
	});
});

describe("one user's working requests are capped [TC-AISEC-021]", () => {
	it("queues (no longer refuses) a start while the user already has AI_MAX_RUNNING_RUNS_PER_USER runs working", async () => {
		// Arrange
		const { service, store } = setup({ AI_MAX_RUNNING_RUNS_PER_USER: "2" });
		await seedRun(store, ctx, "run_a", "planning");
		await seedRun(store, ctx, "run_b", "running");

		// Act
		const mine = await service.reserve(ctx);
		const theirs = await service.reserve(other);

		// Assert
		expect(mine).toMatchObject({ queued: true, replay: false });
		expect(theirs).toMatchObject({ queued: false });
	});

	it("defaults to 3 and counts a start whose run is not written yet", async () => {
		// Arrange
		const { service } = setup({ AI_MAX_RUNNING_RUNS_PER_ORG: "0" });
		const first = await Promise.all([service.reserve(ctx), service.reserve(ctx), service.reserve(ctx)]);

		// Act
		const fourth = await service.reserve(ctx);

		// Assert
		expect(first.map((r) => r.queued)).toEqual([false, false, false]);
		expect(fourth.queued).toBe(true);
	});

	it("ignores finished, paused and stale runs (a stale one was killed with its process)", async () => {
		// Arrange
		const { service, store } = setup({ AI_MAX_RUNNING_RUNS_PER_USER: "1" });
		await seedRun(store, ctx, "run_done", "applied");
		await seedRun(store, ctx, "run_question", "awaiting_input");
		await seedRun(store, ctx, "run_killed", "running", 11 * 60 * 1000);

		// Act + Assert
		await expect(service.reserve(ctx)).resolves.toMatchObject({ queued: false });
	});

	it("is off at 0", async () => {
		// Arrange
		const { service, store } = setup({ AI_MAX_RUNNING_RUNS_PER_USER: "0", AI_MAX_RUNNING_RUNS_PER_ORG: "0" });
		await seedRun(store, ctx, "run_a", "running");
		await seedRun(store, ctx, "run_b", "running");
		await seedRun(store, ctx, "run_c", "running");

		// Act + Assert
		await expect(service.reserve(ctx)).resolves.toMatchObject({ queued: false });
	});

	it("frees the slot once the run finishes", async () => {
		// Arrange
		const { service, startRun } = setup({ AI_MAX_RUNNING_RUNS_PER_USER: "1" });

		// Act
		const run = await startRun();

		// Assert
		expect(run.status).toBe("applied");
		await expect(service.reserve(ctx)).resolves.toMatchObject({ queued: false });
	});
});
