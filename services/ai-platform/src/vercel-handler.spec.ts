import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Controller, Get, Module, Res } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyReply } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keepInvocationFor } from "./pending-work";
import { startTestApp } from "./testing/test-app";
import { createVercelHandler } from "./vercel-handler";

/** Lets the test hold the second SSE frame back until the client has read the first. */
let releaseSecondFrame: () => void = () => undefined;
let secondFrameGate: Promise<void> = Promise.resolve();

@Controller()
class StreamController {
	@Get("ping")
	ping() {
		return { ok: true };
	}

	// same shape as AgentController.stream(): hijacked reply, frames written with raw.write
	@Get("sse")
	async sse(@Res() reply: FastifyReply) {
		reply.hijack();
		const raw = reply.raw;
		raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" });
		raw.write(`data: ${JSON.stringify({ type: "run.started" })}\n\n`);
		await secondFrameGate;
		raw.write(`data: ${JSON.stringify({ type: "run.status", status: "applied" })}\n\n`);
		raw.end();
	}

	// a run that outlives its stream: the response closes, the work goes on
	@Get("kept")
	kept(@Res() reply: FastifyReply) {
		reply.hijack();
		const raw = reply.raw;
		raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
		raw.write(`data: ${JSON.stringify({ type: "run.started" })}\n\n`);
		keepInvocationFor(raw, secondFrameGate);
	}
}

@Module({ controllers: [StreamController] })
class StreamModule {}

const servers: Server[] = [];
const apps: NestFastifyApplication[] = [];

async function serve(boot: () => Promise<NestFastifyApplication>) {
	const handler = createVercelHandler(async () => {
		const app = await boot();
		apps.push(app);
		return app;
	});
	const server = createServer((req, res) => void handler(req, res));
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))));
	await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe("Vercel handler", () => {
	it("[TC-AIREL-01] forwards the request to Fastify and streams SSE frames as they are written", async () => {
		// Arrange
		secondFrameGate = new Promise<void>((resolve) => {
			releaseSecondFrame = resolve;
		});
		const base = await serve(() => startTestApp(StreamModule));

		// Act: a plain route first, then the stream
		const ping = await fetch(`${base}/ping`);
		const response = await fetch(`${base}/sse`);
		const reader = (response.body as ReadableStream<Uint8Array>).getReader();
		const decoder = new TextDecoder();
		const first = await reader.read();

		// Assert: frame 1 reached the client while the handler is still holding frame 2 back
		expect(await ping.json()).toEqual({ ok: true });
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		expect(decoder.decode(first.value)).toBe('data: {"type":"run.started"}\n\n');
		releaseSecondFrame();
		let rest = "";
		for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) rest += decoder.decode(chunk.value);
		expect(rest).toBe('data: {"type":"run.status","status":"applied"}\n\n');
	});

	it("[TC-AISEC-004] keeps the invocation open until a run whose stream closed has settled", async () => {
		// Arrange
		secondFrameGate = new Promise<void>((resolve) => {
			releaseSecondFrame = resolve;
		});
		const handler = createVercelHandler(async () => {
			const app = await startTestApp(StreamModule);
			apps.push(app);
			return app;
		});
		let settled = false;
		let invocation: Promise<void> = Promise.resolve();
		const server = createServer((req, res) => {
			invocation = handler(req, res).then(() => {
				settled = true;
			});
		});
		servers.push(server);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

		// Act: the browser reads the first frame, then goes away
		const abort = new AbortController();
		const response = await fetch(`${base}/kept`, { signal: abort.signal });
		await (response.body as ReadableStream<Uint8Array>).getReader().read();
		abort.abort();
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Assert: still open while the run works, over once it settles
		expect(settled).toBe(false);
		releaseSecondFrame();
		await invocation;
		expect(settled).toBe(true);
	});

	it("[TC-AIREL-02] boots the app once for concurrent first requests", async () => {
		// Arrange
		secondFrameGate = Promise.resolve();
		const boot = vi.fn(() => startTestApp(StreamModule));
		const base = await serve(boot);

		// Act
		const responses = await Promise.all([1, 2, 3].map(() => fetch(`${base}/ping`)));
		await fetch(`${base}/ping`);

		// Assert
		expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
		expect(boot).toHaveBeenCalledTimes(1);
	});

	it("[TC-AIREL-03] answers 500 when boot fails and tries again on the next request", async () => {
		// Arrange
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		let attempts = 0;
		const base = await serve(async () => {
			attempts += 1;
			if (attempts === 1) throw new Error("Invalid ai-platform environment");
			return startTestApp(StreamModule);
		});

		// Act
		const failed = await fetch(`${base}/ping`);
		const recovered = await fetch(`${base}/ping`);

		// Assert: the failure is not cached, and its detail is not leaked to the caller
		expect(failed.status).toBe(500);
		expect(await failed.json()).toEqual({ title: "Service unavailable", status: 500, detail: "The service failed to start." });
		expect(recovered.status).toBe(200);
		expect(attempts).toBe(2);
	});
});
