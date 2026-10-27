import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { Body, Controller, Module, Post } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";
import { ATTACHMENT_CONTENT_TYPE } from "./http-setup";
import { startTestApp, testEnv } from "./testing/test-app";

@Controller()
class UploadController {
	@Post("agent/attachments")
	attachment(@Body() body: { name?: string }) {
		return { received: body.name };
	}

	@Post("agent/runs")
	run(@Body() body: unknown) {
		return { received: Boolean(body) };
	}
}

@Module({ controllers: [UploadController] })
class UploadModule {}

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	await app?.close();
	app = undefined;
});

const inject = (payload: string | Buffer, headers: Record<string, string>) =>
	app?.getHttpAdapter().getInstance().inject({ method: "POST", url: "/agent/attachments", headers, payload });

describe("attachment body limit", () => {
	it("[TC-AIREL-14] answers 413 with a problem body when the upload is over the configured limit", async () => {
		// Arrange
		app = await startTestApp(UploadModule, testEnv({ AI_ATTACHMENT_BODY_LIMIT_BYTES: String(64 * 1024) }));
		const body = JSON.stringify({ name: "a.png", dataBase64: "A".repeat(70 * 1024) });

		// Act
		const response = await inject(body, { "content-type": ATTACHMENT_CONTENT_TYPE });

		// Assert
		expect(response?.statusCode).toBe(413);
		expect(response?.json()).toEqual({
			title: "Payload Too Large",
			status: 413,
			detail: "The upload is larger than 64 KB. Send a smaller file.",
		});
	});

	it("[TC-AIREL-14] parses an upload under the limit, and keeps other JSON bodies at 256 KB", async () => {
		// Arrange
		app = await startTestApp(UploadModule, testEnv({ VERCEL: "1" }));
		const upload = JSON.stringify({ name: "a.png", dataBase64: "A".repeat(1_000_000) });
		const bigJson = JSON.stringify({ prompt: "x".repeat(300 * 1024) });

		// Act
		const accepted = await inject(upload, { "content-type": ATTACHMENT_CONTENT_TYPE });
		const refused = await app?.getHttpAdapter().getInstance().inject({
			method: "POST",
			url: "/agent/runs",
			headers: { "content-type": "application/json" },
			payload: bigJson,
		});

		// Assert
		expect(accepted?.json()).toEqual({ received: "a.png" });
		expect(refused?.statusCode).toBe(413);
		expect(refused?.json()).toMatchObject({ title: "Payload Too Large", status: 413 });
	});

	it("[TC-AIREL-14] still answers 413 for a chunked upload that declares no length", async () => {
		// Arrange
		app = await startTestApp(UploadModule, testEnv({ AI_ATTACHMENT_BODY_LIMIT_BYTES: String(64 * 1024) }));
		await app.listen({ port: 0, host: "127.0.0.1" });
		const port = (app.getHttpServer().address() as AddressInfo).port;

		// Act
		const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
			const req = request(
				{ host: "127.0.0.1", port, method: "POST", path: "/agent/attachments", headers: { "content-type": ATTACHMENT_CONTENT_TYPE } },
				(res) => {
					let body = "";
					res.on("data", (chunk) => {
						body += chunk;
					});
					res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
				},
			);
			req.on("error", reject);
			req.write(`{"name":"a.png","dataBase64":"${"A".repeat(40 * 1024)}`);
			req.write("A".repeat(40 * 1024));
			req.end('"}');
		});

		// Assert
		expect(response.status).toBe(413);
		expect(JSON.parse(response.body)).toEqual({
			title: "Payload Too Large",
			status: 413,
			detail: "The upload is larger than 64 KB. Send a smaller file.",
		});
	});
});
