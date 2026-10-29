import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import { DecisionService } from "../decide/decision.service";
import type { Decider } from "../decide/decision-types";
import type { ImageService } from "../images/image.service";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import type { ShopTools } from "../shop/shop-tools";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { QuestionFlowService } from "./ask/question-flow";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { MERCHANT_INSTRUCTIONS } from "./merchant-instructions";
import { picturesSkippedRefusal } from "./pictures-skipped";

// TC-AIAUD-180..183 — B1 observation (#2103, run_4a78688c0f8442aa9776): the merchant answered "Skip, add later" to
// the photo question and the assistant still drew an AI picture. After a skipped pictures question nothing is
// generated in that run unless the merchant's own words ask for a generated picture.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", token: "t" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

type Turn = { tool: string; input: unknown } | { text: string };

function setup(turns: Turn[]) {
	let call = 0;
	const model = new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			const content =
				"tool" in turn
					? [{ type: "tool-call" as const, toolCallId: `call_${call}`, toolName: turn.tool, input: JSON.stringify(turn.input) }]
					: [{ type: "text" as const, text: turn.text }];
			return { content, finishReason: { unified: "tool" in turn ? ("tool-calls" as const) : ("stop" as const), raw: undefined }, usage, warnings: [] };
		},
	});
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const store = new InMemoryAgentStore();
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const generate = vi.fn(async () => [{ mediaType: "image/png", data: "iVBORw0KGgo=" }]);
	const saveGeneratedPicture = vi.fn(async () => ({ assetId: "ast_9", ref: "asset:ast_9", url: "/api/agent/media/assets/ast_9/thumbnail", name: "Sunscreen" }));
	const shop = { searchMedia: async () => [], saveGeneratedPicture } as unknown as ShopTools;
	const decider: Decider = { provider: "typesafe", model: "m", isAvailable: () => true, decide: async () => ({ answers: new Map(), usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 1 }) };
	const flows = new QuestionFlowService(shop, new DecisionService(store, ledger, env, decider), store);
	const pictures = { available: true, generate } as unknown as ImageService;
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), flows, shop, pictures);
	return { service, model, generate, saveGeneratedPicture };
}

const askPhoto: Turn = {
	tool: "ask_user",
	input: {
		purpose: "custom",
		product: null,
		questions: [{ id: "photo", title: "Do you have a photo of the Sunscreen?", why: null, options: [], multiple: false, pictures: { query: "sunscreen", source: "library" } }],
		language: "en",
	},
};
const draw: Turn = { tool: "generate_image", input: { prompt: "A tube of sunscreen on a white table", aspect: "square", count: 1 } };

/** Every tool result the model received after the first call, as one string. */
const results = (model: MockLanguageModelV4) =>
	model.doGenerateCalls.flatMap((call) => call.prompt.flatMap((m) => (m.role === "tool" ? m.content.map((part) => JSON.stringify(part)) : []))).join("\n");

describe("picturesSkippedRefusal [TC-AIAUD-180]", () => {
	it("TC-AIAUD-180: refuses only after a skipped pictures question, unless the merchant's words ask for a generated picture", () => {
		expect(picturesSkippedRefusal(undefined, "add a featured products section")).toBeNull();
		expect(picturesSkippedRefusal(false, "add a featured products section")).toBeNull();
		expect(picturesSkippedRefusal(true, "add a featured products section")).toMatchObject({ images: [], error: { code: "pictures_skipped" } });
		// the merchant's own request for a generated picture
		for (const asked of ["generate a picture for the sunscreen", "use an AI image for it", "tạo ảnh cho sản phẩm", "jana gambar untuk produk ini", "create an image of it"]) {
			expect(picturesSkippedRefusal(true, asked), asked).toBeNull();
		}
		// pictures in general are not a request to draw one
		expect(picturesSkippedRefusal(true, "display their names, images, prices and product links")).not.toBeNull();
	});

	it("TC-AIAUD-180: the instructions and the skipped answer both say no new pictures", () => {
		expect(MERCHANT_INSTRUCTIONS).toMatch(/skipped — no photos for now/);
	});
});

describe("a skipped pictures question stops picture generation in the run [TC-AIAUD-181..183]", () => {
	const featured = "Add a Featured Products section to the homepage using four existing active products. Display their actual names, images, prices, and product links.";

	it("TC-AIAUD-181: after 'Skip, add later' generate_image is refused and nothing is drawn or saved", async () => {
		// Arrange
		const { service, model, generate, saveGeneratedPicture } = setup([askPhoto, draw, { text: "Staged without a photo for the Sunscreen." }]);
		const paused = await service.start(ctx, { prompt: featured, context: { module: "editor" } }, () => undefined);

		// Act
		await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "q_photo", skip: true }, () => undefined);

		// Assert
		expect(generate).not.toHaveBeenCalled();
		expect(saveGeneratedPicture).not.toHaveBeenCalled();
		expect(results(model)).toContain("skipped — no photos for now");
		expect(results(model)).toContain("pictures_skipped");
	});

	it("TC-AIAUD-182: without a skipped question a requested generated picture is still drawn", async () => {
		const { service, generate } = setup([draw, { text: "Done." }]);

		await service.start(ctx, { prompt: "Make a cover for the sunscreen page", context: { module: "editor" } }, () => undefined);

		expect(generate).toHaveBeenCalledTimes(1);
	});

	it("TC-AIAUD-183: skipping the question but asking for a generated picture in the message still generates", async () => {
		const { service, generate } = setup([askPhoto, draw, { text: "Done." }]);
		const paused = await service.start(ctx, { prompt: "Generate a picture for the sunscreen if I have no photo", context: { module: "editor" } }, () => undefined);

		await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "q_photo", skip: true }, () => undefined);

		expect(generate).toHaveBeenCalledTimes(1);
	});
});
