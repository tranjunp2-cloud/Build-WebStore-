import { Logger } from "@nestjs/common";
import { AgentError } from "../agent/agent-errors";
import { isFreePlan, type PlatformCaps } from "./platform-caps";

/**
 * Platform-wide spend guard. Before a copilot run, a task or a picture starts, the ledgered cost of every org
 * (today in Malaysia time; and this calendar month when a monthly cap is set) is compared with the caps; at or
 * above one the request is refused with 503 and nothing calls a provider until the period ends.
 *
 * Caps: the daily cap is `caps.dailyUsd` from Payload when that key is present (null = off), else the env
 * `AI_DAILY_BUDGET_USD` (unset = off); the monthly cap is `caps.monthlyUsd` (null/absent = off). The caps are read
 * per call, so a change in Payload applies without a restart. "Pause Free first": at `caps.pauseFreeAtPercent` of
 * a cap, FREEMIUM shops are refused (everyone else keeps going until 100 %).
 *
 * Each sum is one indexed range query (`ai_usage_events_created_idx`), cached per instance for 60 s, so the request
 * path never waits on more than one query a minute per window; parallel requests share it. A failed query lets
 * requests through (the ledger is a meter, not a lock). Warn lines at the alert levels below 100 % (once per level
 * per period per instance), one error line per minute per cap while paused.
 */

export const SPEND_GUARD = Symbol("AI_PLATFORM_SPEND_GUARD");

export const PAUSED_MESSAGE = "AI is paused for today, it will be back tomorrow.";
export const PAUSED_MONTH_MESSAGE = "AI is paused for this month, it will be back on the 1st.";

/** The ledgered cost since `since`, in USD micros. */
export type SpendSource = (since: Date) => Promise<number>;

/** Why a request is refused: the cap that was reached, or Free paused ahead of it. */
export type PauseScope = "day" | "month";

const CACHE_MS = 60_000;
const ERROR_EVERY_MS = 60_000;
/** The shop's day (Asia/Kuala_Lumpur, UTC+8 all year). */
const DAY_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WARN_PERCENTS = [50, 80];

/** Start of the Malaysia day `now` is in. */
export function dayStart(now: Date): Date {
	return new Date(Math.floor((now.getTime() + DAY_OFFSET_MS) / DAY_MS) * DAY_MS - DAY_OFFSET_MS);
}

/** Start of the Malaysia calendar month `now` is in. */
export function monthStart(now: Date): Date {
	const local = new Date(now.getTime() + DAY_OFFSET_MS);
	return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - DAY_OFFSET_MS);
}

/** One window's spend (today / this month): cached 60 s, shared by parallel callers, null when it cannot be read. */
class WindowSpend {
	private cached: { start: number; at: number; micros: number } | null = null;
	private pending: Promise<number> | null = null;

	constructor(
		private readonly source: SpendSource,
		private readonly clock: () => number,
		private readonly onError: (error: unknown) => void,
	) {}

	async read(start: Date): Promise<number | null> {
		const now = this.clock();
		const cached = this.cached;
		if (cached && cached.start === start.getTime() && now - cached.at < CACHE_MS) return cached.micros;
		if (!this.pending) {
			this.pending = this.source(start)
				.then((micros) => {
					this.cached = { start: start.getTime(), at: this.clock(), micros };
					return micros;
				})
				.finally(() => {
					this.pending = null;
				});
		}
		try {
			return await this.pending;
		} catch (error) {
			this.onError(error);
			return cached && cached.start === start.getTime() ? cached.micros : null;
		}
	}
}

interface Check {
	scope: PauseScope;
	/** what the cap is called in log lines */
	name: string;
	capUsd: number;
	spent: number;
	period: string;
	message: string;
}

export class SpendGuard {
	private readonly logger = new Logger(SpendGuard.name);
	private readonly day: WindowSpend;
	private readonly month: WindowSpend;
	private warned = new Set<string>();
	private readonly lastError = new Map<PauseScope, number>();

	/**
	 * @param budgetUsd env `AI_DAILY_BUDGET_USD`: the daily cap while Payload sets none
	 * @param source the ledgered cost since a moment
	 * @param caps the platform caps from Payload (read per call); undefined = none set
	 */
	constructor(
		private readonly budgetUsd: number | undefined,
		source: SpendSource,
		private readonly clock: () => number = Date.now,
		private readonly caps: () => PlatformCaps | undefined = () => undefined,
	) {
		const onError = (error: unknown) =>
			this.logger.warn(`AI spend check failed (requests allowed): ${error instanceof Error ? error.message : String(error)}`);
		this.day = new WindowSpend(source, clock, onError);
		this.month = new WindowSpend(source, clock, onError);
	}

	/** The daily cap in USD (Payload's when its key is present, else the env), undefined when off. */
	private dailyCap(caps: PlatformCaps | undefined): { usd: number; name: string } | undefined {
		const fromPayload = caps?.dailyUsd;
		if (fromPayload !== undefined) return fromPayload !== null && fromPayload > 0 ? { usd: fromPayload, name: "the platform daily cap" } : undefined;
		return this.budgetUsd !== undefined && this.budgetUsd > 0 ? { usd: this.budgetUsd, name: "AI_DAILY_BUDGET_USD" } : undefined;
	}

	private monthlyCap(caps: PlatformCaps | undefined): number | undefined {
		const usd = caps?.monthlyUsd;
		return usd !== undefined && usd !== null && usd > 0 ? usd : undefined;
	}

	/** True when at least one cap is on right now. */
	get enabled(): boolean {
		const caps = this.caps();
		return this.dailyCap(caps) !== undefined || this.monthlyCap(caps) !== undefined;
	}

	/** The caps that are on, each with its window's spend; windows that cannot be read are left out. */
	private async checks(caps: PlatformCaps | undefined, now: number): Promise<Check[]> {
		const daily = this.dailyCap(caps);
		const monthly = this.monthlyCap(caps);
		const today = dayStart(new Date(now));
		const thisMonth = monthStart(new Date(now));
		const [daySpent, monthSpent] = await Promise.all([
			daily ? this.day.read(today) : null,
			monthly ? this.month.read(thisMonth) : null,
		]);
		const out: Check[] = [];
		if (daily && daySpent !== null) {
			out.push({ scope: "day", name: daily.name, capUsd: daily.usd, spent: daySpent, period: today.toISOString().slice(0, 10), message: PAUSED_MESSAGE });
		}
		if (monthly && monthSpent !== null) {
			out.push({ scope: "month", name: "the platform monthly cap", capUsd: monthly, spent: monthSpent, period: thisMonth.toISOString().slice(0, 7), message: PAUSED_MONTH_MESSAGE });
		}
		return out;
	}

	/** The first check that refuses this plan, if any: the cap reached, or Free paused ahead of it. */
	private refusal(checks: Check[], caps: PlatformCaps | undefined, plan: string | null | undefined): { check: Check; reason: "cap" | "free-first" } | undefined {
		const freeAt = caps?.pauseFreeAtPercent ?? null;
		for (const check of checks) {
			const share = check.spent / Math.round(check.capUsd * 1_000_000);
			if (share >= 1) return { check, reason: "cap" };
			if (freeAt !== null && isFreePlan(plan) && share * 100 >= freeAt) return { check, reason: "free-first" };
		}
		return undefined;
	}

	/** Throws 503 when a platform cap is reached (or, for a FREEMIUM `plan`, the Free-first threshold). */
	async assertWithinBudget(plan?: string | null): Promise<void> {
		const caps = this.caps();
		if (this.dailyCap(caps) === undefined && this.monthlyCap(caps) === undefined) return;
		const now = this.clock();
		const checks = await this.checks(caps, now);
		this.warn(checks, caps);
		const refused = this.refusal(checks, caps, plan);
		if (!refused) return;
		const { check, reason } = refused;
		const last = this.lastError.get(check.scope) ?? 0;
		if (now - last >= ERROR_EVERY_MS) {
			this.lastError.set(check.scope, now);
			const spent = (check.spent / 1_000_000).toFixed(2);
			const until = check.scope === "day" ? "tomorrow" : "the 1st";
			this.logger.error(
				reason === "cap"
					? `AI paused: ${check.scope === "day" ? "today's" : "this month's"} spend ${spent} USD reached ${check.name} ${check.capUsd}; requests are refused until ${until} (Malaysia time)`
					: `AI paused for Free shops: ${check.scope === "day" ? "today's" : "this month's"} spend ${spent} USD passed ${caps?.pauseFreeAtPercent}% of ${check.name} ${check.capUsd}; other plans continue until ${until} (Malaysia time)`,
			);
		}
		throw new AgentError(check.message, 503);
	}

	/** Warn lines at the alert levels below 100 %, once per level per period per instance. */
	private warn(checks: Check[], caps: PlatformCaps | undefined): void {
		const levels = caps ? caps.alertPercents.filter((p) => p < 100) : DEFAULT_WARN_PERCENTS;
		for (const check of checks) {
			const share = (check.spent / Math.round(check.capUsd * 1_000_000)) * 100;
			if (share >= 100) continue;
			for (const level of levels) {
				const key = `${check.scope}:${check.period}:${level}`;
				if (share >= level && !this.warned.has(key)) {
					this.warned.add(key);
					this.logger.warn(
						`AI spend ${check.scope === "day" ? "today" : "this month"} is ${share.toFixed(0)}% of ${check.name} (${(check.spent / 1_000_000).toFixed(2)} of ${check.capUsd} USD)`,
					);
				}
			}
		}
	}

	/**
	 * What pauses this plan right now: "day" / "month" scope of the refusing cap, or null. Never throws or logs,
	 * null when off or unreadable (the /agent/usage read).
	 */
	async pausedBy(plan?: string | null): Promise<PauseScope | null> {
		try {
			const caps = this.caps();
			if (this.dailyCap(caps) === undefined && this.monthlyCap(caps) === undefined) return null;
			const checks = await this.checks(caps, this.clock());
			return this.refusal(checks, caps, plan)?.check.scope ?? null;
		} catch {
			return null;
		}
	}

	/** True when this plan is refused right now. */
	async isPaused(plan?: string | null): Promise<boolean> {
		return (await this.pausedBy(plan)) !== null;
	}
}
