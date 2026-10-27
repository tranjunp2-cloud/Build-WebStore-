import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry, ResolvedModel } from "../models/model-registry";
import { TaskEngine, withJsonCue } from "./task-engine.service";

// TC-AIMV-08: engine answer modes (text / json / schema), per-request sampling and the JSON cue.
const ctx: AiRequestContext = { organizationId: "org_1", userId: "user_1" };
const usage = {
	inputTokens: { total: 50, noCache: 50, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

type CallOptions = { temperature?: number; maxOutputTokens?: number; prompt: unknown; responseFormat?: unknown };

/** A model that answers with `text` and records every call it receives. */
function answeringModel(text: string) {
	const calls: CallOptions[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			calls.push(options as unknown as CallOptions);
			return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
		},
	});
	return { model, calls };
}

function setup(chain: ResolvedModel[]) {
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = {
		record: async (event) => void recorded.push(event),
		countSince: async () => recorded.filter((e) => e.outcome !== "error").length,
	};
	const models: ModelRegistry = { resolveChain: () => chain };
	const engine = new TaskEngine(
		models,
		ledger,
		parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" }),
	);
	return { engine, recorded };
}

const composed = { system: "Translate the terms.", user: "Kopi, Teh tarik" };

describe("text output mode [TC-AIMV-08]", () => {
	it("returns the model's answer as { text } and sends no structured-output schema", async () => {
		const { model, calls } = answeringModel("Coffee, Tea");
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-nano", model }]);

		const result = await engine.run(ctx, "i18n.translate-image-terms", composed);

		expect(result.output).toEqual({ text: "Coffee, Tea" });
		expect(calls[0]!.responseFormat).toBeUndefined();
	});

	it("treats an empty answer as a failed generation, so the call fails with 503", async () => {
		const { model } = answeringModel("   ");
		const { engine, recorded } = setup([{ provider: "openai", modelId: "gpt-4.1-nano", model }]);

		await expect(engine.run(ctx, "i18n.translate-user-input", composed)).rejects.toMatchObject({ status: 503 });
		expect(recorded).toEqual([expect.objectContaining({ task: "i18n.translate-user-input", outcome: "error" })]);
	});

	it("moves on to the next provider when the first answer is empty", async () => {
		const first = answeringModel("");
		const second = answeringModel("Kopi");
		const { engine } = setup([
			{ provider: "openai", modelId: "gpt-4.1-nano", model: first.model },
			{ provider: "anthropic", modelId: "claude-haiku-4-5", model: second.model },
		]);

		const result = await engine.run(ctx, "i18n.translate-image-terms", composed);

		expect(result.output).toEqual({ text: "Kopi" });
		expect(result.usage.provider).toBe("anthropic");
	});
});

describe("per-request sampling [TC-AIMV-08]", () => {
	it("uses the caller's temperature and token cap for a composed step", async () => {
		const { model, calls } = answeringModel('{"ok":true}');
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-mini", model }]);

		await engine.run(ctx, "sitegen.personalize", { ...composed, temperature: 0.2, maxOutputTokens: 500 });

		expect(calls[0]!.temperature).toBe(0.2);
		expect(calls[0]!.maxOutputTokens).toBe(500);
	});
});

describe("JSON answers [TC-AIMV-08]", () => {
	it("applies the JSON cue to json-mode tasks", async () => {
		const { model, calls } = answeringModel('{"ok":true}');
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-mini", model }]);

		const result = await engine.run(ctx, "sitegen.personalize", composed);

		expect(result.output).toEqual({ ok: true });
		expect(JSON.stringify(calls[0]!.prompt)).toContain("Respond with a JSON object only.");
	});

	it("answers a non-object JSON value as a failed generation", async () => {
		const { model } = answeringModel("[1, 2, 3]");
		const { engine } = setup([{ provider: "openai", modelId: "gpt-4.1-mini", model }]);

		await expect(engine.run(ctx, "sitegen.personalize", composed)).rejects.toMatchObject({ status: 503 });
	});

	it("fails over to the next provider on a provider outage", async () => {
		const down = new MockLanguageModelV4({
			doGenerate: async () => {
				throw new APICallError({ message: "down", url: "https://x", requestBodyValues: {}, statusCode: 503 });
			},
		});
		const ok = answeringModel('{"ok":true}');
		const { engine } = setup([
			{ provider: "openai", modelId: "gpt-5.4-mini", model: down },
			{ provider: "anthropic", modelId: "claude-haiku-4-5", model: ok.model },
		]);

		const result = await engine.run(ctx, "sitegen.site-plan", composed);

		expect(result.output).toEqual({ ok: true });
	});
});

describe("withJsonCue [TC-AIMV-08]", () => {
	it("appends the cue to a string prompt", () => {
		expect(withJsonCue("Plan the site")).toBe("Plan the site\n\nRespond with a JSON object only.");
	});

	it("appends the cue to the last user turn of a message list", () => {
		const messages = withJsonCue([
			{ role: "system", content: "Rules" },
			{ role: "user", content: "Plan" },
		]) as Array<{ role: string; content: string }>;

		expect(messages).toHaveLength(2);
		expect(messages[1]!.content).toBe("Plan\n\nRespond with a JSON object only.");
	});

	it("adds a user turn with the cue when the list ends on the assistant", () => {
		const messages = withJsonCue([{ role: "assistant", content: "Earlier answer" }]) as Array<{ role: string; content: string }>;

		expect(messages.at(-1)).toEqual({ role: "user", content: "Respond with a JSON object only." });
	});
});
