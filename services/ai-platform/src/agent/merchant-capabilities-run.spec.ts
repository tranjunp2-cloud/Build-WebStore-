import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import type { QuestionFlowService } from "./ask/question-flow";
import { merchantInstructions } from "./merchant-instructions";
import { capabilitySet, TOOL_CAPABILITIES } from "./merchant-capabilities";

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 1000, noCache: 800, cacheRead: 200, cacheWrite: undefined },
	outputTokens: { total: 100, text: 100, reasoning: undefined },
};

/** A copilot service on a scripted model; `turns` are its replies in order (tool call or text). */
function setup(envOverrides: Record<string, string>, turns: Array<{ tool: string; input: unknown } | { text: string }>, flows?: QuestionFlowService) {
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		// the capability contract on its own: every allowed tool on every request (routing: tool-routing-run.spec.ts)
		AI_TOOL_ROUTING: "off",
		...envOverrides,
	});
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as (typeof turns)[number];
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
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	return { service: new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), flows), model, store };
}

const system = (call: CallOptions) => call.prompt.filter((m) => m.role === "system");
const toolNames = (call: CallOptions) => call.tools?.map((t) => t.name) ?? [];

describe("copilot runs under a capability set", () => {
	it("[TC-AIREL-36] offers the model only the tools and instructions of AI_AGENT_CAPABILITIES, identical for every user, page and locale", async () => {
		// Arrange
		const a = setup({ AI_AGENT_CAPABILITIES: "site,blog,stock_photos" }, [{ text: "ok" }]);
		const b = setup({ AI_AGENT_CAPABILITIES: "site,blog,stock_photos" }, [{ text: "ok" }]);
		const all = setup({}, [{ text: "ok" }]);

		// Act
		await a.service.start({ ...ctx, locale: "en-MY" }, { prompt: "Write about batik", context: { module: "blog" } }, () => undefined);
		await b.service.start({ organizationId: "org_9", userId: "usr_9", locale: "vi-VN" }, { prompt: "Sửa trang chủ", context: { module: "editor" } }, () => undefined);
		await all.service.start(ctx, { prompt: "hi" }, () => undefined);
		const [callA, callB, callAll] = [a, b, all].map((s) => s.model.doGenerateCalls[0] as CallOptions) as [CallOptions, CallOptions, CallOptions];

		// Assert: only the allowed tools, with the matching instructions
		expect(toolNames(callA)).toEqual([
			"ask_user", "find_images", "read_item", "search_items", "current_page", "propose_update", "propose_status_change", "propose_blog_post",
			"site_read", "propose_page_patch", "propose_site_patch", "propose_new_page", "propose_page_seo", "propose_page_translation", "propose_theme_change", "propose_navigation", "propose_site_languages", "propose_publish",
		]);
		expect(system(callA)).toEqual([{ role: "system", content: merchantInstructions(capabilitySet(["site", "blog", "stock_photos"])) }]);
		// the prompt cache keeps hitting: same bytes for another org, user, locale and page
		expect(system(callB)).toEqual(system(callA));
		expect(JSON.stringify(callB.tools)).toBe(JSON.stringify(callA.tools));
		// unset = everything, as before
		expect(toolNames(callAll)).toHaveLength(Object.keys(TOOL_CAPABILITIES).filter((name) => !name.includes("shop_product")).length);
		expect(JSON.stringify(system(callAll))).not.toBe(JSON.stringify(system(callA)));
	});

	it("[TC-AIREL-36] lets the token's capabilities narrow the request further and never widen it", async () => {
		// Arrange
		const narrowed = setup({ AI_AGENT_CAPABILITIES: "site,blog,stock_photos" }, [{ text: "ok" }]);
		const widened = setup({ AI_AGENT_CAPABILITIES: "site,blog" }, [{ text: "ok" }]);

		// Act
		await narrowed.service.start({ ...ctx, capabilities: ["blog"] }, { prompt: "hi" }, () => undefined);
		await widened.service.start({ ...ctx, capabilities: ["site", "blog", "inventory", "product_master"] }, { prompt: "hi" }, () => undefined);

		// Assert
		expect(toolNames(narrowed.model.doGenerateCalls[0] as CallOptions)).toEqual(["ask_user", "read_item", "search_items", "current_page", "propose_update", "propose_status_change", "propose_blog_post"]);
		const widenedTools = toolNames(widened.model.doGenerateCalls[0] as CallOptions);
		expect(widenedTools).not.toContain("inventory_read");
		expect(widenedTools).not.toContain("propose_product_drafts");
		expect(widenedTools).toContain("propose_page_patch");
	});

	it("[TC-AIREL-37] stages new products for the web store from the store page only where the store capability is on", async () => {
		// Arrange
		const draft = { tool: "propose_product_drafts", input: { locale: "en-US", products: [{ name: "Batik Scarf", description: "Hand-drawn batik scarf." }] } };
		const withStore = setup({ AI_AGENT_CAPABILITIES: "product_master,store_products" }, [draft, { text: "done" }]);
		const withoutStore = setup({ AI_AGENT_CAPABILITIES: "product_master" }, [draft, { text: "done" }]);
		const unset = setup({}, [draft, { text: "done" }]);

		// Act
		const payloads = [];
		for (const { service, store } of [withStore, withoutStore, unset]) {
			await service.start(ctx, { prompt: "Add a scarf", context: { module: "store" } }, () => undefined);
			const [staged] = await store.listChangeSets("org_1", { limit: 5 });
			payloads.push(staged?.action?.payload as Record<string, unknown>);
		}

		// Assert
		expect(payloads[0]).toMatchObject({ addToStore: true });
		expect(payloads[1]).not.toHaveProperty("addToStore");
		expect(payloads[2]).toMatchObject({ addToStore: true });
	});

	it("[TC-AIREL-37] never offers the store tool to a model that cannot reach Product Master", async () => {
		const { service, model } = setup({ AI_AGENT_CAPABILITIES: "site,blog,stock_photos" }, [{ text: "ok" }]);
		await service.start(ctx, { prompt: "add products to the store", context: { module: "store" } }, () => undefined);
		const tools = toolNames(model.doGenerateCalls[0] as CallOptions);
		expect(tools).not.toContain("propose_store_products");
		expect(tools).not.toContain("propose_product_drafts");
	});

	it("[TC-AIREL-37] refuses a product_details question where Product Master is off, without opening the product flow", async () => {
		// Arrange
		const start = vi.fn();
		const asked = { tool: "ask_user", input: { purpose: "product_details", product: { name: "Scarf", facts: [], variants: "none", variantAxes: [] }, questions: [] } };
		const { service, model } = setup({ AI_AGENT_CAPABILITIES: "site,blog,stock_photos" }, [asked, { text: "I can help with posts and pages." }], { start } as unknown as QuestionFlowService);

		// Act
		const run = await service.start(ctx, { prompt: "draft a scarf product" }, () => undefined);

		// Assert: the schema the model saw has no product_details, the flow never ran, the run answered
		expect(JSON.stringify((model.doGenerateCalls[0] as CallOptions).tools?.find((t) => t.name === "ask_user"))).not.toContain("product_details");
		expect(start).not.toHaveBeenCalled();
		expect(run.status).toBe("applied");
		expect(run.answer).toBe("I can help with posts and pages.");
	});
});
