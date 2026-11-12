import { Body, Controller, Delete, Get, HttpCode, HttpException, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ContextTokenError, verifySettingsAdminToken } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { SettingsAdminService } from "./settings-admin.service";
import { SettingsValidationError, TestRateLimitedError } from "./settings-schemas";
import type { Actor } from "./settings-types";

function problem(status: number, title: string, detail: string): HttpException {
	return new HttpException({ title, status, detail }, status);
}

const isObject = (body: unknown): body is Record<string, unknown> => typeof body === "object" && body !== null && !Array.isArray(body);

/**
 * The internal admin API behind Prime Studio's "Providers & models" (prime-web proxies it for super-admins).
 * Bodies are never logged (request logging records the route pattern and status only) and no response carries a secret.
 */
@Controller("internal/settings")
export class SettingsController {
	constructor(
		@Inject(ENV) private readonly env: Env,
		private readonly admin: SettingsAdminService,
	) {}

	private async actorOf(request: FastifyRequest): Promise<Actor> {
		const header = request.headers.authorization ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
		if (!token) throw problem(401, "Unauthorized", "Missing settings admin token.");
		try {
			return await verifySettingsAdminToken(token, this.env.AI_PLATFORM_CONTEXT_SECRET);
		} catch (error) {
			if (error instanceof ContextTokenError) throw problem(401, "Unauthorized", "Invalid settings admin token.");
			throw error;
		}
	}

	/** Authorizes, then runs `fn`, answering validation failures as `{ errors: [{ path, message }] }`. */
	private async handle<T>(request: FastifyRequest, body: unknown, fn: (actor: Actor) => Promise<T>): Promise<T> {
		const actor = await this.actorOf(request);
		try {
			if (body !== undefined && body !== null && !isObject(body)) throw new SettingsValidationError([{ path: [], message: "The body must be a JSON object." }]);
			return await fn(actor);
		} catch (error) {
			if (error instanceof SettingsValidationError) throw new HttpException({ errors: error.errors }, 422);
			if (error instanceof TestRateLimitedError) throw new HttpException({ errors: [{ path: [], message: error.message }] }, 429);
			throw error;
		}
	}

	@Get()
	view(@Req() request: FastifyRequest) {
		return this.handle(request, undefined, () => this.admin.view());
	}

	@Get("history")
	history(@Req() request: FastifyRequest, @Query() query: Record<string, unknown>) {
		return this.handle(request, undefined, () => this.admin.history({ area: query.area || undefined, limit: query.limit || undefined }));
	}

	@Post("history/:id/restore")
	@HttpCode(200)
	restore(@Req() request: FastifyRequest, @Param("id") id: string) {
		return this.handle(request, undefined, (actor) => this.admin.restore(id, actor));
	}

	@Put("providers/:id")
	setProvider(@Req() request: FastifyRequest, @Param("id") id: string, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.setProvider(id, body, actor));
	}

	@Put("providers/:id/key")
	setKey(@Req() request: FastifyRequest, @Param("id") id: string, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.setKey(id, body, actor));
	}

	@Delete("providers/:id/key")
	deleteKey(@Req() request: FastifyRequest, @Param("id") id: string) {
		return this.handle(request, undefined, (actor) => this.admin.deleteKey(id, actor));
	}

	@Post("providers/:id/test")
	@HttpCode(200)
	test(@Req() request: FastifyRequest, @Param("id") id: string, @Body() body: unknown) {
		return this.handle(request, body, () => this.admin.test(id, body));
	}

	@Post("endpoints")
	@HttpCode(200)
	createEndpoint(@Req() request: FastifyRequest, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.createEndpoint(body, actor));
	}

	@Delete("endpoints/:name")
	deleteEndpoint(@Req() request: FastifyRequest, @Param("name") name: string) {
		return this.handle(request, undefined, (actor) => this.admin.deleteEndpoint(name, actor));
	}

	@Put("gateway")
	setGateway(@Req() request: FastifyRequest, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.setGateway(body, actor));
	}

	@Put("routing")
	setRouting(@Req() request: FastifyRequest, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.setRouting(body, actor));
	}

	@Put("tasks")
	setTasks(@Req() request: FastifyRequest, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.setTasks(body, actor));
	}

	@Put("runtime")
	setRuntime(@Req() request: FastifyRequest, @Body() body: unknown) {
		return this.handle(request, body, (actor) => this.admin.setRuntime(body, actor));
	}
}
