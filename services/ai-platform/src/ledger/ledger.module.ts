import { Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { SPEND_GUARD, SpendGuard } from "../cost/spend-guard";
import { DrizzleUsageLedger, USAGE_LEDGER } from "./usage-ledger";

@Module({
	providers: [
		{ provide: USAGE_LEDGER, useClass: DrizzleUsageLedger },
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
	exports: [USAGE_LEDGER, SPEND_GUARD],
})
export class LedgerModule {}
