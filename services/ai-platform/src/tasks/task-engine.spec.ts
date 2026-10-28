import { AI_TASK_IDS } from "@ech/ai-contracts";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { AgentError } from "../agent/agent-errors";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry, ResolvedModel } from "../models/model-registry";
import { TASK_DEFINITIONS } from "./catalog";
import { TaskEngine, withJsonCue } from "./task-engine.service";

const ctx: AiRequestContext = { organizationId: "org_1", userId: "user_1" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 40, text: 40, reasoning: undefined },
};

function jsonModel(json: unknown) {
	return new MockLanguageModelV4({
		doGenerate: async () => ({
			content: [{ type: "text", text: JSON.stringify(json) }],
			finishReason: { unified: "stop", raw: undefined },
			usage,
			warnings: [],
		}),
	});
}

function failingModel(statusCode: number) {
	return new MockLanguageModelV4({
		doGenerate: async () => {
			throw new APICallError({ message: "down", url: "https://x", requestBodyValues: {}, statusCode });
		},
	});
}

function setup(chain: ResolvedModel[], env: Record<string, string> = {}) {
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = {
		record: async (event) => void recorded.push(event),
		countSince: async () => recorded.filter((e) => e.outcome !== "error").length,
	};
	const models: ModelRegistry = { resolveChain: () => chain };
	const engine = new TaskEngine(
		models,
		ledger,
		parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters", ...env }),
	);
	return { engine, recorded };
}

describe("task catalog", () => {
	it("has a server definition with a versioned prompt for every contract task", () => {
		for (const id of AI_TASK_IDS) {
			expect(TASK_DEFINITIONS[id]?.id).toBe(id);
			expect(TASK_DEFINITIONS[id]?.promptVersion).toMatch(/@\d+$/);
		}
	});
});

describe("TaskEngine", () => {
	it("returns the contract-validated output with usage and a ledger row", async () => {
		const { engine, recorded } = setup([
			{ provider: "openai", modelId: "gpt-4.1-nano", model: jsonModel({ fields: { name: "Selendang batik" } }) },
		]);
		const result = await engine.run(ctx, "content.translate", { targetLocale: "ms-MY", fields: { name: "Batik scarf" } });
		expect(result.output).toEqual({ fields: { name: "Selendang batik" } });
		expect(result.promptVersion).toBe("translate@2");
		expect(result.usage).toMatchObject({ provider: "openai", model: "gpt-4.1-nano", inputTokens: 100, outputTokens: 40 });
		expect(result.usage.costUsdMicros).toBeGreaterThan(0);
		expect(recorded).toEqual([expect.objectContaining({ task: "content.translate", outcome: "ok", organizationId: "org_1" })]);
	});

	it("sends translate a strict schema pinned to the caller's keys", async () => {
		const schemas: unknown[] = [];
		const model = new MockLanguageModelV4({
			doGenerate: async (options) => {
				schemas.push(options.responseFormat?.type === "json" ? options.responseFormat.schema : undefined);
				return { content: [{ type: "text", text: '{"fields":{}}' }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
			},
		});
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-nano", model }]);
		await expect(engine.run(ctx, "content.translate", { targetLocale: "ms-MY", fields: { name: "Batik scarf" } })).rejects.toMatchObject({
			status: 503,
		});
		const fields = (schemas[0] as { properties: { fields: Record<string, unknown> } }).properties.fields;
		expect(fields).toMatchObject({ properties: { name: { type: "string" } }, required: ["name"] });
		expect(fields).not.toHaveProperty("propertyNames");
	});

	it("falls back to the next provider and ledgers the failed attempt", async () => {
		const { engine, recorded } = setup([
			{ provider: "openai", modelId: "gpt-4.1-mini", model: failingModel(503) },
			{ provider: "anthropic", modelId: "claude-haiku-4-5", model: jsonModel({ metaTitle: "Batik care", metaDescription: "How to wash and store batik so colours last." }) },
		]);
		const result = await engine.run(ctx, "content.seo-meta", { locale: "en-US", title: "Batik care" });
		expect(result.usage.provider).toBe("anthropic");
		expect(result.usage.fallbacks).toEqual([expect.objectContaining({ provider: "openai" })]);
		expect(recorded.map((e) => `${e.provider}:${e.outcome}`)).toEqual(["openai:error", "anthropic:ok"]);
	});

	it("rejects invalid input, unknown tasks and exhausted quota with typed errors", async () => {
		const { engine } = setup([{ provider: "openai", modelId: "m", model: jsonModel({}) }], { AI_DAILY_TASK_LIMIT_PER_ORG: "0" });
		await expect(engine.run(ctx, "content.translate", { fields: {} })).rejects.toMatchObject({ status: 400 });
		await expect(engine.run(ctx, "content.unknown", {})).rejects.toMatchObject({ status: 404 });
		await expect(
			engine.run(ctx, "content.seo-meta", { locale: "en-US", title: "x" }),
		).rejects.toBeInstanceOf(AgentError);
	});
});

describe("TaskEngine JSON output mode [TC-AICP-28]", () => {
	function textModel(texts: string[], seen: Array<{ responseFormat: unknown; prompt: unknown }> = []) {
		return new MockLanguageModelV4({
			doGenerate: async (options) => {
				seen.push({ responseFormat: options.responseFormat, prompt: options.prompt });
				return { content: [{ type: "text", text: texts.shift() ?? "" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
			},
		});
	}
	const bulkInput = {
		promptText: "áo thun trắng, đỏ giá 5rm",
		locale: "en",
		categoryCandidates: [{ id: 12, path: "Apparel > <T-Shirts>" }],
	} as const;

	it("asks for plain JSON (no schema), keeps the ported bulk-parse prompt and returns the validated output [TC-AICP-26]", async () => {
		const seen: Array<{ responseFormat: unknown; prompt: unknown }> = [];
		const products = [{ name: "T-Shirt", price: 5, categoryId: 12, variants: [{ name: "White", price: 5, stock: 0 }] }];
		const { engine, recorded } = setup([{ provider: "openai", modelId: "gpt-4.1-mini", model: textModel([JSON.stringify({ products })], seen) }]);

		const result = await engine.run(ctx, "catalog.bulk-parse-products", bulkInput);

		expect(result.output).toEqual({ products });
		expect(result.promptVersion).toBe("catalog-bulk-parse-products@1");
		expect(seen[0]?.responseFormat).toEqual({ type: "json" });
		const system = JSON.stringify(seen[0]?.prompt);
		expect(system).toContain("JSON");
		expect(system).toContain("MUST be written entirely in: ENGLISH");
		expect(system).toContain("\\\\u003cT-Shirts\\\\u003e");
		expect(recorded).toEqual([expect.objectContaining({ task: "catalog.bulk-parse-products", outcome: "ok" })]);
	});

	it("puts the JSON cue in the user input, not only the system instructions", async () => {
		const seen: Array<{ responseFormat: unknown; prompt: unknown }> = [];
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-mini", model: textModel([JSON.stringify({ products: [{ name: "T-Shirt" }] })], seen) }]);

		await engine.run(ctx, "catalog.bulk-parse-products", bulkInput);

		const messages = seen[0]?.prompt as Array<{ role: string; content: unknown }>;
		const lastUser = JSON.stringify(messages.filter((m) => m.role === "user").at(-1)?.content);
		expect(lastUser).toContain(bulkInput.promptText);
		expect(lastUser.toLowerCase()).toContain("json");
	});

	it("appends the JSON cue to the last user turn of a conversation prompt", () => {
		expect(withJsonCue([{ role: "assistant", content: "Hi" }, { role: "user", content: "Make it formal" }])).toEqual([
			{ role: "assistant", content: "Hi" },
			{ role: "user", content: "Make it formal\n\nRespond with a JSON object only." },
		]);
		expect(withJsonCue([{ role: "assistant", content: "Hi" }]).at(-1)).toEqual({ role: "user", content: "Respond with a JSON object only." });
	});

	it("treats unparseable or off-contract JSON as a failed generation and falls back", async () => {
		const good = { products: [{ name: "T-Shirt" }] };
		const { engine, recorded } = setup([
			{ provider: "openai", modelId: "gpt-4.1-mini", model: textModel(["not json"]) },
			{ provider: "openai", modelId: "gpt-5.4-mini", model: textModel([JSON.stringify({ products: [{ name: "  " }] })]) },
			{ provider: "anthropic", modelId: "claude-haiku-4-5", model: textModel([JSON.stringify(good)]) },
		]);

		const result = await engine.run(ctx, "catalog.bulk-parse-products", bulkInput);

		expect(result.output).toEqual(good);
		expect(result.usage.fallbacks.map((f) => f.error)).toEqual(["AI_NoObjectGeneratedError", "AI_NoObjectGeneratedError"]);
		expect(recorded.map((e) => e.outcome)).toEqual(["error", "error", "ok"]);
	});

	it("answers 503 when every provider returns off-contract JSON", async () => {
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-mini", model: textModel([JSON.stringify({ action: "explode" })]) }]);
		await expect(engine.run(ctx, "catalog.bulk-parse-products", { promptText: "batik scarf RM50" })).rejects.toMatchObject({ status: 503 });
	});
});

describe("TaskEngine deadline [TC-AICP-26]", () => {
	it("caps attempts to the task budget and answers 504 instead of starting a fallback that cannot finish", async () => {
		const definition = TASK_DEFINITIONS["seo.generate-meta"];
		const original = definition.deadlineMs;
		definition.deadlineMs = 2_100;
		const hanging = new MockLanguageModelV4({
			doGenerate: (options) =>
				new Promise((_, reject) => options.abortSignal?.addEventListener("abort", () => reject(options.abortSignal?.reason))),
		});
		let fallbackCalled = false;
		const backup = new MockLanguageModelV4({
			doGenerate: async () => {
				fallbackCalled = true;
				return { content: [{ type: "text", text: "{}" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
			},
		});
		try {
			const { engine, recorded } = setup([
				{ provider: "openai", modelId: "gpt-4.1-nano", model: hanging },
				{ provider: "anthropic", modelId: "claude-haiku-4-5", model: backup },
			]);
			const started = Date.now();

			await expect(
				engine.run(ctx, "seo.generate-meta", { type: "page", itemName: "About", siteName: "Kedai Batik" }),
			).rejects.toMatchObject({ status: 504 });

			expect(Date.now() - started).toBeLessThan(4_000);
			expect(fallbackCalled).toBe(false);
			expect(recorded.map((e) => `${e.provider}:${e.outcome}`)).toEqual(["openai:error"]);
		} finally {
			definition.deadlineMs = original;
		}
	});
});
