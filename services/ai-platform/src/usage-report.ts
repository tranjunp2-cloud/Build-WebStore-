import { parseArgs } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadLocalEnvFiles, parseEnv } from "./config/env";
import * as schema from "./database/schema";
import { formatUsageReport, summarizeUsage } from "./ledger/usage-summary";

// `pnpm --filter @ech/ai-platform usage:report [--days 7] [--org <organizationId>]` — read-only.
const { values } = parseArgs({ options: { days: { type: "string", default: "7" }, org: { type: "string" } } });
const days = Number(values.days);
if (!Number.isFinite(days) || days <= 0) {
	console.error("--days must be a positive number");
	process.exit(1);
}

loadLocalEnvFiles();
const env = parseEnv(process.env);
const pool = new Pool({ connectionString: env.AI_PLATFORM_DATABASE_URL, max: 1 });
summarizeUsage(drizzle(pool, { schema }), { days, organizationId: values.org })
	.then((rows) => {
		console.log(`AI usage, last ${days} day(s)${values.org ? ` for ${values.org}` : ""}:\n`);
		console.log(formatUsageReport(rows));
	})
	.catch((error: unknown) => {
		console.error("[ai-platform] usage report failed", error);
		process.exitCode = 1;
	})
	.finally(() => pool.end());
