import { Inject, Injectable, Logger } from "@nestjs/common";
import { type InventoryProposalInput, type InventoryReadInput, InventoryDraftDocSchema, type ProductPrepareRequest, type ProductPublishInput, ProductEditDocSchema } from "@ech/agent-core";
import { z } from "zod";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { ShopProductSnapshotSchema } from "../agent/shop-product-schemas";
import { requestIdHeaders } from "../observability/request-context";

/**
 * Typed client for prime-web's agent tool facade (`/api/agent-tools/*`): the
 * shop's own families, attribute schemas and media, read with the merchant's
 * access (prime-web re-checks membership and calls platform-api with that
 * user's bridge token). Outputs are compact by contract — ids, labels, counts.
 */

export const FamilySchema = z.object({
	id: z.string(),
	code: z.string(),
	name: z.string(),
	path: z.string(),
});
export type ShopFamily = z.infer<typeof FamilySchema>;

export const FamilyListSchema = z.object({ total: z.number().int().nonnegative(), items: z.array(FamilySchema) });

export const FamilyFieldSchema = z.object({
	attributeId: z.string(),
	code: z.string(),
	label: z.string(),
	dataType: z.string(),
	required: z.boolean(),
	level: z.enum(["required", "recommended", "optional"]),
	collection: z.boolean(),
	localizable: z.boolean().default(false),
	options: z.array(z.object({ code: z.string(), label: z.string() })),
	optionsTotal: z.number().int().nonnegative(),
});
export type FamilyField = z.infer<typeof FamilyFieldSchema>;

export const FamilySchemaSchema = z.object({
	family: FamilySchema,
	fields: z.array(FamilyFieldSchema),
});
export type ShopFamilySchema = z.infer<typeof FamilySchemaSchema>;

export const MediaItemSchema = z.object({
	ref: z.string(),
	name: z.string(),
	url: z.string(),
	credit: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
});
export type ShopMediaItem = z.infer<typeof MediaItemSchema>;
const MediaListSchema = z.object({ items: z.array(MediaItemSchema) });

/** What the copilot may read of the shop's own content (merchant data, no buyer PII). */
export const ItemKindSchema = z.enum(["product", "blog_post"]);
export type ItemKind = z.infer<typeof ItemKindSchema>;

/** Compact, model-facing summary of one item — every field already trimmed by the facade. */
export const ItemDetailSchema = z.object({
	kind: ItemKindSchema,
	id: z.string(),
	title: z.string(),
	status: z.string().optional(),
	url: z.string().optional(),
	/** label → value lines (sku, family, price, category, SEO…) */
	facts: z.array(z.object({ label: z.string(), value: z.string() })).max(80),
	/** body text (description / article), trimmed */
	text: z.string().optional(),
	/** e.g. variants or headings, one short line each */
	lists: z.array(z.object({ label: z.string(), items: z.array(z.string()).max(60) })).max(6).optional(),
	/** pictures for the chat (cover, photos) — kept out of the model's view */
	media: z.array(z.object({ url: z.string(), alt: z.string().optional(), label: z.string().optional() })).max(12).optional(),
	updatedAt: z.string().optional(),
});
export type ItemDetail = z.infer<typeof ItemDetailSchema>;

/** Exact current state of a record before a change is staged (prime-web `content.snapshot`). */
export const RecordSnapshotSchema = z.object({
	kind: ItemKindSchema,
	id: z.string(),
	title: z.string(),
	status: z.string(),
	version: z.string(),
	removed: z.boolean(),
	fields: z.record(z.string(), z.string().nullable()),
	attributes: z.array(z.object({ code: z.string(), label: z.string(), value: z.string().nullable(), dataType: z.string() })).optional(),
	/** a Payload product (prime-web on staging): its editable fields; `version` is the document's updatedAt */
	shopProduct: ShopProductSnapshotSchema.optional(),
});
export type RecordSnapshot = z.infer<typeof RecordSnapshotSchema>;

/** prime-web's drafted inventory change: review doc + diffs + the plan it runs on confirm. */
export const PreparedInventorySchema = z.object({
	capability: z.string(),
	title: z.string(),
	why: z.string(),
	risk: z.enum(["low", "medium", "high"]),
	doc: InventoryDraftDocSchema,
	diffs: z.array(
		z.object({
			entity: z.object({ kind: z.string(), id: z.string(), label: z.string().optional() }),
			field: z.string(),
			before: z.string().nullable(),
			after: z.string(),
		}),
	),
	guardrails: z.array(z.object({ rule: z.string(), ok: z.boolean(), detail: z.string() })),
	plan: z.record(z.string(), z.unknown()),
});
export type PreparedInventory = z.infer<typeof PreparedInventorySchema>;
const PreparedInventoryResultSchema = z.union([
	PreparedInventorySchema,
	z.object({ error: z.object({ code: z.string(), message: z.string(), candidates: z.array(z.unknown()).optional() }) }),
]);

/** prime-web's drafted Product Master edit (`product.prepare`): review doc + diffs + the plan it runs on confirm. */
export const PreparedProductEditSchema = z.object({
	title: z.string(),
	why: z.string(),
	risk: z.enum(["low", "medium", "high"]),
	confirmText: z.string().min(1).max(200).optional(),
	doc: ProductEditDocSchema,
	diffs: z.array(
		z.object({
			entity: z.object({ kind: z.string(), id: z.string(), label: z.string().optional() }),
			field: z.string(),
			before: z.string().nullable(),
			after: z.string(),
		}),
	),
	guardrails: z.array(z.object({ rule: z.string(), ok: z.boolean(), detail: z.string() })),
	plan: z.record(z.string(), z.unknown()),
});
export type PreparedProductEdit = z.infer<typeof PreparedProductEditSchema>;
const PreparedProductEditResultSchema = z.union([PreparedProductEditSchema, z.object({ error: z.object({ code: z.string(), message: z.string() }) })]);

/** prime-web's drafted web builder change (`site.prepare_patch` / `site.prepare_theme`): diffs + the plan it runs on confirm. */
export const PreparedSiteChangeSchema = z.object({
	kind: z.enum(["site.page_patch", "site.theme_patch", "site.seo_patch", "site.translate_page", "site.pages_patch", "site.page_create", "site.nav_patch", "site.languages_patch", "site.publish", "store.categories_patch", "store.discounts_patch", "store.orders_patch", "store.customers_patch"]),
	title: z.string(),
	why: z.string(),
	risk: z.enum(["low", "medium", "high"]),
	confirmText: z.string().min(1).max(200).optional(),
	/** money / buyer-email / irreversible: Auto-approve never applies it, the merchant clicks Approve */
	requiresClick: z.boolean().optional(),
	diffs: z.array(
		z.object({
			entity: z.object({ kind: z.string(), id: z.string(), label: z.string().optional() }),
			field: z.string(),
			/** where in the section / page / menu the change is — the editor's "Show" goes there */
			path: z.string().min(1).max(160).optional(),
			before: z.string().nullable(),
			after: z.string(),
		}),
	),
	guardrails: z.array(z.object({ rule: z.string(), ok: z.boolean(), detail: z.string() })),
	plan: z.record(z.string(), z.unknown()),
});
export type PreparedSiteChange = z.infer<typeof PreparedSiteChangeSchema>;
/** Which web builder change prime-web drafts (`site.prepare_<kind>`). */
export type SitePrepareKind = "patch" | "theme" | "seo" | "translate" | "pages" | "page_create" | "nav" | "languages" | "publish" | "categories" | "discounts" | "orders" | "customers";
const SITE_PREPARE_TOOL: Record<SitePrepareKind, string> = {
	patch: "site.prepare_patch",
	theme: "site.prepare_theme",
	seo: "site.prepare_seo",
	translate: "site.prepare_translate",
	pages: "site.prepare_pages",
	page_create: "site.prepare_page_create",
	nav: "site.prepare_nav",
	languages: "site.prepare_languages",
	publish: "site.prepare_publish",
	// the Product Store's categories: drafted like a site change, applied by prime-web as the approver
	categories: "store.prepare_categories",
	// the shop's discount codes: the same way
	discounts: "store.prepare_discounts",
	// the shop's orders (status steps, payment proofs, cancel, refund): the same way
	orders: "store.prepare_orders",
	// customers, contact leads (status, replies) and email templates: the same way
	customers: "store.prepare_customers",
};
const ToolErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const PreparedSiteChangeResultSchema = z.union([PreparedSiteChangeSchema, ToolErrorSchema]);

export const SavedPictureSchema = z.object({ assetId: z.string(), ref: z.string(), url: z.string(), name: z.string() });
export type SavedPicture = z.infer<typeof SavedPictureSchema>;

export const ItemSummarySchema = z.object({
	kind: ItemKindSchema,
	id: z.string(),
	title: z.string(),
	status: z.string().optional(),
	meta: z.string().optional(),
	updatedAt: z.string().optional(),
});
export type ItemSummary = z.infer<typeof ItemSummarySchema>;
const ItemListSchema = z.object({
	total: z.number().int().nonnegative(),
	items: z.array(ItemSummarySchema),
	/** Payload products: the shop's categories (ids for a product's category), so a shop with no product yet can still pick one */
	categories: z.array(z.object({ id: z.string().min(1), name: z.string() })).max(200).optional(),
	/** Payload products: the shop's currency (drafts are priced in it) */
	shop: z.object({ currency: z.string().min(1).max(8) }).optional(),
});

export class ShopToolError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

export interface ShopTools {
	listFamilies(ctx: AiRequestContext, input: { query?: string; limit?: number }): Promise<z.infer<typeof FamilyListSchema>>;
	familySchema(ctx: AiRequestContext, familyId: string): Promise<ShopFamilySchema>;
	searchMedia(
		ctx: AiRequestContext,
		input: { source: "media" | "stock" | "product"; query: string; limit?: number },
	): Promise<ShopMediaItem[]>;
	readItem?(ctx: AiRequestContext, input: { kind: ItemKind; id: string }): Promise<ItemDetail>;
	searchItems?(
		ctx: AiRequestContext,
		input: { kind: ItemKind; query?: string; status?: string; limit?: number },
	): Promise<z.infer<typeof ItemListSchema>>;
	/** /inventory read views with the merchant's commerce_ops:read. */
	inventoryRead?(ctx: AiRequestContext, input: InventoryReadInput): Promise<unknown>;
	/** A drafted inventory change (or an error the model can act on); writes nothing. */
	inventoryPrepare?(ctx: AiRequestContext, input: InventoryProposalInput): Promise<PreparedInventory | { error: { code: string; message: string; candidates?: unknown[] } }>;
	/** A Product Master edit drafted from a fresh read (or an error the model can act on); writes nothing. */
	productPrepare?(ctx: AiRequestContext, input: ProductPrepareRequest): Promise<PreparedProductEdit | { error: { code: string; message: string } }>;
	/** Publishing a product's working draft, drafted after a readiness check; writes nothing. */
	productPreparePublish?(ctx: AiRequestContext, input: ProductPublishInput): Promise<PreparedProductEdit | { error: { code: string; message: string } }>;
	/** Current values + version of one record (what a change is drafted from). */
	snapshotItem?(ctx: AiRequestContext, input: { kind: ItemKind; id: string }): Promise<RecordSnapshot>;
	/** Web builder reads (pages, a page draft, a section, theme, block types, store products); untrusted page text. */
	siteRead?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** the Product Store's categories (tree, product counts) and store products by name */
	storeCategories?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** the shop's discount codes (list with live state and usage, or one in full) */
	storeDiscounts?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** the shop's orders (needs-action summary, filtered list, or one order in full) */
	storeOrders?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** the shop's customers, contact leads and email templates (list or one in full) */
	storeCustomers?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** read-only reports (sales, best sellers, discount performance, orders by status, traffic) for a period */
	storeReports?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** what needs the merchant's attention now (the dashboard's To do list) */
	storeTodos?(ctx: AiRequestContext, input: Record<string, unknown>): Promise<unknown>;
	/** A page edit / theme change drafted from a fresh read (or an error the model can act on); writes nothing. */
	sitePrepare?(
		ctx: AiRequestContext,
		kind: SitePrepareKind,
		input: Record<string, unknown>,
	): Promise<PreparedSiteChange | { error: { code: string; message: string } }>;
	/** Keeps a generated picture in the shop's DAM; returns its library ref. */
	saveGeneratedPicture?(
		ctx: AiRequestContext,
		input: { prompt: string; picture: { mediaType: string; data: string; revisedPrompt?: string } },
	): Promise<SavedPicture>;
}

export const SHOP_TOOLS = Symbol("AI_PLATFORM_SHOP_TOOLS");

const TIMEOUT_MS = 12_000;
const SCHEMA_TTL_MS = 5 * 60_000;

@Injectable()
export class HttpShopTools implements ShopTools {
	private readonly logger = new Logger(HttpShopTools.name);
	/** Family schemas are read for every question of a flow — memoize briefly per org. */
	private readonly schemas = new Map<string, { at: number; value: Promise<ShopFamilySchema> }>();

	constructor(@Inject(ENV) private readonly env: Env) {}

	private async call<T>(ctx: AiRequestContext, tool: string, body: unknown, schema: z.ZodType<T>, timeoutMs = TIMEOUT_MS): Promise<T> {
		const base = this.env.PRIME_WEB_INTERNAL_URL;
		if (!base) throw new ShopToolError("The shop catalog is not connected (PRIME_WEB_INTERNAL_URL).", 503);
		if (!ctx.token) throw new ShopToolError("Missing caller context.", 401);
		const response = await fetch(`${base.replace(/\/$/, "")}/api/agent-tools/${tool}`, {
			method: "POST",
			headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json", ...requestIdHeaders() },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			this.logger.warn(`agent tool ${tool} → ${response.status}: ${text.slice(0, 200)}`);
			throw new ShopToolError(`Could not read the shop's ${tool.split(".").pop()} (${response.status}).`, response.status);
		}
		return schema.parse(await response.json());
	}

	listFamilies(ctx: AiRequestContext, input: { query?: string; limit?: number }) {
		return this.call(ctx, "catalog.families", input, FamilyListSchema);
	}

	familySchema(ctx: AiRequestContext, familyId: string): Promise<ShopFamilySchema> {
		const key = `${ctx.organizationId}:${familyId}`;
		const hit = this.schemas.get(key);
		if (hit && Date.now() - hit.at < SCHEMA_TTL_MS) return hit.value;
		const value = this.call(ctx, "catalog.family_schema", { familyId }, FamilySchemaSchema);
		value.catch(() => this.schemas.delete(key));
		this.schemas.set(key, { at: Date.now(), value });
		return value;
	}

	async searchMedia(ctx: AiRequestContext, input: { source: "media" | "stock" | "product"; query: string; limit?: number }) {
		return (await this.call(ctx, "media.search", input, MediaListSchema)).items;
	}

	readItem(ctx: AiRequestContext, input: { kind: ItemKind; id: string }) {
		return this.call(ctx, "content.read_item", input, ItemDetailSchema);
	}

	searchItems(ctx: AiRequestContext, input: { kind: ItemKind; query?: string; status?: string; limit?: number }) {
		return this.call(ctx, "content.search_items", input, ItemListSchema);
	}

	inventoryRead(ctx: AiRequestContext, input: InventoryReadInput) {
		return this.call(ctx, "inventory.read", input, z.unknown(), 20_000);
	}

	inventoryPrepare(ctx: AiRequestContext, input: InventoryProposalInput) {
		return this.call(ctx, "inventory.prepare", input, PreparedInventoryResultSchema, 30_000);
	}

	productPrepare(ctx: AiRequestContext, input: ProductPrepareRequest) {
		// reads the product, family schema, photos and variants: slower than a read
		return this.call(ctx, "product.prepare", input, PreparedProductEditResultSchema, 30_000);
	}

	productPreparePublish(ctx: AiRequestContext, input: ProductPublishInput) {
		return this.call(ctx, "product.prepare_publish", input, PreparedProductEditResultSchema, 30_000);
	}

	siteRead(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "site.read", input, z.record(z.string(), z.unknown()), 20_000);
	}

	storeCategories(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "store.categories", input, z.record(z.string(), z.unknown()), 20_000);
	}

	storeDiscounts(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "store.discounts", input, z.record(z.string(), z.unknown()), 20_000);
	}

	storeOrders(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "store.orders", input, z.record(z.string(), z.unknown()), 25_000);
	}

	storeReports(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "store.reports", input, z.record(z.string(), z.unknown()), 30_000);
	}

	storeTodos(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "store.todos", input, z.record(z.string(), z.unknown()), 30_000);
	}

	storeCustomers(ctx: AiRequestContext, input: Record<string, unknown>) {
		return this.call(ctx, "store.customers", input, z.record(z.string(), z.unknown()), 20_000);
	}

	sitePrepare(ctx: AiRequestContext, kind: SitePrepareKind, input: Record<string, unknown>) {
		// a page translation runs the translator for every section before it can be reviewed
		return this.call(ctx, SITE_PREPARE_TOOL[kind], input, PreparedSiteChangeResultSchema, kind === "translate" ? 80_000 : 30_000);
	}

	snapshotItem(ctx: AiRequestContext, input: { kind: ItemKind; id: string }) {
		return this.call(ctx, "content.snapshot", input, RecordSnapshotSchema);
	}

	saveGeneratedPicture(ctx: AiRequestContext, input: { prompt: string; picture: { mediaType: string; data: string; revisedPrompt?: string } }) {
		// bytes up + a DAM upload session: slower than a read
		return this.call(ctx, "media.save_generated", input, SavedPictureSchema, 60_000);
	}
}
