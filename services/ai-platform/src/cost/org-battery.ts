import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { AgentError } from "../agent/agent-errors";
import { DB, type Database } from "../database/database.module";
import { aiUsageEvents } from "../database/schema";
import { IMAGE_TASK } from "../images/picture-quota";
import { UNPRICED_FALLBACK_RATES } from "../ledger/price-book";

/**
 * The per-shop "AI battery": the shop's AI spend over the last rolling 24 h against
 * the shop's plan budget (token claim `lim.aiBudgetUsd`, else `AI_DAILY_BUDGET_USD_PER_ORG`). Pictures are excluded (they have their own count); every other ledger
 * row counts, errors with tokens included. Rows without a price count at the deepseek-flash peak rates
 * (`UNPRICED_FALLBACK_RATES`), so an unknown model still drains it. The org's spend is cached per org for 30 s (the budget is applied per call);
 * a failed read lets the request through (the ledger is a meter, not a lock).
 */

export const ORG_BATTERY = Symbol("AI_PLATFORM_ORG_BATTERY");

export const WINDOW_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 30_000;
/** The walk for `nextFreeAt` looks at no more rows than this (oldest first). */
const WALK_LIMIT = 5000;

export interface BatteryStatus {
	/** whole percent left, 0..100 */
	leftPercent: number;
	/** when AI is usable again (empty) or when the oldest spend frees up (not empty); null with no spend */
	nextFreeAt: Date | null;
	empty: boolean;
}

/** One window row: when it happened and what it cost, in USD micros. */
export interface SpendRow {
	createdAt: Date;
	micros: number;
}

export interface BatterySource {
	/** total spend in the window, USD micros */
	spent(organizationId: string, since: Date): Promise<number>;
	/** the window's spending rows, oldest first, at most `limit` */
	rows(organizationId: string, since: Date, limit: number): Promise<SpendRow[]>;
}

/** Pure battery math over a source reading. `rows` is only needed when something was spent. */
export function computeBattery(spentMicros: number, budgetMicros: number | null, rows: SpendRow[]): BatteryStatus {
	if (budgetMicros === null) return { leftPercent: 100, nextFreeAt: null, empty: false };
	const empty = spentMicros >= budgetMicros;
	const leftPercent = budgetMicros <= 0 ? 0 : Math.min(100, Math.max(0, Math.round(100 * (1 - spentMicros / budgetMicros))));
	if (spentMicros <= 0) return { leftPercent, nextFreeAt: null, empty };
	if (!empty) {
		const oldest = rows[0];
		return { leftPercent, nextFreeAt: oldest ? new Date(oldest.createdAt.getTime() + WINDOW_MS) : null, empty };
	}
	// empty: the first moment enough of the oldest rows have aged out to drop under the budget
	let remaining = spentMicros;
	for (const row of rows) {
		remaining -= row.micros;
		if (remaining < budgetMicros) return { leftPercent, nextFreeAt: new Date(row.createdAt.getTime() + WINDOW_MS), empty };
	}
	return { leftPercent, nextFreeAt: null, empty };
}

const HHMM = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "AI is out for today. It's back at 14:30. Upgrade your plan for more." (Malaysia time), or the no-time line when unknown. */
export function batteryEmptyMessage(nextFreeAt: Date | null): string {
	return nextFreeAt
		? `AI is out for today. It's back at ${HHMM.format(nextFreeAt)}. Upgrade your plan for more.`
		: "AI is out for today. Please try again later. Upgrade your plan for more.";
}

/** The per-org spend reading (cached 30 s); the budget is applied per call, so a plan change takes effect at once. */
interface Spend {
	spent: number;
	rows: SpendRow[];
}

export class OrgBattery {
	private readonly logger = new Logger(OrgBattery.name);
	private readonly cache = new Map<string, { at: number; spend: Spend }>();
	private readonly pending = new Map<string, Promise<Spend>>();

	constructor(
		private readonly source: BatterySource,
		private readonly clock: () => number = Date.now,
	) {}

	/** The org's battery against `budgetMicros` (null = unlimited); throws when the ledger cannot be read. */
	async status(organizationId: string, budgetMicros: number | null): Promise<BatteryStatus> {
		if (budgetMicros === null) return computeBattery(0, null, []);
		const { spent, rows } = await this.spend(organizationId);
		return computeBattery(spent, budgetMicros, rows);
	}

	private async spend(organizationId: string): Promise<Spend> {
		const now = this.clock();
		const hit = this.cache.get(organizationId);
		if (hit && now - hit.at < CACHE_MS) return hit.spend;
		let pending = this.pending.get(organizationId);
		if (!pending) {
			const since = new Date(now - WINDOW_MS);
			pending = this.read(organizationId, since)
				.then((spend) => {
					this.cache.set(organizationId, { at: this.clock(), spend });
					return spend;
				})
				.finally(() => this.pending.delete(organizationId));
			this.pending.set(organizationId, pending);
		}
		return pending;
	}

	private async read(organizationId: string, since: Date): Promise<Spend> {
		const spent = await this.source.spent(organizationId, since);
		const rows = spent > 0 ? await this.source.rows(organizationId, since, WALK_LIMIT) : [];
		return { spent, rows };
	}

	/** Throws 429 when the org's battery is empty; an unreadable battery lets the request through. */
	async assertAvailable(organizationId: string, budgetMicros: number | null): Promise<void> {
		let status: BatteryStatus;
		try {
			status = await this.status(organizationId, budgetMicros);
		} catch (error) {
			this.logger.warn(`AI battery check failed (request allowed): ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		if (status.empty) throw new AgentError(batteryEmptyMessage(status.nextFreeAt), 429);
	}
}

/** Micro-dollars of one ledger row: its recorded cost, else tokens at the fallback rates (nulls as 0). */
export const rowMicros = () => {
	const u = aiUsageEvents;
	const r = UNPRICED_FALLBACK_RATES;
	return sql`COALESCE(${u.costUsdMicros}, round(
		GREATEST(COALESCE(${u.inputTokens}, 0) - COALESCE(${u.cachedInputTokens}, 0), 0) * ${r.input}::float8
		+ COALESCE(${u.cachedInputTokens}, 0) * ${r.cachedInput}::float8
		+ COALESCE(${u.outputTokens}, 0) * ${r.output}::float8))::bigint`;
};

@Injectable()
export class DrizzleBatterySource implements BatterySource {
	constructor(@Inject(DB) private readonly db: Database) {}

	async spent(organizationId: string, since: Date): Promise<number> {
		const u = aiUsageEvents;
		const result = await this.db.execute<{ micros: string | number | null }>(
			sql`SELECT COALESCE(sum(${rowMicros()}), 0)::bigint AS micros FROM ${u} WHERE ${u.organizationId} = ${organizationId} AND ${u.createdAt} >= ${since} AND ${u.task} <> ${IMAGE_TASK}`,
		);
		return Number(result.rows[0]?.micros ?? 0);
	}

	async rows(organizationId: string, since: Date, limit: number): Promise<SpendRow[]> {
		const u = aiUsageEvents;
		const result = await this.db.execute<{ created_at: Date | string; micros: string | number }>(
			sql`SELECT ${u.createdAt} AS created_at, ${rowMicros()} AS micros FROM ${u} WHERE ${u.organizationId} = ${organizationId} AND ${u.createdAt} >= ${since} AND ${u.task} <> ${IMAGE_TASK} ORDER BY ${u.createdAt} ASC LIMIT ${limit}`,
		);
		return result.rows.map((row) => ({ createdAt: new Date(row.created_at), micros: Number(row.micros) }));
	}
}
