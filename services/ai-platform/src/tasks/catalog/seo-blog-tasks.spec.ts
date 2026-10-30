import { AI_TASKS, SEO_META_BATCH_MAX_ITEMS } from "@ech/ai-contracts";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../../auth/context-token";
import { parseEnv } from "../../config/env";
import type { UsageLedger } from "../../ledger/usage-ledger";
import { TaskEngine } from "../task-engine.service";
import { TASK_DEFINITIONS } from "./index";

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

/** Strict structured output: every property is required and no extra keys are allowed. */
function expectStrictObject(schema: unknown, keys: string[]) {
	expect(schema).toMatchObject({ type: "object", additionalProperties: false });
	expect([...(schema as { required: string[] }).required].sort()).toEqual([...keys].sort());
}

describe("seo/blog tasks [TC-AICP-20]", () => {
	it("seo.page-meta keeps the legacy prompt, sampling and a strict title/description/slug schema", async () => {
		const { engine, calls } = capturingEngine({ title: "Kemeja batik", description: "Beli sekarang", slug: "kemeja-batik" });

		const result = await engine.run(ctx, "seo.page-meta", { name: "Kemeja batik", language: "ms", keywords: ["batik murah"] });

		expect(result.output).toEqual({ title: "Kemeja batik", description: "Beli sekarang", slug: "kemeja-batik" });
		expect(result.promptVersion).toBe("seo-page-meta@1");
		expect(calls[0]).toMatchObject({ temperature: 0.6, maxOutputTokens: 400 });
		expectStrictObject(calls[0]!.schema, ["title", "description", "slug"]);
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain("Bahasa Melayu (Malay)");
		expect(prompt).toContain("Target Keywords: batik murah");
	});

	it("seo.generate-meta uses the product rules and the site name", async () => {
		const { engine, calls } = capturingEngine({ metaTitle: "Shoes | ShoeStore", metaDescription: "Buy now" });

		const result = await engine.run(ctx, "seo.generate-meta", { type: "product", itemName: "Running Shoes", siteName: "ShoeStore" });

		expect(result.promptVersion).toBe("seo-generate-meta@1");
		expect(calls[0]).toMatchObject({ temperature: 0.7, maxOutputTokens: 300 });
		expectStrictObject(calls[0]!.schema, ["metaTitle", "metaDescription"]);
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain('sold by \\"ShoeStore\\"');
		expect(prompt).toContain("Buy Online Malaysia");
		expect(prompt).not.toContain("Target Keywords");
	});

	it("[TC-F37-04-41] seo.generate-meta-batch lists every item with its id and answers a strict items array", async () => {
		const answer = {
			items: [
				{ id: "products:7", metaTitle: "Shoes | ShoeStore", metaDescription: "Buy now" },
				{ id: "pages:3", metaTitle: "About | ShoeStore", metaDescription: "Who we are" },
			],
		};
		const { engine, calls } = capturingEngine(answer);

		const result = await engine.run(ctx, "seo.generate-meta-batch", {
			siteName: "ShoeStore",
			keywords: ["running shoes"],
			items: [
				{ id: "products:7", type: "product", itemName: "Running Shoes", context: "Light and fast" },
				{ id: "pages:3", type: "page", itemName: "About" },
			],
		});

		expect(result.output).toEqual(answer);
		expect(result.promptVersion).toBe("seo-generate-meta-batch@1");
		expect(calls[0]).toMatchObject({ temperature: 0.7, maxOutputTokens: 3_000 });
		expect(calls[0]!.schema).toMatchObject({ type: "object", additionalProperties: false, required: ["items"] });
		const itemSchema = (calls[0]!.schema as { properties: { items: { items: unknown } } }).properties.items.items;
		expectStrictObject(itemSchema, ["id", "metaTitle", "metaDescription"]);
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain('id: \\"products:7\\"');
		expect(prompt).toContain('id: \\"pages:3\\"');
		expect(prompt).toContain("Running Shoes");
		expect(prompt).toContain("Light and fast");
		expect(prompt).toContain("No content provided.");
		expect(prompt).toContain("Buy Online Malaysia");
		expect(prompt).toContain("Target Keywords: running shoes");
	});

	it("[TC-F37-04-42] seo.generate-meta-batch takes 1..20 items and sizes its budget for a 20-item answer", () => {
		const item = (n: number) => ({ id: `pages:${n}`, type: "page" as const, itemName: `Page ${n}` });
		const parse = (count: number) =>
			AI_TASKS["seo.generate-meta-batch"].input.safeParse({ siteName: "Kedai", items: Array.from({ length: count }, (_, i) => item(i)) }).success;
		const definition = TASK_DEFINITIONS["seo.generate-meta-batch"];

		expect(parse(0)).toBe(false);
		expect(parse(1)).toBe(true);
		expect(parse(SEO_META_BATCH_MAX_ITEMS)).toBe(true);
		expect(parse(SEO_META_BATCH_MAX_ITEMS + 1)).toBe(false);
		expect(definition).toMatchObject({ alias: "fast", maxRetries: 0, deadlineMs: 30_000, timeoutMs: 30_000 });
		expect(definition.maxOutputTokens!).toBeGreaterThanOrEqual(SEO_META_BATCH_MAX_ITEMS * 100);
	});

	it("seo.fix-meta sends the page content as the prompt with low temperature", async () => {
		const { engine, calls } = capturingEngine({ metaTitle: "Home | Kedai", metaDescription: "Welcome" });

		await engine.run(ctx, "seo.fix-meta", { siteName: "Kedai Runcit", pageContent: "Heading: Welcome" });

		expect(calls[0]).toMatchObject({ temperature: 0.3, maxOutputTokens: 200 });
		expectStrictObject(calls[0]!.schema, ["metaTitle", "metaDescription"]);
		expect(JSON.stringify(calls[0]!.prompt)).toContain('The business is called \\"Kedai Runcit\\"');
	});

	it("seo.blog-meta writes in the post's own language and passes the post as the prompt", async () => {
		const { engine, calls } = capturingEngine({ metaTitle: "Bảo quản vải batik", metaDescription: "Mẹo giặt, phơi và cất" });

		const result = await engine.run(ctx, "seo.blog-meta", { title: "Cách bảo quản vải batik", content: "Giặt tay bằng nước lạnh." });

		expect(result.promptVersion).toBe("seo-blog-meta@1");
		expectStrictObject(calls[0]!.schema, ["metaTitle", "metaDescription"]);
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain("SAME language as the post");
		expect(prompt).toContain("Cách bảo quản vải batik");
		expect(prompt).toContain("Fallback language: en");
	});

	it("copy.blog-post defaults the tone and keeps the long-form budget", async () => {
		const post = { title: "T", content: "<p>Body</p>", seoTitle: "S", seoDescription: "D" };
		const { engine, calls } = capturingEngine(post);

		const result = await engine.run(ctx, "copy.blog-post", { prompt: "Kopi Malaysia" });

		expect(result.output).toEqual(post);
		expect(result.promptVersion).toBe("copy-blog-post@1");
		expect(calls[0]).toMatchObject({ temperature: 0.7, maxOutputTokens: 3000 });
		expectStrictObject(calls[0]!.schema, ["title", "content", "seoTitle", "seoDescription"]);
		const prompt = JSON.stringify(calls[0]!.prompt);
		expect(prompt).toContain("The tone of voice MUST be: Professional.");
		expect(prompt).toContain("Please write a blog post about: Kopi Malaysia");
	});
});
