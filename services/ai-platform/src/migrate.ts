import { Pool } from "pg";
import { loadLocalEnvFiles, parseEnv } from "./config/env";
import { runMigrations } from "./database/migrations";

loadLocalEnvFiles();
const env = parseEnv(process.env);
const pool = new Pool({ connectionString: env.AI_PLATFORM_DATABASE_URL, max: 1 });
runMigrations(pool, (line) => console.log(line))
	.then(() => console.log("[ai-platform] migrations up to date"))
	.catch((error: unknown) => {
		console.error("[ai-platform] migration failed", error);
		process.exitCode = 1;
	})
	.finally(() => pool.end());
