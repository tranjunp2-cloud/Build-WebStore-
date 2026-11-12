import { MockImageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import type { UsageEvent, UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { IMAGE_TASK, ImageService } from "./image.service";
import { InMemoryPictureQuota } from "./picture-quota";

// TC-AICP-58 — picture generation: one quota per organization counted in
// pictures, one ledger row per picture, a clear refusal when it is off or used up.

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1", tenantId: "7", email: "o@shop.my" };
const PNG = "iVBORw0KGgo=";

function setup(options: { used?: number; models?: MockImageModelV4[]; limit?: string } = {}) {
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (event) => void recorded.push(event), countSince: async () => 0 };
	const quota = new InMemoryPictureQuota(options.used ?? 0);
	const models = options.models ?? [];
	const registry: ModelRegistry = {
		resolveChain: () => [],
		resolveImageChain: () => models.map((model, i) => ({ model, provider: i === 0 ? "openai" : "compat-local", modelId: `img-${i}` })),
	};
	const env = parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		...(options.limit ? { AI_DAILY_IMAGE_LIMIT_PER_ORG: options.limit } : {}),
	});
	return { service: new ImageService(registry, ledger, env, quota), recorded, quota };
}

function drawing(count = 1) {
	const doGenerate = vi.fn(async (_options: unknown) => ({
		images: Array.from({ length: count }, () => PNG),
		warnings: [],
		response: { timestamp: new Date(), modelId: "img", headers: undefined },
	}));
	return Object.assign(new MockImageModelV4({ doGenerate, maxImagesPerCall: 2 }), { calls: doGenerate.mock.calls });
}

describe("ImageService [TC-AICP-58]", () => {
	it("draws at the shape's size and ledgers one row per picture", async () => {
		const model = drawing(2);
		const { service, recorded, quota } = setup({ models: [model] });

		const images = await service.generate(ctx, { prompt: "batik scarf on linen", aspect: "landscape", count: 2 }, { runId: "run_1" });

		expect(images).toHaveLength(2);
		expect(images[0]).toMatchObject({ data: PNG });
		expect(model.calls[0]?.[0]).toMatchObject({ prompt: "batik scarf on linen", n: 2, size: "1536x1024" });
		expect(quota.reservations).toEqual([expect.objectContaining({ organizationId: "org_1", pictures: 2 })]);
		expect(recorded).toEqual([
			expect.objectContaining({ task: IMAGE_TASK, images: 1, outcome: "ok", runId: "run_1", provider: "openai" }),
			expect.objectContaining({ task: IMAGE_TASK, images: 1, outcome: "ok" }),
		]);
	});

	it("falls to the next picture model and ledgers the failed attempt", async () => {
		const broken = new MockImageModelV4({
			doGenerate: async () => {
				throw new Error("upstream 500");
			},
		});
		const { service, recorded } = setup({ models: [broken, drawing()] });

		await expect(service.generate(ctx, { prompt: "a cover photo" })).resolves.toHaveLength(1);
		expect(recorded.map((e) => [e.provider, e.outcome])).toEqual([
			["openai", "error"],
			["compat-local", "ok"],
		]);
	});

	it("refuses past the daily picture cap and when no picture model is set up", async () => {
		await expect(setup({ models: [drawing()], used: 19, limit: "20" }).service.generate(ctx, { prompt: "two covers", count: 2 })).rejects.toMatchObject({
			status: 429,
			message: "Only 1 more picture can be generated today.",
		});
		await expect(setup({ models: [] }).service.generate(ctx, { prompt: "a cover photo" })).rejects.toMatchObject({ status: 503 });
		await expect(setup({ models: [drawing()] }).service.generate(ctx, { prompt: "x" })).rejects.toMatchObject({ status: 400 });
	});
});

describe("pictures per plan from the token [TC-AIPRC-08]", () => {
	const plan = (picturesPerDay: number | null): AiRequestContext => ({ ...ctx, limits: { plan: "pro", aiBudgetUsd: 5, picturesPerDay } });

	it("uses the plan's cap over the env fallback", async () => {
		await expect(setup({ models: [drawing()], used: 3, limit: "100" }).service.generate(plan(3), { prompt: "a cover photo" })).rejects.toMatchObject({ status: 429 });
		await expect(setup({ models: [drawing()], used: 3, limit: "1" }).service.generate(plan(50), { prompt: "a cover photo" })).resolves.toHaveLength(1);
	});

	it("null = unlimited, no claim = env", async () => {
		await expect(setup({ models: [drawing()], used: 9999, limit: "1" }).service.generate(plan(null), { prompt: "a cover photo" })).resolves.toHaveLength(1);
		await expect(setup({ models: [drawing()], used: 1, limit: "1" }).service.generate(ctx, { prompt: "a cover photo" })).rejects.toMatchObject({ status: 429 });
	});
});

function slowDrawing(ms: number, fail?: () => Error) {
	return new MockImageModelV4({
		doGenerate: async () => {
			await new Promise((resolve) => setTimeout(resolve, ms));
			if (fail) throw fail();
			return { images: [PNG], warnings: [], response: { timestamp: new Date(), modelId: "img", headers: undefined } };
		},
	});
}

describe("picture quota is reserved before generating [TC-AISEC-053]", () => {
	it("TC-AISEC-053: lets exactly the daily limit through when requests run in parallel", async () => {
		// Arrange
		const { service } = setup({ models: [slowDrawing(20)], limit: "3" });

		// Act
		const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.generate(ctx, { prompt: "a cover photo" })));

		// Assert
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
		const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
		expect(refused).toHaveLength(7);
		for (const r of refused) expect(r.reason).toMatchObject({ status: 429 });
	});

	it("TC-AISEC-053: keeps a failed or timed-out call counted once the provider was reached", async () => {
		// Arrange
		const { service, quota } = setup({ models: [slowDrawing(1, () => new Error("upstream 500"))], limit: "1" });

		// Act
		await expect(service.generate(ctx, { prompt: "a cover photo" })).rejects.toMatchObject({ status: 503 });
		const next = service.generate(ctx, { prompt: "a cover photo" });

		// Assert
		await expect(next).rejects.toMatchObject({ status: 429 });
		expect(quota.reservations).toHaveLength(1);
	});

	it("TC-AISEC-053: gives the pictures back when the request never reached a provider", async () => {
		// Arrange
		const refused = () => Object.assign(new Error("Cannot connect to API"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
		const { service, quota } = setup({ models: [slowDrawing(1, refused)], limit: "1" });

		// Act
		await expect(service.generate(ctx, { prompt: "a cover photo" })).rejects.toMatchObject({ status: 503 });

		// Assert
		expect(quota.reservations).toEqual([]);
	});
});
