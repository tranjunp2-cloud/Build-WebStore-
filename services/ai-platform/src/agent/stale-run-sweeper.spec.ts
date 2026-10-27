import type { AgentRun } from "@ech/agent-core";
import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { runMaxRunningMs } from "../config/limits";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentController } from "./agent.controller";
import { STALE_RUN_ERROR } from "./stale-run";
import { StaleRunSweeper } from "./stale-run-sweeper";

/**
 * TC-AISEC-026..027 — runs a killed function left working are closed without the daily cron:
 * chat requests start a throttled sweep in the background, and on Vercel a run counts as
 * stale just after its 300 s function limit.
 */

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1" };
const NOW = new Date("2026-10-22T12:00:00Z");

async function seed(store: InMemoryAgentStore, id: string, ageMs: number) {
	const run: AgentRun = { id, role: "merchant", domain: "cms", prompt: "x", status: "running", steps: [], receipts: [], changeSetIds: [], startedAt: NOW.toISOString() };
	await store.createRun(ctx, run, "x");
	const row = store.runs.get(id);
	if (row) row.updatedAt = new Date(NOW.getTime() - ageMs);
}

function setup(env: Record<string, string> = {}) {
	const store = new InMemoryAgentStore();
	return { store, sweeper: new StaleRunSweeper(store, testEnv(env)) };
}

afterEach(() => vi.restoreAllMocks());

describe("opportunistic stale-run sweep [TC-AISEC-026]", () => {
	it("closes stale runs at most once per AI_STALE_SWEEP_EVERY_MS per process", async () => {
		// Arrange
		const { store, sweeper } = setup();
		const sweep = vi.spyOn(store, "failStaleRuns");
		await seed(store, "run_killed", 11 * 60_000);

		// Act
		const first = sweeper.nudge(NOW);
		const throttled = sweeper.nudge(new Date(NOW.getTime() + 30_000));
		await first;
		const later = sweeper.nudge(new Date(NOW.getTime() + 61_000));
		await later;

		// Assert
		expect(throttled).toBeNull();
		expect(sweep).toHaveBeenCalledTimes(2);
		expect(sweep).toHaveBeenCalledWith(new Date(NOW.getTime() - 600_000), STALE_RUN_ERROR, NOW);
		expect((await store.getRun("org_1", "run_killed"))?.status).toBe("failed");
	});

	it("never fails or blocks the request, and warns once per failing streak", async () => {
		// Arrange
		const { store, sweeper } = setup({ AI_STALE_SWEEP_EVERY_MS: "1000" });
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		let fail: (error: Error) => void = () => undefined;
		const stuck = new Promise<number>((_resolve, reject) => (fail = reject));
		store.failStaleRuns = () => stuck;

		// Act: nudge returns at once while the sweep is still waiting on the database
		const pending = sweeper.nudge(NOW);
		const whileRunning = sweeper.nudge(new Date(NOW.getTime() + 5_000));
		fail(new Error("db down"));
		const firstResult = await pending;
		store.failStaleRuns = async () => {
			throw new Error("db down");
		};
		await sweeper.nudge(new Date(NOW.getTime() + 10_000));

		// Assert
		expect(whileRunning).toBeNull();
		expect(firstResult).toBe(0);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toMatch(/db down/);
	});

	it("is off at 0", () => {
		const { sweeper } = setup({ AI_STALE_SWEEP_EVERY_MS: "0" });
		expect(sweeper.nudge(NOW)).toBeNull();
	});

	it("is started by listing chats, opening one and reading the work queue, without being awaited", async () => {
		// Arrange
		const nudge = vi.fn(() => new Promise<number>(() => undefined)); // a sweep that never ends
		const threads = { list: vi.fn(async () => []), detail: vi.fn(async () => ({ changeSets: [] })) };
		const work = { work: vi.fn(async () => ({})) };
		const controller = new AgentController({} as never, {} as never, {} as never, threads as never, {} as never, testEnv(), work as never, { nudge } as never, {} as never);

		// Act
		await controller.listThreads(ctx);
		await controller.getThread(ctx, "thr_1");
		await controller.getWork(ctx);

		// Assert
		expect(nudge).toHaveBeenCalledTimes(3);
	});
});

describe("stale limit on Vercel [TC-AISEC-027]", () => {
	it("defaults to 330 s on Vercel (just above maxDuration 300 s) and 10 min locally; env wins", () => {
		expect(runMaxRunningMs(testEnv({ VERCEL: "1" }))).toBe(330_000);
		expect(runMaxRunningMs(testEnv())).toBe(600_000);
		expect(runMaxRunningMs(testEnv({ VERCEL: "1", AI_RUN_MAX_RUNNING_MS: "900000" }))).toBe(900_000);
	});

	it("closes a run 6 minutes after its last write on Vercel", async () => {
		// Arrange
		const { store, sweeper } = setup({ VERCEL: "1" });
		await seed(store, "run_killed", 6 * 60_000);
		await seed(store, "run_live", 4 * 60_000);

		// Act
		const closed = await sweeper.nudge(NOW);

		// Assert
		expect(closed).toBe(1);
		expect((await store.getRun("org_1", "run_live"))?.status).toBe("running");
	});
});
