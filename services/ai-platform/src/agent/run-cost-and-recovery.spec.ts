import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../config/env";
import type { ModelRegistry } from "../models/model-registry";
import type { SettingsService } from "../settings/settings.service";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { lastCopilot, REPLY, runCopilot, type Seen } from "./provider-fakes.spec-helper";
import { budgetLine } from "./run-budget";
import { ctx, runHarness, STAGING_FULL } from "./run-harness.spec-helper";

// TC-AICP-361 — the copilot's history is cached on Anthropic (a breakpoint on the newest message, moved each step)
// TC-AICP-362 — the run's token budget stops a call between its steps, not only between calls
// TC-AICP-363 — a read that ends after its call timed out never writes into the fallback call's result memory
// TC-AICP-364 — a picture deleted while the run waits for an answer: the run goes on
// TC-AICP-365 — a hung tool no longer holds a model call past its limit (or past Stop)

afterEach(() => vi.unstubAllGlobals());

const READ = { view: "page", siteId: "3490", pageId: "11853", blockId: null, query: null };
/** A page read the size of a real one (~8k characters). */
const bigPage = async (_c: unknown, input: { view: string }) => ({
	view: input.view,
	blocks: Array.from({ length: 24 }, (_, i) => ({ id: `block_${i}`, type: "text", heading: `Kopi Kampung ${i}`, text: "Freshly roasted beans from Johor. ".repeat(8) })),
});

/** Input tokens billed at Anthropic's prices: full 1×, cache write 1.25×, cache read 0.1×. */
function billed(seen: Seen[]) {
	const calls = seen.filter((s) => s.provider === "anthropic" && s.copilot && s.cache);
	const sum = (key: "input" | "cacheRead" | "cacheWrite") => calls.reduce((n, s) => n + (s.cache?.[key] ?? 0), 0);
	const input = sum("input");
	const read = sum("cacheRead");
	const write = sum("cacheWrite");
	return { requests: calls.length, prompt: input + read + write, input, read, write, cost: input + 1.25 * write + 0.1 * read };
}

describe("history cached on Anthropic [TC-AICP-361]", () => {
	for (const [name, script] of [
		["six page reads, then the answer", ["read", "read", "read", "read", "read", "read", "reply"]],
		["#2205: two reads, a silent turn, the wrap-up", ["read", "read", "silent", "reply"]],
	] as const) {
		it(name, async () => {
			// Arrange + Act
			const { result, seen, refused } = await runCopilot(["anthropic"], [...script], { shop: { siteRead: bigPage } as never });

			// Assert: at most 4 breakpoints, the newest message is one, later steps read the history from the cache
			const b = billed(seen);
			if (process.env.EVIDENCE) console.log(`EVIDENCE ${name}: ${JSON.stringify(b)}`);
			const copilot = seen.filter((s) => s.copilot);
			expect(refused()).toEqual([]);
			expect(result.answer).toBe(REPLY);
			expect(copilot.every((s) => (s.breakpoints ?? 0) <= 4)).toBe(true);
			const last = lastCopilot(seen)?.body.messages.at(-1);
			expect(JSON.stringify(last?.content)).toContain("cache_control");
			for (const s of copilot.slice(1)) expect(s.cache?.cacheRead ?? 0).toBeGreaterThan(0.8 * ((s.cache?.cacheRead ?? 0) + (s.cache?.input ?? 0) + (s.cache?.cacheWrite ?? 0)) - 2_000);
			// nothing at full price: every request is cache read up to the last breakpoint, then cache write
			expect(b.input).toBe(0);
		});
	}

	it("other providers get the history unchanged (they cache prefixes themselves)", async () => {
		const { seen } = await runCopilot(["openai"], ["read", "read", "reply"]);
		expect(seen.some((s) => JSON.stringify(s.body).includes("cache_control"))).toBe(false);
	});
});

describe("token budget between steps [TC-AICP-362]", () => {
	it("stops before the next step once the run's tokens are used up", async () => {
		// Arrange: each step costs 1 020 tokens, the run may use 2 500; the model would read six times in one call
		const turns = [...Array.from({ length: 6 }, () => ({ tool: "site_read", input: READ })), { text: "Done." }];
		const { service, model } = runHarness({ turns, env: { AI_RUN_TOKEN_BUDGET: "2500" }, shop: { siteRead: bigPage } as never });

		// Act
		const run = await service.start(ctx, { prompt: "add a block to the home page", context: { module: "editor" } } as never, () => undefined);

		// Assert: three steps (3 060 tokens), not six (6 120), and the run says why it stopped
		expect(model.doGenerateCalls).toHaveLength(3);
		expect(run.status).toBe("failed");
		expect(run.error).toBe(budgetLine("tokens", false, "en"));
	});
});

describe("a read that ends after its call timed out [TC-AICP-363]", () => {
	it("leaves the fallback call's memory alone: the fallback's own read comes back whole", async () => {
		// Arrange: call 1 (model A) times out at 150 ms while its page read takes 300 ms; model B reads the same page
		// at ~400 ms, after A's late read has landed
		const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
		const readCall = (id: string) => ({ content: [{ type: "tool-call" as const, toolCallId: id, toolName: "site_read", input: JSON.stringify(READ) }], finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [] });
		const reply = { content: [{ type: "text" as const, text: "Done." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
		const a = new MockLanguageModelV4({ doGenerate: async () => readCall("a1") });
		let bCalls = 0;
		const b = new MockLanguageModelV4({
			doGenerate: async () => {
				bCalls += 1;
				if (bCalls > 1) return reply;
				await new Promise((r) => setTimeout(r, 250));
				return readCall("b1");
			},
		});
		let reads = 0;
		const siteRead = vi.fn(async (c: unknown, input: { view: string }) => {
			reads += 1;
			if (reads === 1) await new Promise((r) => setTimeout(r, 300));
			return bigPage(c, input);
		});
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", AI_AGENT_CAPABILITIES: STAGING_FULL });
		let timeouts = 0;
		const settings = { runtimeEnv: () => env, tierTimeoutMs: () => (timeouts++ === 0 ? 150 : 5_000), imageTimeoutMs: () => 0 } as unknown as SettingsService;
		const models: ModelRegistry = { resolveChain: () => [{ model: a, provider: "openai", modelId: "a" }, { model: b, provider: "openai", modelId: "b" }] };
		const store = new InMemoryAgentStore();
		const service = new AgentRunService(store, models, { record: async () => undefined, countSince: async () => 0 }, env, new AgentThreadService(store, env), undefined, { siteRead } as unknown as ShopTools, undefined, undefined, undefined, undefined, settings);

		// Act
		const run = await service.start(ctx, { prompt: "add a block to the home page", context: { module: "editor" } } as never, () => undefined);

		// Assert: B's model got its read in full, not "(unchanged: …)" pointing at A's read it never had
		expect(run.status).toBe("applied");
		expect(siteRead).toHaveBeenCalledTimes(2);
		const sentToB = JSON.stringify(b.doGenerateCalls[1]?.prompt);
		expect(sentToB).not.toContain("(unchanged:");
		expect(sentToB).toContain("Kopi Kampung 23");
	});
});

describe("a picture deleted while the run waits for an answer [TC-AICP-364]", () => {
	const picture = { id: "att_pic", kind: "image" as const, origin: "upload" as const, ref: null, name: "home.jpg", mime: "image/jpeg", size: 3, textContent: null, credit: null, content: Buffer.from([1, 2, 3]) };

	for (const provider of ["anthropic", "google", "openai"] as const) {
		it(`${provider} — the answer goes on without the picture, and says so`, async () => {
			// Arrange: a run with an attached picture asks a question; the picture is deleted before the answer
			const { result: paused, seen, service, store, refused } = await runCopilot([provider], ["read", "ask-valid", "read", "silent", "reply"], {
				flows: true,
				attachmentIds: ["att_pic"],
				before: async (s) => void (await s.insertAttachment(ctx, picture)),
			});
			expect(paused.status).toBe("awaiting_input");
			(store as unknown as { attachments: Map<string, unknown> }).attachments.delete("att_pic");

			// Act
			const done = await service.answer(ctx, paused.id, { toolCallId: paused.ask?.toolCallId as string, questionId: paused.ask?.question.id as string, values: ["a"] }, () => undefined);

			// Assert: accepted by the provider, answered, and the model was told the picture is gone
			expect(refused()).toEqual([]);
			expect(done.status).toBe("applied");
			expect(JSON.stringify(lastCopilot(seen)?.body)).toContain("image no longer available");
		});
	}
});

describe("a hung tool and the call's limit [TC-AICP-365]", () => {
	const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
	const readCall = { content: [{ type: "tool-call" as const, toolCallId: "r1", toolName: "site_read", input: JSON.stringify(READ) }], finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [] };
	const reply = { content: [{ type: "text" as const, text: "Done." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] };
	/** reads once, then answers */
	const reader = () => {
		let n = 0;
		return new MockLanguageModelV4({ doGenerate: async () => (n++ === 0 ? readCall : reply) });
	};
	/** the shop hangs for `hangMs` on the first read only */
	const hungShop = (hangMs: number) => {
		let reads = 0;
		return vi.fn(async (c: unknown, input: { view: string }) => {
			reads += 1;
			if (reads === 1) await new Promise((r) => setTimeout(r, hangMs));
			return bigPage(c, input);
		});
	};
	function setup(chain: MockLanguageModelV4[], siteRead: ReturnType<typeof hungShop>, callMs = 150) {
		const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", AI_AGENT_CAPABILITIES: STAGING_FULL });
		const settings = { runtimeEnv: () => env, tierTimeoutMs: () => callMs, imageTimeoutMs: () => 0 } as unknown as SettingsService;
		const models: ModelRegistry = { resolveChain: () => chain.map((model, i) => ({ model, provider: "openai", modelId: `m${i}` })) };
		const store = new InMemoryAgentStore();
		const service = new AgentRunService(store, models, { record: async () => undefined, countSince: async () => 0 }, env, new AgentThreadService(store, env), undefined, { siteRead } as unknown as ShopTools, undefined, undefined, undefined, undefined, settings);
		return { service };
	}
	const start = (service: AgentRunService, frames: unknown[] = []) =>
		service.start(ctx, { prompt: "add a block to the home page", context: { module: "editor" } } as never, (f) => frames.push(f));

	it("a read that hangs 3 s ends a 150 ms call at its limit, with the timeout line", async () => {
		// Arrange
		const { service } = setup([reader()], hungShop(3_000));
		const t0 = Date.now();

		// Act
		const run = await start(service);

		// Assert: about the call's limit, not the read's 3 s
		expect(Date.now() - t0).toBeLessThan(1_000);
		expect(run.status).toBe("failed");
		expect(run.error).toBe("The AI took too long to answer. Please try again.");
	});

	it("with a fallback model: it answers from its own read, and the late read changes nothing", async () => {
		// Arrange: model A's read hangs 600 ms, its call ends at 150 ms; model B reads at once
		const b = reader();
		const { service } = setup([reader(), b], hungShop(600), 150);
		const frames: Array<{ type: string }> = [];
		const t0 = Date.now();

		// Act
		const run = await start(service, frames);
		const elapsed = Date.now() - t0;
		const framesAtEnd = frames.length;
		await new Promise((r) => setTimeout(r, 700)); // A's read lands now

		// Assert
		expect(elapsed).toBeLessThan(600);
		expect(run.status).toBe("applied");
		expect(JSON.stringify(b.doGenerateCalls[1]?.prompt)).toContain("Kopi Kampung 23");
		expect(frames).toHaveLength(framesAtEnd);
	});

	it("Stop while a read hangs ends the run at once", async () => {
		// Arrange: a long call limit (5 s), the read hangs 3 s
		const { service } = setup([reader()], hungShop(3_000), 5_000);
		const frames: Array<{ type: string; run?: { id: string } }> = [];
		const t0 = Date.now();

		// Act: Stop 100 ms in
		const running = start(service, frames);
		await new Promise((r) => setTimeout(r, 100));
		const runId = frames.find((f) => f.type === "run.started")?.run?.id as string;
		await service.cancel(ctx, runId);
		const run = await running;

		// Assert
		expect(Date.now() - t0).toBeLessThan(1_000);
		expect(run.status).toBe("cancelled");
	});
});
