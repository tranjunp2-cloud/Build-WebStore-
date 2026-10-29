import { z } from "zod";

/**
 * A per-shop override of the plan's AI limits (collection `ai-shop-limits`, written from Prime Studio).
 * custom: each non-null value replaces the plan's; unlimited: every budget off; blocked: AI is refused for the shop.
 */
export const SHOP_LIMIT_MODES = ["custom", "unlimited", "blocked"] as const;
export type ShopLimitMode = (typeof SHOP_LIMIT_MODES)[number];

const usd = z.number().finite().nonnegative().nullable();

export const ShopLimitInputSchema = z
	.object({
		mode: z.enum(SHOP_LIMIT_MODES),
		/** rolling 24 h; null = keep the plan's */
		aiBudgetUsd: usd.optional(),
		picturesPerDay: z.number().int().nonnegative().nullable().optional(),
		aiBudgetUsdMonthly: usd.optional(),
		siteBudgetUsd: usd.optional(),
		reason: z.string().trim().min(1, "Say why this shop has its own limits.").max(500),
		expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
	})
	.strict();
export type ShopLimitInput = z.infer<typeof ShopLimitInputSchema>;

/** The values a custom override may set. */
export const SHOP_LIMIT_VALUE_KEYS = ["aiBudgetUsd", "picturesPerDay", "aiBudgetUsdMonthly", "siteBudgetUsd"] as const;

/** A sentence for what is wrong with an override beyond its field types, or null. */
export function shopLimitProblem(input: Partial<Record<(typeof SHOP_LIMIT_VALUE_KEYS)[number], number | null | undefined>> & { mode?: unknown }): string | null {
	if (input.mode === "custom" && SHOP_LIMIT_VALUE_KEYS.every((key) => input[key] === null || input[key] === undefined)) {
		return "A custom override needs at least one limit. Leave a field empty to keep the plan's value.";
	}
	return null;
}

/** Values stored for a mode: unlimited and blocked ignore any numbers sent with them. */
export function normalizeShopLimit(input: ShopLimitInput) {
	const keep = input.mode === "custom";
	return {
		mode: input.mode,
		aiBudgetUsd: keep ? (input.aiBudgetUsd ?? null) : null,
		picturesPerDay: keep ? (input.picturesPerDay ?? null) : null,
		aiBudgetUsdMonthly: keep ? (input.aiBudgetUsdMonthly ?? null) : null,
		siteBudgetUsd: keep ? (input.siteBudgetUsd ?? null) : null,
		reason: input.reason.trim(),
		expiresAt: input.expiresAt ?? null,
	};
}
