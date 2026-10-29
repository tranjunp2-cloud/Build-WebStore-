import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { threadEntityQuery } from "./agent.controller";
import { AgentRunService, currentPage } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { merchantContextLine } from "./merchant-tools";

// TC-AICP-127 — the assistant knows where the merchant is: the Context line names the
// screen (also with the page chip removed), current_page returns the same facts, and a
// chat started on a record stays linked to it (listed by record, named on other pages).

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 10, text: 10, reasoning: undefined },
};
const page = { title: "eCommerce Operations › Product Master", path: "/catalog/products", module: "products" };

function setup(turns: Array<{ tool: string } | { text: string }>) {
	const prompts: unknown[] = [];
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			prompts.push(options.prompt);
			const turn = turns[Math.min(call, turns.length - 1)] as { tool: string } | { text: string };
			call += 1;
			const content =
				"tool" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.tool, input: "{}" }]
					: [{ type: "text" as const, text: turn.text }];
			return { content, finishReason: { unified: "tool" in turn ? "tool-calls" : "stop", raw: undefined }, usage, warnings: [] };
		},
	});
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const threads = new AgentThreadService(store, env);
	return { service: new AgentRunService(store, models, ledger, env, threads), store, threads, prompts };
}

describe("the Context line names the screen [TC-AICP-127]", () => {
	const base = { locale: "vi", today: "2026-10-21" };

	it("keeps the old line when only a module is pinned", () => {
		expect(merchantContextLine({ ...base, module: "store" })).toBe('Context: the merchant is on the "store" page, UI locale vi. Today is 2026-10-21.');
	});

	it("names the screen and its address with the pin", () => {
		expect(merchantContextLine({ ...base, module: "products", page, entity: { kind: "product", id: "p1" } })).toBe(
			'Context: the merchant is on "eCommerce Operations › Product Master" (address "/catalog/products", module "products"), viewing product id "p1", UI locale vi. Today is 2026-10-21.',
		);
	});

	it("still says where they are once the page chip is removed, and that the request is not about it", () => {
		const line = merchantContextLine({ ...base, page, entity: { kind: "product", id: "p1" } });
		expect(line).toContain('on "eCommerce Operations › Product Master"');
		expect(line).toContain("not about this page");
		expect(line).not.toContain("viewing");
		expect(merchantContextLine(base)).toContain("on a page they did not share");
		expect(merchantContextLine(base)).not.toContain("dashboard");
	});

	it("names the record the chat was started on when another one (or none) is open", () => {
		const about = { kind: "blog_post", id: "post_9", label: "Batik care" };
		expect(merchantContextLine({ ...base, module: "store", about })).toContain('this chat was started on blog post id "post_9" ("Batik care")');
		expect(merchantContextLine({ ...base, module: "blog", entity: { kind: "blog_post", id: "post_9" }, about })).not.toContain("started on");
	});
});

describe("current_page and the record link [TC-AICP-127]", () => {
	it("current_page returns the screen, record and filters of the latest message", () => {
		expect(currentPage({ page, context: { module: "products", entity: { kind: "product", id: "p1" } } }, {})).toMatchObject({
			title: page.title,
			address: "/catalog/products",
			module: "products",
			pinned: true,
			record: { kind: "product", id: "p1" },
		});
		expect(currentPage({ page, context: undefined }, {})).toMatchObject({ title: page.title, pinned: false, record: null });
	});

	it("a run answers which page from the tool and stores the page; a new chat on a record is linked to it", async () => {
		const { service, store, threads, prompts } = setup([{ tool: "current_page" }, { text: "Bạn đang ở Product Master." }]);
		const run = await service.start(
			ctx,
			{ prompt: "tôi đang đứng ở trang nào", page, context: { module: "products", entity: { kind: "product", id: "p1", label: "Grey Shirt" } } },
			() => undefined,
		);
		expect(run.page).toEqual(page);
		expect(JSON.stringify(prompts[1])).toContain("eCommerce Operations › Product Master");
		expect(run.receipts.some((r) => r.tool === "page.current")).toBe(true);
		const [record] = await store.listThreadRuns("org_1", run.threadId as string);
		expect(record?.userMessage).toContain('on "eCommerce Operations › Product Master"');

		const linked = await threads.list(ctx, 5, { entity: { kind: "product", id: "p1" } });
		expect(linked.map((t) => t.id)).toEqual([run.threadId]);
		expect(linked[0]?.entity).toEqual({ kind: "product", id: "p1", label: "Grey Shirt" });
		expect(await threads.list(ctx, 5, { entity: { kind: "product", id: "p2" } })).toEqual([]);

		// continued from another page: the record stays the chat's subject
		const next = await service.start(ctx, { prompt: "thêm ảnh cho nó", threadId: run.threadId, page: { title: "Online Store › Product Store", path: "/products" }, context: { module: "store" } }, () => undefined);
		const records = await store.listThreadRuns("org_1", next.threadId as string);
		expect(records[1]?.userMessage).toContain('this chat was started on product id "p1" ("Grey Shirt")');
	});

	it("parses the thread list's record filter, refusing anything else", () => {
		expect(threadEntityQuery("product:prod_1")).toEqual({ kind: "product", id: "prod_1" });
		expect(threadEntityQuery("site_page:12")).toEqual({ kind: "site_page", id: "12" });
		expect(threadEntityQuery("Product:1")).toBeUndefined();
		expect(threadEntityQuery("product:")).toBeUndefined();
		expect(threadEntityQuery(["product:1"])).toBeUndefined();
	});
});
