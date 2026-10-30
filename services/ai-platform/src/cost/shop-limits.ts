import { AgentError } from "../agent/agent-errors";
import type { AiRequestContext } from "../auth/context-token";
import type { Env } from "../config/env";

/** The shop's AI battery allowance in USD micros: its plan's (token `lim`), else the env fallback. null = unlimited. */
export function aiBudgetMicros(ctx: Pick<AiRequestContext, "limits">, env: Pick<Env, "AI_DAILY_BUDGET_USD_PER_ORG">): number | null {
	const usd = ctx.limits ? ctx.limits.aiBudgetUsd : env.AI_DAILY_BUDGET_USD_PER_ORG;
	return usd === null ? null : Math.round(usd * 1_000_000);
}

/** Pictures per rolling day: the shop's plan, else the env fallback. null = unlimited. */
export function picturesPerDay(ctx: Pick<AiRequestContext, "limits">, env: Pick<Env, "AI_DAILY_IMAGE_LIMIT_PER_ORG">): number | null {
	return ctx.limits ? ctx.limits.picturesPerDay : env.AI_DAILY_IMAGE_LIMIT_PER_ORG;
}

export const AI_DISABLED_MESSAGE = "AI is not included in this shop's plan.";
/** A super-admin blocked this one shop (lim.source "shop"): not a plan matter, so upgrading would not help. */
export const AI_BLOCKED_MESSAGE = "AI is turned off for this shop. Contact support if you need it back.";

/** Throws 403 when the shop's plan (or a block on the shop) switched AI off. Pure: nothing is read or reserved. Old tokens (no `enabled`) pass. */
export function assertAiEnabled(ctx: Pick<AiRequestContext, "limits">): void {
	if (ctx.limits?.enabled === false) throw new AgentError(ctx.limits.source === "shop" ? AI_BLOCKED_MESSAGE : AI_DISABLED_MESSAGE, 403);
}

/** The plan code from the token, for the platform's "pause Free first" rule. */
export function planOf(ctx: Pick<AiRequestContext, "limits">): string | null {
	return ctx.limits?.plan ?? null;
}

/** USD to micros; null/undefined = unlimited. */
export function usdToMicros(usd: number | null | undefined): number | null {
	return usd === null || usd === undefined ? null : Math.round(usd * 1_000_000);
}

/** The shop's calendar-month allowance in USD micros (token `lim.aiBudgetUsdMonthly`); null = unlimited. */
export function monthlyBudgetMicros(ctx: Pick<AiRequestContext, "limits">): number | null {
	return usdToMicros(ctx.limits?.aiBudgetUsdMonthly);
}

/** The shop's website-setup allowance over the rolling 24 h in USD micros (token `lim.siteBudgetUsd`); null = unlimited. */
export function siteBudgetMicros(ctx: Pick<AiRequestContext, "limits">): number | null {
	return usdToMicros(ctx.limits?.siteBudgetUsd);
}

/** Tasks counted against the website-setup budget. */
export const SITE_TASK_PREFIX = "sitegen.";
