import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../../auth/context-token";
import { parseEnv } from "../../config/env";
import type { UsageLedger } from "../../ledger/usage-ledger";
import { TaskEngine } from "../task-engine.service";

const ctx: AiRequestContext = { organizationId: "org_1", userId: "user_1" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 40, text: 40, reasoning: undefined },
};

/** Captures what the engine sends the model and answers with `json`. */
function capturingEngine(json: unknown) {
	const calls: { schema: unknown; prompt: unknown; temperature?: number; maxOutputTokens?: number }[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: async (options) => {
			calls.push({
				schema: options.responseFormat?.type === "json" ? options.responseFormat.schema : undefined,
				prompt: options.prompt,
				temperature: options.temperature,
				maxOutputTokens: options.maxOutputTokens,
			});
			return { content: [{ type: "text", text: JSON.stringify(json) }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
		},
	});
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const engine = new TaskEngine(
		{ resolveChain: () => [{ provider: "openai", modelId: "gpt-4.1-nano", model }] },
		ledger,
		parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" }),
	);
	return { engine, calls };
}

describe("i18n tasks [TC-AICP-23, TC-AICP-25]", () => {
	it("i18n.translate-blocks pins a strict schema to the field paths and keeps legacy sampling", async () => {
		const fields = { headline: "Welcome", "faq.items.0.question": "What is it?" };
		const { engine, calls } = capturingEngine({ fields: { headline: "Selamat Datang", "faq.items.0.question": "Apa itu?" } });

		const result = await engine.run(ctx, "i18n.translate-blocks", { targetLocale: "ms", fields });

		expect(result.output).toEqual({ fields: { headline: "Selamat Datang", "faq.items.0.question": "Apa itu?" } });
		expect(result.promptVersion).toBe("i18n-translate-blocks@2");
		const schemaFields = (calls[0]!.schema as { properties: { fields: Record<string, unknown> } }).properties.fields;
		expect(schemaFields).toMatchObject({
			properties: { headline: { type: "string" }, "faq.items.0.question": { type: "string" } },
			required: ["headline", "faq.items.0.question"],
		});
		expect(schemaFields).not.toHaveProperty("propertyNames");
		expect(calls[0]).toMatchObject({ temperature: 0.3, maxOutputTokens: 4096 });
		expect(JSON.stringify(calls[0]!.prompt)).toContain("Bahasa Malaysia (Malaysian Malay)");
	});

	it("i18n.translate-product-field names both languages and keeps html rules", async () => {
		const { engine, calls } = capturingEngine({ text: "<p>Teh hijau</p>" });

		const result = await engine.run(ctx, "i18n.translate-product-field", {
			text: "<p>Trà xanh</p>",
			format: "html",
			sourceLocale: "vi-VN",
			targetLocale: "ms-MY",
		});

		expect(result.output).toEqual({ text: "<p>Teh hijau</p>" });
		expect(result.promptVersion).toBe("i18n-translate-product-field@1");
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain("from Vietnamese");
		expect(prompt).toContain("keep every tag and attribute exactly");
		expect(calls[0]!.schema).toMatchObject({ properties: { text: { type: "string" } }, required: ["text"] });
		expect(calls[0]).toMatchObject({ temperature: 0.2, maxOutputTokens: 4096 });
	});

	it("i18n.translate-blocks keeps brand and product names and asks for one glossary [TC-AIWB-77]", async () => {
		const { engine, calls } = capturingEngine({ fields: { headline: "Kedai Batik Aisyah" } });
		await engine.run(ctx, "i18n.translate-blocks", { targetLocale: "ms", fields: { headline: "Aisyah Batik Shop" } });
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain("Keep brand names, product names, model numbers");
		expect(prompt).toContain("glossary consistency");
	});

	it("rejects block translation without fields", async () => {
		const { engine } = capturingEngine({ fields: {} });
		await expect(engine.run(ctx, "i18n.translate-blocks", { targetLocale: "ms", fields: {} })).rejects.toMatchObject({ status: 400 });
	});
});
