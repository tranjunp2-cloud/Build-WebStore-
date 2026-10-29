import "reflect-metadata";
import { type Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { parseEnv } from "../config/env";
import { configureApp, createAdapter } from "../http-setup";

export function testEnv(overrides: Record<string, string> = {}) {
	return parseEnv({
		AI_PLATFORM_DATABASE_URL: "postgres://x/y",
		AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
		...overrides,
	});
}

/** A Nest app on the same Fastify setup as production (parsers, limits), without the database. */
export async function startTestApp(module: Type, env = testEnv()): Promise<NestFastifyApplication> {
	const app = await NestFactory.create<NestFastifyApplication>(module, createAdapter(), { logger: false });
	configureApp(app, env);
	await app.init();
	await app.getHttpAdapter().getInstance().ready();
	return app;
}
