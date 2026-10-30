import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../app.module";
import { ContextGuard } from "../auth/context.guard";
import { DecisionService } from "../decide/decision.service";
import { ImageService } from "../images/image.service";
import { MODEL_REGISTRY } from "../models/models.module";
import { createAdapter } from "../http-setup";
import { TaskEngine } from "../tasks/task-engine.service";
import { AgentRunService } from "../agent/agent-run.service";
import { AgentThreadService } from "../agent/agent-thread.service";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

// TC-AIPROV-17 — the real module graph resolves SettingsService into every consumer (Nest drops an @Optional dependency it cannot resolve without a word).

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	await app?.close();
	app = undefined;
	vi.unstubAllEnvs();
});

describe("module wiring [TC-AIPROV-17]", () => {
	it("TC-AIPROV-17: every consumer holds the one SettingsService, and the admin controller is mounted", async () => {
		// Arrange
		vi.stubEnv("AI_PLATFORM_DATABASE_URL", "postgres://u:p@127.0.0.1:1/none");
		vi.stubEnv("AI_PLATFORM_CONTEXT_SECRET", "test-context-secret-at-least-32-characters");
		vi.stubEnv("PRIME_WEB_INTERNAL_URL", "");
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);

		// Act
		app = await NestFactory.create<NestFastifyApplication>(AppModule, createAdapter(), { logger: false });
		const settings = app.get(SettingsService);

		// Assert (a failed database read at boot only keeps the empty copy)
		for (const consumer of [TaskEngine, ImageService, AgentRunService, AgentThreadService, DecisionService, ContextGuard]) {
			expect((app.get(consumer, { strict: false }) as unknown as { settings?: unknown }).settings).toBe(settings);
		}
		expect(app.get(SettingsController, { strict: false })).toBeTruthy();
		expect(app.get(MODEL_REGISTRY)).toBeTruthy();
	});
});
