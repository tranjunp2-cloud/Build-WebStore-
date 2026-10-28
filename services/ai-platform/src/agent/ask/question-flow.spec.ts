import { ChangeSetSchema } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../../auth/context-token";
import { parseEnv } from "../../config/env";
import { DecisionService } from "../../decide/decision.service";
import type { Decider } from "../../decide/decision-types";
import type { UsageEvent, UsageLedger } from "../../ledger/usage-ledger";
import type { ModelRegistry } from "../../models/model-registry";
import type { ShopFamilySchema, ShopTools } from "../../shop/shop-tools";
import { InMemoryAgentStore } from "../../testing/in-memory-agent-store";
import { AgentRunService, type RunFrame } from "../agent-run.service";
import { AgentThreadService } from "../agent-thread.service";
import { QuestionFlowService } from "./question-flow";

// TC-AICP-42..44 — clarifying questions as an ask_user tool call, answered
// from the shop's catalog by the decision model when it is confident.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", token: "t" };
const usage = {
	inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 100, text: 100, reasoning: undefined },
};

type Turn = { tool: string; input: unknown } | { text: string };

function scripted(turns: Turn[]) {
	let call = 0;
	return new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			if ("tool" in turn) {
				return {
					content: [
						{ type: "text", text: "I read your notes: cotton, 2 colours." },
						{ type: "tool-call", toolCallId: `call_${call}`, toolName: turn.tool, input: JSON.stringify(turn.input) },
					],
					finishReason: { unified: "tool-calls", raw: undefined },
					usage,
					warnings: [],
				};
			}
			return { content: [{ type: "text", text: turn.text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
		},
	});
}

const SHIRTS: ShopFamilySchema = {
	family: { id: "fam_shirts", code: "shirts_blouses", name: "Shirts & Blouses", path: "Tops › Shirts & Blouses" },
	fields: [
		{
			attributeId: "attr_fit",
			code: "fit",
			label: "Fit",
			dataType: "enum",
			required: true,
			level: "required",
			collection: false,
			localizable: false,
			options: [
				{ code: "oversized", label: "Oversized" },
				{ code: "regular", label: "Regular" },
			],
			optionsTotal: 2,
		},
		{
			attributeId: "attr_material",
			code: "material",
			label: "Material",
			dataType: "enum",
			required: true,
			level: "required",
			collection: false,
			localizable: false,
			options: [
				{ code: "cotton_100", label: "100% cotton" },
				{ code: "linen", label: "Linen" },
			],
			optionsTotal: 2,
		},
		{
			attributeId: "attr_care",
			code: "care",
			label: "Care instructions",
			dataType: "text",
			required: false,
			level: "optional",
			collection: false,
			localizable: false,
			options: [],
			optionsTotal: 0,
		},
	],
};

const shop: ShopTools = {
	listFamilies: async () => ({
		total: 2,
		items: [
			{ id: "fam_shirts", code: "shirts_blouses", name: "Shirts & Blouses", path: "Tops › Shirts & Blouses" },
			{ id: "fam_dresses", code: "dresses", name: "Dresses", path: "Dresses" },
		],
	}),
	familySchema: async (_ctx, id) =>
		id === "fam_shirts" ? SHIRTS : { family: { id, code: "dresses", name: "Dresses", path: "Dresses" }, fields: [] },
	searchMedia: async (_ctx, input) =>
		input.source === "media"
			? [
					{ ref: "asset:a1", name: "Grey shirt flat lay", url: "/api/agent/media/assets/a1/preview" },
					{ ref: "asset:a2", name: "Ivory shirt on model", url: "/api/agent/media/assets/a2/preview" },
				]
			: [{ ref: "pixabay:9", name: "linen", url: "https://cdn.pixabay.com/9.jpg", credit: "Pixabay · Ann" }],
};

/** Decision backend double: confidence per question key. */
function decider(confidence: Record<string, number>): Decider & { calls: number } {
	const choice: Record<string, string> = { family: "fam_shirts", fit: "oversized", material: "cotton_100" };
	return {
		provider: "typesafe",
		model: "jev-latest",
		calls: 0,
		isAvailable: () => true,
		async decide(request) {
			this.calls += 1;
			const answers = new Map();
			for (const q of request.questions) {
				const c = confidence[q.key] ?? 0.4;
				const pick = choice[q.key] ?? q.candidates[0]?.code ?? null;
				answers.set(q.key, { choice: pick, confidence: c, probabilities: pick ? { [pick]: c } : {} });
			}
			return { answers, usage: { inputTokens: 300 * request.questions.length, outputTokens: 0 }, latencyMs: 5 };
		},
	};
}

const askCall: Turn = {
	tool: "ask_user",
	input: {
		purpose: "product_details",
		product: {
			name: "Oversized cotton shirt",
			facts: [{ name: "material", value: "100% cotton" }],
			variants: "listed",
			variantAxes: [
				{ axis: "color", label: "Colour", values: ["Grey", "Ivory"] },
				{ axis: "size", label: "Size", values: ["S", "M", "L", "XL"] },
			],
		},
		questions: [],
	},
};

const proposeCall: Turn = {
	tool: "propose_product_drafts",
	input: {
		locale: "en-US",
		products: [
			{
				name: "Oversized Cotton Shirt",
				description: "A relaxed shirt in breathable cotton.",
				familyCode: "shirts_blouses",
				price: { amount: 89, currency: "MYR" },
				attributes: [{ code: "care", value: "Machine wash cold" }],
				variants: {
					axes: [
						{ axis: "color", label: "Colour", values: ["Grey", "Ivory"] },
						{ axis: "size", label: "Size", values: ["S", "M", "L", "XL"] },
					],
				},
				imageIds: [],
			},
		],
	},
};

function setup(
	turns: Turn[],
	confidence: Record<string, number>,
	shared?: { store: InMemoryAgentStore; backend: ReturnType<typeof decider> },
) {
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
	});
	const store = shared?.store ?? new InMemoryAgentStore();
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (e) => void recorded.push(e), countSince: async () => 0 };
	const model = scripted(turns);
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const backend = shared?.backend ?? decider(confidence);
	const decisions = new DecisionService(store, ledger, env, backend);
	const flows = new QuestionFlowService(shop, decisions, store);
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), flows, shop);
	return { service, store, recorded, model, backend };
}

describe("ask_user tool call [TC-AICP-42]", () => {
	it("pauses on a family question built from the shop's catalog, then resumes the same run with the answers", async () => {
		const { service, store, model, recorded } = setup([askCall, proposeCall, { text: "Here is the draft." }], { family: 0.6 });
		const frames: RunFrame[] = [];
		const paused = await service.start(ctx, { prompt: "Create a product: oversized cotton shirt, grey and ivory, S–XL, RM 89" }, (f) =>
			frames.push(f),
		);

		expect(paused.status).toBe("awaiting_input");
		expect(paused.ask?.question).toMatchObject({ kind: "family", suggested: "fam_shirts", total: 2 });
		expect(paused.ask?.question.options.map((o) => o.value)).toEqual(["fam_shirts", "fam_dresses"]);
		expect(paused.ask?.question.options[0]?.meta).toBe("3 attributes · 2 required");
		expect(paused.answer).toBe("I read your notes: cotton, 2 colours.");
		expect(frames.map((f) => f.type)).toContain("run.ask");
		expect(model.doGenerateCalls).toHaveLength(1);

		// family answered → the family's required attribute comes next, no model call in between
		const second = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "family", values: ["fam_shirts"] }, () => {});
		expect(second.status).toBe("awaiting_input");
		expect(second.ask?.question).toMatchObject({ kind: "attribute", label: "Fit" });
		expect(second.answers?.[0]).toMatchObject({ label: "Family", display: "Tops › Shirts & Blouses", source: "you" });
		expect(model.doGenerateCalls).toHaveLength(1);

		// the third turn is kept for photos (none attached): the shop's own library, upload allowed, never stock
		const third = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "attr_fit", values: ["oversized"] }, () => {});
		expect(third.ask?.question).toMatchObject({ kind: "images", multiple: true, allowUpload: true });
		expect(third.ask?.question.options.map((o) => o.value)).toEqual(["asset:a1", "asset:a2"]);
		const done = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "images", values: ["asset:a1", "pixabay:not-offered"] }, () => {});

		expect(done.status).toBe("awaiting_approval");
		expect(model.doGenerateCalls).toHaveLength(3);
		// the model got the answers as the ask_user tool result
		const resumed = JSON.stringify(model.doGenerateCalls[1]?.prompt);
		expect(resumed).toContain('"toolName":"ask_user"');
		expect(resumed).toContain("shirts_blouses");

		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		expect(ChangeSetSchema.parse(changeSet)).toBeTruthy();
		const doc = changeSet?.drafts?.[0];
		expect(doc?.type).toBe("product");
		if (doc?.type !== "product") return;
		expect(doc.family?.label).toBe("Tops › Shirts & Blouses");
		expect(doc.fields.find((f) => f.key === "fit")).toMatchObject({ value: "Oversized", source: "you", group: "required" });
		expect(doc.fields.find((f) => f.key === "care")).toMatchObject({ source: "ai", group: "optional" });
		// material had no turn left and the decision model was unsure: left for the merchant
		expect(doc.fields.find((f) => f.key === "material")).toMatchObject({ source: "missing", group: "required" });
		// the picked library photo is the draft's main image; a value that was never offered is ignored
		expect(doc.images).toEqual([expect.objectContaining({ ref: "asset:a1", role: "main", origin: "media" })]);
		expect(doc.fields.find((f) => f.key === "price")).toMatchObject({ value: "RM 89.00", source: "you" });
		expect(doc.variants?.rows).toHaveLength(8);
		expect(changeSet?.action?.payload).toMatchObject({ version: 2 });

		// every System One call is metered
		expect(recorded.filter((e) => e.task.startsWith("agent.decide."))).not.toHaveLength(0);
	});

	it("rejects a stale or repeated answer [TC-AICP-43]", async () => {
		const { service } = setup([askCall, proposeCall, { text: "ok" }], { family: 0.6 });
		const paused = await service.start(ctx, { prompt: "Create a shirt" }, () => {});
		await expect(
			service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "attr_fit", values: ["oversized"] }, () => {}),
		).rejects.toThrow(/already answered/);
		await expect(
			service.answer({ ...ctx, userId: "someone_else" }, paused.id, { toolCallId: "call_1", questionId: "family", skip: true }, () => {}),
		).rejects.toThrow(/not found/i);
	});
});

describe("decision model answers what it is sure about [TC-AICP-44]", () => {
	it("auto-picks a confident family and attributes: no pause, one extra model call, choices visible as picked for you", async () => {
		const { service, model, backend } = setup([askCall, proposeCall, { text: "Here is the draft." }], {
			family: 0.95,
			fit: 0.93,
			material: 0.97,
		});
		const paused = await service.start(ctx, { prompt: "Create a product: oversized cotton shirt" }, () => {});
		// only the photo question is left for the merchant
		expect(paused.ask?.question.kind).toBe("images");
		const run = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "images", skip: true }, () => {});

		expect(run.status).toBe("awaiting_approval");
		expect(run.answers?.filter((a) => a.source !== "skipped").map((a) => [a.label, a.source])).toEqual([
			["Family", "auto"],
			["Fit", "auto"],
			["Material", "auto"],
		]);
		// ask_user cost nothing extra on the chat model: start + drafting only
		expect(model.doGenerateCalls).toHaveLength(3);
		expect(backend.calls).toBe(2);
		expect(run.receipts.find((r) => r.tool === "catalog.ask_user")?.summary).toContain("3 picked from your catalog");
	});

	it("answers the same question from cache the second time (no System One call)", async () => {
		const first = setup([askCall, proposeCall, { text: "ok" }], { family: 0.95, fit: 0.93, material: 0.97 });
		await first.service.start(ctx, { prompt: "shirt" }, () => {});
		const callsAfterFirst = first.backend.calls;
		// another process of the service, same database (L2 cache)
		const second = setup([askCall, proposeCall, { text: "ok" }], {}, { store: first.store, backend: first.backend });
		const again = await second.service.start(ctx, { prompt: "shirt" }, () => {});
		expect(again.answers?.map((a) => a.source)).toEqual(["auto", "auto", "auto"]);
		expect(first.backend.calls).toBe(callsAfterFirst);
	});
});

describe("photos are picked or uploaded in the card, never described in words [TC-AICP-51]", () => {
	it("offers stock + library photos for a blog, takes the merchant's own upload, and drafts with the picks", async () => {
		const ask: Turn = {
			tool: "ask_user",
			input: {
				purpose: "custom",
				product: null,
				questions: [
					{ id: "photos", title: "Which photos should the post use?", why: null, options: [], multiple: true, pictures: { query: "linen care", source: "both" } },
				],
			},
		};
		const blog: Turn = {
			tool: "propose_blog_post",
			input: {
				locale: "en",
				title: "How to care for linen",
				contentHtml: `<p>${"Linen loves cold water. ".repeat(12)}</p><h2>Wash</h2><p>${"Cold wash, inside out. ".repeat(6)}</p>`,
				seoTitle: "Linen care guide",
				seoDescription: "How to wash, dry and store linen so it lasts for years.",
				coverImageId: "img_1",
				images: [{ imageId: "att_mine", caption: "Our linen shirt", afterSection: 1 }],
			},
		};
		const { service, store, model } = setup([ask, blog, { text: "Here is the post." }], {});
		await store.insertAttachment(ctx, { id: "att_mine", kind: "image", origin: "upload", ref: null, name: "shirt.jpg", mime: "image/jpeg", size: 3, textContent: null, credit: null, content: Buffer.from([1, 2, 3]) });
		await store.insertAttachment({ ...ctx, userId: "someone_else" }, { id: "att_theirs", kind: "image", origin: "upload", ref: null, name: "x.jpg", mime: "image/jpeg", size: 3, textContent: null, credit: null, content: Buffer.from([1]) });

		const paused = await service.start(ctx, { prompt: "Add photos to the linen post" }, () => {});
		expect(paused.ask?.question).toMatchObject({ kind: "images", allowUpload: true, title: "Which photos should the post use?" });
		expect(paused.ask?.question.options.map((o) => o.value)).toEqual(["asset:a1", "asset:a2", "pixabay:9"]);

		// words typed at the photo question search again — same question, no model call
		const searched = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "q_photos", text: "linen on a hanger" }, () => {});
		expect(searched.status).toBe("awaiting_input");
		expect(searched.ask?.question).toMatchObject({ id: "q_photos", kind: "images" });
		expect(searched.ask?.index).toBe(paused.ask?.index);
		expect(model.doGenerateCalls).toHaveLength(1);

		const done = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "q_photos", values: ["pixabay:9", "att_mine", "att_theirs"] }, () => {});
		expect(done.status).toBe("awaiting_approval");
		expect(done.answers?.[0]).toMatchObject({ kind: "images", values: ["img_1", "att_mine"], display: "2 photos" });

		const [changeSet] = await store.listChangeSets("org_1", { limit: 5 });
		const doc = changeSet?.drafts?.[0];
		expect(doc?.type === "blog" && doc.cover).toMatchObject({ ref: "pixabay:9", origin: "stock", credit: "Pixabay · Ann" });
		expect(doc?.type === "blog" && doc.images[0]).toMatchObject({ ref: "attachment:att_mine", origin: "upload" });
	});
});

// TC-AICP-131 — tester feedback "the questions repeat": after the merchant answered the card,
// the model asked the same questions again in the same message. The second ask is refused
// (no new card) and the model drafts with the answers it has.
describe("one question card per message [TC-AICP-131]", () => {
	it("a second ask_user after the answers is refused and the run drafts instead", async () => {
		const { service, model } = setup([askCall, askCall, proposeCall, { text: "Here is the draft." }], { family: 0.99, fit: 0.99, material: 0.99 });
		const paused = await service.start(ctx, { prompt: "Create a product: oversized cotton shirt, grey and ivory, S–XL, RM 89" }, () => {});
		let run = paused;
		for (let i = 0; i < 4 && run.status === "awaiting_input" && run.ask; i += 1) {
			run = await service.answer(ctx, paused.id, { toolCallId: run.ask.toolCallId, questionId: run.ask.question.id, skip: true }, () => {});
		}

		expect(run.status).toBe("awaiting_approval");
		// the refused second ask came back to the model as a tool result telling it to draft
		expect(JSON.stringify(model.doGenerateCalls.at(-2)?.prompt)).toContain("Do not ask again");
		expect(run.receipts.filter((r) => r.tool === "catalog.ask_user")).toHaveLength(1);
	});
});
