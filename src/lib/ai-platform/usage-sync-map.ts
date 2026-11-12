import { z } from "zod";
import { extractTenantRawId, resolveTenantOrganization, toPlatformUserId } from "@/lib/auth/bridge-token";

/** One row of ai-platform's usage ledger as `GET /internal/usage-events` returns it. */
export const UsageEventSchema = z.object({
	id: z.number().int().positive(),
	organizationId: z.string(),
	userId: z.string().nullable(),
	surface: z.enum(["merchant", "shopper", "system"]),
	task: z.string(),
	runId: z.string().nullable(),
	provider: z.string().nullable(),
	model: z.string().nullable(),
	inputTokens: z.number().nullable(),
	outputTokens: z.number().nullable(),
	cachedInputTokens: z.number().nullable(),
	costUsdMicros: z.number().nullable(),
	/** what the call took from the shop's AI battery (price, else fallback token rates; pictures 0); absent on older platforms */
	batteryUsdMicros: z.number().nullable().optional(),
	latencyMs: z.number().nullable(),
	outcome: z.enum(["ok", "refused", "error"]),
	errorCode: z.string().nullable(),
	/** why it failed: status + the provider's message, keys masked by the platform; absent on older platforms */
	errorDetail: z.string().nullable().optional(),
	createdAt: z.string(),
	/** the copilot run the call belonged to: where it was asked and which chat (never the prompt) */
	run: z
		.object({
			domain: z.string().nullable(),
			threadId: z.string().nullable(),
			pagePath: z.string().nullable(),
			pageTitle: z.string().nullable(),
			pageModule: z.string().nullable(),
		})
		.nullable()
		.optional(),
});
export type UsageEvent = z.infer<typeof UsageEventSchema>;

export const UsagePageSchema = z.object({ events: z.array(z.unknown()), nextAfter: z.number() });

export type UsageFeature = "assistant" | "writing" | "pictures" | "other";

/** Product area shown in the admin list: the copilot, the writing tools, picture generation, anything else. */
export function featureOf(event: Pick<UsageEvent, "task" | "surface">): UsageFeature {
	if (event.task === "media.generate-image") return "pictures";
	if (event.task.startsWith("agent.")) return "assistant";
	if (event.surface === "system") return "writing";
	return "other";
}

export type UsageArea =
	| "dashboard" | "web-editor" | "products" | "blog" | "orders" | "customers" | "discounts" | "inventory" | "reports"
	| "settings" | "media" | "website-setup" | "migration" | "background" | "chat-deleted" | "other";

const FEATURE_LABEL: Record<UsageFeature, string> = { assistant: "Assistant", writing: "Writing tools", pictures: "Pictures", other: "Other" };

export const AREA_LABEL: Record<UsageArea, string> = {
	dashboard: "Dashboard", "web-editor": "Web editor", products: "Products", blog: "Blog & pages", orders: "Orders",
	customers: "Customers", discounts: "Discounts", inventory: "Inventory", reports: "Reports", settings: "Settings",
	media: "Media", "website-setup": "Website setup", migration: "Store migration", background: "Tool / background", "chat-deleted": "Chat deleted", other: "Other",
};

/** Readable name of a platform task id; unknown ids fall back to the id itself. */
const TASK_LABEL: Record<string, string> = {
	"agent.merchant-copilot": "Assistant reply",
	"agent.suggest-next": "Suggested next messages",
	"media.generate-image": "Picture",
	"catalog.bulk-parse-products": "Bulk add products",
	"catalog.split-products": "Bulk add products (split list)",
	"content.product-description": "Product description",
	"copy.product-description": "Product description",
	"copy.blog-post": "Blog post",
	"copy.blog-post-draft": "Blog post (assistant set)",
	"copy.rewrite-text": "Rewrite text",
	"content.seo-meta": "SEO title & description",
	"seo.generate-meta": "SEO title & description",
	"seo.generate-meta-batch": "SEO titles & descriptions (Fix all)",
	"seo.page-meta": "Page SEO",
	"seo.blog-meta": "Blog SEO",
	"seo.fix-meta": "Fix SEO",
	"content.translate": "Translate",
	"i18n.translate-blocks": "Translate page",
	"i18n.translate-image-terms": "Translate picture keywords",
	"i18n.translate-product-field": "Translate product field",
	"i18n.translate-user-input": "Translate input",
	"site.extract-business-info": "Read business info from a link",
	"sitegen.site-plan": "Website setup: site plan",
	"sitegen.page-blocks": "Website setup: page sections",
	"sitegen.personalize": "Website setup: personalise",
	"sitegen.sample-products": "Website setup: sample products",
	"sitegen.blog-seeds": "Website setup: blog ideas",
	"sitegen.blog-post-content": "Website setup: blog post",
	"sitegen.image-keywords": "Website setup: picture keywords",
	"migration.pw1-brand-palette": "Store migration: brand colours",
	"migration.pw1-native-design": "Store migration: page design",
};

export function taskLabel(task: string): string {
	if (task.startsWith("agent.decide.")) return `Auto-answer (${task.slice("agent.decide.".length)})`;
	return TASK_LABEL[task] ?? task;
}

/** The copilot page's module (from the run), else its domain. */
const MODULE_AREA: Record<string, UsageArea> = {
	dashboard: "dashboard", editor: "web-editor", webbuilder: "web-editor", products: "products", listings: "products",
	pricing: "products", blog: "blog", cms: "blog", orders: "orders", customers: "customers", crm: "customers",
	"contact-leads": "customers", discounts: "discounts", campaigns: "discounts", inventory: "inventory", reports: "reports",
	settings: "settings", media: "media",
};

/** Where in the app the call came from: the copilot run's page, else the task family. */
export function areaOf(event: Pick<UsageEvent, "task" | "run">): UsageArea {
	const run = event.run;
	if (run) {
		const fromModule = run.pageModule ? (MODULE_AREA[run.pageModule] ?? (run.pageModule.startsWith("settings") ? "settings" : null)) : null;
		return fromModule ?? (run.domain ? MODULE_AREA[run.domain] : undefined) ?? "other";
	}
	// an assistant call whose chat is gone (deleted, or past retention): its page went with it
	if (event.task.startsWith("agent.")) return "chat-deleted";
	if (event.task === "media.generate-image") return "media";
	if (event.task.startsWith("sitegen.") || event.task === "site.extract-business-info") return "website-setup";
	if (event.task.startsWith("migration.")) return "migration";
	return "background";
}

const ERROR_LABEL: Record<string, string> = {
	TimeoutError: "Timed out",
	AbortError: "Stopped before it finished",
	AI_APICallError: "Model provider error",
	AI_RetryError: "Model provider error after retries",
	ModelUnavailable: "No model available",
	DecisionFailed: "Auto-answer failed",
};

export const errorLabel = (code: string | null): string | null => (code ? (ERROR_LABEL[code] ?? code) : null);

const OUTCOME_LABEL: Record<UsageEvent["outcome"], string> = { ok: "OK", refused: "No result", error: "Error" };

/** One line an admin can read in the list: feature · what · where (· outcome when not OK). */
export function summaryOf(event: UsageEvent): string {
	const parts = [FEATURE_LABEL[featureOf(event)], taskLabel(event.task), AREA_LABEL[areaOf(event)]];
	if (event.outcome !== "ok") parts.push(OUTCOME_LABEL[event.outcome]);
	return parts.join(" · ");
}

/** A `ai_usage_logs` row, column by column (snake_case as stored). */
export interface UsageLogRow {
	platform_event_id: number;
	source: "ai-platform";
	organization_id: string;
	tenant_id: number | null;
	/** plan code the shop was on when the row was copied (FREEMIUM when no active subscription); null without a tenant */
	plan: string | null;
	user_id: number | null;
	summary: string;
	feature: UsageFeature;
	area: UsageArea;
	task: string;
	task_label: string;
	page_title: string | null;
	page_path: string | null;
	run_id: string | null;
	thread_id: string | null;
	provider: string | null;
	model: string;
	tokens_in: number;
	tokens_out: number;
	cached_tokens_in: number | null;
	total_tokens: number;
	cache_hit_percent: number | null;
	cost_usd: number | null;
	priced: boolean;
	battery_cost_usd: number | null;
	duration_ms: number;
	outcome: UsageEvent["outcome"];
	success: boolean;
	error_code: string | null;
	error_label: string | null;
	error_detail: string | null;
	created_at: string;
}

export function toLogRow(
	event: UsageEvent,
	tenantByOrg: ReadonlyMap<string, number>,
	userByPlatformId: ReadonlyMap<string, number>,
): UsageLogRow {
	const tokensIn = event.inputTokens ?? 0;
	const tokensOut = event.outputTokens ?? 0;
	return {
		platform_event_id: event.id,
		source: "ai-platform",
		organization_id: event.organizationId,
		tenant_id: tenantByOrg.get(event.organizationId) ?? null,
		plan: null,
		user_id: event.userId ? (userByPlatformId.get(event.userId) ?? null) : null,
		summary: summaryOf(event),
		feature: featureOf(event),
		area: areaOf(event),
		task: event.task,
		task_label: taskLabel(event.task),
		page_title: event.run?.pageTitle ?? null,
		page_path: event.run?.pagePath ?? null,
		run_id: event.runId,
		thread_id: event.run?.threadId ?? null,
		provider: event.provider,
		model: event.model || "unknown",
		tokens_in: tokensIn,
		tokens_out: tokensOut,
		cached_tokens_in: event.cachedInputTokens,
		total_tokens: tokensIn + tokensOut,
		cache_hit_percent: tokensIn > 0 && event.cachedInputTokens != null ? Math.round((event.cachedInputTokens / tokensIn) * 100) : null,
		// null = the model has no price on file (not "free"); the battery cost still counts it at the fallback rates
		cost_usd: event.costUsdMicros == null ? null : event.costUsdMicros / 1e6,
		priced: event.costUsdMicros != null,
		battery_cost_usd: event.batteryUsdMicros == null ? null : event.batteryUsdMicros / 1e6,
		duration_ms: Math.round(event.latencyMs ?? 0),
		outcome: event.outcome,
		success: event.outcome !== "error",
		error_code: event.errorCode,
		error_label: errorLabel(event.errorCode),
		error_detail: event.errorDetail ?? null,
		created_at: event.createdAt,
	};
}

/** organization id the platform bills a tenant under → tenant id (metaData.platformOrgId override, else derived hash). */
export function tenantOrgMap(tenants: ReadonlyArray<{ id: number | string; meta_data: unknown }>): Map<string, number> {
	const map = new Map<string, number>();
	for (const row of tenants) {
		const metaData = typeof row.meta_data === "string" ? safeJson(row.meta_data) : row.meta_data;
		const org = resolveTenantOrganization({
			tenant: { id: row.id, metaData: metaData as Record<string, unknown> | null },
		} as unknown as Parameters<typeof resolveTenantOrganization>[0]);
		const id = Number(extractTenantRawId(row.id));
		if (org && Number.isSafeInteger(id)) map.set(org.id, id);
	}
	return map;
}

/** platform user id (`user_<hash>`) → users.id. */
export function userPlatformMap(users: ReadonlyArray<{ id: number | string }>): Map<string, number> {
	const map = new Map<string, number>();
	for (const row of users) map.set(toPlatformUserId(row.id), Number(row.id));
	return map;
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
