import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageLedger } from "../ledger/usage-ledger";
import { createModelRegistry } from "../models/model-registry";
import { TaskEngine } from "./task-engine.service";

// TC-AIEFF-14 — the engine must not put its own effort on the call: a provider-level `effort` makes the
// SDK ignore the tier's `reasoning`, so Haiku 5.5 thought inside a 300-token SEO answer and ran out.
const ctx: AiRequestContext = { organizationId: "org_1", userId: "user_1" };
const vars = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	ANTHROPIC_API_KEY: "test-key",
	AI_MODEL_FAST: "anthropic:claude-haiku-5-5",
	AI_MODEL_BALANCED: "anthropic:claude-haiku-5-5",
};

type Body = {
	max_tokens?: number;
	max_completion_tokens?: number;
	thinking?: { type?: string };
	output_config?: { effort?: string };
	reasoning_effort?: string;
	messages?: Array<{ role: string; content: unknown }>;
	system?: unknown;
};

/** Runs `taskId` through the real registry and engine; returns the body sent to Anthropic (the fake server answers 500). */
async function anthropicBodyFor(taskId: string, input: unknown, extraEnv: Record<string, string> = {}): Promise<Body> {
	const bodies: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init?: { body?: string }) => {
			bodies.push(String(init?.body ?? "{}"));
			return new Response("{}", { status: 500 });
		}),
	);
	const env = parseEnv({ ...vars, ...extraEnv });
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const engine = new TaskEngine(createModelRegistry(env, { ...vars, ...extraEnv }), ledger, env);
	await engine.run(ctx, taskId, input).catch(() => undefined);
	return JSON.parse(bodies[0] ?? "{}") as Body;
}

afterEach(() => vi.unstubAllGlobals());

describe("task calls carry the tier's effort only [TC-AIEFF-14]", () => {
	it("a fast task on Claude Haiku 5.5 is sent with thinking disabled and no effort", async () => {
		// Act
		const body = await anthropicBodyFor("seo.generate-meta", { type: "product", itemName: "Red T-Shirt", siteName: "Siraga" });

		// Assert
		expect(body.max_tokens).toBe(300);
		expect(body.thinking).toEqual({ type: "disabled" });
		expect(body.output_config?.effort).toBeUndefined();
	});

	it("an explicit tier effort reaches the request unchanged", async () => {
		// Act
		const body = await anthropicBodyFor("copy.product-description", { name: "Batik Scarf", language: "en" }, { AI_EFFORT_FAST: "medium" });

		// Assert
		expect(body.output_config?.effort).toBe("medium");
		expect(body.thinking?.type).not.toBe("disabled");
	});

	it("SEO meta stays without thinking even when the fast tier sets an effort", async () => {
		// Act
		const body = await anthropicBodyFor("seo.generate-meta", { type: "page", itemName: "About us", siteName: "Siraga" }, { AI_EFFORT_FAST: "medium" });

		// Assert
		expect(body.max_tokens).toBe(300);
		expect(body.thinking).toEqual({ type: "disabled" });
		expect(body.output_config?.effort).toBeUndefined();
	});
});

// TC-AIWB-125 — bulk add: the long JSON product list runs without thinking on every tier, with room for ~20 products.
describe("catalog.bulk-parse-products runs without thinking [TC-AIWB-125]", () => {
	const bulk = { promptText: "batik scarf RM50, rattan basket RM30", locale: "en", categoryCandidates: [] };

	it("is sent with thinking disabled and 8000 output tokens, even when Studio / env sets a balanced effort", async () => {
		// Act
		const body = await anthropicBodyFor("catalog.bulk-parse-products", bulk, { AI_EFFORT_BALANCED: "high" });

		// Assert
		expect(body.max_tokens).toBe(8000);
		expect(body.thinking).toEqual({ type: "disabled" });
		expect(body.output_config?.effort).toBeUndefined();
	});

	it("changes only that call: the tier's effort still reaches every other call", async () => {
		// Arrange
		const bodies: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: { body?: string }) => {
				bodies.push(String(init?.body ?? "{}"));
				return new Response("{}", { status: 500 });
			}),
		);
		const extra = { AI_EFFORT_BALANCED: "high" };
		const registry = createModelRegistry(parseEnv({ ...vars, ...extra }), { ...vars, ...extra });

		// Act
		await generateText({ model: registry.resolveChain("balanced")[0]!.model, prompt: "hi", maxRetries: 0 }).catch(() => undefined);
		await generateText({ model: registry.resolveChain("balanced", { effort: "none" })[0]!.model, prompt: "hi", maxRetries: 0 }).catch(() => undefined);
		const [tier, task] = bodies.map((body) => JSON.parse(body) as Body);

		// Assert
		expect(tier!.output_config?.effort).toBe("high");
		expect(task!.thinking).toEqual({ type: "disabled" });
	});
});

// TC-AIWB-126 — the list splitter: fast tier, no thinking, the merchant's text as the prompt, unchanged.
describe("catalog.split-products [TC-AIWB-126]", () => {
	it("sends the merchant's text verbatim with thinking disabled and room for a 6000-character copy", async () => {
		// Arrange
		const text = "2 brown capybara keychains RM15, 1 red slippers size M RM5";

		// Act
		const body = await anthropicBodyFor("catalog.split-products", { promptText: text });

		// Assert
		expect(body.max_tokens).toBe(4000);
		expect(body.thinking).toEqual({ type: "disabled" });
		expect(JSON.stringify(body.messages)).toContain(text);
		expect(JSON.stringify(body.system)).toMatch(/exactly as the merchant wrote them/);
	});
});
