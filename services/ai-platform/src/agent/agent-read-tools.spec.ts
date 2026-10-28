import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ImageService } from "../images/image.service";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentError } from "./agent-errors";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

// TC-AICP-54 — the copilot reads the shop's own products and posts: the viewed
// record rides on the Context line, read_item / search_items go through the shop
// facade, and a missing record comes back as a structured error, not a crash.

type LanguageModelV4CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type Turn = { toolCall: { name: string; input: unknown } } | { text: string };

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function setup(turns: Turn[], shop: Partial<ShopTools>, pictures?: Partial<ImageService>) {
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			const content =
				"toolCall" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) }]
					: [{ type: "text" as const, text: turn.text }];
			return {
				content,
				finishReason: { unified: "toolCall" in turn ? ("tool-calls" as const) : ("stop" as const), raw: undefined },
				usage,
				warnings: [],
			};
		},
	});
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	});
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const service = new AgentRunService(
		store,
		models,
		ledger,
		env,
		new AgentThreadService(store, env),
		undefined,
		shop as ShopTools,
		pictures as ImageService | undefined,
	);
	return { service, model, store };
}

/** The tool result the model saw on its second call. */
function toolResult(call: LanguageModelV4CallOptions | undefined): unknown {
	const message = call?.prompt.find((m) => m.role === "tool");
	const part = message?.role === "tool" ? message.content[0] : undefined;
	return part && part.type === "tool-result" ? part.output : undefined;
}

describe("copilot read tools [TC-AICP-54]", () => {
	const post = {
		kind: "blog_post" as const,
		id: "42",
		title: "Caring for batik",
		status: "draft",
		facts: [{ label: "Meta description", value: "missing" }],
		text: "Wash batik by hand in cold water.",
		media: [{ url: "/api/media/file/cover.jpg", alt: "cover.jpg", label: "Cover" }],
	};

	it("puts the viewed post on the Context line and reads it through the shop facade", async () => {
		const readItem = vi.fn(async () => post);
		const { service, model } = setup(
			[{ toolCall: { name: "read_item", input: { kind: "blog_post", id: "42" } } }, { text: "Good structure. Add a meta description." }],
			{ readItem },
		);
		const frames: RunFrame[] = [];
		const run = await service.start(
			ctx,
			{ prompt: "Đánh giá bài viết này cho tôi", context: { module: "blog", entity: { kind: "blog_post", id: "42" } } },
			(f) => frames.push(f),
		);

		const first = model.doGenerateCalls[0];
		const user = first?.prompt.at(-1);
		expect(user?.role === "user" && user.content[0]?.type === "text" ? user.content[0].text : "").toMatch(
			/^Context: the merchant is on the "blog" page, viewing blog post id "42"\./,
		);
		expect(readItem).toHaveBeenCalledWith(ctx, { kind: "blog_post", id: "42" });
		expect(JSON.stringify(toolResult(model.doGenerateCalls[1]))).toContain("Wash batik by hand");
		// the chat shows the post as one card with its cover as the picture [TC-AICP-133]; the model never sees picture URLs
		expect(JSON.stringify(toolResult(model.doGenerateCalls[1]))).not.toContain("cover.jpg");
		expect(run.receipts.flatMap((r) => r.media ?? [])).toEqual([]);
		expect(run.receipts.flatMap((r) => r.records ?? [])).toEqual([expect.objectContaining({ kind: "post", id: "42", title: "Caring for batik", thumb: "/api/media/file/cover.jpg" })]);
		expect(frames).toContainEqual(
			expect.objectContaining({ type: "run.receipt", receipt: expect.objectContaining({ status: "ok", summary: "Read the post: Caring for batik" }) }),
		);
		expect(run.status).toBe("applied");
		expect(run.changeSetIds).toHaveLength(0);
	});

	it("passes search words and status through, dropping a null query", async () => {
		const searchItems = vi.fn(async () => ({ total: 0, items: [] }));
		const { service } = setup(
			[{ toolCall: { name: "search_items", input: { kind: "product", query: null, status: "draft", limit: 5 } } }, { text: "No drafts." }],
			{ searchItems },
		);
		await service.start(ctx, { prompt: "How many draft products do I have?", context: { module: "products" } }, () => undefined);
		expect(searchItems).toHaveBeenCalledWith(ctx, { kind: "product", status: "draft", limit: 5 });
	});

	it("returns not_found to the model when the record is gone", async () => {
		const readItem = vi.fn(async () => {
			throw Object.assign(new Error("missing"), { status: 404 });
		});
		const { service, model } = setup(
			[{ toolCall: { name: "read_item", input: { kind: "product", id: "prod_x" } } }, { text: "I could not find that product." }],
			{ readItem },
		);
		const frames: RunFrame[] = [];
		const run = await service.start(ctx, { prompt: "What is missing on this product?", context: { module: "products" } }, (f) => frames.push(f));
		expect(JSON.stringify(toolResult(model.doGenerateCalls[1]))).toContain("not_found");
		expect(frames).toContainEqual(expect.objectContaining({ type: "run.receipt", receipt: expect.objectContaining({ status: "error" }) }));
		expect(run.status).toBe("applied");
	});
});

// TC-AICP-59 — generate_image: the platform draws, the facade keeps the picture in
// the DAM, the chat shows it, and its id works as a blog cover in the same run.
describe("copilot generate_image [TC-AICP-59]", () => {
	const blog = {
		locale: "en",
		title: "Caring for batik silk",
		contentHtml: `<p>${"Batik silk needs gentle care. ".repeat(10)}</p>`,
		seoTitle: "Caring for batik silk",
		seoDescription: "How to wash, dry and store batik silk scarves.",
		coverImageId: "img_1",
	};

	it("saves the picture to the DAM, shows it, and uses it as the cover", async () => {
		const generate = vi.fn(async () => [{ mediaType: "image/png", data: "iVBORw0KGgo=" }]);
		const saveGeneratedPicture = vi.fn(async () => ({
			assetId: "ast_9",
			ref: "asset:ast_9",
			url: "/api/agent/media/assets/ast_9/thumbnail",
			name: "Indigo batik scarf on linen",
		}));
		const { service, model, store } = setup(
			[
				{ toolCall: { name: "generate_image", input: { prompt: "Indigo batik scarf on a linen table", aspect: "landscape", count: 1 } } },
				{ toolCall: { name: "propose_blog_post", input: blog } },
				{ text: "Drafted the post with a new cover." },
			],
			{ saveGeneratedPicture },
			{ available: true, generate } as unknown as Partial<ImageService>,
		);
		const frames: RunFrame[] = [];
		const run = await service.start(ctx, { prompt: "Write a post about batik care with a new cover", context: { module: "blog" } }, (f) => frames.push(f));

		expect(generate).toHaveBeenCalledWith(ctx, expect.objectContaining({ aspect: "landscape", count: 1 }), { runId: run.id });
		expect(saveGeneratedPicture).toHaveBeenCalledWith(ctx, { prompt: "Indigo batik scarf on a linen table", picture: { mediaType: "image/png", data: "iVBORw0KGgo=" } });
		expect(JSON.stringify(toolResult(model.doGenerateCalls[1]))).toContain('"id":"img_1"');
		expect(run.receipts.flatMap((r) => r.media ?? [])).toEqual([
			{ url: "/api/agent/media/assets/ast_9/thumbnail", alt: "Indigo batik scarf on linen", label: "Generated", imageId: "img_1", ref: "asset:ast_9" },
		]);
		expect(frames).toContainEqual(expect.objectContaining({ type: "run.step", step: expect.objectContaining({ label: "Generating a picture (about a minute)", status: "done" }) }));

		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		expect(JSON.stringify(changeSet?.action)).toContain("asset:ast_9");
	});

	it("tells the model when generation is off or the day's pictures are used up", async () => {
		const off = setup([{ toolCall: { name: "generate_image", input: { prompt: "a cover for the post", aspect: "square", count: 1 } } }, { text: "I can't generate pictures here." }], {});
		await off.service.start(ctx, { prompt: "make a cover", context: { module: "blog" } }, () => undefined);
		expect(JSON.stringify(toolResult(off.model.doGenerateCalls[1]))).toContain("unavailable");

		const generate = vi.fn(async () => {
			throw new AgentError("Your workspace reached today's picture limit. Try again tomorrow.", 429);
		});
		const capped = setup(
			[{ toolCall: { name: "generate_image", input: { prompt: "a cover for the post", aspect: "square", count: 1 } } }, { text: "Limit reached." }],
			{ saveGeneratedPicture: vi.fn() },
			{ available: true, generate } as unknown as Partial<ImageService>,
		);
		await capped.service.start(ctx, { prompt: "make a cover", context: { module: "blog" } }, () => undefined);
		expect(JSON.stringify(toolResult(capped.model.doGenerateCalls[1]))).toContain('"code":"limit"');
	});
});

// TC-AICP-64 — Product Store is a read model of Product Master: the copilot adds only
// products it found in Product Master; new products asked for on the store page are
// created in Product Master and marked to be added to the store.
describe("copilot and Product Store [TC-AICP-64]", () => {
	const found = {
		total: 1,
		items: [{ kind: "product" as const, id: "prod_1", title: "Batik Scarf", status: "active", meta: "SCARF-1" }],
	};

	it("stages store.add_products for products search_items found, skipping invented ids", async () => {
		const { service, store } = setup(
			[
				{ toolCall: { name: "search_items", input: { kind: "product", query: "scarf", status: "any", limit: 5 } } },
				{ toolCall: { name: "propose_store_products", input: { productIds: ["prod_1", "prod_made_up"] } } },
				{ text: "Staged: add Batik Scarf to the store." },
			],
			{ searchItems: vi.fn(async () => found) },
		);
		await service.start(ctx, { prompt: "Put the batik scarf in my store", context: { module: "store" } }, () => undefined);

		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		expect(changeSet?.action).toEqual({ kind: "store.add_products", payload: { productIds: ["prod_1"] } });
		expect(changeSet?.title).toBe("Add to the store: Batik Scarf");
		expect(changeSet?.diffs[0]).toMatchObject({ entity: { id: "prod_1" }, after: "In the store, live" });
		expect(changeSet?.guardrails).toContainEqual(expect.objectContaining({ rule: "unknown_product", ok: false }));
	});

	it("refuses to stage when no id was found, and marks store-page product drafts addToStore", async () => {
		const none = setup(
			[{ toolCall: { name: "propose_store_products", input: { productIds: ["prod_x"] } } }, { text: "Let me search first." }],
			{},
		);
		await none.service.start(ctx, { prompt: "add prod_x", context: { module: "store" } }, () => undefined);
		expect(JSON.stringify(toolResult(none.model.doGenerateCalls[1]))).toContain("unknown_products");
		expect(await none.store.listChangeSets("org_1", { limit: 5 })).toHaveLength(0);

		const draft = setup(
			[
				{ toolCall: { name: "propose_product_drafts", input: { locale: "en-US", products: [{ name: "Linen Shirt", description: "Relaxed linen shirt." }] } } },
				{ text: "Drafted." },
			],
			{},
		);
		await draft.service.start(ctx, { prompt: "Create 1 simple product: Linen Shirt", context: { module: "store" } }, () => undefined);
		const [changeSet] = await draft.store.listChangeSets("org_1", { limit: 5 });
		expect(changeSet?.action?.payload).toMatchObject({ addToStore: true });
	});
});

// TC-AICP-72 — photos found earlier in the chat show as pictures and keep their ids:
// "Use img_2" in a later message still resolves to the same Pixabay photo.
describe("found photos across chat turns [TC-AICP-72]", () => {
	it("puts found photos on the receipt and reuses their ids in the next run", async () => {
		const searchMedia = vi.fn(async () => [
			{ ref: "pixabay:11", name: "linen shirt on a line", url: "https://cdn.pixabay.com/11.jpg", credit: "Pixabay · wilhei" },
			{ ref: "pixabay:12", name: "iron on a shirt", url: "https://cdn.pixabay.com/12.jpg", credit: "Pixabay · stevepb" },
		]);
		const { service, model, store } = setup(
			[
				{ toolCall: { name: "find_images", input: { query: "linen shirt care", source: "stock", count: 2 } } },
				{ text: "Here are two photos." },
			],
			{ searchMedia },
		);
		const first = await service.start(ctx, { prompt: "Find Pixabay photos about linen care", context: { module: "blog" } }, () => undefined);
		expect(first.receipts.flatMap((r) => r.media ?? [])).toEqual([
			{ url: "https://cdn.pixabay.com/11.jpg", alt: "linen shirt on a line", label: "Pixabay · wilhei", imageId: "img_1", ref: "pixabay:11" },
			{ url: "https://cdn.pixabay.com/12.jpg", alt: "iron on a shirt", label: "Pixabay · stevepb", imageId: "img_2", ref: "pixabay:12" },
		]);

		// second message in the same chat: the model drafts a post with img_2 as the cover
		const turns = [
			{
				toolCall: {
					name: "propose_blog_post",
					input: {
						locale: "en",
						title: "Caring for linen shirts",
						contentHtml: `<p>${"Linen likes cool water and a warm iron. ".repeat(8)}</p>`,
						seoTitle: "Caring for linen shirts",
						seoDescription: "Wash, dry and iron linen shirts so they last.",
						coverImageId: "img_2",
					},
				},
			},
			{ text: "Drafted with the iron photo." },
		];
		let call = 0;
		model.doGenerate = (async () => {
			const turn = turns[Math.min(call++, turns.length - 1)] as Turn;
			return "toolCall" in turn
				? {
						content: [{ type: "tool-call", toolCallId: `c${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) }],
						finishReason: { unified: "tool-calls", raw: undefined },
						usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
						warnings: [],
					}
				: {
						content: [{ type: "text", text: turn.text }],
						finishReason: { unified: "stop", raw: undefined },
						usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
						warnings: [],
					};
		}) as typeof model.doGenerate;
		await service.start(ctx, { prompt: "Use img_2", threadId: first.threadId, context: { module: "blog" } }, () => undefined);
		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		expect(JSON.stringify(changeSet?.action)).toContain("pixabay:12");
	});
});

// TC-AICP-75 — inventory: reads go straight to the facade; propose_inventory stages the
// drafted change as an `inventory` change set (review doc + plan), nothing is applied;
// a platform refusal (ambiguous product, over available) goes back to the model.
describe("copilot inventory tools [TC-AICP-75]", () => {
	const prepared = {
		capability: "stock.set_count",
		title: "Set on hand · Recount · PrimeCommerce",
		why: "Counted 45, the system says 50.",
		risk: "low" as const,
		doc: {
			type: "inventory" as const,
			capability: "stock.set_count",
			action: "Set on hand · Recount · PrimeCommerce",
			lines: [{ name: "Tici", detail: "On hand 50 → 45", quantity: "−5" }],
			why: "Counted 45, the system says 50.",
			workflow: "immediate" as const,
		},
		diffs: [{ entity: { kind: "inventory_item", id: "iitem_1", label: "Tici" }, field: "PrimeCommerce · On hand", before: "50", after: "45" }],
		guardrails: [{ rule: "stock_guard", ok: true, detail: "Applied only if this stock has not changed." }],
		plan: { capability: "stock.set_count", steps: [{ op: "request" }], guards: [] },
	};
	const input = { capability: "stock.set_count", why: "Counted 45", warehouse: null, toWarehouse: null, targetId: null, lines: [{ item: "CHANGA-TICI-Q", quantity: 45, shortageReason: null }], reason: null, note: null, fields: null };

	it("stages the prepared change as an inventory change set", async () => {
		const inventoryPrepare = vi.fn(async () => prepared);
		const { service, store } = setup([{ toolCall: { name: "propose_inventory", input } }, { text: "Drafted — confirm it to post." }], { inventoryPrepare });
		const run = await service.start(ctx, { prompt: "Tici counted 45", context: { module: "inventory" } }, () => undefined);

		expect(run.domain).toBe("inventory");
		expect(inventoryPrepare).toHaveBeenCalledWith(ctx, expect.objectContaining({ capability: "stock.set_count" }));
		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		expect(changeSet).toMatchObject({
			domain: "inventory",
			status: "pending",
			drafts: [expect.objectContaining({ type: "inventory", action: "Set on hand · Recount · PrimeCommerce" })],
			action: { kind: "inventory.apply", payload: prepared.plan },
		});
	});

	it("hands a refusal back to the model and stages nothing", async () => {
		const inventoryPrepare = vi.fn(async () => ({ error: { code: "ambiguous", message: "\"bim\" matches several items — which one?", candidates: [{ sku: "A" }, { sku: "B" }] } }));
		const { service, store, model } = setup([{ toolCall: { name: "propose_inventory", input } }, { text: "Which one: A or B?" }], { inventoryPrepare });
		await service.start(ctx, { prompt: "bim counted 201", context: { module: "inventory" } }, () => undefined);
		expect(JSON.stringify(toolResult(model.doGenerateCalls[1]))).toContain("ambiguous");
		expect(await store.listChangeSets("org_1", { limit: 5 })).toHaveLength(0);
	});
});
