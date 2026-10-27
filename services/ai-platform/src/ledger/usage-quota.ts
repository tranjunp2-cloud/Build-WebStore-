import { Inject, Injectable, Optional } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { ORG_BATTERY, type OrgBattery, WINDOW_MS } from "../cost/org-battery";
import { aiBudgetMicros, picturesPerDay } from "../cost/shop-limits";
import { SPEND_GUARD, type SpendGuard } from "../cost/spend-guard";
import { DB, type Database } from "../database/database.module";
import { aiImageReservations, aiUsageEvents } from "../database/schema";
import { IMAGE_TASK } from "../images/picture-quota";


/** What one rolling-24h meter counted: how many, and when the oldest counted item happened. */
export interface Meter {
	used: number;
	oldest: Date | null;
}

export interface UsageMeters {
	pictures(organizationId: string, since: Date): Promise<Meter>;
}

export const USAGE_METERS = Symbol("AI_PLATFORM_USAGE_METERS");

export interface UsageLine {
	used: number;
	/** null = unlimited on the shop's plan */
	limit: number | null;
	/** when the oldest counted item leaves the 24 h window (one slot frees); null when nothing is used */
	nextFreeAt: string | null;
}

export interface OrgUsage {
	/** the shop's AI battery (assistant + writing tools merged); no dollars leave the service */
	ai: { leftPercent: number; nextFreeAt: string | null };
	pictures: UsageLine;
	paused: boolean;
	/** the shop's plan name from the context token; null when the token carries no limits */
	plan: string | null;
}

type CountRow = { used: number | string | null; oldest: Date | string | null };

function toMeter(row: CountRow | undefined): Meter {
	const oldest = row?.oldest ? new Date(row.oldest) : null;
	return { used: Number(row?.used ?? 0), oldest };
}

/** The side that holds more (the quotas count GREATEST of two sources); on a tie, the older item. */
function larger(a: Meter, b: Meter): Meter {
	if (a.used !== b.used) return a.used > b.used ? a : b;
	if (!a.oldest || !b.oldest) return { used: a.used, oldest: a.oldest ?? b.oldest };
	return { used: a.used, oldest: a.oldest < b.oldest ? a.oldest : b.oldest };
}

/**
 * Read-only mirror of the picture quota's count (no lock, no reservation): the same tables and
 * conditions the enforcing code uses (its GREATEST), plus the oldest counted row for `nextFreeAt`.
 */
@Injectable()
export class DrizzleUsageMeters implements UsageMeters {
	constructor(@Inject(DB) private readonly db: Database) {}

	private async one(query: ReturnType<typeof sql>): Promise<Meter> {
		const result = await this.db.execute<CountRow>(query);
		return toMeter(result.rows[0]);
	}

	async pictures(organizationId: string, since: Date): Promise<Meter> {
		const r = aiImageReservations;
		const u = aiUsageEvents;
		// a success is both a reservation and ledger rows; ledger rows alone are from before reservations
		const [reserved, ledger] = await Promise.all([
			this.one(sql`SELECT coalesce(sum(${r.pictures}), 0)::int AS used, min(${r.createdAt}) AS oldest FROM ${r} WHERE ${r.organizationId} = ${organizationId} AND ${r.createdAt} >= ${since}`),
			this.one(sql`SELECT count(*)::int AS used, min(${u.createdAt}) AS oldest FROM ${u} WHERE ${u.organizationId} = ${organizationId} AND ${u.task} = ${IMAGE_TASK} AND ${u.outcome} <> 'error' AND ${u.createdAt} >= ${since}`),
		]);
		return larger(reserved, ledger);
	}
}

/** `GET /agent/usage`: the AI battery (percent left), the picture count, and the global pause. */
@Injectable()
export class UsageQuotaService {
	constructor(
		@Inject(USAGE_METERS) private readonly meters: UsageMeters,
		@Inject(ENV) private readonly env: Env,
		@Optional() @Inject(SPEND_GUARD) private readonly spend?: SpendGuard,
		@Optional() @Inject(ORG_BATTERY) private readonly battery?: OrgBattery,
	) {}

	async read(ctx: Pick<AiRequestContext, "organizationId" | "limits">, now: Date = new Date()): Promise<OrgUsage> {
		const organizationId = ctx.organizationId;
		const since = new Date(now.getTime() - WINDOW_MS);
		const [ai, pictures, paused] = await Promise.all([
			this.aiLine(organizationId, aiBudgetMicros(ctx, this.env)),
			this.meters.pictures(organizationId, since),
			this.spend?.isPaused() ?? false,
		]);
		return {
			ai,
			pictures: {
				used: pictures.used,
				limit: picturesPerDay(ctx, this.env),
				nextFreeAt: pictures.used > 0 && pictures.oldest ? new Date(pictures.oldest.getTime() + WINDOW_MS).toISOString() : null,
			},
			paused,
			plan: ctx.limits?.plan ?? null,
		};
	}

	/** A battery that cannot be read shows as full: the gauge is a meter, never the reason a page fails. */
	private async aiLine(organizationId: string, budgetMicros: number | null): Promise<OrgUsage["ai"]> {
		try {
			const status = await this.battery?.status(organizationId, budgetMicros);
			if (status) return { leftPercent: status.leftPercent, nextFreeAt: status.nextFreeAt?.toISOString() ?? null };
		} catch {
			// fall through
		}
		return { leftPercent: 100, nextFreeAt: null };
	}
}
