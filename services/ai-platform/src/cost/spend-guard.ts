import { Logger } from "@nestjs/common";
import { AgentError } from "../agent/agent-errors";

/**
 * Global daily spend guard (`AI_DAILY_BUDGET_USD`, unset = off). Before a copilot run or a task starts,
 * today's ledgered cost (every org, Malaysia day) is compared with the budget; above it the request is
 * refused with 503 and nothing calls a provider until the next day. The sum is one indexed query
 * (`ai_usage_events_created_idx`), cached per instance for 60 s, so the request path never waits on more
 * than one query a minute; parallel requests share it. A failed query lets requests through (the
 * ledger is a meter, not a lock). Warn lines at 50 % and 80 % (once per level per day per instance),
 * one error line per minute while paused.
 */

export const SPEND_GUARD = Symbol("AI_PLATFORM_SPEND_GUARD");

export const PAUSED_MESSAGE = "AI is paused for today, it will be back tomorrow.";

/** Today's ledgered cost since `since`, in USD micros. */
export type SpendSource = (since: Date) => Promise<number>;

const CACHE_MS = 60_000;
const ERROR_EVERY_MS = 60_000;
/** The shop's day (Asia/Kuala_Lumpur, UTC+8 all year). */
const DAY_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the Malaysia day `now` is in. */
export function dayStart(now: Date): Date {
	return new Date(Math.floor((now.getTime() + DAY_OFFSET_MS) / DAY_MS) * DAY_MS - DAY_OFFSET_MS);
}

export class SpendGuard {
	private readonly logger = new Logger(SpendGuard.name);
	private cached: { day: number; at: number; micros: number } | null = null;
	private pending: Promise<number> | null = null;
	private warned = new Set<string>();
	private lastError = 0;

	constructor(
		private readonly budgetUsd: number | undefined,
		private readonly source: SpendSource,
		private readonly clock: () => number = Date.now,
	) {}

	get enabled(): boolean {
		return this.budgetUsd !== undefined && this.budgetUsd > 0;
	}

	/** Throws 503 when today's spend reached the budget. */
	async assertWithinBudget(): Promise<void> {
		if (!this.enabled) return;
		const budgetMicros = Math.round((this.budgetUsd as number) * 1_000_000);
		const spent = await this.spentToday();
		if (spent === null) return;
		const now = this.clock();
		const day = dayStart(new Date(now)).toISOString().slice(0, 10);
		const share = spent / budgetMicros;
		for (const level of [0.5, 0.8]) {
			const key = `${day}:${level}`;
			if (share >= level && share < 1 && !this.warned.has(key)) {
				this.warned.add(key);
				this.logger.warn(`AI spend today is ${(share * 100).toFixed(0)}% of AI_DAILY_BUDGET_USD (${(spent / 1_000_000).toFixed(2)} of ${this.budgetUsd} USD)`);
			}
		}
		if (spent < budgetMicros) return;
		if (now - this.lastError >= ERROR_EVERY_MS) {
			this.lastError = now;
			this.logger.error(`AI paused: today's spend ${(spent / 1_000_000).toFixed(2)} USD reached AI_DAILY_BUDGET_USD ${this.budgetUsd}; requests are refused until tomorrow (Malaysia time)`);
		}
		throw new AgentError(PAUSED_MESSAGE, 503);
	}

	/** True when today's spend reached the budget; never throws or logs, false when off or unreadable (the /agent/usage read). */
	async isPaused(): Promise<boolean> {
		if (!this.enabled) return false;
		try {
			const spent = await this.spentToday();
			return spent !== null && spent >= Math.round((this.budgetUsd as number) * 1_000_000);
		} catch {
			return false;
		}
	}

	/** Today's cost in micros (cached 60 s; a new day starts at 0); null when it could not be read. */
	private async spentToday(): Promise<number | null> {
		const now = this.clock();
		const start = dayStart(new Date(now));
		const cached = this.cached;
		if (cached && cached.day === start.getTime() && now - cached.at < CACHE_MS) return cached.micros;
		if (!this.pending) {
			this.pending = this.source(start)
				.then((micros) => {
					this.cached = { day: start.getTime(), at: this.clock(), micros };
					return micros;
				})
				.finally(() => {
					this.pending = null;
				});
		}
		try {
			return await this.pending;
		} catch (error) {
			this.logger.warn(`AI spend check failed (requests allowed): ${error instanceof Error ? error.message : String(error)}`);
			return cached && cached.day === start.getTime() ? cached.micros : null;
		}
	}
}
