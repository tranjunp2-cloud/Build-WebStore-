import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentError } from "./agent-errors";
import { AttachmentService } from "./attachment.service";

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function png(bytes: number) {
	return Buffer.concat([PNG_HEAD, Buffer.alloc(bytes - PNG_HEAD.length)]);
}

function upload(buffer: Buffer) {
	return { name: "photo.png", mime: "image/png", origin: "upload" as const, dataBase64: buffer.toString("base64") };
}

describe("AttachmentService size limit", () => {
	it("[TC-AIREL-12] refuses a file over the Vercel limit with a 413 that names the limit", async () => {
		// Arrange
		const service = new AttachmentService(new InMemoryAgentStore(), testEnv({ VERCEL: "1" }));

		// Act
		const refusal = await service.upload(ctx, upload(png(3_200_000))).catch((error: unknown) => error);

		// Assert
		expect(refusal).toBeInstanceOf(AgentError);
		expect(refusal).toMatchObject({ status: 413, message: "photo.png is larger than 3 MB. Choose a smaller file." });
	});

	it("[TC-AIREL-12] accepts the same file locally, and a file under the limit on Vercel", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		const local = new AttachmentService(store, testEnv());
		const vercel = new AttachmentService(store, testEnv({ VERCEL: "1" }));

		// Act
		const big = await local.upload(ctx, upload(png(3_200_000)));
		const small = await vercel.upload(ctx, upload(png(2_900_000)));

		// Assert
		expect(big.size).toBe(3_200_000);
		expect(small.size).toBe(2_900_000);
	});

	it("[TC-AIREL-12] rejects an oversized payload on its encoded length, before decoding it", async () => {
		// Arrange
		const service = new AttachmentService(new InMemoryAgentStore(), testEnv({ AI_ATTACHMENT_MAX_BYTES: "1024" }));

		// Act + Assert
		await expect(service.upload(ctx, upload(png(1025)))).rejects.toMatchObject({ status: 413 });
		await expect(service.upload(ctx, upload(png(1024)))).resolves.toMatchObject({ size: 1024 });
	});
});
