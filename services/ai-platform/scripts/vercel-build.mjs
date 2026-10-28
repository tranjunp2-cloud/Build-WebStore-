// Runs after `tsup` in the Vercel build (`pnpm build:vercel`): applies database migrations
// when the build has a database URL. Builds without one (e.g. a preview with no database)
// still deploy; they just cannot serve requests that need the database.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.env.AI_PLATFORM_DATABASE_URL) {
	console.log("[ai-platform] AI_PLATFORM_DATABASE_URL is not set for this build: skipping migrations");
	process.exit(0);
}

const migrate = fileURLToPath(new URL("../dist/migrate.js", import.meta.url));
const result = spawnSync(process.execPath, [migrate], { stdio: "inherit", env: process.env });
if (result.error) {
	console.error("[ai-platform] could not run migrations", result.error);
	process.exit(1);
}
process.exit(result.status ?? 1);
