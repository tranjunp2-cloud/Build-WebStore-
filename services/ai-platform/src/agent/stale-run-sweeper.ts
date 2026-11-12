import { Inject, Injectable, Logger } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { runMaxRunningMs } from "../config/limits";
import { AGENT_STORE, type AgentStore } from "./agent-store";
import { STALE_RUN_ERROR } from "./stale-run";

/**
 * Closes runs a killed process left working between retention sweeps. Vercel Cron does not
 * run on the staging target and runs once a day in production, so a run cut at maxDuration
 * would show as working for hours. Chat requests (thread list / open, work queue, run start)
 * call `nudge()`: at most one sweep per AI_STALE_SWEEP_EVERY_MS per process, in the background.
 */
@Injectable()
export class StaleRunSweeper {
	private readonly logger = new Logger(StaleRunSweeper.name);
	private lastAt = Number.NEGATIVE_INFINITY;
	private sweeping = false;
	/** one warning per failing streak, not one per request */
	private failing = false;

	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		@Inject(ENV) private readonly env: Pick<Env, "VERCEL" | "AI_RUN_MAX_RUNNING_MS" | "AI_STALE_SWEEP_EVERY_MS">,
	) {}

	/**
	 * Starts a sweep when the last one is old enough and returns it (never rejects); null when
	 * skipped. Callers must not await it: the request never waits for the sweep.
	 */
	nudge(now: Date = new Date()): Promise<number> | null {
		const every = this.env.AI_STALE_SWEEP_EVERY_MS;
		if (every === 0 || this.sweeping || now.getTime() - this.lastAt < every) return null;
		this.lastAt = now.getTime();
		this.sweeping = true;
		const staleBefore = new Date(now.getTime() - runMaxRunningMs(this.env));
		return Promise.resolve()
			.then(() => this.store.failStaleRuns(staleBefore, STALE_RUN_ERROR, now))
			.then(
				(closed) => {
					this.failing = false;
					if (closed) this.logger.warn(`closed ${closed} run(s) not written for over ${Math.round(runMaxRunningMs(this.env) / 1000)} s`);
					return closed;
				},
				(error: unknown) => {
					if (!this.failing) this.logger.warn(`stale-run sweep failed: ${error instanceof Error ? error.message : String(error)}`);
					this.failing = true;
					return 0;
				},
			)
			.finally(() => {
				this.sweeping = false;
			});
	}
}
