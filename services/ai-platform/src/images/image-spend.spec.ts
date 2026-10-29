import { MockImageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { SpendGuard } from "../cost/spend-guard";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { testEnv } from "../testing/test-app";
import { ImageService } from "./image.service";
import { InMemoryPictureQuota } from "./picture-quota";

// TC-AISEC-146 — picture generation respects the platform's daily spend cap (AI_DAILY_BUDGET_USD) like
// runs and tasks: above it a 503, before any picture is reserved or drawn.

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1", tenantId: "7", email: "o@shop.my" };

function setup(spentMicros: number) {
	const doGenerate = vi.fn(async () => ({
		images: ["iVBORw0KGgo="],
		warnings: [],
		response: { timestamp: new Date(), modelId: "img", headers: undefined },
	}));
	const model = new MockImageModelV4({ doGenerate, maxImagesPerCall: 2 });
	const registry: ModelRegistry = { resolveChain: () => [], resolveImageChain: () => [{ model, provider: "openai", modelId: "gpt-image-1" }] };
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	const quota = new InMemoryPictureQuota();
	const spend = new SpendGuard(5, async () => spentMicros);
	return { service: new ImageService(registry, ledger, testEnv(), quota, spend), doGenerate, quota };
}

describe("pictures under the daily spend cap [TC-AISEC-146]", () => {
	it("TC-AISEC-146: over AI_DAILY_BUDGET_USD a picture is a 503, nothing reserved, no provider call", async () => {
		// Arrange
		const { service, doGenerate, quota } = setup(6_000_000);

		// Act
		const generating = service.generate(ctx, { prompt: "a batik scarf on a table" });

		// Assert
		await expect(generating).rejects.toMatchObject({ status: 503 });
		expect(doGenerate).not.toHaveBeenCalled();
		expect(quota.reservations).toHaveLength(0);
	});

	it("TC-AISEC-146: under the cap the picture is drawn", async () => {
		// Arrange
		const { service, doGenerate } = setup(1_000_000);

		// Act
		const pictures = await service.generate(ctx, { prompt: "a batik scarf on a table" });

		// Assert
		expect(pictures).toHaveLength(1);
		expect(doGenerate).toHaveBeenCalledTimes(1);
	});
});
