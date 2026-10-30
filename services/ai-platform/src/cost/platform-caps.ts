import { z } from "zod";

/**
 * The platform-wide AI caps, owned by prime-web (`ai_platform_config.settings.caps`, served by
 * `GET /api/internal/ai-config`). `dailyUsd`: a number sets the daily cap, `null` turns it off, absent keeps the
 * env default (`AI_DAILY_BUDGET_USD`). `monthlyUsd`: null/absent = no monthly cap. `pauseFreeAtPercent`: at that
 * share of the daily or monthly cap FREEMIUM shops pause first (null/absent = everyone pauses together at 100 %).
 */
export const CapsSchema = z.object({
	dailyUsd: z.number().finite().min(0).nullable().optional(),
	monthlyUsd: z.number().finite().min(0).nullable().optional(),
	alertPercents: z.array(z.number().finite().min(1).max(100)).max(10).optional(),
	pauseFreeAtPercent: z.number().finite().min(1).max(100).nullable().optional(),
});

export interface PlatformCaps {
	/** undefined = env default; null = off */
	dailyUsd: number | null | undefined;
	/** undefined / null = no monthly cap */
	monthlyUsd: number | null | undefined;
	alertPercents: number[];
	pauseFreeAtPercent: number | null;
}

export const DEFAULT_ALERT_PERCENTS = [50, 80, 100];

export function toPlatformCaps(raw: z.infer<typeof CapsSchema>): PlatformCaps {
	return {
		dailyUsd: raw.dailyUsd,
		monthlyUsd: raw.monthlyUsd,
		alertPercents: [...(raw.alertPercents ?? DEFAULT_ALERT_PERCENTS)].sort((a, b) => a - b),
		pauseFreeAtPercent: raw.pauseFreeAtPercent ?? null,
	};
}

/** The plan that is paused first when the platform caps run hot. */
export function isFreePlan(plan: string | null | undefined): boolean {
	return plan?.toUpperCase() === "FREEMIUM";
}
