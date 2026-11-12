import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
import { dbPoolMax } from "./limits";

const required = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
};

describe("ai-platform env defaults (only secrets need setting)", () => {
	it("[TC-AIEFF-11] limits, logging and the spend cap default to the staging values", () => {
		// Act
		const env = parseEnv(required);

		// Assert
		expect(env.AI_DAILY_RUN_LIMIT_PER_ORG).toBe(200);
		expect(env.AI_DAILY_TASK_LIMIT_PER_ORG).toBe(1_000);
		expect(env.AI_DAILY_IMAGE_LIMIT_PER_ORG).toBe(20);
		expect(env.AI_LOG_REQUESTS).toBe("all");
		expect(env.AI_DAILY_BUDGET_USD).toBe(20);
		expect(dbPoolMax({ ...env, VERCEL: "1" })).toBe(3);
	});

	it("[TC-AIEFF-12] AI_DAILY_BUDGET_USD=0 turns the spend cap off; a value still overrides", () => {
		expect(parseEnv({ ...required, AI_DAILY_BUDGET_USD: "0" }).AI_DAILY_BUDGET_USD).toBeUndefined();
		expect(parseEnv({ ...required, AI_DAILY_BUDGET_USD: "150" }).AI_DAILY_BUDGET_USD).toBe(150);
		expect(() => parseEnv({ ...required, AI_DAILY_BUDGET_USD: "-1" })).toThrow(/AI_DAILY_BUDGET_USD/);
	});
});
