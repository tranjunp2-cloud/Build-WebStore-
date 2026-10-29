import { Global, Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { createModelRegistry } from "./model-registry";

export const MODEL_REGISTRY = Symbol("AI_PLATFORM_MODEL_REGISTRY");

@Global()
@Module({
	providers: [{ provide: MODEL_REGISTRY, inject: [ENV], useFactory: (env: Env) => createModelRegistry(env) }],
	exports: [MODEL_REGISTRY],
})
export class ModelsModule {}
