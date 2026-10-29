import type { ChangeSet, RunEvent } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { DecisionService } from "../decide/decision.service";
import { QuestionFlowService } from "./ask/question-flow";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { createMerchantTools, type MerchantToolDeps, merchantContextLine, merchantUserMessage } from "./merchant-tools";
import { confidentLanguage, messageScript, replyLanguageName, summaryInScriptOf } from "./message-language";
import { ctx, runHarness, scripted } from "./run-harness.spec-helper";
import { looksDeclined, SUGGEST_NEXT_PROMPT, SUGGEST_NEXT_SYSTEM, suggestUserTurn } from "./suggest-next";

// TC-AIAUD-060..079 — the editor copilot, audit #2103 (B1-B5): a run is saved before its end is streamed (no
// THREAD_BUSY for the next message), no chips for what was just declined, the reply language pinned per turn
// with a script guard on the card summary, honest product counts on the card, one products section per page.

const usage = {
	inputTokens: { total: 1000, noCache: 500, cacheRead: 500, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const text = (value: string) => ({ content: [{ type: "text" as const, text: value }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] });

describe("a run is saved before its end is streamed [TC-AIAUD-060]", () => {
	it("TC-AIAUD-060: the stored run says applied before the client sees the end, and both come before the suggestions", async () => {
		// Arrange
		const log: string[] = [];
		const fast = new MockLanguageModelV4({
			doGenerate: async () => {
				log.push("suggestion call");
				return text("Show my best sellers\nWhich orders are pending?");
			},
		});
		const { service, store } = runHarness({ turns: [{ text: "You have 24 draft products." }], fast, cacheRead: 500 });
		const save = store.saveRun.bind(store);
		vi.spyOn(store, "saveRun").mockImplementation(async (org, run) => {
			log.push(`saved ${run.status}${run.suggestions ? " with suggestions" : ""}`);
			return save(org, run);
		});

		// Act
		await service.start(ctx, { prompt: "Analyse my products" }, (frame) => {
			if (frame.type === "run.status") log.push(`streamed ${frame.status}${frame.suggestions ? " with suggestions" : ""}`);
		});

		// Assert: saved first, then the client is told, then the suggestions are made, streamed and saved
		expect(log.slice(0, 4)).toEqual(["saved applied", "streamed applied", "suggestion call", "streamed applied with suggestions"]);
		expect(log.at(-1)).toBe("saved applied with suggestions");
	});

	it("TC-AIAUD-060: a failed run is saved before its failure is streamed too", async () => {
		// Arrange
		const log: string[] = [];
		const broken = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new Error("model down");
			},
		});
		const store = new InMemoryAgentStore();
		const env = testEnv();
		const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
		const models: ModelRegistry = { resolveChain: () => [{ model: broken, provider: "openai", modelId: "gpt-4.1-mini" }] };
		const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env));
		const save = store.saveRun.bind(store);
		vi.spyOn(store, "saveRun").mockImplementation(async (org, run) => {
			log.push(`saved ${run.status}`);
			return save(org, run);
		});

		// Act
		await service.start(ctx, { prompt: "Analyse my products" }, (frame) => {
			if (frame.type === "run.status") log.push(`streamed ${frame.status}`);
		});

		// Assert
		expect(log.indexOf("saved failed")).toBeGreaterThanOrEqual(0);
		expect(log.indexOf("saved failed")).toBeLessThan(log.indexOf("streamed failed"));
	});

	it("TC-AIAUD-061: the next message is accepted while the suggestions are still being made (no THREAD_BUSY)", async () => {
		// Arrange: the first run's suggestion call waits on a gate
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let suggesting: () => void = () => undefined;
		const suggestionStarted = new Promise<void>((resolve) => {
			suggesting = resolve;
		});
		let suggestionCalls = 0;
		const fast = new MockLanguageModelV4({
			doGenerate: async () => {
				suggestionCalls += 1;
				if (suggestionCalls === 1) {
					suggesting();
					await gate;
				}
				return text("Show my best sellers\nWhich orders are pending?");
			},
		});
		const { service } = runHarness({ turns: [{ text: "First answer." }, { text: "Second answer." }], fast, cacheRead: 500 });
		let threadId = "";
		let ended = false;
		const first = service.start(ctx, { prompt: "Analyse my products" }, (frame) => {
			if (frame.type === "run.started") threadId = frame.run.threadId ?? "";
			if (frame.type === "run.status" && frame.status === "applied" && !frame.suggestions) ended = true;
		});
		await suggestionStarted;
		expect(ended).toBe(true);

		// Act: the client saw the end and sends the queued message right away (the controller reserves the start first: 409 while the chat is busy)
		const reserved = await service.reserve(ctx, { threadId });
		const second = await service.start(ctx, { prompt: "And my orders?", threadId }, () => undefined, undefined, reserved.runId);

		// Assert
		expect(second.status).toBe("applied");
		expect(second.answer).toBe("Second answer.");
		release();
		await first;
	});
});

describe("no chips for what the assistant just declined [TC-AIAUD-062]", () => {
	it("TC-AIAUD-062: a reply that declines makes no suggestion call and shows no chips", async () => {
		// Arrange
		const fast = scripted([{ text: "Edit the checkout page\nChange the payment form" }]);
		const { service } = runHarness({ turns: [{ text: "I can't edit the checkout page from here." }], fast, cacheRead: 500 });

		// Act
		const run = await service.start(ctx, { prompt: "change the checkout page colours" }, () => undefined);

		// Assert
		expect(run.status).toBe("applied");
		expect(fast.doGenerateCalls).toHaveLength(0);
		expect(run.suggestions).toBeUndefined();
	});

	it("TC-AIAUD-062: a reply that answers still gets its chips", async () => {
		// Arrange
		const fast = scripted([{ text: "Show my best sellers\nWhich orders are pending?" }]);
		const { service } = runHarness({ turns: [{ text: "You have 24 draft products." }], fast, cacheRead: 500 });

		// Act
		const run = await service.start(ctx, { prompt: "Analyse my products" }, () => undefined);

		// Assert
		expect(fast.doGenerateCalls).toHaveLength(1);
		expect(run.suggestions?.map((s) => s.prompt)).toEqual(["Show my best sellers", "Which orders are pending?"]);
	});

	it("TC-AIAUD-062: recognises a decline in English, Malay and Vietnamese, and not an ordinary answer", () => {
		expect(looksDeclined("Sorry, I can't change fonts from here.")).toBe(true);
		expect(looksDeclined("Saya tidak boleh mengubah fon di sini.")).toBe(true);
		expect(looksDeclined("Tôi không thể đổi phông chữ ở đây.")).toBe(true);
		expect(looksDeclined("Custom HTML isn't supported in the chat.")).toBe(true);
		expect(looksDeclined("You have 24 draft products.")).toBe(false);
		expect(looksDeclined(undefined)).toBe(false);
	});

	it("TC-AIAUD-063: both suggestion prompts forbid suggesting what was declined or a workaround for it", () => {
		expect(SUGGEST_NEXT_PROMPT).toMatch(/Never suggest something you just said you can't do, nor a workaround/);
		expect(SUGGEST_NEXT_SYSTEM).toMatch(/cannot do, nor a workaround/);
	});
});

describe("the reply language of each turn [TC-AIAUD-064]", () => {
	const context = { module: "dashboard", today: "2026-10-29" };

	it("TC-AIAUD-064: the Context line names the language of the latest message when it is clear", () => {
		expect(merchantUserMessage(context, "Add a banner for the new sale to my homepage")).toContain("Reply language: English (from this message).");
		expect(merchantUserMessage(context, "Tolong tambah banner jualan untuk laman utama saya")).toContain("Reply language: Malay (from this message).");
		expect(merchantUserMessage(context, "Thêm banner khuyến mãi vào trang chủ của tôi")).toContain("Reply language: Vietnamese (from this message).");
		expect(merchantUserMessage(context, "Добавь баннер распродажи на главную страницу")).toContain("Reply language: the language of this message (Cyrillic script).");
	});

	it("TC-AIAUD-064: a short or unclear message pins nothing (the model goes by the message itself)", () => {
		expect(merchantUserMessage(context, "ok thanks")).not.toContain("Reply language");
		expect(merchantUserMessage(context, "Añade un banner de rebajas a mi página principal")).not.toContain("Reply language");
		expect(merchantContextLine(context)).not.toContain("Reply language");
	});

	it("TC-AIAUD-064: the pinned language follows each message, not the chat's first one", () => {
		const first = merchantUserMessage(context, "Add a banner for the new sale to my homepage");
		const second = merchantUserMessage(context, "Tolong tambah banner jualan untuk laman utama saya");
		expect(first).toContain("English");
		expect(second).toContain("Malay");
		expect(second).not.toContain("English");
	});

	it("TC-AIAUD-064: the suggestion call is told the language to write in", () => {
		const turn = suggestUserTurn({ prompt: "Add a banner for the new sale", answer: "Done.", staged: [], abilities: ["blog"], language: replyLanguageName("Add a banner for the new sale") });
		expect(turn).toContain("Write the suggestions in: English.");
	});

	it("TC-AIAUD-065: tells scripts apart by the letters, ignoring digits and punctuation", () => {
		expect(messageScript("Hello there 123!")).toBe("latin");
		expect(messageScript("Привет, мир 123")).toBe("cyrillic");
		expect(messageScript("你好，世界")).toBe("cjk");
		expect(messageScript("12 34 !!")).toBeNull();
	});

	it("TC-AIAUD-065: a card summary in another script than the request is replaced by a neutral line", () => {
		// Latin request, Cyrillic summary → a line in the merchant's language
		expect(summaryInScriptOf("Обновить заголовок главной страницы", "Edit page: Home", "Change the homepage headline please")).toBe("Review the changes below before approving.");
		expect(summaryInScriptOf("Обновить заголовок", "Edit page: Home", "Tolong tukar tajuk halaman utama saya")).toBe("Semak perubahan di bawah sebelum meluluskan.");
		// Cyrillic request, Latin summary → the card title (the platform has no Russian lines)
		expect(summaryInScriptOf("Warmer hero headline", "Edit page: Home", "Измени заголовок на главной странице")).toBe("Edit page: Home");
		// same script and nothing clear to tell the languages apart: left alone
		expect(summaryInScriptOf("Warmer hero banner", "Edit page: Home", "Change the homepage headline please")).toBe("Warmer hero banner");
		// (a line with two common Malay words is clearly Malay since TC-AIAUD-174, so it is replaced)
		expect(summaryInScriptOf("Tajuk lebih mesra", "Edit page: Home", "Change the homepage headline please")).toBe("Review the changes below before approving.");
	});

	it("TC-AIAUD-163: a Malay summary under an English request (earlier turns were Malay) is replaced by the English line", () => {
		const prompt = "Please add a banner for the new sale to my homepage";
		const malay = "Tukar tajuk dan penerangan untuk halaman utama";
		expect(summaryInScriptOf(malay, "Edit page: Home", prompt)).toBe("Review the changes below before approving.");
		// and the other way round: an English summary under a Malay request
		expect(summaryInScriptOf("Update the headline and the description for the home page", "Edit page: Home", "Tolong tukar tajuk halaman utama saya")).toBe("Semak perubahan di bawah sebelum meluluskan.");
		// and a Vietnamese one under an English request
		expect(summaryInScriptOf("Cập nhật tiêu đề trang chủ", "Edit page: Home", prompt)).toBe("Review the changes below before approving.");
	});

	it("TC-AIAUD-164: the language guard only fires when both languages are clear", () => {
		const english = "Please add a banner for the new sale to my homepage";
		// same language: untouched
		expect(summaryInScriptOf("Add a sale banner to the home page", "Edit page: Home", english)).toBe("Add a sale banner to the home page");
		expect(summaryInScriptOf("Tukar tajuk dan penerangan untuk halaman utama", "Edit page: Home", "Tolong tukar tajuk halaman utama saya")).toBe("Tukar tajuk dan penerangan untuk halaman utama");
		// request too short or unclear: nothing is pinned, nothing replaced
		expect(summaryInScriptOf("Tukar tajuk dan penerangan untuk halaman utama", "Edit page: Home", "ok thanks")).toBe("Tukar tajuk dan penerangan untuk halaman utama");
		expect(summaryInScriptOf("Tukar tajuk dan penerangan untuk halaman utama", "Edit page: Home", "Añade un banner de rebajas a mi página principal")).toBe("Tukar tajuk dan penerangan untuk halaman utama");
		// summary not clearly Malay (one marker word, product names): kept
		expect(summaryInScriptOf("Batik scarf and silk tudung", "Edit page: Home", english)).toBe("Batik scarf and silk tudung");
		expect(confidentLanguage("Banner sale")).toBeNull();
		expect(confidentLanguage("Tukar tajuk dan penerangan untuk halaman")).toBe("ms");
		expect(confidentLanguage("Update the headline for the page")).toBe("en");
	});

	it("TC-AIAUD-163: a staged card whose summary came out in Malay under an English request carries the English line", async () => {
		// Arrange
		const why = "Tukar tajuk dan penerangan untuk halaman utama";
		const sitePrepare = vi.fn(async () => ({
			kind: "site.page_patch" as const,
			title: "Edit page: Home",
			why,
			risk: "low" as const,
			diffs: [{ entity: { kind: "site_block", id: "b1", label: "Hero · Home" }, field: "headline", before: "Old", after: "New" }],
			guardrails: [],
			plan: { siteId: "5", pageId: "10", ops: [], expect: {} },
		}));
		const input = {
			siteId: "5",
			pageId: "10",
			why,
			ops: [{ op: "set_fields", blockId: "00000000-0000-4000-8000-0000000000b1", afterBlockId: null, blockType: null, variant: null, fields: [{ name: "headline", valueJson: '"New"' }], path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null }],
			addToStore: null,
			keepWording: null,
		};
		const { service, store } = runHarness({ turns: [{ tool: "propose_page_patch", input }, { text: "Drafted for your approval." }], shop: { sitePrepare } });

		// Act
		const run = await service.start(ctx, { prompt: "Please change the homepage headline to be warmer", context: { module: "editor" } }, () => undefined);

		// Assert
		const [changeSet] = await store.listRunChangeSets("org_1", run.id);
		expect(changeSet?.summary).toBe("Review the changes below before approving.");
	});

	it("TC-AIAUD-065: a staged card whose summary came out in Cyrillic carries the neutral line", async () => {
		// Arrange
		const sitePrepare = vi.fn(async () => ({
			kind: "site.page_patch" as const,
			title: "Edit page: Home",
			why: "Обновить заголовок главной страницы",
			risk: "low" as const,
			diffs: [{ entity: { kind: "site_block", id: "b1", label: "Hero · Home" }, field: "headline", before: "Old", after: "New" }],
			guardrails: [],
			plan: { siteId: "5", pageId: "10", ops: [], expect: {} },
		}));
		const input = {
			siteId: "5",
			pageId: "10",
			why: "Обновить заголовок главной страницы",
			ops: [{ op: "set_fields", blockId: "00000000-0000-4000-8000-0000000000b1", afterBlockId: null, blockType: null, variant: null, fields: [{ name: "headline", valueJson: '"New"' }], path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null }],
			addToStore: null,
			keepWording: null,
		};
		const { service, store } = runHarness({ turns: [{ tool: "propose_page_patch", input }, { text: "Drafted for your approval." }], shop: { sitePrepare } });

		// Act
		const run = await service.start(ctx, { prompt: "Change the homepage headline to be warmer", context: { module: "editor" } }, () => undefined);

		// Assert
		const [changeSet] = await store.listRunChangeSets("org_1", run.id);
		expect(changeSet?.summary).toBe("Review the changes below before approving.");
		expect(changeSet?.title).toBe("Edit page: Home");
	});
});

describe("the step before a question [TC-AIAUD-066]", () => {
	const ASK = { purpose: "custom", product: null, questions: [{ id: "tone", title: "Friendly or formal?", why: null, options: [{ value: "friendly", label: "Friendly" }], multiple: false, pictures: null }] };

	it("TC-AIAUD-066: a general question says it prepares a question, not that it reads the catalog families", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		const env = testEnv();
		const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
		const model = scripted([{ tool: "ask_user", input: ASK }]);
		const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
		const flows = new QuestionFlowService({} as ShopTools, new DecisionService(store, ledger, env), store);
		const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), flows);
		const frames: RunFrame[] = [];

		// Act
		const run = await service.start(ctx, { prompt: "write a welcome note for new customers" }, (frame) => frames.push(frame));

		// Assert
		expect(run.status).toBe("awaiting_input");
		const labels = frames.filter((f): f is Extract<RunEvent, { type: "run.step" }> => f.type === "run.step").map((f) => f.step.label);
		expect(labels).toContain("Preparing a question");
		expect(labels).not.toContain("Reading your catalog families");
		const preparing = frames.find((f) => f.type === "run.step" && f.step.label === "Preparing a question");
		expect(preparing).toMatchObject({ step: { phrase: { key: "step.question" } } });
	});
});

function toolDeps(overrides: Partial<MerchantToolDeps> = {}): MerchantToolDeps {
	return {
		runId: "run_1",
		newChangeSetId: () => "cs_abc123def456",
		now: () => new Date("2026-10-29T08:00:00Z"),
		stage: vi.fn(async () => undefined),
		allowEdit: () => true,
		createdInChat: () => [],
		images: () => [],
		seenProducts: () => [],
		siteRead: vi.fn(async () => ({})),
		sitePrepare: vi.fn(async () => ({ error: { code: "x", message: "x" } })),
		...overrides,
	} as unknown as MerchantToolDeps;
}

const run = (tools: ReturnType<typeof createMerchantTools>, name: "propose_page_patch" | "propose_site_patch", input: unknown) =>
	(tools[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: "t", messages: [] });

const nulls = { blockId: null, afterBlockId: null, blockType: null, variant: null, fields: null, path: null, imageId: null, imageIds: null, captions: null, valueJson: null, rows: null } as const;
const insertFeatured = (pageId: string) => ({
	siteId: "5",
	pageId,
	why: "Show two products on the homepage",
	addToStore: null,
	keepWording: null,
	ops: [{ ...nulls, op: "insert_block", blockType: "products-featured", fields: [{ name: "productIds", valueJson: '["1","2"]' }] }],
});

const prepared = (guardrails: Array<{ rule: string; ok: boolean; detail: string }>) => ({
	kind: "site.page_patch" as const,
	title: "Edit page: Home",
	why: "Show two products",
	risk: "low" as const,
	diffs: [{ entity: { kind: "site_block", id: "b1", label: "Featured Products · Home" }, field: "productIds", before: null, after: "2 items" }],
	guardrails,
	plan: { siteId: "5", pageId: "10", ops: [], expect: {} },
});

describe("what a products section will show [TC-AIAUD-067]", () => {
	it("TC-AIAUD-067: the tool result carries the platform's count (N of M) and the reasons, apart from the skipped notes", async () => {
		// Arrange
		const detail = "Featured Products shows 1 of 2 chosen products on the live site. Not shown (not on sale on this site: draft, off-sale or deleted): “Batik scarf”.";
		const d = toolDeps({
			sitePrepare: vi.fn(async () =>
				prepared([
					{ rule: "products_shown", ok: false, detail },
					{ rule: "skipped_value", ok: false, detail: "Left out a link." },
				]),
			),
		});

		// Act
		const out = await run(createMerchantTools(d), "propose_page_patch", insertFeatured("10"));

		// Assert
		expect(out.productsShown).toEqual([detail]);
		expect(out.skipped).toEqual(["Left out a link."]);
		expect(String(out.note)).toMatch(/exactly what productsShown says/);
	});

	it("TC-AIAUD-067: nothing is added to the result when the edit chooses no products", async () => {
		// Arrange
		const d = toolDeps({ sitePrepare: vi.fn(async () => prepared([{ rule: "undo", ok: true, detail: "undo" }])) });

		// Act
		const out = await run(createMerchantTools(d), "propose_page_patch", insertFeatured("10"));

		// Assert
		expect(out).not.toHaveProperty("productsShown");
		expect(out).not.toHaveProperty("skipped");
	});
});

describe("one products section per page [TC-AIAUD-068]", () => {
	const waiting = (pageId: string, blockType: string, status: ChangeSet["status"] = "pending") =>
		({
			id: "cs_waiting0001",
			status,
			action: { kind: "site.page_patch", payload: { siteId: "5", pageId, ops: [{ op: "insert_block", afterBlockId: null, block: { blockType, productIds: ["1", "2"] } }] } },
		}) as unknown as ChangeSet;

	it("TC-AIAUD-068: a second Featured Products section is refused while the first still waits for approval", async () => {
		// Arrange
		const d = toolDeps({ pendingChanges: async () => [waiting("10", "products-featured")], sitePrepare: vi.fn(async () => prepared([])) });

		// Act
		const out = await run(createMerchantTools(d), "propose_page_patch", insertFeatured("10"));

		// Assert
		expect(out).toMatchObject({ error: { code: "section_pending" } });
		expect(JSON.stringify(out)).toContain("cs_waiting0001");
		expect(d.sitePrepare).not.toHaveBeenCalled();
		expect(d.stage).not.toHaveBeenCalled();
	});

	it("TC-AIAUD-068: another page, another kind of section, or a decided card does not block the insert", async () => {
		// Arrange
		const d = toolDeps({
			pendingChanges: async () => [waiting("11", "products-featured"), waiting("10", "products-grid"), waiting("10", "products-featured", "applied")],
			sitePrepare: vi.fn(async () => prepared([])),
		});

		// Act
		const out = await run(createMerchantTools(d), "propose_page_patch", insertFeatured("10"));

		// Assert
		expect(out).toMatchObject({ changeSetId: "cs_abc123def456" });
		expect(d.stage).toHaveBeenCalledTimes(1);
	});

	it("TC-AIAUD-068: a pending section on a page also blocks the same insert inside a multi-page edit", async () => {
		// Arrange
		const d = toolDeps({ pendingChanges: async () => [waiting("10", "products-featured")], sitePrepare: vi.fn(async () => prepared([])) });
		const input = { siteId: "5", why: "Same on two pages", keepWording: null, pages: [{ pageId: "10", ops: insertFeatured("10").ops }, { pageId: "12", ops: insertFeatured("12").ops }] };

		// Act
		const out = await run(createMerchantTools(d), "propose_site_patch", input);

		// Assert
		expect(out).toMatchObject({ error: { code: "section_pending" } });
	});

	const insertGrid = (pageId: string, fields: Array<{ name: string; valueJson: string }>) => ({
		...insertFeatured(pageId),
		ops: [{ ...nulls, op: "insert_block", blockType: "products-grid", fields }],
	});
	const waitingGrid = (pageId: string, block: Record<string, unknown>) =>
		({
			id: "cs_waitinggrid1",
			status: "pending",
			action: { kind: "site.page_patch", payload: { siteId: "5", pageId, ops: [{ op: "insert_block", afterBlockId: null, block: { blockType: "products-grid", ...block } }] } },
		}) as unknown as ChangeSet;

	it("TC-AIAUD-152: a Bags grid is staged while a Shoes grid (and a Featured Products section) still wait on the same page", async () => {
		// Arrange
		const d = toolDeps({
			pendingChanges: async () => [waitingGrid("10", { category: "12", selectionMode: "all" }), waiting("10", "products-featured")],
			sitePrepare: vi.fn(async () => prepared([])),
		});

		// Act
		const bags = await run(createMerchantTools(d), "propose_page_patch", insertGrid("10", [{ name: "category", valueJson: '"13"' }]));
		const picks = await run(createMerchantTools(d), "propose_page_patch", insertGrid("10", [{ name: "selectedProductIds", valueJson: '["1","2"]' }]));

		// Assert
		expect(bags).toMatchObject({ changeSetId: "cs_abc123def456" });
		expect(picks).toMatchObject({ changeSetId: "cs_abc123def456" });
		expect(d.stage).toHaveBeenCalledTimes(2);
	});

	it("TC-AIAUD-152: the same grid again (same category, same unfiltered list, same picked set in another order) is refused while it waits", async () => {
		// Arrange
		const cases: Array<[Record<string, unknown>, Array<{ name: string; valueJson: string }>]> = [
			[{ category: "12", selectionMode: "all" }, [{ name: "category", valueJson: '"12"' }]],
			[{ selectionMode: "all" }, []],
			[{ selectionMode: "fixed", selectedProductIds: ["2", "1"] }, [{ name: "selectedProductIds", valueJson: '["1","2"]' }]],
		];

		for (const [pending, fields] of cases) {
			const d = toolDeps({ pendingChanges: async () => [waitingGrid("10", pending)], sitePrepare: vi.fn(async () => prepared([])) });

			// Act
			const out = await run(createMerchantTools(d), "propose_page_patch", insertGrid("10", fields));

			// Assert
			expect(out).toMatchObject({ error: { code: "section_pending" } });
			expect(d.stage).not.toHaveBeenCalled();
		}
	});

	it("TC-AIAUD-206: an expired card (stored as pending, past its expiry) no longer blocks the section; a live one still does", async () => {
		// Arrange: now is 2026-10-29T08:00Z
		const expired = { ...waiting("10", "products-featured"), expiresAt: "2026-10-29T07:59:00Z" } as ChangeSet;
		const live = { ...waiting("10", "products-featured"), expiresAt: "2026-10-29T08:30:00Z" } as ChangeSet;
		const dExpired = toolDeps({ pendingChanges: async () => [expired], sitePrepare: vi.fn(async () => prepared([])) });
		const dLive = toolDeps({ pendingChanges: async () => [live], sitePrepare: vi.fn(async () => prepared([])) });

		// Act
		const added = await run(createMerchantTools(dExpired), "propose_page_patch", insertFeatured("10"));
		const refused = await run(createMerchantTools(dLive), "propose_page_patch", insertFeatured("10"));

		// Assert
		expect(added).toMatchObject({ changeSetId: "cs_abc123def456" });
		expect(dExpired.stage).toHaveBeenCalledTimes(1);
		expect(refused).toMatchObject({ error: { code: "section_pending" } });
	});

	it("TC-AIAUD-207: the Featured Products refusal points to a fixed Products Grid, never to set_fields productIds as a way to pick products", async () => {
		// Arrange
		const d = toolDeps({ pendingChanges: async () => [waiting("10", "products-featured")], sitePrepare: vi.fn(async () => prepared([])) });

		// Act
		const out = (await run(createMerchantTools(d), "propose_page_patch", insertFeatured("10"))) as { error: { message: string } };

		// Assert
		expect(out.error.message).toContain("Products Grid");
		expect(out.error.message).toContain("selectedProductIds");
		expect(out.error.message).toContain("Never suggest set_fields productIds");
		expect(out.error.message).not.toMatch(/change the section's products with set_fields/);
	});

	it("TC-AIAUD-068: a run reads the chat's waiting cards from the store (a card staged earlier in the chat)", async () => {
		// Arrange: the first message stages a Featured Products section; the second asks for another one
		const sitePrepare = vi.fn(async () => ({ ...prepared([]), plan: { siteId: "5", pageId: "10", ops: [{ op: "insert_block", afterBlockId: null, block: { blockType: "products-featured", productIds: ["1", "2"] } }], expect: {} } }));
		const { service } = runHarness({
			turns: [{ tool: "propose_page_patch", input: insertFeatured("10") }, { text: "Drafted." }, { tool: "propose_page_patch", input: insertFeatured("10") }, { text: "Already waiting." }],
			shop: { sitePrepare },
		});
		const first = await service.start(ctx, { prompt: "Feature two products on my homepage", context: { module: "editor" } }, () => undefined);

		// Act
		await service.start(ctx, { prompt: "Feature two products on my homepage again", threadId: first.threadId, context: { module: "editor" } }, () => undefined);

		// Assert: the second insert never reached prime-web
		expect(sitePrepare).toHaveBeenCalledTimes(1);
	});
});
