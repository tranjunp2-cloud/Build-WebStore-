import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../../auth/context-token";
import { parseEnv } from "../../config/env";
import { DecisionService } from "../../decide/decision.service";
import type { Decider } from "../../decide/decision-types";
import type { UsageLedger } from "../../ledger/usage-ledger";
import type { ShopTools } from "../../shop/shop-tools";
import { InMemoryAgentStore } from "../../testing/in-memory-agent-store";
import { flowLanguage } from "./flow-copy";
import { QuestionFlowService } from "./question-flow";

// TC-AICP-131 — tester feedback (Malay chat): the platform's own question cards speak the
// merchant's language, and a product's photo question offers the pictures this chat found
// (Pixabay, generated) — never the shop's newest library photos of other products.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", token: "t", locale: "en" } as AiRequestContext;

function flows(library: Array<{ ref: string; name: string; url: string }>) {
	const searched: Array<{ source: string; query: string }> = [];
	const shop = {
		listFamilies: async () => ({ total: 1, items: [{ id: "fam_tops", code: "tops", name: "Tops & Shirts", path: "Tops & Shirts" }] }),
		familySchema: async (_c: unknown, id: string) => ({ family: { id, code: "tops", name: "Tops & Shirts", path: "Tops & Shirts" }, fields: [] }),
		searchMedia: async (_c: unknown, input: { source: string; query: string }) => {
			searched.push(input);
			// the library has nothing named like the product, only other products' newest photos
			return input.source === "media" && input.query === "" ? library : [];
		},
	} as unknown as ShopTools;
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const backend: Decider = {
		provider: "typesafe",
		model: "m",
		isAvailable: () => true,
		decide: async (request) => ({
			answers: new Map(request.questions.map((q) => [q.key, { choice: q.candidates[0]?.code ?? null, confidence: 0.99, probabilities: {} }])),
			usage: { inputTokens: 1, outputTokens: 0 },
			latencyMs: 1,
		}),
	};
	const store = new InMemoryAgentStore();
	return { service: new QuestionFlowService(shop, new DecisionService(store, ledger, env, backend), store), searched };
}

const product = (language: "en" | "ms" | "vi" | null) => ({
	purpose: "product_details" as const,
	product: { name: "Kemeja-T Kasual Ringkas", facts: [], variants: "unknown" as const, variantAxes: [] },
	questions: [],
	language,
});

describe("question cards and product photos [TC-AICP-131]", () => {
	it("a Malay message gets Malay cards even when the dashboard is in English", async () => {
		const { service } = flows([]);
		const { outcome } = await service.start(ctx, "run_1", "call_1", product("ms"), false);

		expect(outcome.status).toBe("ask")
		const ask = outcome.status === "ask" ? outcome.ask : null
		expect(["Adakah produk ini mempunyai varian?", "Tambah foto produk?"]).toContain(ask?.question.title)
		expect(JSON.stringify(ask)).not.toMatch(/Does it come in variants|Add product photos|Colours and sizes/)
	});

	it("no language from the model → the UI locale, else English", () => {
		expect(flowLanguage("ms", "en")).toBe("ms");
		expect(flowLanguage(null, "vi-VN")).toBe("vi");
		expect(flowLanguage(null, "fr")).toBe("en");
	});

	it("the product photo question offers the chat's Pixabay finds first and never other products' newest library photos", async () => {
		const { service } = flows([{ ref: "asset:coffee", name: "Robusta coffee beans", url: "/m/coffee.jpg" }]);
		const chat = [{ id: "img_1", ref: "pixabay:42", url: "https://cdn.pixabay.com/tshirt.jpg", origin: "stock" as const, alt: "plain t-shirt", credit: "Pixabay · Ann" }];
		let { state, outcome } = await service.start(ctx, "run_1", "call_1", { ...product("en"), product: { ...product("en").product, variants: "none" as const } }, false, 1, chat);
		// answer the questions before the photos (family) until the photo card shows
		for (let i = 0; i < 4 && outcome.status === "ask" && outcome.ask.question.kind !== "images"; i += 1) {
			outcome = await service.answer(ctx, "run_1", state, { toolCallId: "call_1", questionId: outcome.ask.question.id, skip: true });
		}

		expect(outcome.status).toBe("ask");
		const photos = outcome.status === "ask" ? outcome.ask.question : null;
		expect(photos?.kind).toBe("images");
		expect(photos?.options.map((o) => o.value)).toEqual(["pixabay:42"]);
		expect(JSON.stringify(photos)).not.toContain("asset:coffee");
		void state;
	});
});
