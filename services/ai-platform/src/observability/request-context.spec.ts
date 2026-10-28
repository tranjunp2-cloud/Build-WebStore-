import { Controller, Get, HttpException, Module, Param, Res } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyReply } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startTestApp, testEnv } from "../testing/test-app";
import { currentRequestId, requestIdFor, shouldLogRequest } from "./request-context";

// TC-AISEC-034 — one request id across services: honoured or generated, echoed, logged, never with secrets.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller("probe")
class ProbeController {
	@Get("id")
	async id() {
		await new Promise((resolve) => setTimeout(resolve, 1));
		return { seen: currentRequestId() };
	}

	@Get("missing/:id")
	missing(@Param("id") _id: string) {
		throw new HttpException({ title: "Not found", status: 404 }, 404);
	}

	@Get("boom")
	boom() {
		throw new Error("database went away");
	}

	@Get("stream")
	stream(@Res() reply: FastifyReply) {
		reply.hijack();
		reply.raw.writeHead(200, { "content-type": "text/event-stream" });
		reply.raw.end("data: {}\n\n");
	}
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	vi.restoreAllMocks();
	await app?.close();
	app = undefined;
});

const get = (url: string, headers: Record<string, string> = {}) => app?.getHttpAdapter().getInstance().inject({ method: "GET", url, headers });

describe("request ids [TC-AISEC-034]", () => {
	it("TC-AISEC-034: accepts a safe caller id and replaces anything else", () => {
		expect(requestIdFor("prime-web:01J9ZK3Q.abc")).toBe("prime-web:01J9ZK3Q.abc");
		expect(requestIdFor(["req_12345678", "other"])).toBe("req_12345678");
		for (const bad of [undefined, "", "short", "has space 12345", "x".repeat(129), 'quote"12345678', "line\nbreak123"]) {
			expect(requestIdFor(bad)).toMatch(UUID);
		}
	});

	it("TC-AISEC-034: honours the caller's x-request-id, echoes it, and the handler sees it after an await", async () => {
		// Arrange
		app = await startTestApp(ProbeModule);

		// Act
		const response = await get("/probe/id", { "x-request-id": "pw-req-0001" });

		// Assert
		expect(response?.headers["x-request-id"]).toBe("pw-req-0001");
		expect(response?.json()).toEqual({ seen: "pw-req-0001" });
	});

	it("TC-AISEC-034: generates an id when the header is missing or invalid, and echoes it", async () => {
		// Arrange
		app = await startTestApp(ProbeModule);

		// Act
		const missing = await get("/probe/id");
		const invalid = await get("/probe/id", { "x-request-id": "bad id <script>" });

		// Assert
		expect(missing?.headers["x-request-id"]).toMatch(UUID);
		expect(invalid?.headers["x-request-id"]).toMatch(UUID);
		expect(invalid?.json()).toEqual({ seen: invalid?.headers["x-request-id"] });
	});

	it("TC-AISEC-034: echoes the id on a hijacked (SSE) reply", async () => {
		// Arrange
		app = await startTestApp(ProbeModule);

		// Act
		const response = await get("/probe/stream", { "x-request-id": "pw-stream-0001" });

		// Assert
		expect(response?.headers["content-type"]).toBe("text/event-stream");
		expect(response?.headers["x-request-id"]).toBe("pw-stream-0001");
	});

	it("TC-AISEC-034: logs one JSON line for a failed request with the route pattern, never the token or query", async () => {
		// Arrange
		app = await startTestApp(ProbeModule);
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

		// Act
		await get("/probe/missing/prod_42?q=secret-words", { "x-request-id": "pw-req-0404", authorization: "Bearer ctx-token-value" });
		await get("/probe/id");

		// Assert
		expect(log).toHaveBeenCalledTimes(1);
		const line = String(log.mock.calls[0]?.[0]);
		expect(JSON.parse(line)).toEqual({ reqId: "pw-req-0404", method: "GET", route: "/probe/missing/:id", status: 404, ms: expect.any(Number) });
		expect(line).not.toMatch(/ctx-token-value|secret-words|prod_42|authorization/i);
	});

	it("TC-AISEC-034: logs every request when AI_LOG_REQUESTS=all, and slow ones by default", async () => {
		// Arrange
		app = await startTestApp(ProbeModule, testEnv({ AI_LOG_REQUESTS: "all" }));
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

		// Act
		await get("/probe/id", { "x-request-id": "pw-req-0200" });

		// Assert
		expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ reqId: "pw-req-0200", route: "/probe/id", status: 200 });
		expect(shouldLogRequest(200, 1_999, "default")).toBe(false);
		expect(shouldLogRequest(200, 2_000, "default")).toBe(true);
	});

	it("TC-AISEC-034: an unhandled error logs one structured error line with the request id", async () => {
		// Arrange
		app = await startTestApp(ProbeModule);
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(console, "log").mockImplementation(() => undefined);

		// Act
		const response = await get("/probe/boom", { "x-request-id": "pw-req-0500" });

		// Assert
		expect(response?.statusCode).toBe(500);
		expect(response?.headers["x-request-id"]).toBe("pw-req-0500");
		const lines = error.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith("{"));
		expect(lines.map((line) => JSON.parse(line))).toEqual([
			{ level: "error", reqId: "pw-req-0500", route: "/probe/boom", message: "database went away" },
		]);
	});
});
