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
import { merchantInstructions } from "./merchant-instructions";
import { editingLanguageOf, prepareWithLanguage, readWithLanguage } from "./site-editing-language";
import { SUGGEST_NEXT_PROMPT } from "./suggest-next";

// TC-AIREL-220 / 228 — the editor's canvas language reaches prime-web beside (never inside) the model's input, so a
// page text edit lands on the text the merchant sees; replies and suggestions follow the language the merchant wrote in.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 1000, noCache: 800, cacheRead: 200, cacheWrite: undefined },
	outputTokens: { total: 100, text: 100, reasoning: undefined },
};
const BLOCK = "00000000-0000-4000-8000-0000000000b1";
const nulls = { afterBlockId: null, blockType: null, variant: null, fields: null, path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null } as const;

describe("editingLanguageOf — the canvas language from the editor's pin [TC-AIREL-228]", () => {
	it("reads it from the editor pin only, and only as a language code", () => {
		expect(editingLanguageOf({ module: "editor", filters: { site: "5", editingLanguage: "ms" } })).toBe("ms");
		expect(editingLanguageOf({ module: "editor", filters: { editingLanguage: " en-MY " } })).toBe("en-MY");
		expect(editingLanguageOf({ module: "blog", filters: { editingLanguage: "ms" } })).toBeUndefined();
		expect(editingLanguageOf({ module: "editor", filters: { editingLanguage: "ms; DROP TABLE" } })).toBeUndefined();
		expect(editingLanguageOf({ module: "editor", filters: { site: "5" } })).toBeUndefined();
		expect(editingLanguageOf(undefined)).toBeUndefined();
	});

	it("is added to page text drafts and page / section reads, to nothing else", () => {
		expect(prepareWithLanguage("patch", { siteId: "5" }, "ms")).toEqual({ siteId: "5", language: "ms" });
		expect(prepareWithLanguage("pages", { siteId: "5" }, "ms")).toEqual({ siteId: "5", language: "ms" });
		expect(prepareWithLanguage("theme", { siteId: "5" }, "ms")).toEqual({ siteId: "5" });
		expect(prepareWithLanguage("patch", { siteId: "5" }, undefined)).toEqual({ siteId: "5" });
		expect(readWithLanguage({ view: "page" }, "ms")).toEqual({ view: "page", language: "ms" });
		expect(readWithLanguage({ view: "block" }, "ms")).toEqual({ view: "block", language: "ms" });
		expect(readWithLanguage({ view: "theme" }, "ms")).toEqual({ view: "theme" });
	});
});

describe("a run in the Malay view sends the language to prime-web [TC-AIREL-228]", () => {
	function setup(shop: Partial<ShopTools>, turns: Array<{ tool: string; input: unknown } | { text: string }>) {
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", AI_AGENT_CAPABILITIES: "site" });
		let call = 0;
		const model = new MockLanguageModelV4({
			doGenerate: async () => {
				const turn = turns[Math.min(call, turns.length - 1)] as (typeof turns)[number];
				call += 1;
				return "tool" in turn
					? { content: [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.tool, input: JSON.stringify(turn.input) }], finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [] }
					: { content: [{ type: "text" as const, text: turn.text }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
			},
		});
		const store = new InMemoryAgentStore();
		const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
		const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
		return new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), undefined, shop as ShopTools);
	}

	const prepared = {
		kind: "site.page_patch" as const,
		title: "Edit page: Home",
		why: "Change the headline",
		risk: "low" as const,
		diffs: [{ entity: { kind: "site_block", id: BLOCK, label: "Hero · Home" }, field: "headline", before: "Penjagaan mudah. Kulit cantik.", after: "Glow gently" }],
		guardrails: [],
		plan: { siteId: "5", pageId: "10", ops: [], expect: {}, locale: "ms" },
	};
	const turns = [
		{ tool: "site_read", input: { view: "block", siteId: "5", pageId: "10", blockId: BLOCK, query: null } },
		{ tool: "propose_page_patch", input: { siteId: "5", pageId: "10", why: "Change the headline", addToStore: null, keepWording: null, ops: [{ ...nulls, op: "set_fields", blockId: BLOCK, fields: [{ name: "headline", valueJson: '"Glow gently"' }] }] } },
		{ text: "Sudah sedia." },
	];

	it("adds editingLanguage from the pin to the section read and the page patch, and not when the pin has none", async () => {
		const siteRead = vi.fn(async () => ({ id: BLOCK }));
		const sitePrepare = vi.fn(async () => prepared);
		const service = setup({ siteRead, sitePrepare }, turns);

		await service.start(ctx, { prompt: "Change the hero headline to Glow gently", context: { module: "editor", filters: { site: "5", editingLanguage: "ms" } } }, () => undefined);

		expect(siteRead).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ view: "block", blockId: BLOCK, language: "ms" }));
		expect(sitePrepare).toHaveBeenCalledWith(expect.anything(), "patch", expect.objectContaining({ siteId: "5", language: "ms" }));

		const plain = { siteRead: vi.fn(async () => ({ id: BLOCK })), sitePrepare: vi.fn(async () => prepared) };
		await setup(plain, turns).start(ctx, { prompt: "Change the hero headline", context: { module: "editor", filters: { site: "5" } } }, () => undefined);

		expect(plain.siteRead.mock.calls[0]).not.toContainEqual(expect.objectContaining({ language: expect.anything() }));
		expect(plain.sitePrepare.mock.calls[0]).not.toContainEqual(expect.objectContaining({ language: expect.anything() }));
	});
});

describe("reply language [TC-AIREL-228]", () => {
	const instructions = merchantInstructions();

	it("replies, questions and suggestions follow the language of the merchant's message, never the UI, page or website language", () => {
		expect(instructions).toMatch(/Your replies, questions, ask_user options and next-step suggestions are in the language the merchant wrote their latest message in/);
		expect(instructions).toMatch(/not the UI locale, not the website's or the page's language/);
		expect(instructions).toMatch(/Never mix two languages in one reply or line/);
	});

	it("website text follows the language being edited and a text edit in a translation changes that translation", () => {
		expect(instructions).toMatch(/Website text is in the language the editor canvas shows \(Context editingLanguage; else pagesWrittenIn\)/);
		expect(instructions).toMatch(/changes that translation/);
		expect(instructions).not.toMatch(/changes the pagesWrittenIn text, not the translation they see/);
	});

	it("the next-step suggestions are written entirely in the language the merchant wrote in", () => {
		expect(SUGGEST_NEXT_PROMPT).toMatch(/entirely in the language the merchant's own last message was written in/);
		expect(SUGGEST_NEXT_PROMPT).toMatch(/Never mix two languages in one line/);
	});
});
