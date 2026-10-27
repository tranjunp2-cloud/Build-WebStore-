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
