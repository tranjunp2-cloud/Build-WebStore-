import { Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { startTestApp, testEnv } from "../testing/test-app";
import { InternalCronController } from "./cron.controller";
import { AgentThreadService } from "./agent-thread.service";
import { ThreadRetentionService } from "./thread-retention.service";

const SECRET = "cron-secret-0123456789";

async function cronApp(sweep: () => Promise<unknown>, overrides: Record<string, string> = { CRON_SECRET: SECRET }) {
	const env = testEnv(overrides);
	@Module({
		controllers: [InternalCronController],
		providers: [
			{ provide: ENV, useValue: env },
			{ provide: ThreadRetentionService, useValue: { sweep } },
		],
	})
	class CronModule {}
	return startTestApp(CronModule, env);
}

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	await app?.close();
	app = undefined;
});

const call = (method: "GET" | "POST", authorization?: string) =>
	app?.getHttpAdapter().getInstance().inject({
		method,
		url: "/internal/cron/thread-retention",
		...(authorization ? { headers: { authorization } } : {}),
	});

describe("thread-retention cron endpoint", () => {
	it("[TC-AIREL-04] refuses a missing or wrong bearer secret and does not sweep", async () => {
		// Arrange
		const sweep = vi.fn(async () => ({ threads: 0, runs: 0, changeSets: 0 }));
		app = await cronApp(sweep);

		// Act
		const missing = await call("GET");
		const wrong = await call("GET", "Bearer cron-secret-0123456780");
		const shorter = await call("POST", "Bearer nope");
		const basic = await call("GET", `Basic ${SECRET}`);

		// Assert
		expect([missing?.statusCode, wrong?.statusCode, shorter?.statusCode, basic?.statusCode]).toEqual([401, 401, 401, 401]);
		expect(missing?.json()).toMatchObject({ title: "Unauthorized", status: 401 });
		expect(sweep).not.toHaveBeenCalled();
	});

	it("[TC-AIREL-05] fails closed when CRON_SECRET is not configured", async () => {
		// Arrange
		const sweep = vi.fn(async () => ({ threads: 0, runs: 0, changeSets: 0 }));
		app = await cronApp(sweep, {});

		// Act
		const response = await call("GET", "Bearer ");
		const guessed = await call("GET", "Bearer undefined");

		// Assert
		expect(response?.statusCode).toBe(401);
		expect(response?.json().detail).toContain("CRON_SECRET");
		expect(guessed?.statusCode).toBe(401);
		expect(sweep).not.toHaveBeenCalled();
	});

	it("[TC-AIREL-06] runs the sweep for Vercel's GET with the bearer secret and returns the counts", async () => {
		// Arrange
		const sweep = vi.fn(async () => ({ threads: 2, runs: 5, changeSets: 3 }));
		app = await cronApp(sweep);

		// Act
		const response = await call("GET", `Bearer ${SECRET}`);

		// Assert
		expect(response?.statusCode).toBe(200);
		expect(response?.json()).toEqual({ ok: true, threads: 2, runs: 5, changeSets: 3 });
		expect(sweep).toHaveBeenCalledTimes(1);
	});

	it("[TC-AIREL-07] accepts POST for manual runs and reports a failed sweep as 500", async () => {
		// Arrange
		const sweep = vi.fn().mockResolvedValueOnce({ threads: 0, runs: 0, changeSets: 0 }).mockResolvedValueOnce(null);
		app = await cronApp(sweep);

		// Act
		const ok = await call("POST", `Bearer ${SECRET}`);
		const failed = await call("GET", `Bearer ${SECRET}`);

		// Assert
		expect(ok?.statusCode).toBe(200);
		expect(failed?.statusCode).toBe(500);
		expect(failed?.json()).toMatchObject({ title: "Sweep failed", status: 500 });
	});
});

describe("ThreadRetentionService timer", () => {
	function service(env: Pick<Env, "VERCEL" | "AI_RUN_MAX_RUNNING_MS">) {
		const store = new InMemoryAgentStore();
		const purge = vi.spyOn(store, "purgeThreadsInactiveSince");
		const threads = new AgentThreadService(store, testEnv());
		return { retention: new ThreadRetentionService(store, threads, env), purge };
	}

	it("[TC-AIREL-08] sweeps on boot and hourly locally, and does neither on Vercel", async () => {
		// Arrange
		vi.useFakeTimers();
		try {
			const local = service({ VERCEL: undefined, AI_RUN_MAX_RUNNING_MS: 600_000 });
			const vercel = service({ VERCEL: "1", AI_RUN_MAX_RUNNING_MS: 600_000 });

			// Act
			local.retention.onApplicationBootstrap();
			vercel.retention.onApplicationBootstrap();
			await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
			local.retention.onApplicationShutdown();
			vercel.retention.onApplicationShutdown();

			// Assert: boot + one hourly tick locally; nothing on Vercel (Cron calls the endpoint instead)
			expect(local.purge).toHaveBeenCalledTimes(2);
			expect(vercel.purge).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
