import { type Env, parseEnv } from "../config/env";
import type { RuntimeKey, RuntimeValue } from "./settings-types";

/** The longest a whole copilot request may take (Vercel maxDuration 300 s, with room to save): queue wait + run budget. */
export const REQUEST_BUDGET_MS = 290_000;

/** The env names the runtime knobs map onto; services read the effective values under these names. */
export type RuntimeEnv = Pick<
	Env,
	| "AI_DAILY_RUN_LIMIT_PER_ORG"
	| "AI_DAILY_TASK_LIMIT_PER_ORG"
	| "AI_RUNS_PER_MINUTE_PER_USER"
	| "AI_MAX_RUNNING_RUNS_PER_USER"
	| "AI_MAX_RUNNING_RUNS_PER_ORG"
	| "AI_QUEUE_MAX_WAIT_MS"
	| "AI_MODEL_TIMEOUT_MS"
	| "AI_RUN_BUDGET_MS"
	| "AI_THREAD_RETENTION_DAYS"
	| "AI_SUGGEST_MODE"
	| "AI_TOOL_ROUTING"
	| "AI_LOG_REQUESTS"
>;

export interface RuntimeDef {
	key: RuntimeKey;
	envName: keyof RuntimeEnv;
	label: string;
	help: string;
	type: "int" | "enum" | "bool";
	min?: number;
	max?: number;
	options?: string[];
}

export const RUNTIME_DEFS: readonly RuntimeDef[] = [
	{ key: "runsPerDayPerShop", envName: "AI_DAILY_RUN_LIMIT_PER_ORG", label: "Copilot runs per shop per day", help: "Abuse safety cap on copilot starts per shop per day. The shop's AI budget normally binds first. 0 blocks every run.", type: "int", min: 0, max: 1_000_000 },
	{ key: "tasksPerDayPerShop", envName: "AI_DAILY_TASK_LIMIT_PER_ORG", label: "AI tasks per shop per day", help: "Abuse safety cap on one-shot task calls (descriptions, translation, SEO) per shop per day.", type: "int", min: 0, max: 1_000_000 },
	{ key: "runsPerMinutePerUser", envName: "AI_RUNS_PER_MINUTE_PER_USER", label: "Copilot runs per person per minute", help: "How many copilot messages one person can start in a minute.", type: "int", min: 0, max: 1_000 },
	{ key: "maxRunningPerUser", envName: "AI_MAX_RUNNING_RUNS_PER_USER", label: "Runs working at once per person", help: "More wait in the queue. 0 = no cap.", type: "int", min: 0, max: 100 },
	{ key: "maxRunningPerShop", envName: "AI_MAX_RUNNING_RUNS_PER_ORG", label: "Runs working at once per shop", help: "More wait in the queue (first come, first served). 0 = no cap.", type: "int", min: 0, max: 100 },
	{ key: "queueMaxWaitMs", envName: "AI_QUEUE_MAX_WAIT_MS", label: "Longest queue wait (ms)", help: "A queued run gives up after this. Queue wait plus the run budget must stay within 290 000 ms.", type: "int", min: 0, max: REQUEST_BUDGET_MS },
	{ key: "modelTimeoutMs", envName: "AI_MODEL_TIMEOUT_MS", label: "Model timeout (ms)", help: "How long one model call may take before the next model in the chain is tried. A tier can set its own under Routing.", type: "int", min: 5_000, max: 300_000 },
	{ key: "runBudgetMs", envName: "AI_RUN_BUDGET_MS", label: "Copilot run budget (ms)", help: "Model time of one copilot request. Queue wait plus this must stay within 290 000 ms.", type: "int", min: 30_000, max: REQUEST_BUDGET_MS },
	{ key: "threadRetentionDays", envName: "AI_THREAD_RETENTION_DAYS", label: "Chat retention (days)", help: "Copilot chats are deleted this long after their last activity.", type: "int", min: 1, max: 3_650 },
	{ key: "suggestMode", envName: "AI_SUGGEST_MODE", label: "Next-message suggestions", help: "rules = from what the run did (a tiny model call only when no rule fits); model = always call the model; off.", type: "enum", options: ["rules", "model", "off"] },
	{ key: "toolRouting", envName: "AI_TOOL_ROUTING", label: "Tool routing", help: "On sends the copilot only the tool groups a message needs; off sends every tool.", type: "bool" },
	{ key: "logRequests", envName: "AI_LOG_REQUESTS", label: "Request logging", help: "all = one log line per request; default = only failures and requests over 2 s.", type: "enum", options: ["default", "all"] },
];

export function runtimeDef(key: string): RuntimeDef | undefined {
	return RUNTIME_DEFS.find((def) => def.key === key);
}

/** Code defaults = what the env schema yields with nothing set (single source of truth). */
const DEFAULT_ENV: Env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://defaults/none", AI_PLATFORM_CONTEXT_SECRET: "x".repeat(32) });

/** An env/default value as the knob's own type (tool routing: on/off -> boolean). */
export function fromEnvValue(def: RuntimeDef, value: unknown): RuntimeValue {
	if (def.type === "bool") return value === "on" || value === true;
	return value as RuntimeValue;
}

export function toEnvValue(def: RuntimeDef, value: RuntimeValue): unknown {
	return def.type === "bool" ? (value ? "on" : "off") : value;
}

export function defaultRuntimeValue(def: RuntimeDef): RuntimeValue {
	return fromEnvValue(def, DEFAULT_ENV[def.envName]);
}

/** null when `value` is valid for the knob, else why not. */
export function runtimeValueError(def: RuntimeDef, value: unknown): string | null {
	if (def.type === "bool") return typeof value === "boolean" ? null : "must be true or false";
	if (def.type === "enum") return typeof value === "string" && def.options?.includes(value) ? null : `must be one of ${def.options?.join(", ")}`;
	if (typeof value !== "number" || !Number.isInteger(value)) return "must be a whole number";
	if (def.min !== undefined && value < def.min) return `must be at least ${def.min}`;
	if (def.max !== undefined && value > def.max) return `must be at most ${def.max}`;
	return null;
}
