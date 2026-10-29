import { MockImageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { parseEnv } from "../config/env";
import { imageOutputFormat } from "../config/limits";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { ImageService } from "./image.service";
import { InMemoryPictureQuota } from "./picture-quota";

// TC-AIREL-67 — generated pictures come back as webp on Vercel so the base64 answer (and
// prime-web's upload of it) stays under the 4.5 MB body limit; png stays the local default.

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1", tenantId: "7", email: "o@shop.my" };
const base = { AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" };

function service(env: Record<string, string>) {
	const doGenerate = vi.fn(async (_options: unknown) => ({ images: ["UklGRg=="], warnings: [], response: { timestamp: new Date(), modelId: "img", headers: undefined } }));
	const model = new MockImageModelV4({ doGenerate, maxImagesPerCall: 1 });
	const registry: ModelRegistry = { resolveChain: () => [], resolveImageChain: () => [{ model, provider: "openai", modelId: "gpt-image-1" }] };
	const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };
	return { images: new ImageService(registry, ledger, parseEnv({ ...base, ...env }), new InMemoryPictureQuota()), calls: doGenerate.mock.calls };
}

describe("generated picture format [TC-AIREL-67]", () => {
	it("TC-AIREL-67: webp on Vercel, png locally, and AI_IMAGE_OUTPUT_FORMAT wins", async () => {
		// Arrange
		const onVercel = service({ VERCEL: "1" });
		const local = service({});

		// Act
		const [picture] = await onVercel.images.generate(ctx, { prompt: "batik scarf", aspect: "square", count: 1 });
		await local.images.generate(ctx, { prompt: "batik scarf", aspect: "square", count: 1 });

		// Assert
		expect(onVercel.calls[0]?.[0]).toMatchObject({ providerOptions: { openai: { quality: "medium", outputFormat: "webp", outputCompression: 85 } } });
		expect(picture?.mediaType).toMatch(/^image\//);
		expect((local.calls[0]?.[0] as { providerOptions: { openai: Record<string, unknown> } }).providerOptions.openai).toEqual({ quality: "medium" });
		expect(imageOutputFormat({ VERCEL: "1", AI_IMAGE_OUTPUT_FORMAT: "jpeg" })).toBe("jpeg");
		expect(imageOutputFormat({ VERCEL: undefined, AI_IMAGE_OUTPUT_FORMAT: undefined })).toBeUndefined();
	});
});
