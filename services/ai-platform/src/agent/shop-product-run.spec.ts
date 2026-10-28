import type { ChangeSet } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { type RecordSnapshot, RecordSnapshotSchema, type ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { ChangeSetDecisionService, guardedRecord } from "./change-set-decision.service";
import { TOOL_CAPABILITIES } from "./merchant-capabilities";

// TC-AIREL-60..62 — a deployment whose products are Payload products (AI_AGENT_CAPABILITIES=…,shop_products):
// the model gets the shop product tools, edits are drafted from the facade's snapshot, a stale draft is
// superseded when another edit of the same product is applied.

type Call = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type Turn = { tool: string; input: unknown } | { text: string };

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", role: "owner" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const STAGING = "site,blog,stock_photos,shop_products";
const VERSION = "2026-10-20T09:30:00.000Z";

const snapshot: RecordSnapshot = {
	kind: "product",
	id: "42",
	title: "Batik Scarf",
	status: "draft",
	version: VERSION,
	removed: false,
	fields: {},
	shopProduct: {
		name: "Batik Scarf",
		shortDescription: null,
		description: "A soft scarf.",
		descriptionBM: null,
		price: 49,
		compareAtPrice: null,
		currency: "MYR",
		sku: "BAT-001",
		inventory: 12,
		weight: 0.2,
		hasVariants: false,
		tags: [],
		category: null,
		categories: [{ id: "3", name: "Scarves" }],
		seo: { title: null, description: null },
		images: [],
	},
};

const nulls = { name: null, shortDescription: null, description: null, descriptionBM: null, price: null, compareAtPrice: null, sku: null, inventory: null, weight: null, tags: null, categoryId: null, seoTitle: null, seoDescription: null, images: null };

function setup(turns: Turn[], capabilities: string | undefined, shop: Partial<ShopTools> = {}) {
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			return "tool" in turn
				? {
						content: [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.tool, input: JSON.stringify(turn.input) }],
						finishReason: { unified: "tool-calls" as const, raw: undefined },
						usage,
						warnings: [],
					}
				: { content: [{ type: "text" as const, text: turn.text }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
		},
	});
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		...(capabilities ? { AI_AGENT_CAPABILITIES: capabilities } : {}),
		// the capability contract on its own: every allowed tool on every request (routing: tool-routing-run.spec.ts)
		AI_TOOL_ROUTING: "off",
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), undefined, shop as ShopTools);
	return { service, model, store, decisions: new ChangeSetDecisionService(store) };
}

const toolNames = (call: Call) => call.tools?.map((t) => t.name) ?? [];
const toolOutput = (call: Call | undefined) => {
	const message = call?.prompt.find((m) => m.role === "tool");
	const part = message?.role === "tool" ? message.content[0] : undefined;
	return part && part.type === "tool-result" ? part.output : undefined;
};

describe("a run with shop_products [TC-AIREL-60]", () => {
	it("offers the model the shop product tools and their instructions, and none of Product Master's", async () => {
		const { service, model } = setup([{ text: "ok" }], STAGING);
		await service.start(ctx, { prompt: "hi", context: { module: "products" } }, () => undefined);
		const first = model.doGenerateCalls[0] as Call;
		expect(toolNames(first)).toEqual(expect.arrayContaining(["read_item", "search_items", "propose_shop_product_update", "propose_shop_product_status", "propose_shop_product_drafts"]));
		expect(toolNames(first)).not.toContain("propose_product_update");
		expect(JSON.stringify(first.prompt)).toContain("propose_shop_product_update");
		const readItem = first.tools?.find((t) => t.name === "read_item");
		expect(JSON.stringify(readItem)).toContain('"product"');
	});

	it("offers nothing of it by default: an unset deployment keeps the Product Master tools", async () => {
		const { service, model } = setup([{ text: "ok" }], undefined);
		await service.start(ctx, { prompt: "hi" }, () => undefined);
		const names = toolNames(model.doGenerateCalls[0] as Call);
		expect(names).toHaveLength(Object.keys(TOOL_CAPABILITIES).filter((name) => !name.includes("shop_product")).length);
		expect(names.some((n) => n.includes("shop_product"))).toBe(false);
	});

	it("puts the viewed product on the Context line", async () => {
		const { service, model } = setup([{ text: "ok" }], STAGING);
		await service.start(ctx, { prompt: "what is missing on this product?", context: { module: "products", entity: { kind: "product", id: "42", label: "Batik Scarf" } } }, () => undefined);
		const user = (model.doGenerateCalls[0] as Call).prompt.find((m) => m.role === "user");
		expect(JSON.stringify(user)).toContain('product id \\"42\\" (\\"Batik Scarf\\")');
	});
});

describe("editing a Payload product end to end [TC-AIREL-61]", () => {
	it("searches (categories come back), reads a fresh snapshot, stages shop_product.update and the model sees the change set id", async () => {
		// Arrange
		const calls: unknown[] = [];
		const shop: Partial<ShopTools> = {
			searchItems: async (_ctx, input) => {
				calls.push(["search", input]);
				return { total: 1, items: [{ kind: "product", id: "42", title: "Batik Scarf", status: "draft" }], categories: [{ id: "3", name: "Scarves" }] };
			},
			snapshotItem: async (_ctx, input) => {
				calls.push(["snapshot", input]);
				return snapshot;
			},
		};
		const { service, store, model } = setup(
			[
				{ tool: "search_items", input: { kind: "product", query: "batik", status: "any", limit: 5 } },
				{ tool: "propose_shop_product_update", input: { id: "42", reason: "Merchant asked", changes: { ...nulls, price: 45, categoryId: "3" } } },
				{ text: "Staged the new price and category." },
			],
			STAGING,
			shop,
		);

		// Act
		const run = await service.start(ctx, { prompt: "price the batik scarf at 45 and file it under Scarves", context: { module: "products" } }, () => undefined);

		// Assert
		expect(run.status).toBe("awaiting_approval");
		expect(calls).toEqual([
			["search", { kind: "product", query: "batik", status: "any", limit: 5 }],
			["snapshot", { kind: "product", id: "42" }],
		]);
		expect(JSON.stringify(toolOutput(model.doGenerateCalls[1]))).toContain('"categories":[{"id":"3","name":"Scarves"}]');
		const [staged] = await store.listChangeSets("org_1", { limit: 5 });
		expect(staged?.action).toEqual({
			kind: "shop_product.update",
			payload: { id: "42", base: VERSION, changes: { price: 45, categoryId: "3" } },
		});
		expect(staged?.diffs.map((d) => [d.field, d.before, d.after])).toEqual([
			["price", "RM 49.00", "RM 45.00"],
			["category", null, "Scarves"],
		]);
	});

	it("stages drafts from a photo request on the products page", async () => {
		const { service, store } = setup(
			[
				{ tool: "propose_shop_product_drafts", input: { products: [{ ...nulls, name: "Batik Scarf", description: "Hand-drawn.", price: 49 }] } },
				{ text: "Drafted 1 product." },
			],
			STAGING,
		);
		const run = await service.start(ctx, { prompt: "add a batik scarf at 49", context: { module: "products" } }, () => undefined);
		expect(run.status).toBe("awaiting_approval");
		const [staged] = await store.listChangeSets("org_1", { limit: 5 });
		expect(staged?.action).toMatchObject({ kind: "shop_product.create_drafts", payload: { status: "draft", aiReviewPending: true } });
		expect(staged?.drafts?.[0]).toMatchObject({ type: "product", name: "Batik Scarf", price: "RM 49.00" });
	});
});

describe("version-guarded shop product changes [TC-AIREL-62]", () => {
	const edit = (id: string, kind: string, productId: string): ChangeSet =>
		({
			id, runId: `run_${id}`, domain: "products", title: id, summary: "", risk: "low",
			blastRadius: { kind: "product", count: 1, label: "1 product" },
			diffs: [{ entity: { kind: "product", id: productId }, field: "price", before: "a", after: "b", provenance: "generated" }],
			guardrails: [], status: "pending", stagedBy: "agent",
			stagedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
			action: { kind, payload: { id: productId, base: VERSION, changes: {} } },
		}) as ChangeSet;

	it("keys updates and status changes by the product, apart from Product Master's product.* kinds", () => {
		expect(guardedRecord(edit("a", "shop_product.update", "42"))).toBe("shop_product:42");
		expect(guardedRecord(edit("b", "shop_product.set_status", "42"))).toBe("shop_product:42");
		expect(guardedRecord(edit("c", "product.update", "42"))).toBe("product:42");
		expect(guardedRecord(edit("d", "shop_product.create_drafts", "new-1"))).toBeUndefined();
	});

	it("supersedes the other pending edits and status changes of a product once one is applied", async () => {
		const store = new InMemoryAgentStore();
		const decisions = new ChangeSetDecisionService(store);
		for (const cs of [edit("cs_old", "shop_product.update", "42"), edit("cs_status", "shop_product.set_status", "42"), edit("cs_new", "shop_product.update", "42"), edit("cs_other", "shop_product.update", "43")]) {
			await store.insertChangeSet("org_1", cs);
		}

		await decisions.claim(ctx, "cs_new");
		await decisions.decide(ctx, "cs_new", { decision: "approve", result: { entities: [{ kind: "product", id: "42" }], links: [] } });

		expect((await decisions.get(ctx, "cs_old")).status).toBe("superseded");
		expect((await decisions.get(ctx, "cs_status")).status).toBe("superseded");
		expect((await decisions.get(ctx, "cs_other")).status).toBe("pending");
	});

	it("reads the snapshot's Payload product fields and the search's categories from the facade", () => {
		const parsed = RecordSnapshotSchema.parse(snapshot);
		expect(parsed.shopProduct?.categories).toEqual([{ id: "3", name: "Scarves" }]);
		expect(RecordSnapshotSchema.safeParse({ ...snapshot, shopProduct: { ...snapshot.shopProduct, price: "49" } }).success).toBe(false);
		// a Product Master snapshot has no shopProduct and still parses
		const { shopProduct: _omitted, ...plain } = snapshot;
		expect(RecordSnapshotSchema.parse(plain).shopProduct).toBeUndefined();
	});
});
