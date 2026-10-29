import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { ChangeSetDecisionService } from "./change-set-decision.service";
import { MERCHANT_INSTRUCTIONS } from "./merchant-tools";
import { boundTurns, draftTitle, historyMessages, threadTitle, type ThreadTurn } from "./thread-memory";
import { ThreadRetentionService } from "./thread-retention.service";
import { replyLanguageNote } from "./message-language";

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];
type Turn = { toolCall: { name: string; input: unknown } } | { text: string };

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", locale: "en-MY" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const DAY_MS = 24 * 60 * 60 * 1000;

function setup(turns: Turn[], envOverrides: Record<string, string> = {}) {
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		...envOverrides,
	});
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			const content =
				"toolCall" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.toolCall.name, input: JSON.stringify(turn.toolCall.input) }]
					: [{ type: "text" as const, text: turn.text }];
			const finishReason = { unified: "toolCall" in turn ? ("tool-calls" as const) : ("stop" as const), raw: undefined };
			return { content, finishReason, usage, warnings: [] };
		},
	});
	const store = new InMemoryAgentStore();
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (event) => void recorded.push(event), countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "deepseek", modelId: "deepseek-chat" }] };
	const threads = new AgentThreadService(store, env);
	const runs = new AgentRunService(store, models, ledger, env, threads);
	return {
		store,
		threads,
		runs,
		recorded,
		model,
		decisions: new ChangeSetDecisionService(store),
		retention: new ThreadRetentionService(store, threads, env),
	};
}

const twoProducts: Turn = {
	toolCall: {
		name: "propose_product_drafts",
		input: {
			locale: "en-US",
			products: [
				{ name: "Batik scarf", description: "Hand-drawn batik scarf in soft cotton." },
				{ name: "Silk tudung", description: "Lightweight silk tudung with a fine batik edge." },
			],
		},
	},
};

const noop = (_frame: RunFrame) => undefined;

afterEach(() => vi.useRealTimers());

describe("copilot threads — lifecycle and ownership [TC-AICP-36]", () => {
	it("keeps run reads private to the user who sent the prompt", async () => {
		const { runs, store } = setup([{ text: "ok" }]);
		const mine = await runs.start(ctx, { prompt: "Create draft products: Batik scarf" }, noop);
		const colleague = { ...ctx, userId: "usr_2" };

		expect(await store.listRuns(colleague.organizationId, 20, colleague.userId)).toEqual([]);
		expect(await store.getRun(colleague.organizationId, mine.id, colleague.userId)).toBeNull();
		expect((await store.listRuns(ctx.organizationId, 20, ctx.userId)).map((r) => r.id)).toEqual([mine.id]);
	});

	it("creates a thread on the first run and continues it when threadId is sent", async () => {
		const { runs, threads, store } = setup([{ text: "ok" }]);
		const frames: RunFrame[] = [];
		const first = await runs.start(ctx, { prompt: "  Create   draft products:\nBatik scarf, Silk tudung  " }, (f) => frames.push(f));
		expect(first.threadId).toMatch(/^thr_[0-9a-f]{20}$/);
		expect(frames[0]).toMatchObject({ type: "run.started", run: { threadId: first.threadId } });

		const second = await runs.start(ctx, { prompt: "Make the second one shorter", threadId: first.threadId, context: { module: "store" } }, noop);
		expect(second.threadId).toBe(first.threadId);
		expect(store.threads.size).toBe(1);

		const [listed] = await threads.list(ctx, 20);
		expect(listed).toMatchObject({
			id: first.threadId,
			title: "Batik scarf, Silk tudung",
			preview: "Make the second one shorter",
			runCount: 2,
			// the page the latest message came from names the chat in the list ("Product Store")
			module: "store",
		});
		const detail = await threads.detail(ctx, first.threadId as string);
		expect(detail.runs.map((r) => r.id)).toEqual([first.id, second.id]);
	});

	it("titles a thread from the first prompt, cut at 60 characters", () => {
		expect(threadTitle("a".repeat(80))).toBe(`A${"a".repeat(59)}…`);
		expect(threadTitle("Draft a\n\n batik   scarf")).toBe("Draft a batik scarf");
	});

	it("names the chat without a model call: request phrasing dropped, first clause kept [TC-AICP-50]", () => {
		expect(threadTitle("Create a product: oversized cotton shirt, grey and ivory, sizes S to XL, RM 89.")).toBe("Oversized cotton shirt");
		expect(threadTitle("Write a blog post about caring for linen and cotton clothes, friendly tone, 600 words.")).toBe(
			"Caring for linen and cotton clothes",
		);
		expect(threadTitle("Create a product from this photo and the size chart. Oversized shirt, grey, RM 89.")).toBe("Oversized shirt");
		expect(threadTitle("Viết bài blog về cách chọn áo dài cho ngày Tết")).toBe("Cách chọn áo dài cho ngày Tết");
		expect(threadTitle("Tulis artikel blog tentang tips memilih tudung untuk Hari Raya")).toBe("Tips memilih tudung untuk Hari Raya");
		expect(draftTitle([{ type: "product", name: "Oversized Cotton Shirt" }], "en-MY")).toBe("Oversized Cotton Shirt — new product");
		expect(draftTitle([{ type: "blog", title: "How to care for linen" }])).toBe("How to care for linen");
	});

	it("renames the chat after its draft, but never over the merchant's own title [TC-AICP-50]", async () => {
		const staged = { toolCall: { name: "propose_product_drafts", input: { locale: "en-US", products: [{ name: "Batik Silk Scarf", description: "Scarf." }] } } };
		const { runs, threads } = setup([staged, { text: "Drafted." }, staged, { text: "Drafted again." }]);
		const first = await runs.start(ctx, { prompt: "please create a product for me" }, noop);
		expect((await threads.list(ctx, 5))[0]?.title).toBe("Batik Silk Scarf — new product");

		await threads.rename(ctx, first.threadId as string, "Scarves for Raya");
		await runs.start(ctx, { prompt: "again", threadId: first.threadId }, noop);
		expect((await threads.list(ctx, 5))[0]?.title).toBe("Scarves for Raya");
	});

	it("hides a thread from another user of the same org and from other orgs (404, no run created)", async () => {
		const { runs, threads, store } = setup([{ text: "ok" }]);
		const run = await runs.start(ctx, { prompt: "Draft a scarf" }, noop);
		const id = run.threadId as string;
		const colleague = { ...ctx, userId: "usr_2" };
		const otherOrg = { ...ctx, organizationId: "org_2" };

		for (const other of [colleague, otherOrg]) {
			await expect(threads.open(other, { prompt: "hi", threadId: id })).rejects.toMatchObject({ status: 404 });
			await expect(runs.start(other, { prompt: "hi", threadId: id }, noop)).rejects.toMatchObject({ status: 404 });
			await expect(threads.detail(other, id)).rejects.toMatchObject({ status: 404 });
			await expect(threads.rename(other, id, "Mine now")).rejects.toMatchObject({ status: 404 });
			await expect(threads.remove(other, id)).rejects.toMatchObject({ status: 404 });
			expect(await threads.list(other, 20)).toEqual([]);
		}
		expect(store.runs.size).toBe(1);
		expect(store.threads.get(id)?.thread.title).toBe("Draft a scarf");
	});

	it("lists newest activity first, renames, and deletes the thread with its runs and change sets", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-20T01:00:00Z"));
		const { runs, threads, store, recorded } = setup([twoProducts, { text: "Drafted 2 products." }]);
		const older = await runs.start(ctx, { prompt: "Create draft products: Batik scarf, Silk tudung" }, noop);
		vi.setSystemTime(new Date("2026-10-20T02:00:00Z"));
		const newer = await runs.start(ctx, { prompt: "Another chat" }, noop);
		expect((await threads.list(ctx, 20)).map((t) => t.id)).toEqual([newer.threadId, older.threadId]);
		expect(await threads.list(ctx, 1)).toHaveLength(1);

		const renamed = await threads.rename(ctx, older.threadId as string, "Raya scarves");
		expect(renamed).toMatchObject({ title: "Raya scarves", updatedAt: "2026-10-20T01:00:00.000Z" });

		expect(store.changeSets.size).toBe(1);
		await threads.remove(ctx, older.threadId as string);
		await expect(threads.detail(ctx, older.threadId as string)).rejects.toMatchObject({ status: 404 });
		expect(store.runs.has(older.id)).toBe(false);
		expect(store.changeSets.size).toBe(0);
		expect(store.runs.has(newer.id)).toBe(true);
		// Ledger rows carry no content and stay.
		expect(recorded.filter((e) => e.runId === older.id)).toHaveLength(1);
	});

	it("refuses to delete while a change set of the thread is claimed, then deletes once released", async () => {
		const { runs, threads, decisions, store } = setup([twoProducts, { text: "Drafted 2 products." }]);
		const run = await runs.start(ctx, { prompt: "Create draft products: Batik scarf, Silk tudung" }, noop);
		const changeSetId = run.changeSetIds[0] as string;
		await decisions.claim(ctx, changeSetId);

		await expect(threads.remove(ctx, run.threadId as string)).rejects.toMatchObject({ status: 409 });
		expect(store.changeSets.has(changeSetId)).toBe(true);

		await decisions.release(ctx, changeSetId);
		await threads.remove(ctx, run.threadId as string);
		expect(store.changeSets.has(changeSetId)).toBe(false);
		expect(store.threads.size).toBe(0);
	});
});

describe("copilot threads — conversation memory [TC-AICP-37]", () => {
	function lastUserText(call: CallOptions): string {
		const message = call.prompt.at(-1);
		return message?.role === "user" && message.content[0]?.type === "text" ? message.content[0].text : "";
	}

	it("replays the first turn's exact user message, answer and staged line before the new message", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-20T03:00:00Z"));
		// every tool on both turns, so the system prompt is the full set's (routing keeps a chat's set growing: tool-routing-run.spec.ts)
		const { runs, model } = setup([twoProducts, { text: "Drafted 2 products for your approval." }, { text: "Shorter tudung drafted." }], { AI_TOOL_ROUTING: "off" });
		const first = await runs.start(ctx, { prompt: "Create draft products: Batik scarf, Silk tudung", context: { module: "products" } }, noop);
		const firstUser = lastUserText(model.doGenerateCalls[0] as CallOptions);
		expect(firstUser).toBe(
			'Context: the merchant is on the "products" page, UI locale en-MY. Today is 2026-10-20. Reply language: English (from this message).\n\nCreate draft products: Batik scarf, Silk tudung\n\n' + replyLanguageNote("English"),
		);

		vi.setSystemTime(new Date("2026-10-21T08:00:00Z"));
		await runs.start(
			ctx,
			{ prompt: "Make the second one's description shorter", threadId: first.threadId, context: { module: "blog" } },
			noop,
		);
		const call = model.doGenerateCalls[2] as CallOptions;
		const csId = first.changeSetIds[0] as string;
		// JSON round-trip drops the SDK's `providerOptions: undefined` keys.
		expect(JSON.parse(JSON.stringify(call.prompt))).toEqual([
			{ role: "system", content: MERCHANT_INSTRUCTIONS },
			{ role: "user", content: [{ type: "text", text: firstUser }] },
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: `Drafted 2 products for your approval.\n<staged_draft id="${csId}">Create 2 draft products — Batik scarf, Silk tudung</staged_draft>`,
					},
				],
			},
			{
				role: "user",
				content: [
					{
						type: "text",
						// a day later the earlier draft has expired: the line says what became of it
						text: `Context: the merchant is on the "blog" page, UI locale en-MY. Today is 2026-10-21. Reply language: English (from this message).\nDrafts from earlier messages: ${csId} "Create 2 draft products": expired\n\nMake the second one's description shorter\n\n${replyLanguageNote("English")}`,
					},
				],
			},
		]);
	});

	it("keeps history byte-identical across consecutive runs, even after a decision changes state", async () => {
		const { runs, model, decisions } = setup([twoProducts, { text: "Drafted." }, { text: "Second." }, { text: "Third." }]);
		const first = await runs.start(ctx, { prompt: "Create draft products: Batik scarf, Silk tudung" }, noop);
		await runs.start(ctx, { prompt: "Shorter please", threadId: first.threadId }, noop);
		await decisions.decide(ctx, first.changeSetIds[0] as string, { decision: "reject" });
		await runs.start(ctx, { prompt: "Thanks", threadId: first.threadId }, noop);

		const run2 = (model.doGenerateCalls[2] as CallOptions).prompt;
		const run3 = (model.doGenerateCalls[3] as CallOptions).prompt;
		expect(run2).toHaveLength(4);
		expect(run3).toHaveLength(6);
		// Run 3 starts with everything run 2 sent (system + turn 1 + run 2's user turn), byte for byte.
		expect(JSON.stringify(run3.slice(0, 4))).toBe(JSON.stringify(run2));
		expect(JSON.stringify(run3[4])).toContain("Second.");
	});

	it("sends the same history to the fallback model when the first provider fails", async () => {
		const { runs, store, threads } = setup([{ text: "First answer." }]);
		const first = await runs.start(ctx, { prompt: "Draft a scarf" }, noop);
		const failing = new MockLanguageModelV4({ doGenerate: async () => Promise.reject(new Error("fetch failed")) });
		const backup = new MockLanguageModelV4({
			doGenerate: async () => ({
				content: [{ type: "text", text: "Backup answer." }],
				finishReason: { unified: "stop", raw: undefined },
				usage,
				warnings: [],
			}),
		});
		const env = parseEnv({
			AI_PLATFORM_DATABASE_URL: "postgres://x/y",
			AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		});
		const chain: ModelRegistry = {
			resolveChain: () => [
				{ model: failing, provider: "deepseek", modelId: "deepseek-chat" },
				{ model: backup, provider: "openai", modelId: "gpt-4.1-mini" },
			],
		};
		const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
		const fallbackRuns = new AgentRunService(store, chain, ledger, env, threads);
		const second = await fallbackRuns.start(ctx, { prompt: "Shorter", threadId: first.threadId }, noop);

		expect(second.answer).toBe("Backup answer.");
		const sent = [failing.doGenerateCalls[0], backup.doGenerateCalls[0]].map((call) => JSON.stringify(call?.prompt));
		expect(sent[0]).toContain("First answer.");
		expect(sent[1]).toBe(sent[0]);
	});

	it("bounds history to the newest 20 whole turns and ~24k characters", () => {
		const turns: ThreadTurn[] = Array.from({ length: 25 }, (_, i) => ({ user: `u${i}`, assistant: `a${i}` }));
		const kept = boundTurns(turns);
		expect(kept).toHaveLength(20);
		expect(kept[0]?.user).toBe("u5");
		expect(kept.at(-1)?.user).toBe("u24");

		const big: ThreadTurn[] = Array.from({ length: 6 }, (_, i) => ({ user: `u${i}`.padEnd(5_000, "x"), assistant: "a" }));
		const bounded = boundTurns(big);
		expect(bounded.map((t) => t.user.slice(0, 2))).toEqual(["u2", "u3", "u4", "u5"]);
		expect(bounded.reduce((n, t) => n + t.user.length + t.assistant.length, 0)).toBeLessThanOrEqual(24_000);
	});

	it("skips runs that left nothing to remember and runs without a stored user turn", () => {
		const base = { role: "merchant" as const, domain: "products" as const, prompt: "p", steps: [], receipts: [], startedAt: "x" };
		const messages = historyMessages(
			[
				{ run: { ...base, id: "run_a", status: "failed", changeSetIds: [], error: "boom" }, userMessage: "u-failed" },
				{ run: { ...base, id: "run_b", status: "applied", changeSetIds: [], answer: "hello" }, userMessage: null },
				{ run: { ...base, id: "run_c", status: "applied", changeSetIds: [], answer: "kept" }, userMessage: "u-kept" },
			],
			new Map(),
		);
		expect(messages).toEqual([
			{ role: "user", content: "u-kept" },
			{ role: "assistant", content: "kept" },
		]);
	});
});

describe("copilot threads — retention [TC-AICP-38]", () => {
	it("hides threads idle past the retention window, sweeps them with runs + change sets and keeps ledger rows", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
		const { runs, threads, store, recorded, retention } = setup([twoProducts, { text: "Drafted." }]);
		const run = await runs.start(ctx, { prompt: "Create draft products: Batik scarf, Silk tudung" }, noop);
		const id = run.threadId as string;

		vi.setSystemTime(new Date(Date.parse("2026-01-01T00:00:00Z") + 89 * DAY_MS));
		expect(await threads.list(ctx, 20)).toHaveLength(1);
		expect(await retention.sweep()).toEqual({ threads: 0, runs: 0, changeSets: 0, staleRuns: 0 });

		vi.setSystemTime(new Date(Date.parse("2026-01-01T00:00:00Z") + 91 * DAY_MS));
		expect(await threads.list(ctx, 20)).toEqual([]);
		await expect(threads.detail(ctx, id)).rejects.toMatchObject({ status: 404 });
		await expect(runs.start(ctx, { prompt: "hi", threadId: id }, noop)).rejects.toMatchObject({ status: 404 });
		expect(store.threads.has(id)).toBe(true); // hidden before the sweep runs

		expect(await retention.sweep()).toEqual({ threads: 1, runs: 1, changeSets: 1, staleRuns: 0 });
		expect(store.threads.size).toBe(0);
		expect(store.runs.size).toBe(0);
		expect(store.changeSets.size).toBe(0);
		expect(recorded.filter((e) => e.runId === run.id)).toHaveLength(1);
	});

	it("counts from last activity and respects AI_THREAD_RETENTION_DAYS", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const t0 = Date.parse("2026-03-01T00:00:00Z");
		vi.setSystemTime(new Date(t0));
		const { runs, threads, retention } = setup([{ text: "ok" }], { AI_THREAD_RETENTION_DAYS: "7" });
		const run = await runs.start(ctx, { prompt: "Draft a scarf" }, noop);

		vi.setSystemTime(new Date(t0 + 5 * DAY_MS));
		await runs.start(ctx, { prompt: "And a tudung", threadId: run.threadId }, noop);

		vi.setSystemTime(new Date(t0 + 11 * DAY_MS));
		expect(await threads.list(ctx, 20)).toHaveLength(1);

		vi.setSystemTime(new Date(t0 + 13 * DAY_MS));
		expect(await threads.list(ctx, 20)).toEqual([]);
		expect(await retention.sweep()).toMatchObject({ threads: 1, runs: 2 });
	});
});
