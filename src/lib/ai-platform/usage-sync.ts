import "server-only";

import { randomUUID } from "node:crypto";
import config from "@payload-config";
import { SignJWT } from "jose";
import { type SQL, sql } from "drizzle-orm";
import { getPayload } from "payload";
import { type ReportsDb, rowsOf } from "@/lib/reports/report-db";
import { getAiPlatformContextSecret, getAiPlatformUrl } from "./config";
import { aiPlatformJson } from "./upstream";
import {
	type UsageEvent,
	UsageEventSchema,
	UsagePageSchema,
	type UsageLogRow,
	tenantOrgMap,
	toLogRow,
	userPlatformMap,
} from "./usage-sync-map";
import { currentPlanByTenant } from "./usage-sync-plan";

/**
 * Copies ai-platform's usage ledger into `ai_usage_logs` (the Payload admin list super-admins read).
 * The cursor is the highest `platform_event_id` already copied; an upsert on that unique column makes a re-run (or two
 * overlapping runs) harmless, and a run started `from` an older id refreshes rows copied before a column existed (backfill).
 * Each page is fetched, mapped and written in one statement.
 */

export const USAGE_PAGE_SIZE = 500;
export const USAGE_MAX_PAGES = 20;
export const USAGE_BUDGET_MS = 60_000;
const USAGE_SYNC_SUBJECT = "usage-sync";
const USAGE_AUDIENCE = "ai-platform:internal";
const USAGE_ISSUER = "prime-web";

export interface UsageSyncResult {
	fetched: number;
	inserted: number;
	pages: number;
	cursor: number;
}

export type UsageSyncSkip = { skipped: true; reason: string };

/** Why the sync cannot run here (platform not wired), or null. */
export function usageSyncUnconfigured(): string | null {
	if (!getAiPlatformUrl()) return "AI_PLATFORM_URL is not configured";
	if (!getAiPlatformContextSecret()) return "AI_PLATFORM_CONTEXT_SECRET is not configured";
	return null;
}

async function db(): Promise<ReportsDb> {
	return (await getPayload({ config })) as unknown as ReportsDb;
}

async function signSyncToken(): Promise<string> {
	const secret = getAiPlatformContextSecret();
	if (!secret) throw new Error("AI_PLATFORM_CONTEXT_SECRET is not configured.");
	return new SignJWT({})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(USAGE_ISSUER)
		.setAudience(USAGE_AUDIENCE)
		.setSubject(USAGE_SYNC_SUBJECT)
		.setIssuedAt()
		.setExpirationTime("2m")
		.sign(new TextEncoder().encode(secret));
}

async function currentCursor(handle: ReportsDb): Promise<number> {
	const [row] = await rowsOf<{ cursor: string | number | null }>(
		handle,
		sql`SELECT MAX(platform_event_id) AS cursor FROM ai_usage_logs`,
	);
	const cursor = Number(row?.cursor ?? 0);
	return Number.isFinite(cursor) ? cursor : 0;
}

/**
 * One page of the ledger. A malformed event (ledger and sync out of step between releases) ends the page there:
 * the events before it are kept, the cursor stops before it, and `malformed` makes the run fail so it is retried
 * (and seen) instead of the row being skipped for good.
 */
async function fetchPage(after: number, requestId: string): Promise<{ events: UsageEvent[]; nextAfter: number; malformed: string | null }> {
	const body = await aiPlatformJson<unknown>({
		method: "GET",
		path: `/internal/usage-events?after=${after}&limit=${USAGE_PAGE_SIZE}`,
		token: await signSyncToken(),
		requestId,
	});
	const page = UsagePageSchema.parse(body);
	const events: UsageEvent[] = [];
	for (const raw of page.events) {
		const parsed = UsageEventSchema.safeParse(raw);
		if (!parsed.success) {
			const at = events.at(-1)?.id ?? after;
			return { events, nextAfter: at, malformed: `after ledger id ${at}: ${parsed.error.issues[0]?.message ?? "unknown problem"}` };
		}
		events.push(parsed.data);
	}
	return { events, nextAfter: page.nextAfter, malformed: null };
}

const COLUMNS = [
	"platform_event_id", "source", "organization_id", "tenant_id", "plan", "user_id", "summary", "feature", "area", "task",
	"task_label", "page_title", "page_path", "run_id", "thread_id", "provider", "model", "tokens_in", "tokens_out",
	"cached_tokens_in", "total_tokens", "cache_hit_percent", "cost_usd", "priced", "battery_cost_usd", "duration_ms",
	"outcome", "success", "error_code", "error_label", "error_detail", "created_at",
] as const satisfies ReadonlyArray<keyof UsageLogRow>;

/**
 * Columns a re-copy refreshes (labels and derived values can change between releases; the ledger row itself does not).
 * `plan` is kept once set: a backfill must not stamp today's plan on an old call.
 */
const REFRESHED = COLUMNS.filter((column) => column !== "platform_event_id" && column !== "created_at" && column !== "plan");

/** Writes a page; returns how many rows were new (xmax = 0 on an inserted row, not on an updated one). */
async function insertRows(handle: ReportsDb, rows: UsageLogRow[]): Promise<number> {
	if (rows.length === 0) return 0;
	const tuples: SQL[] = rows.map((row) => {
		const values = COLUMNS.map((column) => sql`${row[column]}`);
		return sql`(${sql.join(values, sql`, `)}, ${row.created_at})`;
	});
	const inserted = await rowsOf<{ inserted: boolean }>(
		handle,
		sql`INSERT INTO ai_usage_logs (${sql.raw(COLUMNS.join(", "))}, updated_at)
			VALUES ${sql.join(tuples, sql`, `)}
			ON CONFLICT (platform_event_id) DO UPDATE SET
				${sql.raw(REFRESHED.map((column) => `${column} = EXCLUDED.${column}`).join(", "))},
				plan = COALESCE(ai_usage_logs.plan, EXCLUDED.plan), updated_at = now()
			RETURNING (xmax = 0) AS inserted`,
	);
	return inserted.filter((row) => row.inserted).length;
}

/** `from`: start after this ledger id instead of the cursor and refresh what is already copied (backfill: 0, then each run's `cursor`). */
export async function syncUsageEvents(now: () => number = Date.now, options: { from?: number } = {}): Promise<UsageSyncResult> {
	const handle = await db();
	const startedAt = now();
	const requestId = randomUUID();
	let after = options.from ?? (await currentCursor(handle));
	const result: UsageSyncResult = { fetched: 0, inserted: 0, pages: 0, cursor: after };

	// built once per run, only when the first page has something to map
	let tenantByOrg: Map<string, number> | null = null;
	let userByPlatformId: Map<string, number> | null = null;

	while (result.pages < USAGE_MAX_PAGES && now() - startedAt < USAGE_BUDGET_MS) {
		const page = await fetchPage(after, requestId);
		result.pages += 1;
		result.fetched += page.events.length;
		if (page.events.length > 0) {
			tenantByOrg ??= tenantOrgMap(await rowsOf(handle, sql`SELECT id, meta_data FROM tenants`));
			if (!userByPlatformId && page.events.some((event) => event.userId)) {
				userByPlatformId = userPlatformMap(await rowsOf(handle, sql`SELECT id FROM users`));
			}
			const rows = page.events.map((event) => toLogRow(event, tenantByOrg!, userByPlatformId ?? new Map()));
			const plans = await currentPlanByTenant(handle, rows.flatMap((row) => (row.tenant_id === null ? [] : [row.tenant_id])));
			for (const row of rows) row.plan = row.tenant_id === null ? null : (plans.get(row.tenant_id) ?? null);
			result.inserted += await insertRows(handle, rows);
		}
		if (page.malformed) throw new Error(`malformed usage event ${page.malformed}`);
		// the cursor only moves forward; a page that did not advance it is the end
		const next = Math.max(page.nextAfter, ...page.events.map((event) => event.id));
		const advanced = next > after;
		after = Math.max(after, next);
		result.cursor = after;
		if (page.events.length < USAGE_PAGE_SIZE || !advanced) break;
	}
	return result;
}
