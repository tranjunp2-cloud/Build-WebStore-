import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { TaskEngine } from "../tasks/task-engine.service";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

// TC-AIWB-128 — a copilot run with propose_blog_posts: the real task engine writes every article at once, each
// call is counted with the run, and the cards land as one linked set.
const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my", role: "owner" };
const usage = {
	inputTokens: { total: 1000, noCache: 1000, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 200, text: 200, reasoning: undefined },
};
const finish = (unified: "stop" | "tool-calls") => ({ unified, raw: undefined });

const titles = ["Keep batik bright in the rain", "Drying silk the right way", "Storing scarves for the monsoon"];
const planned = {
	locale: "en",
	label: "Rainy season tips",
	posts: titles.map((title) => ({ title, outline: ["Why it matters", "What to do"], notes: "Shop: Kedai Batik, Kuching", coverImageId: null })),
};

/** The copilot: plans the set, then says what is waiting. */
function copilot() {
	let call = 0;
	return new MockLanguageModelV4({
		doGenerate: async () => {
			call += 1;
			if (call === 1) {
				return {
					content: [{ type: "tool-call", toolCallId: "call_1", toolName: "propose_blog_posts", input: JSON.stringify(planned) }],
					finishReason: finish("tool-calls"),
					usage,
					warnings: [],
				};
			}
			return { content: [{ type: "text", text: "3 posts are waiting — Approve all saves them as drafts." }], finishReason: finish("stop"), usage, warnings: [] };
		},
	});
}

/** The article writer (fast tier): answers each post; `failTitle` fails like a busy provider. */
function writer(failTitle?: string) {
	const prompts: string[] = [];
	let inFlight = 0;
	const seen = { peak: 0 };
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			const prompt = JSON.stringify(options.prompt);
			prompts.push(prompt);
			inFlight += 1;
			seen.peak = Math.max(seen.peak, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 10));
			inFlight -= 1;
			if (failTitle && prompt.includes(failTitle)) throw new Error("upstream 503");
			const title = titles.find((t) => prompt.includes(t)) ?? "post";
			const answer = {
				contentHtml: `<p>Intro to ${title}.</p><h2>Why it matters</h2><p>${"Rain and batik. ".repeat(15)}</p><h2>What to do</h2><p>Wash cold.</p>`,
				seoTitle: title.slice(0, 60),
				seoDescription: `How to look after batik and silk when it rains, from Kedai Batik.`,
			};
			return { content: [{ type: "text", text: JSON.stringify(answer) }], finishReason: finish("stop"), usage, warnings: [] };
		},
	});
	return { model, prompts, seen };
}

function setup(failTitle?: string) {
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const store = new InMemoryAgentStore();
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (event) => void recorded.push(event), countSince: async () => 0 };
	const write = writer(failTitle);
	const copilotModel = copilot();
	const models: ModelRegistry = {
		resolveChain: (alias) => [{ model: alias === "fast" ? write.model : copilotModel, provider: "openai", modelId: alias === "fast" ? "gpt-5.4-nano" : "gpt-5.4-mini" }],
	};
	const tasks = new TaskEngine(models, ledger, env);
	const threads = new AgentThreadService(store, env);
	const service = new AgentRunService(store, models, ledger, env, threads, undefined, undefined, undefined, undefined, undefined, undefined, undefined, tasks);
	return { service, store, recorded, write };
}

describe("propose_blog_posts in a copilot run [TC-AIWB-128]", () => {
	it("writes the 3 articles in parallel, counts each with the run and stages 3 linked drafts", async () => {
		// Arrange
		const { service, store, recorded, write } = setup();
		const frames: RunFrame[] = [];

		// Act
		const run = await service.start(ctx, { prompt: "Write 3 blog posts about caring for batik in the rainy season", context: { module: "blog" } }, (f) => frames.push(f));

		// Assert
		expect(run.status).toBe("awaiting_approval");
		expect(run.changeSetIds).toHaveLength(3);
		expect(write.prompts).toHaveLength(3);
		expect(write.seen.peak).toBe(3);
		const cards = await store.listChangeSets("org_1", { limit: 10 });
		expect(cards.map((c) => c.action?.kind)).toEqual(["blog.create_draft", "blog.create_draft", "blog.create_draft"]);
		expect(new Set(cards.map((c) => c.group?.id)).size).toBe(1);
		expect(cards.map((c) => c.group?.kind)).toEqual(["set", "set", "set"]);
		expect(cards.map((c) => (c.action?.payload as { title: string }).title).sort()).toEqual([...titles].sort());
		const writes = recorded.filter((e) => e.task === "copy.blog-post-draft");
		expect(writes).toHaveLength(3);
		expect(writes.every((e) => e.runId === run.id && e.outcome === "ok")).toBe(true);
		expect(frames).toContainEqual(expect.objectContaining({ type: "run.receipt", receipt: expect.objectContaining({ tool: "blog.write_posts", status: "ok" }) }));
	});

	it("stages the posts that were written when one article fails, and says so in the receipt", async () => {
		// Arrange
		const { service, store, recorded } = setup("Drying silk the right way");
		const frames: RunFrame[] = [];

		// Act
		const run = await service.start(ctx, { prompt: "Write 3 blog posts about the rainy season", context: { module: "blog" } }, (f) => frames.push(f));

		// Assert
		expect(run.changeSetIds).toHaveLength(2);
		const cards = await store.listChangeSets("org_1", { limit: 10 });
		expect(cards.map((c) => (c.action?.payload as { title: string }).title)).not.toContain("Drying silk the right way");
		expect(recorded.filter((e) => e.task === "copy.blog-post-draft" && e.outcome === "error")).toHaveLength(1);
		expect(frames).toContainEqual(
			expect.objectContaining({ type: "run.receipt", receipt: expect.objectContaining({ tool: "blog.write_posts", status: "error", summary: "Wrote 2 of 3 blog posts" }) }),
		);
	});
});
