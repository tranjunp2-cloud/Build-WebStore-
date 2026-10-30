import { Global, Module } from "@nestjs/common";
import { AiConfigService } from "../ai-config/ai-config.service";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { DrizzleSettingsStore } from "./drizzle-settings-store";
import { ProviderTester } from "./provider-tester";
import { SettingsAdminService } from "./settings-admin.service";
import { SETTINGS_STORE, type SettingsStore } from "./settings-store";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

/** Prime Studio's AI settings: the store, the merged read side every other module uses, and the internal admin API. */
@Global()
@Module({
	controllers: [SettingsController],
	providers: [
		{ provide: SETTINGS_STORE, useClass: DrizzleSettingsStore },
		{
			provide: SettingsService,
			inject: [ENV, SETTINGS_STORE, AiConfigService],
			useFactory: (env: Env, store: SettingsStore, config: AiConfigService) => new SettingsService(env, store, config),
		},
		{ provide: ProviderTester, inject: [SettingsService], useFactory: (settings: SettingsService) => new ProviderTester(settings) },
		{
			provide: SettingsAdminService,
			inject: [SettingsService, ProviderTester],
			useFactory: (settings: SettingsService, tester: ProviderTester) => new SettingsAdminService(settings, tester),
		},
	],
	exports: [SettingsService],
})
export class SettingsModule {}
