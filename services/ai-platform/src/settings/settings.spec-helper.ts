import { parseEnv } from "../config/env";
import { ProviderTester, type TesterDeps } from "./provider-tester";
import { SettingsAdminService } from "./settings-admin.service";
import { InMemorySettingsStore } from "./settings-store";
import { SettingsService } from "./settings.service";

export const BASE_VARS = {
	AI_PLATFORM_DATABASE_URL: "postgres://x/y",
	AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters",
};

export const ACTOR = { id: "usr_admin", email: "admin@example.com" };

/** Settings over an in-memory store, with a fixed clock and sequential history ids. */
export async function makeSettings(options: { vars?: Record<string, string>; models?: Partial<Record<"fast" | "balanced" | "quality" | "image", string>>; tester?: TesterDeps } = {}) {
	const vars = { ...BASE_VARS, ...options.vars };
	const env = parseEnv(vars);
	const store = new InMemorySettingsStore();
	const clock = { now: Date.UTC(2026, 9, 30, 10, 0, 0) };
	const config = { models: () => options.models ?? {} };
	const settings = new SettingsService(env, store, config, vars, () => clock.now);
	const tester = new ProviderTester(settings, { clock: () => clock.now, ...options.tester });
	let counter = 0;
	const admin = new SettingsAdminService(settings, tester, () => clock.now, () => `h${++counter}`);
	await settings.reload();
	return { vars, env, store, settings, admin, clock, tester };
}
