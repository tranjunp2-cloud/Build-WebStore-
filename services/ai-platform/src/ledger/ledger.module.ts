import { Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { DrizzleBatterySource, ORG_BATTERY, OrgBattery } from "../cost/org-battery";
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
		{
			// today's spend vs AI_DAILY_BUDGET_USD, before a run or task starts (one cached sum per instance)
			provide: SPEND_GUARD,
			inject: [ENV, USAGE_LEDGER],
			useFactory: (env: Env, ledger: DrizzleUsageLedger) =>
				new SpendGuard(env.AI_DAILY_BUDGET_USD, (since) =>
					ledger.costSinceMicros(since),
				),
		},
	],
	exports: [USAGE_LEDGER, SPEND_GUARD, ORG_BATTERY, UsageQuotaService],
})
export class LedgerModule {}
