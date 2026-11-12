import { Global, Module } from "@nestjs/common";
import { type Env, parseEnv } from "./env";

export const ENV = Symbol("AI_PLATFORM_ENV");

@Global()
@Module({
	providers: [{ provide: ENV, useFactory: (): Env => parseEnv(process.env) }],
	exports: [ENV],
})
export class ConfigModule {}
