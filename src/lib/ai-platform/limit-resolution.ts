import type { PlanCode } from "@/collections/PlanSubscriptions";
import {
	AI_BUDGET_FEATURE,
	AI_BUDGET_MONTHLY_FEATURE,
	AI_ENABLED_FEATURE,
	AI_PICTURES_FEATURE,
	AI_SITE_BUDGET_FEATURE,
} from "./ai-config-schema";
import type { ShopLimitMode } from "./shop-limit-schema";

/**
 * What a shop may spend on AI; null = unlimited. Sent to ai-platform as the `lim` token claim.
 * Pure resolution lives here (no server imports) so the token path, Studio and the alert job share one rule.
 */
export interface AiLimits {
	plan: string;
	/** AI battery: USD per rolling 24 h for chat + writing tools */
	aiBudgetUsd: number | null;
	/** AI pictures per rolling 24 h */
	picturesPerDay: number | null;
	/** false → ai-platform refuses every AI call for the shop */
	enabled: boolean;
	/** USD per calendar month (Malaysia time) */
	aiBudgetUsdMonthly: number | null;
	/** USD per rolling 24 h for website-setup tasks (`sitegen.*`) */
	siteBudgetUsd: number | null;
	/** "shop" when an active shop override applied */
	source: "plan" | "shop";
}

/** Used when a plan has no feature row (never unlimited by accident). Same numbers the db-setup seed inserts. */
export const DEFAULT_AI_LIMITS: Readonly<Record<PlanCode, { aiBudgetUsd: number; picturesPerDay: number }>> = {
	FREEMIUM: { aiBudgetUsd: 0.05, picturesPerDay: 1 },
	STARTER_TM_USER: { aiBudgetUsd: 0.15, picturesPerDay: 3 },
	STARTER_NON_TM_USER: { aiBudgetUsd: 0.15, picturesPerDay: 3 },
	STANDARD_TM_USER: { aiBudgetUsd: 0.4, picturesPerDay: 8 },
	STANDARD_NON_TM_USER: { aiBudgetUsd: 0.4, picturesPerDay: 8 },
	PROFESSIONAL_TM_USER: { aiBudgetUsd: 0.9, picturesPerDay: 20 },
	PROFESSIONAL_NON_TM_USER: { aiBudgetUsd: 0.9, picturesPerDay: 20 },
};

/**
 * One feature value → a limit. undefined = row missing or unreadable (caller uses the default);
 * null = unlimited. YES counts as unlimited, as it does for the numeric staff_limit / template_limit features.
 */
export function parseLimit(raw: unknown, integer: boolean): number | null | undefined {
	if (typeof raw !== "string") return undefined;
	const text = raw.trim();
	if (!text) return undefined;
	const upper = text.toUpperCase();
	if (upper === "UNLIMITED" || upper === "YES") return null;
	const value = Number(text);
	if (!Number.isFinite(value) || value < 0) return undefined;
	return integer ? Math.floor(value) : value;
}

/** The stored fields of an `ai-shop-limits` row the resolver needs (numbers already parsed, expiry as a Date or null). */
export interface ShopOverride {
	mode: ShopLimitMode;
	aiBudgetUsd: number | null;
	picturesPerDay: number | null;
	aiBudgetUsdMonthly: number | null;
	siteBudgetUsd: number | null;
	expiresAt: Date | null;
}

/** An expired override is ignored. */
export const isOverrideActive = (override: Pick<ShopOverride, "expiresAt">, now: number): boolean =>
	!override.expiresAt || override.expiresAt.getTime() > now;

/** A numeric DB / form value as number | null (null for empty, non-finite or negative). */
export function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Plan rows (feature code → stored text) and an optional shop override → the shop's limits.
 * - plan: missing / unreadable budget or pictures → the plan default; missing new budgets → unlimited; missing ai_enabled → on.
 * - shop override (active only): custom replaces each value it sets (and turns AI on: it is an explicit grant),
 *   unlimited → every budget off and AI on, blocked → AI off (the budgets stay as the plan's).
 */
export function resolveAiLimits(input: {
	plan: PlanCode;
	values: Readonly<Partial<Record<string, string | null | undefined>>>;
	override?: ShopOverride | null;
	now?: number;
}): AiLimits {
	const { plan, values } = input;
	const defaults = DEFAULT_AI_LIMITS[plan];
	const budget = parseLimit(values[AI_BUDGET_FEATURE], false);
	const pictures = parseLimit(values[AI_PICTURES_FEATURE], true);
	const monthly = parseLimit(values[AI_BUDGET_MONTHLY_FEATURE], false);
	const site = parseLimit(values[AI_SITE_BUDGET_FEATURE], false);
	const limits: AiLimits = {
		plan,
		aiBudgetUsd: budget === undefined ? defaults.aiBudgetUsd : budget,
		picturesPerDay: pictures === undefined ? defaults.picturesPerDay : pictures,
		enabled: String(values[AI_ENABLED_FEATURE] ?? "").trim().toUpperCase() !== "NO",
		aiBudgetUsdMonthly: monthly === undefined ? null : monthly,
		siteBudgetUsd: site === undefined ? null : site,
		source: "plan",
	};
	const override = input.override;
	if (!override || !isOverrideActive(override, input.now ?? Date.now())) return limits;
	if (override.mode === "blocked") return { ...limits, enabled: false, source: "shop" };
	if (override.mode === "unlimited") {
		return { ...limits, enabled: true, aiBudgetUsd: null, picturesPerDay: null, aiBudgetUsdMonthly: null, siteBudgetUsd: null, source: "shop" };
	}
	return {
		...limits,
		enabled: true,
		aiBudgetUsd: override.aiBudgetUsd ?? limits.aiBudgetUsd,
		picturesPerDay: override.picturesPerDay === null ? limits.picturesPerDay : Math.floor(override.picturesPerDay),
		aiBudgetUsdMonthly: override.aiBudgetUsdMonthly ?? limits.aiBudgetUsdMonthly,
		siteBudgetUsd: override.siteBudgetUsd ?? limits.siteBudgetUsd,
		source: "shop",
	};
}

/** A stored `ai-shop-limits` row (Payload doc or SQL row, camelCase) → the resolver's shape; null when the mode is unreadable. */
export function toShopOverride(row: Record<string, unknown>): ShopOverride | null {
	const mode = row.mode;
	if (mode !== "custom" && mode !== "unlimited" && mode !== "blocked") return null;
	const expires = row.expiresAt ? new Date(String(row.expiresAt)) : null;
	return {
		mode,
		aiBudgetUsd: toNullableNumber(row.aiBudgetUsd),
		picturesPerDay: toNullableNumber(row.picturesPerDay),
		aiBudgetUsdMonthly: toNullableNumber(row.aiBudgetUsdMonthly),
		siteBudgetUsd: toNullableNumber(row.siteBudgetUsd),
		// an unparseable date must not turn into a forever-active override: treat it as expired
		expiresAt: expires && Number.isNaN(expires.getTime()) ? new Date(0) : expires,
	};
}
