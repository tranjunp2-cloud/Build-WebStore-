import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { buildProductDraftsChangeSet } from "./change-set-builders";
import { chosenLine, earlierDraftsLine, picturesLine } from "./merchant-tools";

// TC-AICP-128 — one picture registry per chat: every picture shown (found, generated,
// picked in a card, attached) keeps its id for the whole chat, the model is told which
// ids exist in later messages ("Use img_7" resolves), a library pick links its asset
// instead of a copy, and a stock photo on a new product survives approval.

type Turn = { toolCall: { name: string; input: unknown } } | { text: string };
const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function setup(shop: Partial<ShopTools>) {
	let turns: Turn[] = [];
	let call = 0;
	const prompts: string[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			prompts.push(JSON.stringify(options.prompt));
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			const content =
				"toolCall" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) }]
					: [{ type: "text" as const, text: turn.text }];
			return { content, finishReason: { unified: "toolCall" in turn ? ("tool-calls" as const) : ("stop" as const), raw: undefined }, usage, warnings: [] };
		},
	});
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), undefined, shop as ShopTools);
	const script = (next: Turn[]) => {
		turns = next;
		call = 0;
		prompts.length = 0;
	};
	return { service, store, prompts, script };
}

const blogPost = (cover: string) => ({
	toolCall: {
		name: "propose_blog_post",
		input: {
			locale: "en",
			title: "Morning coffee at home",
			contentHtml: `<p>${"Fresh beans, a warm cup and a quiet morning. ".repeat(8)}</p>`,
			seoTitle: "Morning coffee at home",
			seoDescription: "How to brew a better cup of coffee at home every morning.",
			coverImageId: cover,
		},
	},
});

describe("pictures in this chat [TC-AICP-128]", () => {
	it("lists the newest pictures and the ones the request names, with where they came from", () => {
		const images = Array.from({ length: 15 }, (_, i) => ({ id: `img_${i + 1}`, origin: "stock", alt: `photo ${i + 1}` }));
		const line = picturesLine([{ id: "att_a1", origin: "upload", alt: "shirt.jpg" }, ...images], "Use img_1 and att_a1") as string;
		expect(line.startsWith("Pictures in this chat (ids you can use): ")).toBe(true);
		expect(line).toContain('att_a1 (their upload: "shirt.jpg")');
		expect(line).toContain('img_1 (stock photo: "photo 1")');
		expect(line).not.toContain("img_2 ");
		expect(line).toContain("img_15");
		expect(picturesLine([], "Use img_1")).toBeNull();
	});

	it("tells the next message which found photos exist, so Use img_N lands on that photo", async () => {
		const searchMedia = vi.fn(async () =>
			[5, 6, 7, 8].map((n) => ({ ref: `pixabay:${n}`, name: `coffee ${n}`, url: `https://cdn.pixabay.com/${n}.jpg`, credit: "Pixabay · barista" })),
		);
		const { service, store, prompts, script } = setup({ searchMedia });
		script([{ toolCall: { name: "find_images", input: { query: "coffee", source: "stock", count: 4 } } }, { text: "Four coffee photos." }]);
		const first = await service.start(ctx, { prompt: "Find coffee photos", context: { module: "blog" } }, () => undefined);
		expect(first.receipts.flatMap((r) => r.media ?? []).map((m) => m.imageId)).toEqual(["img_1", "img_2", "img_3", "img_4"]);

		script([blogPost("img_3"), { text: "Drafted with that photo." }]);
		const next = await service.start(ctx, { prompt: "Use img_3", threadId: first.threadId, context: { module: "blog" } }, () => undefined);
		const records = await store.listThreadRuns("org_1", next.threadId as string);
		expect(records[1]?.userMessage).toContain('img_3 (stock photo: "coffee 7")');
		expect(prompts[0]).toContain("Pictures in this chat");
		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		expect(JSON.stringify(changeSet?.action)).toContain("pixabay:7");
	});

	it("keeps a photo attached in an earlier message usable, and a library pick links its asset", async () => {
		const { service, store, script } = setup({});
		await store.insertAttachment(ctx, { id: "att_up", kind: "image", origin: "upload", ref: null, name: "beans.jpg", mime: "image/jpeg", size: 3, textContent: null, credit: null, content: Buffer.from([1, 2, 3]) });
		await store.insertAttachment(ctx, { id: "att_lib", kind: "image", origin: "media", ref: "asset:as_9", name: "cup.jpg", mime: "image/jpeg", size: 3, textContent: null, credit: null, content: Buffer.from([1, 2, 3]) });
		script([{ text: "Nice photo." }]);
		const first = await service.start(ctx, { prompt: "Here is my photo", attachmentIds: ["att_up"], context: { module: "blog" } }, () => undefined);

		script([blogPost("att_up"), { text: "Drafted." }]);
		const second = await service.start(ctx, { prompt: "Use the photo I sent before as the cover", threadId: first.threadId, context: { module: "blog" } }, () => undefined);
		const [records] = [await store.listThreadRuns("org_1", second.threadId as string)];
		expect(records[1]?.userMessage).toContain('att_up (their upload: "beans.jpg")');
		expect(JSON.stringify((await store.listChangeSets("org_1", { limit: 5 }))[0]?.action)).toContain("attachment:att_up");

		script([blogPost("att_lib"), { text: "Drafted." }]);
		await service.start(ctx, { prompt: "Use this one", attachmentIds: ["att_lib"], threadId: first.threadId, context: { module: "blog" } }, () => undefined);
		const newest = (await store.listChangeSets("org_1", { limit: 5 })).find((c) => JSON.stringify(c.action).includes("as_9"));
		expect(JSON.stringify(newest?.action)).toContain("asset:as_9");
		expect(JSON.stringify(newest?.action)).not.toContain("attachment:att_lib");
	});

	it("a stock photo on a new product carries its download address to the applier", () => {
		const changeSet = buildProductDraftsChangeSet(
			{ locale: "en-US", products: [{ name: "Coffee Mug", description: "A mug.", imageIds: ["img_1"] }] } as Parameters<typeof buildProductDraftsChangeSet>[0],
			{ id: "cs_1", runId: "run_1", now: new Date("2026-10-21T00:00:00Z") },
			{ images: [{ id: "img_1", ref: "pixabay:5", url: "https://cdn.pixabay.com/5.jpg", origin: "stock", alt: "mug" }] },
		);
		const [product] = (changeSet.action?.payload as { products: Array<{ images: Array<{ ref: string; url?: string }> }> }).products;
		expect(product?.images[0]).toMatchObject({ ref: "pixabay:5", url: "https://cdn.pixabay.com/5.jpg" });
	});
});

// TC-AICP-129 — pictures chosen with "Use this" travel by id: the run keeps them (the message
// shows their thumbnails after a reload) and the user turn names them, in order.
describe("chosen pictures [TC-AICP-129]", () => {
	it("names the chosen pictures in order", () => {
		expect(chosenLine([{ id: "img_3", origin: "stock", alt: "coffee  grinds" }, { id: "att_1", origin: "upload", alt: "shop.jpg" }])).toBe(
			'Chosen pictures (the merchant picked these, in order): img_3 (stock photo: "coffee grinds"); att_1 (their upload: "shop.jpg")',
		);
		expect(chosenLine([])).toBeNull();
	});

	it("keeps the chosen pictures on the run and tells the model, dropping ids the chat never had", async () => {
		const searchMedia = vi.fn(async () => [1, 2, 3].map((n) => ({ ref: `pixabay:${n}`, name: `coffee ${n}`, url: `https://cdn.pixabay.com/${n}.jpg`, credit: "Pixabay · a" })));
		const { service, store, script } = setup({ searchMedia });
		script([{ toolCall: { name: "find_images", input: { query: "coffee", source: "stock", count: 3 } } }, { text: "Three photos." }]);
		const first = await service.start(ctx, { prompt: "Find coffee photos", context: { module: "blog" } }, () => undefined);

		script([{ text: "Which post should they go on?" }]);
		const next = await service.start(
			ctx,
			{ prompt: "Dùng 2 ảnh này", pictureIds: ["img_3", "img_1", "img_99"], threadId: first.threadId, context: { module: "blog" } },
			() => undefined,
		);
		expect(next.pictures?.map((p) => [p.imageId, p.ref, p.url])).toEqual([
			["img_3", "pixabay:3", "https://cdn.pixabay.com/3.jpg"],
			["img_1", "pixabay:1", "https://cdn.pixabay.com/1.jpg"],
		]);
		const records = await store.listThreadRuns("org_1", next.threadId as string);
		expect(records[1]?.userMessage).toContain('Chosen pictures (the merchant picked these, in order): img_3 (stock photo: "coffee 3"); img_1 (stock photo: "coffee 1")');
		expect(records[1]?.userMessage).not.toContain("img_99");
	});
});

// TC-AICP-130 — an approved draft is a real record: later messages say what each earlier draft
// became, and drafting it again (same title / name) is refused with the record to edit instead.
describe("approved drafts are not drafted again [TC-AICP-130]", () => {
	it("says what became of each earlier draft", () => {
		expect(
			earlierDraftsLine([
				{ id: "cs_1", title: "Create blog draft: Capsule wardrobe", status: "applied", result: { entities: [{ kind: "blog_post", id: "10" }] } },
				{ id: "cs_2", title: "Create 1 product draft", status: "pending" },
				{ id: "cs_3", title: "Edit post", status: "rejected" },
			]),
		).toBe('Drafts from earlier messages: cs_1 "Create blog draft: Capsule wardrobe": approved — now blog post id "10"; cs_2 "Create 1 product draft": waiting for approval; cs_3 "Edit post": rejected');
		expect(earlierDraftsLine([])).toBeNull();
	});

	it("refuses a second draft of a post this chat already created and points to the post", async () => {
		const { service, store, prompts, script } = setup({});
		script([blogPost("img_1"), { text: "Drafted." }]);
		const first = await service.start(ctx, { prompt: "Write a blog post", context: { module: "blog" } }, () => undefined);
		const [staged] = await store.listChangeSets("org_1", { limit: 5 });
		// approved (auto-approve): the draft became blog post 10
		await store.updateChangeSet("org_1", {
			...(staged as NonNullable<typeof staged>),
			status: "applied",
			result: { entities: [{ kind: "blog_post", id: "10", label: "Morning coffee at home" }], links: [] },
		} as never);

		script([blogPost("img_1"), { text: "That post already exists." }]);
		await service.start(ctx, { prompt: "Use img_4", threadId: first.threadId, context: { module: "blog" } }, () => undefined);
		expect(prompts[0]).toContain('approved — now blog post id \\"10\\"');
		expect(prompts[1]).toContain("already_created");
		expect(prompts[1]).toContain('propose_update with kind \\"blog_post\\", id \\"10\\"');
		expect(await store.listChangeSets("org_1", { limit: 5 })).toHaveLength(1);
	});
});
