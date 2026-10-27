import { Controller, Get, HttpException, Inject, Query, Req } from "@nestjs/common";
import { asc, eq, gt, sql } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { ContextTokenError, verifyUsageSyncToken } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { DB, type Database } from "../database/database.module";
import { aiRuns, aiUsageEvents } from "../database/schema";
import { IMAGE_TASK } from "../images/picture-quota";
import { fallbackCostMicros } from "./price-book";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const QuerySchema = z.object({
	after: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

function problem(status: number, title: string, detail: string): HttpException {
	return new HttpException({ title, status, detail }, status);
}

/** Read-only feed of the usage ledger for prime-web's log sync (ordered by id, resume with `nextAfter`). */
@Controller("internal/usage-events")
export class UsageEventsController {
	constructor(
		@Inject(ENV) private readonly env: Env,
		@Inject(DB) private readonly db: Database,
	) {}

	private async authorize(request: FastifyRequest): Promise<void> {
		const header = request.headers.authorization ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
		if (!token) throw problem(401, "Unauthorized", "Missing sync token.");
		try {
			await verifyUsageSyncToken(token, this.env.AI_PLATFORM_CONTEXT_SECRET);
		} catch (error) {
			if (error instanceof ContextTokenError) throw problem(401, "Unauthorized", "Invalid sync token.");
			throw error;
		}
	}

	@Get()
	async list(@Req() request: FastifyRequest, @Query() query: Record<string, unknown>) {
		await this.authorize(request);
		const parsed = QuerySchema.safeParse({ after: query.after || undefined, limit: query.limit || undefined });
		if (!parsed.success) throw problem(400, "Bad request", "after and limit must be non-negative integers (limit 1-1000).");
		const { after, limit } = parsed.data;
		// the run gives the chat's context (where it was asked, which chat); never its prompt or answer
		const rows = await this.db
			.select({
				event: aiUsageEvents,
				runDomain: aiRuns.domain,
				threadId: aiRuns.threadId,
				pagePath: sql<string | null>`${aiRuns.run} -> 'page' ->> 'path'`,
				pageTitle: sql<string | null>`${aiRuns.run} -> 'page' ->> 'title'`,
				pageModule: sql<string | null>`${aiRuns.run} -> 'page' ->> 'module'`,
			})
			.from(aiUsageEvents)
			.leftJoin(aiRuns, eq(aiRuns.id, aiUsageEvents.runId))
			.where(gt(aiUsageEvents.id, after))
			.orderBy(asc(aiUsageEvents.id))
			.limit(limit);
		const events = rows.map(({ event: row, ...run }) => ({
			id: row.id,
			organizationId: row.organizationId,
			userId: row.userId,
			surface: row.surface,
			task: row.task,
			runId: row.runId,
			provider: row.provider,
			model: row.model,
			inputTokens: row.inputTokens,
			outputTokens: row.outputTokens,
			cachedInputTokens: row.cachedInputTokens,
			costUsdMicros: row.costUsdMicros,
			// what the call drained from the shop's AI battery: its price, else tokens at the fallback rates; pictures have their own count
			batteryUsdMicros: row.task === IMAGE_TASK ? 0 : (row.costUsdMicros ?? fallbackCostMicros(row)),
			latencyMs: row.latencyMs,
			outcome: row.outcome as "ok" | "refused" | "error",
			errorCode: row.errorCode,
			createdAt: row.createdAt.toISOString(),
			// null when the call had no run, or its run is gone (chat deleted or past retention)
			run: run.runDomain
				? { domain: run.runDomain, threadId: run.threadId, pagePath: run.pagePath, pageTitle: run.pageTitle, pageModule: run.pageModule }
				: null,
		}));
		return { events, nextAfter: events.at(-1)?.id ?? after };
	}
}
