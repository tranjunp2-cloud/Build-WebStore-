import type { AgentRun } from "@ech/agent-core";
import { Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";
import { parseEnv } from "../config/env";
import { ENV } from "../config/config.module";
import { runMaxRunningMs } from "../config/limits";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { startTestApp, testEnv } from "../testing/test-app";
import { InternalCronController } from "./cron.controller";
import { AgentThreadService } from "./agent-thread.service";
import { STALE_RUN_ERROR } from "./stale-run";
import { ThreadRetentionService } from "./thread-retention.service";

const ctx = { organizationId: "org_1", userId: "usr_1" };
const NOW = new Date("2026-10-21T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function run(id: string, status: AgentRun["status"], overrides: Partial<AgentRun> = {}): AgentRun {
	return { id, role: "merchant", domain: "cms", prompt: "write a post", status, steps: [], receipts: [], changeSetIds: [], startedAt: minutesAgo(30).toISOString(), ...overrides };
}

/** Puts a run in the store as if its last write was `ageMinutes` ago. */
async function seed(store: InMemoryAgentStore, id: string, status: AgentRun["status"], ageMinutes: number, overrides: Partial<AgentRun> = {}) {
	await store.createRun(ctx, run(id, status, overrides), "write a post");
	const row = store.runs.get(id);
	if (row) row.updatedAt = minutesAgo(ageMinutes);
}

describe("closing runs a killed process left running", () => {
	it("[TC-AIREL-39] fails planning and running runs not written since the cutoff, and only those", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		await seed(store, "run_stuck_planning", "planning", 20);
		await seed(store, "run_stuck_running", "running", 45, {
			steps: [
				{ id: "model_1", label: "Thinking", status: "running" },
				{ id: "read_1", label: "Read your website", status: "done" },
			],
		});
		await seed(store, "run_fresh", "running", 3);
		await seed(store, "run_waiting", "awaiting_input", 600);
		await seed(store, "run_done", "applied", 600);
		await store.saveRunState("org_1", "run_stuck_running", { messages: [] });

		// Act
		const closed = await store.failStaleRuns(minutesAgo(10), STALE_RUN_ERROR, NOW);

		// Assert
		expect(closed).toBe(2);
		const stuck = await store.getRun("org_1", "run_stuck_running");
		expect(stuck).toMatchObject({ status: "failed", error: STALE_RUN_ERROR, finishedAt: NOW.toISOString() });
		expect(stuck?.steps.map((step) => step.status)).toEqual(["failed", "done"]);
		expect(await store.getRun("org_1", "run_stuck_planning")).toMatchObject({ status: "failed", error: STALE_RUN_ERROR });
		expect((await store.getRunWithState("org_1", "run_stuck_running", "usr_1"))?.state).toBeNull();
		for (const [id, status] of [["run_fresh", "running"], ["run_waiting", "awaiting_input"], ["run_done", "applied"]] as const) {
			expect((await store.getRun("org_1", id))?.status, id).toBe(status);
		}
		// nothing is left to close the second time
		expect(await store.failStaleRuns(minutesAgo(10), STALE_RUN_ERROR, NOW)).toBe(0);
	});

	it("[TC-AIREL-39] states why: the message tells the merchant to try again, not that the server broke", () => {
		expect(STALE_RUN_ERROR).toMatch(/interrupted/);
		expect(STALE_RUN_ERROR).toMatch(/try again/i);
	});
});

describe("retention sweep closes stuck runs [TC-AIREL-40]", () => {
	const service = (overrides: Record<string, string> = {}) => {
		const env = testEnv(overrides);
		const store = new InMemoryAgentStore();
		return { store, retention: new ThreadRetentionService(store, new AgentThreadService(store, env), env) };
	};

	it("uses AI_RUN_MAX_RUNNING_MS (default 10 min, above Vercel's 300 s) and reports how many it closed", async () => {
		// Arrange
		const { store, retention } = service();
		await seed(store, "run_old", "running", 11);
		await seed(store, "run_recent", "running", 9);

		// Act
		const counts = await retention.sweep(NOW);

		// Assert
		expect(counts).toEqual({ threads: 0, runs: 0, changeSets: 0, staleRuns: 1 });
		expect((await store.getRun("org_1", "run_old"))?.status).toBe("failed");
		expect((await store.getRun("org_1", "run_recent"))?.status).toBe("running");
	});

	it("honours a configured limit", async () => {
		const { store, retention } = service({ AI_RUN_MAX_RUNNING_MS: "1800000" });
		await seed(store, "run_old", "running", 29);
		await seed(store, "run_older", "running", 31);

		expect((await retention.sweep(NOW))?.staleRuns).toBe(1);
		expect((await store.getRun("org_1", "run_old"))?.status).toBe("running");
	});

	it("fails the sweep, so the cron shows as failed, when the store cannot close runs", async () => {
		const { store, retention } = service();
		store.failStaleRuns = async () => {
			throw new Error("db down");
		};
		expect(await retention.sweep(NOW)).toBeNull();
	});

	it("keeps the limit above a function's maxDuration", () => {
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
		expect(runMaxRunningMs(env)).toBe(600_000);
		expect(runMaxRunningMs({ ...env, VERCEL: "1" })).toBeGreaterThan(300_000);
		expect(() => parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", AI_RUN_MAX_RUNNING_MS: "1000" })).toThrow(/AI_RUN_MAX_RUNNING_MS/);
	});

	describe("through the cron endpoint", () => {
		let app: NestFastifyApplication | undefined;
		afterEach(async () => {
			await app?.close();
			app = undefined;
		});

		it("returns the stale run count next to the retention counts", async () => {
			// Arrange
			const secret = "cron-secret-0123456789";
			const env = testEnv({ CRON_SECRET: secret, VERCEL: "1" }); // as deployed: no boot sweep, only the cron call
			const store = new InMemoryAgentStore();
			await store.createRun(ctx, run("run_old", "running"), "write a post");
			(store.runs.get("run_old") as { updatedAt: Date }).updatedAt = new Date(Date.now() - 40 * 60_000);
			const retention = new ThreadRetentionService(store, new AgentThreadService(store, env), env);
			@Module({
				controllers: [InternalCronController],
				providers: [
					{ provide: ENV, useValue: env },
					{ provide: ThreadRetentionService, useValue: retention },
				],
			})
			class CronModule {}
			app = await startTestApp(CronModule, env);

			// Act
			const response = await app.getHttpAdapter().getInstance().inject({ method: "GET", url: "/internal/cron/thread-retention", headers: { authorization: `Bearer ${secret}` } });

			// Assert: the run was last written 40 minutes ago by the wall clock
			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({ ok: true, staleRuns: 1 });
			expect((await store.getRun("org_1", "run_old"))?.status).toBe("failed");
		});
	});
});
