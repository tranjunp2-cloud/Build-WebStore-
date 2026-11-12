import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, gte, ne, sql } from "drizzle-orm";
import { AgentError } from "../agent/agent-errors";
import type { AiRequestContext } from "../auth/context-token";
import { DB, type Database } from "../database/database.module";
import { aiUsageEvents } from "../database/schema";
import { IMAGE_TASK } from "../images/picture-quota";
import { rowMicros, WINDOW_MS } from "./org-battery";
import { monthlyBudgetMicros, SITE_TASK_PREFIX, siteBudgetMicros } from "./shop-limits";
import { monthStart } from "./spend-guard";

/**
 * The shop's longer and narrower allowances (token `lim`), next to the 24 h battery in `org-battery.ts`:
 *   - calendar month (Malaysia): all AI spend since the 1st vs `aiBudgetUsdMonthly`
 *   - website setup: spend of `sitegen.*` tasks over the rolling 24 h vs `siteBudgetUsd`, checked for those tasks only
 * Same cost rule as the battery (recorded price, else fallback rates; pictures excluded). Spend is cached per
 * org and window for 30 s (the allowance is applied per call, so a plan change takes effect at once); a failed
 * read lets the request through (the ledger is a meter, not a lock).
 */

export const SHOP_CAPS = Symbol("AI_PLATFORM_SHOP_CAPS");

const CACHE_MS = 30_000;

export const MONTH_EMPTY_MESSAGE = "AI is out for this month. It's back on the 1st. Upgrade your plan for more.";
export const SITE_EMPTY_MESSAGE = "Website setup AI is out for today. Please try again later. Upgrade your plan for more.";

export interface ShopCapsSource {
	/** the org's spend since `since` in USD micros, pictures excluded; only tasks starting with `taskPrefix` when given */
	spent(organizationId: string, since: Date, taskPrefix?: string): Promise<number>;
}

export class ShopCaps {
	private readonly logger = new Logger(ShopCaps.name);
	private readonly cache = new Map<string, { at: number; micros: number }>();
	private readonly pending = new Map<string, Promise<number>>();

	constructor(
		private readonly source: ShopCapsSource,
		private readonly clock: () => number = Date.now,
	) {}

	/** `window` names the cached reading: the month's start, or "24h" for a rolling window (whose `since` moves every call). */
	private spend(organizationId: string, window: string, since: Date, taskPrefix?: string): Promise<number> | number {
		const key = `${organizationId}|${taskPrefix ?? ""}|${window}`;
		const now = this.clock();
		const hit = this.cache.get(key);
		if (hit && now - hit.at < CACHE_MS) return hit.micros;
		let pending = this.pending.get(key);
		if (!pending) {
			pending = this.source
				.spent(organizationId, since, taskPrefix)
				.then((micros) => {
					this.cache.set(key, { at: this.clock(), micros });
					return micros;
				})
				.finally(() => this.pending.delete(key));
			this.pending.set(key, pending);
		}
		return pending;
	}

	/** True when the spend since `since` reached `budgetMicros`; false when unlimited or unreadable. */
	private async reached(organizationId: string, budgetMicros: number | null, window: string, since: Date, taskPrefix?: string): Promise<boolean> {
		if (budgetMicros === null) return false;
		try {
			return (await this.spend(organizationId, window, since, taskPrefix)) >= budgetMicros;
		} catch (error) {
			this.logger.warn(`AI allowance check failed (request allowed): ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/** True when the shop used up this month's AI allowance (Malaysia calendar month). */
	monthEmpty(ctx: Pick<AiRequestContext, "organizationId" | "limits">, now: Date = new Date(this.clock())): Promise<boolean> {
		const start = monthStart(now);
		return this.reached(ctx.organizationId, monthlyBudgetMicros(ctx), String(start.getTime()), start);
	}

	/**
	 * Throws 429 when the month's allowance is used up, and, for a `sitegen.*` task, when the website-setup
	 * allowance of the last 24 h is used up. Other tasks and the copilot never touch the website-setup budget.
	 */
	async assertAvailable(ctx: Pick<AiRequestContext, "organizationId" | "limits">, taskId?: string): Promise<void> {
		const now = new Date(this.clock());
		if (await this.monthEmpty(ctx, now)) throw new AgentError(MONTH_EMPTY_MESSAGE, 429);
		if (taskId?.startsWith(SITE_TASK_PREFIX) && (await this.reached(ctx.organizationId, siteBudgetMicros(ctx), "24h", new Date(now.getTime() - WINDOW_MS), SITE_TASK_PREFIX))) {
			throw new AgentError(SITE_EMPTY_MESSAGE, 429);
		}
	}
}

@Injectable()
export class DrizzleShopCapsSource implements ShopCapsSource {
	constructor(@Inject(DB) private readonly db: Database) {}

	async spent(organizationId: string, since: Date, taskPrefix?: string): Promise<number> {
		const u = aiUsageEvents;
		// the prefix is a code constant ("sitegen."), never user input; escaped for LIKE all the same
		const like = taskPrefix ? `${taskPrefix.replace(/[\\%_]/g, "\\$&")}%` : null;
		const result = await this.db.execute<{ micros: string | number | null }>(
			sql`SELECT COALESCE(sum(${rowMicros()}), 0)::bigint AS micros FROM ${u} WHERE ${and(
				sql`${u.organizationId} = ${organizationId}`,
				gte(u.createdAt, since),
				ne(u.task, IMAGE_TASK),
				like ? sql`${u.task} LIKE ${like}` : undefined,
			)}`,
		);
		return Number(result.rows[0]?.micros ?? 0);
	}
}
