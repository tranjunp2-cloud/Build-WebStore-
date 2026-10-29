import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { isVercel, runMaxRunningMs } from "../config/limits";
import { AGENT_STORE, type AgentStore, type PurgeCounts } from "./agent-store";
import { AgentThreadService } from "./agent-thread.service";
import { STALE_RUN_ERROR } from "./stale-run";

export const THREAD_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** Run starts (quota rows) are kept this long; the widest quota window is a day. */
export const RUN_START_KEEP_MS = 2 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What one sweep did: threads (with their runs and change sets) deleted, and stuck runs closed. */
export type SweepCounts = PurgeCounts & { staleRuns: number };

/**
 * Retention: threads idle longer than AI_THREAD_RETENTION_DAYS are deleted with
 * their runs and change sets (in batches, see `purgeThreadsInactiveSince`), on boot and then hourly;
 * cached decisions older than AI_DECISION_CACHE_TTL_DAYS go too. Usage-ledger rows
 * (ai_usage_events — no content) are kept. List/get already hide expired
 * threads, so the sweep only reclaims storage.
 *
 * The sweep also closes runs a killed process left `running` (see `failStaleRuns`):
 * Vercel stops a function at maxDuration without letting the run save a final
 * status, so without this the chat would show it working forever.
 *
 * On Vercel there is no long-lived process (instances come and go, an interval
 * would run on every cold start), so the timer is off and Vercel Cron calls
 * `/internal/cron/thread-retention` instead (see InternalCronController).
 */
@Injectable()
export class ThreadRetentionService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(ThreadRetentionService.name);
	private timer: NodeJS.Timeout | undefined;

	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		private readonly threads: AgentThreadService,
		// AI_DECISION_CACHE_TTL_DAYS always comes with the parsed env (default 7); absent (a partial test env): no decision pruning
		@Inject(ENV) private readonly env: Pick<Env, "VERCEL" | "AI_RUN_MAX_RUNNING_MS"> & Partial<Pick<Env, "AI_DECISION_CACHE_TTL_DAYS">>,
	) {}

	onApplicationBootstrap(): void {
		if (isVercel(this.env)) return;
		// Not awaited: a slow or failing sweep must never block or crash boot.
		void this.sweep();
		this.timer = setInterval(() => void this.sweep(), THREAD_SWEEP_INTERVAL_MS);
		this.timer.unref();
	}

	onApplicationShutdown(): void {
		if (this.timer) clearInterval(this.timer);
	}

	async sweep(now: Date = new Date()): Promise<SweepCounts | null> {
		try {
			const counts = await this.store.purgeThreadsInactiveSince(this.threads.activeSince(now));
			// files go with their chat; files never sent are dropped after a day
			const files = await this.store.purgeAttachments(this.threads.activeSince(now), new Date(now.getTime() - 24 * 60 * 60 * 1000));
			if (files) this.logger.log(`retention sweep deleted ${files} attachment(s)`);
			// the quota only looks back a day; starts stay through chat deletes until then
			await this.store.pruneRunStarts(new Date(now.getTime() - RUN_START_KEEP_MS));
			// cached decisions are never read past their TTL (decision.service): drop them
			const ttlDays = this.env.AI_DECISION_CACHE_TTL_DAYS;
			const decisions = ttlDays ? await this.store.pruneDecisions(new Date(now.getTime() - ttlDays * DAY_MS)) : 0;
			if (decisions) this.logger.log(`retention sweep deleted ${decisions} cached decision(s)`);
			const maxRunningMs = runMaxRunningMs(this.env);
			const staleRuns = await this.store.failStaleRuns(new Date(now.getTime() - maxRunningMs), STALE_RUN_ERROR, now);
			if (staleRuns) this.logger.warn(`retention sweep closed ${staleRuns} run(s) stuck running for over ${Math.round(maxRunningMs / 1000)} s`);
			if (counts.threads || counts.runs || counts.changeSets) {
				this.logger.log(
					`retention sweep deleted ${counts.threads} thread(s), ${counts.runs} run(s), ${counts.changeSets} change set(s)`,
				);
			}
			return { ...counts, staleRuns };
		} catch (error) {
			this.logger.warn(`retention sweep failed: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}
}
