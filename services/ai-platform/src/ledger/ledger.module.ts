import { Module } from "@nestjs/common";
import { AiConfigService } from "../ai-config/ai-config.service";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { DrizzleBatterySource, ORG_BATTERY, OrgBattery } from "../cost/org-battery";
import { DrizzleShopCapsSource, SHOP_CAPS, ShopCaps } from "../cost/shop-caps";
import { SPEND_GUARD, SpendGuard } from "../cost/spend-guard";
import { UsageEventsController } from "./usage-events.controller";
import { DrizzleUsageLedger, USAGE_LEDGER } from "./usage-ledger";
import { DrizzleUsageMeters, USAGE_METERS, UsageQuotaService } from "./usage-quota";

@Module({
	controllers: [UsageEventsController],
	providers: [
		{ provide: USAGE_LEDGER, useClass: DrizzleUsageLedger },
		{ provide: USAGE_METERS, useClass: DrizzleUsageMeters },
		UsageQuotaService,
		DrizzleBatterySource,
		{
			// one shop's AI spend over the last 24 h (cached 30 s per org; the budget comes per call from the shop's plan)
			provide: ORG_BATTERY,
			inject: [DrizzleBatterySource],
			useFactory: (source: DrizzleBatterySource) => new OrgBattery(source),
		},
		DrizzleShopCapsSource,
		{
			// one shop's calendar-month allowance and website-setup allowance (cached 30 s per org and window)
			provide: SHOP_CAPS,
			inject: [DrizzleShopCapsSource],
			useFactory: (source: DrizzleShopCapsSource) => new ShopCaps(source),
		},
		{
			// the platform's daily / monthly caps (Payload's, else AI_DAILY_BUDGET_USD) before a run, task or picture starts (one cached sum per instance and window)
			provide: SPEND_GUARD,
			inject: [ENV, USAGE_LEDGER, AiConfigService],
			useFactory: (env: Env, ledger: DrizzleUsageLedger, config: AiConfigService) =>
				new SpendGuard(env.AI_DAILY_BUDGET_USD, (since) => ledger.costSinceMicros(since), Date.now, () => config.caps()),
		},
	],
	exports: [USAGE_LEDGER, SPEND_GUARD, ORG_BATTERY, SHOP_CAPS, UsageQuotaService],
})
export class LedgerModule {}
