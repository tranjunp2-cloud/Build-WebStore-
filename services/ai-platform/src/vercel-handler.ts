import type { IncomingMessage, ServerResponse } from "node:http";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createApp } from "./bootstrap";
import { pendingWorkOf } from "./pending-work";

export type NodeHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Vercel Node function: boots the app once per instance (the promise is cached so
 * concurrent first requests share it; a failed boot is not cached) and hands each
 * request to Fastify's own http server. Fastify writes to `res` itself, so SSE
 * frames leave as they are written — nothing here buffers the body.
 *
 * Resolves when the response is finished or the connection closed, and any work the
 * route kept running after it (`keepInvocationFor`) has settled: Vercel treats the
 * invocation as over when the handler returns. maxDuration still bounds it.
 */
export function createVercelHandler(boot: () => Promise<NestFastifyApplication>): NodeHandler {
	let booting: Promise<NestFastifyApplication> | undefined;

	const app = (): Promise<NestFastifyApplication> => {
		if (!booting) {
			booting = boot().catch((error: unknown) => {
				booting = undefined;
				throw error;
			});
		}
		return booting;
	};

	return async (req, res) => {
		let instance: NestFastifyApplication;
		try {
			instance = await app();
		} catch (error) {
			console.error("[ai-platform] failed to start", error);
			if (!res.headersSent) {
				res.writeHead(500, { "content-type": "application/json" });
			}
			res.end(JSON.stringify({ title: "Service unavailable", status: 500, detail: "The service failed to start." }));
			return;
		}
		const finished = new Promise<void>((resolve) => {
			res.once("close", resolve);
		});
		instance.getHttpAdapter().getInstance().server.emit("request", req, res);
		await finished;
		await pendingWorkOf(res);
	};
}

export default createVercelHandler(createApp);
