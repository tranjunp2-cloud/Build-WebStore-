import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { DB, type Database } from "../database/database.module";
import { aiUsageEvents } from "../database/schema";
import { estimateCostMicros, type TokenUsage } from "./price-book";

export interface UsageEvent extends TokenUsage {
	organizationId: string;
	userId?: string;
	surface: "merchant" | "shopper" | "system";
	task: string;
	runId?: string;
	provider?: string;
	model?: string;
	latencyMs: number;
	outcome: "ok" | "refused" | "error";
	errorCode?: string;
}

export interface UsageLedger {
	record(event: UsageEvent): Promise<void>;
	/** Successful + refused calls since `since` (failed attempts don't burn quota); one task only when given. */
	countSince(organizationId: string, since: Date, task?: string): Promise<number>;
}

export const USAGE_LEDGER = Symbol("AI_PLATFORM_USAGE_LEDGER");

/** Every model call lands here, including failures. A ledger write never fails the call. */
@Injectable()
export class DrizzleUsageLedger implements UsageLedger {
	private readonly logger = new Logger(DrizzleUsageLedger.name);

	constructor(@Inject(DB) private readonly db: Database) {}

	async countSince(organizationId: string, since: Date, task?: string): Promise<number> {
		const [row] = await this.db
			.select({ value: count() })
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.organizationId, organizationId),
					gte(aiUsageEvents.createdAt, since),
					ne(aiUsageEvents.outcome, "error"),
					task ? eq(aiUsageEvents.task, task) : undefined,
				),
			);
		return row?.value ?? 0;
	}

	/**
	 * Every org's ledgered cost since `since`, in USD micros (the daily spend guard). Served by
	 * `ai_usage_events_created_idx (created_at) INCLUDE (cost_usd_micros)`: an index-only range scan.
	 */
	async costSinceMicros(since: Date): Promise<number> {
		const [row] = await this.db
			.select({ value: sql<string | null>`COALESCE(SUM(${aiUsageEvents.costUsdMicros}), 0)` })
			.from(aiUsageEvents)
			.where(gte(aiUsageEvents.createdAt, since));
		return Number(row?.value ?? 0);
	}

	async record(event: UsageEvent): Promise<void> {
		const cost =
			event.provider && event.model ? estimateCostMicros(event.provider, event.model, event) : null;
		try {
			await this.db.insert(aiUsageEvents).values({
				organizationId: event.organizationId,
				userId: event.userId ?? null,
				surface: event.surface,
				task: event.task,
				runId: event.runId ?? null,
				provider: event.provider ?? null,
				model: event.model ?? null,
				inputTokens: event.inputTokens ?? null,
				outputTokens: event.outputTokens ?? null,
				cachedInputTokens: event.cachedInputTokens ?? null,
				costUsdMicros: cost,
				latencyMs: event.latencyMs,
				outcome: event.outcome,
				errorCode: event.errorCode ?? null,
			});
		} catch (error) {
			this.logger.warn(`usage ledger write failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
