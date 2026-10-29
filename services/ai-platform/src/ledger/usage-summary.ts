import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { aiUsageEvents } from "../database/schema";

export interface UsageSummaryRow {
	task: string;
	provider: string | null;
	model: string | null;
	/** ok + refused attempts. */
	calls: number;
	errors: number;
	inputTokens: number;
	cachedInputTokens: number;
	/** cachedInputTokens / inputTokens (0 when no input was recorded). */
	hitRatio: number;
	costUsdMicros: number;
	/** Successful calls with no price-book entry (their cost is missing from costUsdMicros). */
	unpricedCalls: number;
}

type Aggregate = Omit<UsageSummaryRow, "hitRatio">;

export function withHitRatio(row: Aggregate): UsageSummaryRow {
	return { ...row, hitRatio: row.inputTokens > 0 ? row.cachedInputTokens / row.inputTokens : 0 };
}

export interface UsageSummaryOptions {
	days: number;
	organizationId?: string;
	now?: Date;
}

/** The aggregate query behind `summarizeUsage` (read-only). */
export function usageSummaryQuery(db: Database, options: UsageSummaryOptions) {
	const since = new Date((options.now ?? new Date()).getTime() - options.days * 24 * 60 * 60 * 1000);
	const t = aiUsageEvents;
	return db
		.select({
			task: t.task,
			provider: t.provider,
			model: t.model,
			calls: sql<number>`count(*) filter (where ${t.outcome} <> 'error')`.mapWith(Number),
			errors: sql<number>`count(*) filter (where ${t.outcome} = 'error')`.mapWith(Number),
			inputTokens: sql<number>`coalesce(sum(${t.inputTokens}), 0)`.mapWith(Number),
			cachedInputTokens: sql<number>`coalesce(sum(${t.cachedInputTokens}), 0)`.mapWith(Number),
			costUsdMicros: sql<number>`coalesce(sum(${t.costUsdMicros}), 0)`.mapWith(Number),
			unpricedCalls: sql<number>`count(*) filter (where ${t.outcome} <> 'error' and ${t.costUsdMicros} is null)`.mapWith(Number),
		})
		.from(t)
		.where(and(gte(t.createdAt, since), options.organizationId ? eq(t.organizationId, options.organizationId) : undefined))
		.groupBy(t.task, t.provider, t.model)
		.orderBy(asc(t.task), asc(t.provider), asc(t.model));
}

/**
 * Roll-up of `ai_usage_events` per task + provider + model over the last
 * `days` — the prompt-cache hit ratio and cost each prompt actually gets.
 */
export async function summarizeUsage(db: Database, options: UsageSummaryOptions): Promise<UsageSummaryRow[]> {
	return (await usageSummaryQuery(db, options)).map(withHitRatio);
}

/** Plain-text table for the `usage:report` CLI. */
export function formatUsageReport(rows: UsageSummaryRow[]): string {
	if (rows.length === 0) return "No AI usage recorded in this window.";
	const header = ["task", "provider:model", "calls", "errors", "input", "cached", "hit %", "cost USD"];
	const body = rows.map((r) => [
		r.task,
		`${r.provider ?? "-"}:${r.model ?? "-"}`,
		String(r.calls),
		String(r.errors),
		String(r.inputTokens),
		String(r.cachedInputTokens),
		(r.hitRatio * 100).toFixed(1),
		`${(r.costUsdMicros / 1_000_000).toFixed(4)}${r.unpricedCalls > 0 ? ` (+${r.unpricedCalls} unpriced)` : ""}`,
	]);
	const widths = header.map((h, i) => Math.max(h.length, ...body.map((cells) => cells[i]?.length ?? 0)));
	const line = (cells: string[]) =>
		cells.map((cell, i) => (i < 2 ? cell.padEnd(widths[i] ?? 0) : cell.padStart(widths[i] ?? 0))).join("  ");
	return [line(header), widths.map((w) => "-".repeat(w)).join("  "), ...body.map(line)].join("\n");
}
