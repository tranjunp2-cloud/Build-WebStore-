import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { loadLocalEnvFiles, parseEnv } from "./config/env";
import { isVercel } from "./config/limits";
import { configureApp, createAdapter } from "./http-setup";

/** Boots the Nest app on Fastify without listening: `listen()` or the Vercel handler takes it from here. */
export async function createApp(): Promise<NestFastifyApplication> {
	loadLocalEnvFiles();
	const env = parseEnv(process.env);
	const app = await NestFactory.create<NestFastifyApplication>(AppModule, createAdapter(), {
		// route-mapping lines on every cold start are noise in serverless logs
		logger: isVercel(env) ? ["error", "warn"] : ["error", "warn", "log"],
	});
	configureApp(app, env);
	await app.init();
	await app.getHttpAdapter().getInstance().ready();
	return app;
}
