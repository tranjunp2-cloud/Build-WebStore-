import type { ChangeSet } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentError } from "./agent-errors";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { ChangeSetDecisionService, guardedRecord } from "./change-set-decision.service";
import { MERCHANT_INSTRUCTIONS } from "./merchant-tools";

type LanguageModelV4CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", role: "owner" };
const usage = {
	inputTokens: { total: 1200, noCache: 1000, cacheRead: 200, cacheWrite: undefined },
	outputTokens: { total: 300, text: 300, reasoning: undefined },
};

type Turn = { toolCall: { name: string; input: unknown } } | { text: string } | { error: Error };

function scriptedModel(turns: Turn[], cacheRead = 200) {
	const used = { ...usage, inputTokens: { ...usage.inputTokens, noCache: 1200 - cacheRead, cacheRead } };
	let call = 0;
	return new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			if ("error" in turn) throw turn.error;
			if ("toolCall" in turn) {
				return {
					content: [
						{ type: "tool-call", toolCallId: `call_${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) },
					],
					finishReason: { unified: "tool-calls", raw: undefined },
					usage: used,
					warnings: [],
				};
			}
			return { content: [{ type: "text", text: turn.text }], finishReason: { unified: "stop", raw: undefined }, usage: used, warnings: [] };
		},
	});
}

function setup(
	turns: Turn[],
	envOverrides: Record<string, string> = {},
	provider = "openai",
	model: MockLanguageModelV4 = scriptedModel(turns),
) {
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		...envOverrides,
	});
	const store = new InMemoryAgentStore();
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = {
		record: async (event) => void recorded.push(event),
		countSince: async () => recorded.filter((e) => e.outcome !== "error").length,
	};
	const models: ModelRegistry = { resolveChain: () => [{ model, provider, modelId: "gpt-4.1-mini" }] };
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env));
	return { service, store, recorded, decisions: new ChangeSetDecisionService(store) };
}

const productCall = {
	toolCall: {
		name: "propose_product_drafts",
		input: { locale: "en-US", products: [{ name: "Batik Scarf", description: "Hand-drawn batik scarf." }] },
	},
};

describe("AgentRunService", () => {
	let frames: RunFrame[];
	beforeEach(() => {
		frames = [];
	});

	it("stages a change set from the tool call, streams events and records usage", async () => {
		const { service, store, recorded } = setup([productCall, { text: "Drafted 1 product — approve it below." }]);
		const run = await service.start(ctx, { prompt: "Create a draft for a batik scarf", context: { module: "products" } }, (f) =>
			frames.push(f),
		);

		expect(frames[0]).toMatchObject({ type: "run.started" });
		expect(frames.map((f) => f.type)).toContain("changeset.staged");
		expect(run.status).toBe("awaiting_approval");
		expect(run.answer).toBe("Drafted 1 product — approve it below.");
		expect(run.changeSetIds).toHaveLength(1);

		const [stored] = await store.listChangeSets("org_1", { limit: 10 });
		expect(stored?.action?.kind).toBe("product.create_drafts");
		expect(await store.getRun("org_1", run.id)).toMatchObject({ status: "awaiting_approval" });

		expect(recorded.filter((e) => e.task === "agent.merchant-copilot")).toEqual([
			expect.objectContaining({
				organizationId: "org_1",
				userId: "usr_1",
				task: "agent.merchant-copilot",
				model: "gpt-4.1-mini",
				inputTokens: 2400,
				outputTokens: 600,
				cachedInputTokens: 400,
				outcome: "ok",
			}),
		]);
	});

	it("answers off-topic requests without staging anything", async () => {
		const { service, store, recorded } = setup([{ text: "I can draft products and blog posts for now." }]);
		const run = await service.start(ctx, { prompt: "build me a React todo app with auth" }, (f) => frames.push(f));
		expect(run.status).toBe("applied");
		expect(run.changeSetIds).toEqual([]);
		expect(await store.listChangeSets("org_1", { limit: 10 })).toEqual([]);
		expect(recorded[0]?.outcome).toBe("refused");
	});

	it("fails the run with a user-facing message and still records the attempt", async () => {
		const { service, recorded } = setup([{ error: new Error("upstream 500") }]);
		const run = await service.start(ctx, { prompt: "write a blog post" }, (f) => frames.push(f));
		expect(run.status).toBe("failed");
		expect(run.error).toMatch(/could not complete/i);
		expect(recorded[0]?.outcome).toBe("error");
	});

	it("enforces the per-user rate before starting", async () => {
		const { service } = setup([{ text: "ok" }], { AI_RUNS_PER_MINUTE_PER_USER: "1" });
		await service.start(ctx, { prompt: "hi" }, () => undefined);
		await expect(service.reserveStart(ctx)).rejects.toBeInstanceOf(AgentError);
		await expect(service.reserveStart({ ...ctx, userId: "usr_2" })).resolves.toMatch(/^run_/);
	});
});

describe("ChangeSetDecisionService", () => {
	it("requires a claim before approve, blocks double claims and settles the run", async () => {
		const { service, decisions, store } = setup([productCall, { text: "done" }]);
		const run = await service.start(ctx, { prompt: "draft a scarf" }, () => undefined);
		const id = run.changeSetIds[0] as string;

		await expect(decisions.decide(ctx, id, { decision: "approve" })).rejects.toMatchObject({ status: 409 });
		await decisions.claim(ctx, id);
		await expect(decisions.claim(ctx, id)).rejects.toMatchObject({ status: 409 });

		const decided = await decisions.decide(ctx, id, {
			decision: "approve",
			result: { entities: [{ kind: "product", id: "prd_1" }], links: [{ label: "Open", href: "/catalog/products/prd_1" }] },
		});
		expect(decided).toMatchObject({ status: "applied", decidedBy: "owner@shop.my" });
		expect(decided.result?.links[0]?.href).toBe("/catalog/products/prd_1");
		expect(await store.getRun("org_1", run.id)).toMatchObject({ status: "applied" });
		await expect(decisions.decide(ctx, id, { decision: "reject" })).rejects.toMatchObject({ status: 409 });
	});

	it("supersedes other pending changes for the same record once one is applied (they were drafted from a gone version)", async () => {
		const store = new InMemoryAgentStore();
		const decisions = new ChangeSetDecisionService(store);
		const now = new Date().toISOString();
		const later = new Date(Date.now() + 86_400_000).toISOString();
		const edit = (id: string, kind: string, postId: string): ChangeSet =>
			({
				id, runId: `run_${id}`, domain: "cms", title: id, summary: "", risk: "low",
				blastRadius: { kind: "blog_post", count: 1, label: "1 post" },
				diffs: [{ entity: { kind: "blog_post", id: postId }, field: "title", before: "a", after: "b", provenance: "generated" }],
				guardrails: [], status: "pending", stagedBy: "agent", stagedAt: now, expiresAt: later,
				action: { kind, payload: { id: postId, base: "2026-10-21T04:13:04.326Z", changes: {} } },
			}) as ChangeSet;
		for (const cs of [edit("cs_old", "blog.update", "9"), edit("cs_new", "blog.update", "9"), edit("cs_other", "blog.update", "7")]) {
			await store.insertChangeSet("org_1", cs);
		}

		await decisions.claim(ctx, "cs_new");
		await decisions.decide(ctx, "cs_new", { decision: "approve", result: { entities: [{ kind: "blog_post", id: "9" }], links: [] } });

		expect((await decisions.get(ctx, "cs_old")).status).toBe("superseded");
		expect((await decisions.get(ctx, "cs_other")).status).toBe("pending");
		expect(guardedRecord(edit("x", "blog.create_draft", "new-1"))).toBeUndefined();
	});

	it("never exposes another organization's change set", async () => {
		const { service, decisions } = setup([productCall, { text: "done" }]);
		const run = await service.start(ctx, { prompt: "draft a scarf" }, () => undefined);
		const other = { ...ctx, organizationId: "org_2" };
		await expect(decisions.get(other, run.changeSetIds[0] as string)).rejects.toMatchObject({ status: 404 });
	});
});

describe("merchant copilot prompt is prefix-cache friendly [TC-AICP-32]", () => {
	afterEach(() => vi.useRealTimers());

	/** Runs one copilot request on `date` and returns what the model received. */
	async function captureCall(options: { ctx: AiRequestContext; module: string; prompt: string; date: string; provider?: string }) {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(options.date));
		// the whole capability set on every request (tool routing has its own spec: tool-routing-run.spec.ts)
		const { service } = setup([{ text: "ok" }], { AI_TOOL_ROUTING: "off" }, options.provider);
		const model = (service as unknown as { models: ModelRegistry }).models.resolveChain("balanced")[0]?.model as MockLanguageModelV4;
		await service.start(options.ctx, { prompt: options.prompt, context: { module: options.module } }, () => undefined);
		return model.doGenerateCalls[0] as LanguageModelV4CallOptions;
	}

	it("sends identical system + tool bytes for every org/user/page/day and the context as the user turn", async () => {
		const a = await captureCall({ ctx: { ...ctx, locale: "en-MY" }, module: "products", prompt: "Draft a batik scarf", date: "2026-10-20T03:00:00Z" });
		const b = await captureCall({
			ctx: { organizationId: "org_9", userId: "usr_9", locale: "vi-VN" },
			module: "blog",
			prompt: "Viết bài về cà phê",
			date: "2026-12-31T23:00:00Z",
		});

		const system = (call: LanguageModelV4CallOptions) => call.prompt.filter((m) => m.role === "system");
		expect(system(a)).toEqual([{ role: "system", content: MERCHANT_INSTRUCTIONS }]);
		expect(system(b)).toEqual(system(a));
		expect(MERCHANT_INSTRUCTIONS).not.toMatch(/2026-10-20|"products" page|en-MY/);
		expect(JSON.stringify(b.tools)).toBe(JSON.stringify(a.tools));
		expect(a.tools?.map((t) => t.name)).toEqual(["ask_user", "find_images", "generate_image", "read_item", "search_items", "current_page", "propose_product_drafts", "propose_update", "propose_product_update", "propose_product_publish", "propose_status_change", "inventory_read", "propose_inventory", "propose_store_products", "propose_blog_post", "site_read", "propose_page_patch", "propose_site_patch", "propose_new_page", "propose_page_seo", "propose_page_translation", "propose_theme_change", "propose_navigation", "propose_site_languages", "store_categories", "propose_store_categories", "store_discounts", "propose_store_discounts", "start_campaign", "store_orders", "propose_store_orders", "store_customers", "propose_store_customers", "store_reports", "store_todos", "propose_publish"]);

		const lastUser = (call: LanguageModelV4CallOptions) => {
			const message = call.prompt.at(-1);
			expect(message?.role).toBe("user");
			return message?.role === "user" && message.content[0]?.type === "text" ? message.content[0].text : "";
		};
		expect(lastUser(a)).toBe('Context: the merchant is on the "products" page, UI locale en-MY. Today is 2026-10-20.\n\nDraft a batik scarf');
		expect(lastUser(b)).toBe('Context: the merchant is on the "blog" page, UI locale vi-VN. Today is 2026-12-31.\n\nViết bài về cà phê');
	});

	it("marks the static system prompt as an Anthropic cache breakpoint on anthropic models only", async () => {
		const call = await captureCall({ ctx, module: "products", prompt: "hi", date: "2026-10-20T03:00:00Z", provider: "anthropic" });
		expect(call.prompt[0]).toEqual({
			role: "system",
			content: MERCHANT_INSTRUCTIONS,
			providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
		});
	});
});

describe("next-message suggestions reuse a warm prompt cache [TC-AICP-115]", () => {
	it("asks for suggestions only when the last call read from the cache, and puts them on the run", async () => {
		// Arrange: the reply, then the suggestion call's lines (one numbered, one repeat, one too long)
		const lines = "1. Which products have no photos?\nWrite descriptions for 5 drafts\nwhich products have no photos?\n" + "x".repeat(90);
		const { service, store, recorded } = setup([{ text: "You have 24 draft products." }, { text: lines }]);
		const frames: RunFrame[] = [];

		// Act
		const run = await service.start(ctx, { prompt: "Analyse my products" }, (f) => frames.push(f));

		// Assert
		expect(run.suggestions).toEqual([
			{ prompt: "Which products have no photos?", source: "model" },
			{ prompt: "Write descriptions for 5 drafts", source: "model" },
		]);
		expect((await store.getRun("org_1", run.id))?.suggestions).toHaveLength(2);
		expect(recorded.map((e) => e.task)).toEqual(["agent.merchant-copilot", "agent.suggest-next"]);
		// the reply is final before the suggestions arrive
		const statuses = frames.filter((f) => f.type === "run.status");
		expect(statuses.at(-2)).toMatchObject({ status: "applied", answer: "You have 24 draft products." });
		expect(statuses.at(-1)).toMatchObject({ status: "applied", suggestions: expect.any(Array) });
	});

	it("makes no extra call when the cache was cold", async () => {
		// Arrange
		const turns = [{ text: "You have 24 draft products." }];
		const { service, recorded } = setup(turns, {}, "openai", scriptedModel(turns, 0));

		// Act
		const run = await service.start(ctx, { prompt: "Analyse my products" }, () => undefined);

		// Assert
		expect(run.suggestions).toBeUndefined();
		expect(recorded.map((e) => e.task)).toEqual(["agent.merchant-copilot"]);
	});
});

describe("Stop ends a run as cancelled [TC-AICP-116]", () => {
	it("aborts the model call of a run that is still working", async () => {
		// Arrange: a model that only returns when aborted
		let started: () => void = () => undefined;
		const waiting = new Promise<void>((resolve) => {
			started = resolve;
		});
		const hanging = new MockLanguageModelV4({
			doGenerate: (options: LanguageModelV4CallOptions) =>
				new Promise((_, reject) => {
					started();
					options.abortSignal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
				}),
		});
		const { service, store, recorded } = setup([], {}, "openai", hanging);
		let runId = "";
		const running = service.start(ctx, { prompt: "Analyse my products" }, (f) => {
			if (f.type === "run.started") runId = f.run.id;
		});
		await waiting;

		// Act
		const answer = await service.cancel(ctx, runId);
		const run = await running;

		// Assert
		expect(answer.status).toBe("cancelled");
		expect(run.status).toBe("cancelled");
		expect(run.error).toBeUndefined();
		expect((await store.getRun("org_1", runId))?.status).toBe("cancelled");
		expect(recorded.some((e) => e.task === "agent.suggest-next")).toBe(false);
	});

	it("leaves a finished run as it is and refuses another user's run", async () => {
		// Arrange
		const { service } = setup([{ text: "Done." }]);
		const run = await service.start(ctx, { prompt: "Hi" }, () => undefined);

		// Act + Assert
		expect((await service.cancel(ctx, run.id)).status).toBe("applied");
		await expect(service.cancel({ ...ctx, userId: "usr_2" }, run.id)).rejects.toBeInstanceOf(AgentError);
	});
});
