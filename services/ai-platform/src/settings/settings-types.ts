/** Wire types of the internal admin API (the contract with prime-web; see plans/261030-1000-studio-ai-providers/plan.md). */
export type Source = "studio" | "env" | "default" | "none";
export type TierName = "fast" | "balanced" | "quality";
export type RoutingKey = TierName | "image";
export const TIER_NAMES: readonly TierName[] = ["fast", "balanced", "quality"];
export const ROUTING_KEYS: readonly RoutingKey[] = ["fast", "balanced", "quality", "image"];

export type RuntimeKey =
	| "runsPerDayPerShop"
	| "tasksPerDayPerShop"
	| "runsPerMinutePerUser"
	| "maxRunningPerUser"
	| "maxRunningPerShop"
	| "queueMaxWaitMs"
	| "modelTimeoutMs"
	| "runBudgetMs"
	| "threadRetentionDays"
	| "suggestMode"
	| "toolRouting"
	| "logRequests";
export type RuntimeValue = number | string | boolean;

export interface TestResult {
	ok: boolean;
	at: string;
	ms: number | null;
	model: string;
	code: "ok" | "invalid-key" | "quota" | "timeout" | "not-found" | "error";
	message: string;
	/** model ids an OpenAI-compatible endpoint listed at its /models (so self-hosted models can be picked in Routing) */
	models?: string[];
}

export type HistoryArea = "providers" | "keys" | "endpoints" | "gateway" | "routing" | "tasks" | "runtime" | "restore";
export const HISTORY_AREAS: readonly HistoryArea[] = ["providers", "keys", "endpoints", "gateway", "routing", "tasks", "runtime", "restore"];

export interface Actor {
	id: string;
	email: string;
}

export interface HistoryEntry {
	id: string;
	at: string;
	actor: Actor;
	area: HistoryArea;
	summary: string;
	restorable: boolean;
}

export type SkipReason = "disabled" | "no-key" | "needs-reentry" | "last-test-failed" | "unknown-provider";

export interface ProviderView {
	id: string;
	label: string;
	kind: "builtin" | "compat";
	enabled: boolean;
	enabledSource: Source;
	key: { state: "set" | "env" | "none" | "needs-reentry"; last4: string | null; setBy: string | null; setAt: string | null };
	baseUrl: string | null;
	baseUrlSource: Source;
	defaultBaseUrl: string | null;
	options: { reasoning?: boolean; structuredOutputs?: boolean };
	lastTest: TestResult | null;
	models: string[];
}

export interface TierView {
	chain: string[];
	chainSource: Source;
	effort: string | null;
	effortSource: Source;
	timeoutMs: number;
	timeoutSource: Source;
}

export interface ImageTierView {
	chain: string[];
	chainSource: Source;
	timeoutMs: number;
	timeoutSource: Source;
	format: string | null;
	formatSource: Source;
}

export interface HealthView {
	serving: string | null;
	state: "first-choice" | "fallback" | "down";
	skipped: Array<{ model: string; reason: SkipReason }>;
}

export interface RuntimeRowView {
	key: RuntimeKey;
	label: string;
	help: string;
	type: "int" | "enum" | "bool";
	min?: number;
	max?: number;
	options?: string[];
	value: RuntimeValue;
	source: Source;
	default: RuntimeValue;
	envName: string;
}

export interface SettingsView {
	updatedAt: string | null;
	providers: ProviderView[];
	gateway: { baseUrl: string | null; tokenSet: boolean; paths: Record<string, string>; source: Source };
	routing: { tiers: Record<TierName, TierView> & { image: ImageTierView } };
	health: Record<RoutingKey, HealthView>;
	tasks: Array<{ id: string; group: string; label: string; defaultTier: string; override: string | null }>;
	runtime: RuntimeRowView[];
}
