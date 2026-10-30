import { Global, Module } from "@nestjs/common";
import { AiConfigService } from "../ai-config/ai-config.service";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { SettingsService } from "../settings/settings.service";
import { createModelRegistry } from "./model-registry";

export const MODEL_REGISTRY = Symbol("AI_PLATFORM_MODEL_REGISTRY");

@Global()
@Module({
	providers: [
		{ provide: AiConfigService, inject: [ENV], useFactory: (env: Env) => new AiConfigService(env) },
		{
			provide: MODEL_REGISTRY,
			inject: [ENV, AiConfigService, SettingsService],
			useFactory: (env: Env, config: AiConfigService, settings: SettingsService) => createModelRegistry(env, process.env, config, settings),
		},
	],
	exports: [MODEL_REGISTRY, AiConfigService],
})
export class ModelsModule {}
