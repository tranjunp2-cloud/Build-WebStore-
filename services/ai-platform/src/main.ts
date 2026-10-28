import type { Pool } from "pg";
import { createApp } from "./bootstrap";
import { loadLocalEnvFiles, parseEnv } from "./config/env";
import { PG_POOL } from "./database/database.module";
import { runMigrations } from "./database/migrations";

async function bootstrap(): Promise<void> {
	loadLocalEnvFiles();
	const env = parseEnv(process.env);
	const app = await createApp();
	if (env.NODE_ENV !== "production") {
		// Local/dev convenience; production runs `db:migrate` as a release step.
		await runMigrations(app.get<Pool>(PG_POOL), (line) => console.log(line));
	}
	await app.listen({ port: env.PORT, host: "0.0.0.0" });
	console.log(`[ai-platform] listening on :${env.PORT}`);
}

bootstrap().catch((error: unknown) => {
	console.error("[ai-platform] failed to start", error);
	process.exit(1);
});
