import { type ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { FastifyReply, FastifyRequest, RawRequestDefaultExpression } from "fastify";
import type { AiRequestContext } from "./auth/context-token";
import type { Env } from "./config/env";
import { attachmentBodyLimit, formatLimit } from "./config/limits";
import { SettingsService } from "./settings/settings.service";
import { logRequest, logServerError, REQUEST_ID_HEADER, requestIdFor, runWithRequestId, shouldLogRequest } from "./observability/request-context";

/** BFF → service attachment uploads (see AttachmentService). */
export const ATTACHMENT_CONTENT_TYPE = "application/vnd.ech.attachment+json";
/** Every other JSON body. */
const DEFAULT_BODY_LIMIT = 256 * 1024;

/**
 * Shared by the long-lived server (main.ts) and the Vercel function (vercel-handler.ts).
 * `request.id` is the caller's `x-request-id` when it is a safe token, else a fresh uuid.
 */
export function createAdapter(): FastifyAdapter {
	return new FastifyAdapter({
		logger: false,
		trustProxy: true,
		bodyLimit: DEFAULT_BODY_LIMIT,
		genReqId: (request: RawRequestDefaultExpression) => requestIdFor(request.headers[REQUEST_ID_HEADER]),
	});
}

/** The route pattern (`/agent/runs/:id`): never the raw url, whose query may carry what the merchant typed. */
const routeOf = (request: FastifyRequest) => request.routeOptions?.url ?? "(no route)";

/** The same problem body as every other refusal (`title`, `status`, `detail`), naming the limit that was hit. */
function payloadTooLarge(contentType: string | undefined, attachmentLimit: number) {
	const upload = contentType?.startsWith(ATTACHMENT_CONTENT_TYPE) ?? false;
	const detail = upload
		? `The upload is larger than ${formatLimit(attachmentLimit)}. Send a smaller file.`
		: `The request body is larger than ${formatLimit(DEFAULT_BODY_LIMIT)}.`;
	return { title: "Payload Too Large", status: 413, detail };
}

/**
 * A chunked body (no Content-Length) is only refused while Fastify reads it, before Nest has a
 * route; Nest wraps that as a bare `HttpException(413)`. Our own 413s already carry a `title`.
 * An unhandled error (a 500) also logs one structured line with the request id.
 */
@Catch()
class AppExceptionFilter extends BaseExceptionFilter {
	constructor(
		httpAdapterHost: HttpAdapterHost,
		private readonly attachmentLimit: number,
	) {
		super(httpAdapterHost.httpAdapter);
	}

	override catch(exception: unknown, host: ArgumentsHost): void {
		if (host.getType() !== "http") return super.catch(exception, host);
		const http = host.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		if (!(exception instanceof HttpException)) {
			// unhandled: answered 500 by Nest; the request line (onResponse) has no message
			logServerError({ reqId: request.id, route: routeOf(request), message: exception instanceof Error ? exception.message : String(exception) });
			return super.catch(exception, host);
		}
		const body = exception.getResponse();
		const bare = typeof body === "string" || !("title" in body);
		if (exception.getStatus() !== 413 || !bare) return super.catch(exception, host);
		void http.getResponse<FastifyReply>().code(413).send(payloadTooLarge(request.headers["content-type"], this.attachmentLimit));
	}
}

/**
 * Attachment uploads (files as base64 + read text) get their own body limit on a
 * dedicated media type (16 MiB locally, just under Vercel's 4.5 MB on Vercel,
 * AI_ATTACHMENT_BODY_LIMIT_BYTES); everything else stays at 256 KB. A body over
 * the limit answers 413 with a problem body the BFF can show.
 */
export function configureApp(app: NestFastifyApplication, env: Env): void {
	const limit = attachmentBodyLimit(env);
	// Prime Studio's request-log mode when the settings module is present (test apps have none)
	let settings: SettingsService | null = null;
	try {
		settings = app.get(SettingsService, { strict: false });
	} catch {
		// no settings module in this app: env only
	}
	const fastify = app.getHttpAdapter().getInstance();
	fastify.addContentTypeParser(ATTACHMENT_CONTENT_TYPE, { parseAs: "string", bodyLimit: limit }, (_request, body, done) => {
		try {
			done(null, JSON.parse(String(body)));
		} catch (error) {
			done(error as Error, undefined);
		}
	});
	fastify.addHook("onRequest", (request, reply, done) => {
		// on the raw response so it also leaves with hijacked (SSE) replies, which write their own head
		reply.raw.setHeader(REQUEST_ID_HEADER, request.id);
		done();
	});
	// after the body is read (stream callbacks would lose it): the handler, and work it outlives the response with, see the id
	fastify.addHook("preHandler", (request, _reply, done) => runWithRequestId(request.id, done));
	fastify.addHook("onResponse", async (request, reply) => {
		const ms = Math.round(reply.elapsedTime);
		if (!shouldLogRequest(reply.statusCode, ms, (settings?.runtimeEnv() ?? env).AI_LOG_REQUESTS)) return;
		const org = (request as FastifyRequest & { aiContext?: AiRequestContext }).aiContext?.organizationId;
		logRequest({ reqId: request.id, method: request.method, route: routeOf(request), status: reply.statusCode, ms, ...(org ? { org } : {}) });
	});
	fastify.addHook("onRequest", async (request, reply) => {
		// Content-Length is known up front: refuse before reading a body that cannot fit.
		const declared = Number(request.headers["content-length"] ?? 0);
		const upload = request.headers["content-type"]?.startsWith(ATTACHMENT_CONTENT_TYPE) ?? false;
		if (declared > (upload ? limit : DEFAULT_BODY_LIMIT)) {
			return reply.code(413).send(payloadTooLarge(request.headers["content-type"], limit));
		}
	});
	app.useGlobalFilters(new AppExceptionFilter(app.get(HttpAdapterHost), limit));
	app.enableShutdownHooks();
}
