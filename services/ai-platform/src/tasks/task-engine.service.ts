import { randomUUID } from "node:crypto";
import { AI_TASKS, type AiTaskId, isAiTaskId, type RunTaskResponse } from "@ech/ai-contracts";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { generateText, type ModelMessage, NoObjectGeneratedError, Output } from "ai";
import type { ZodType } from "zod";
import { AgentError } from "../agent/agent-errors";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { ORG_BATTERY, type OrgBattery } from "../cost/org-battery";
import { SHOP_CAPS, type ShopCaps } from "../cost/shop-caps";
import { aiBudgetMicros, assertAiEnabled, planOf } from "../cost/shop-limits";
import { SPEND_GUARD, type SpendGuard } from "../cost/spend-guard";
import { estimateCostMicros } from "../ledger/price-book";
import { errorUsage, tokenUsageOf } from "../ledger/sdk-usage";
import { USAGE_LEDGER, type UsageLedger } from "../ledger/usage-ledger";
import { isProviderBillingError, isProviderRateLimitError, PROVIDER_RATE_LIMITED, runWithFallback } from "../models/fallback";
import type { ModelRegistry } from "../models/model-registry";
import { MODEL_REGISTRY } from "../models/models.module";
import { cacheableInstructions } from "../models/prompt-cache";
import { SettingsService } from "../settings/settings.service";
import { TASK_DEFINITIONS } from "./catalog";
import type { TaskDefinition } from "./task-definition";

/**
 * Whole-chain budget for tasks that declare no `deadlineMs`. The shared task client gives up at 90 s;
 * stacking a per-attempt timeout on every provider of the alias chain (60 s default × 2–3) would blow
 * past it and leave the caller with a timeout instead of an answer or a clean fallback. A task whose
 * per-attempt timeout is longer on purpose (batch migration) is exempt: it is bounded by its own caller.
 */
export const DEFAULT_CHAIN_DEADLINE_MS = 75_000;

export function chainBudgetFor(definition: Pick<TaskDefinition, "deadlineMs" | "timeoutMs">): number | undefined {
	if (definition.deadlineMs) return definition.deadlineMs;
	return (definition.timeoutMs ?? 0) >= DEFAULT_CHAIN_DEADLINE_MS ? undefined : DEFAULT_CHAIN_DEADLINE_MS;
}

/** Below this much budget left, another provider attempt cannot finish. */
const MIN_ATTEMPT_MS = 2_000;

/**
 * One door for single-shot AI work (descriptions, translation, SEO…):
 * validate input against the shared contract → quota → alias chain with
 * provider fallback → structured output → ledger for every attempt.
 */
@Injectable()
export class TaskEngine {
	constructor(
		@Inject(MODEL_REGISTRY) private readonly models: ModelRegistry,
		@Inject(USAGE_LEDGER) private readonly ledger: UsageLedger,
		@Inject(ENV) private readonly env: Env,
		@Optional() @Inject(SPEND_GUARD) private readonly spend?: SpendGuard,
		@Optional() @Inject(ORG_BATTERY) private readonly battery?: OrgBattery,
		@Optional() @Inject(SHOP_CAPS) private readonly shopCaps?: ShopCaps,
		// Prime Studio: task -> tier overrides, tier timeouts, runtime knobs; absent = catalog tiers and env
		@Optional() @Inject(SettingsService) private readonly settings?: SettingsService,
	) {}

	async run(ctx: AiRequestContext, taskId: string, rawInput: unknown, requestId?: string): Promise<RunTaskResponse> {
		if (!isAiTaskId(taskId)) throw new AgentError(`Unknown AI task "${taskId}".`, 404);
		const contract = AI_TASKS[taskId];
		const parsed = contract.input.safeParse(rawInput);
		if (!parsed.success) {
			throw new AgentError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
		}
		await this.assertQuota(ctx, taskId);

		const definition = TASK_DEFINITIONS[taskId as AiTaskId] as (typeof TASK_DEFINITIONS)[AiTaskId];
		const input = parsed.data as never;
		// the tier a Studio override moved the task to, else the catalog's
		const alias = this.settings?.taskTier(taskId, definition.alias) ?? definition.alias;
		const chain = this.models.resolveChain(alias);
		const schema = (definition.modelOutput?.(input) ?? contract.output) as ZodType;
		const jsonMode = definition.outputMode === "json";
		const textMode = definition.outputMode === "text";
		// The per-task union of contract schemas is too wide for Output.object's generic.
		const output = textMode
			? undefined
			: jsonMode
				? Output.json()
				: Output.object({ schema: schema as unknown as Parameters<typeof Output.object>[0]["schema"] });
		const sampling = definition.sampling?.(input) ?? {};
		const record = (outcome: "ok" | "error", m: { provider: string; modelId: string }, latencyMs: number, extra = {}) =>
			this.ledger.record({
				organizationId: ctx.organizationId,
				userId: ctx.userId,
				surface: "system",
				task: taskId,
				provider: m.provider,
				model: m.modelId,
				latencyMs,
				outcome,
				...extra,
			});

		// Whole-chain budget for callers bound by a request deadline (serverless maxDuration).
		const chainBudgetMs = chainBudgetFor(definition);
		const deadline = chainBudgetMs ? Date.now() + chainBudgetMs : null;
		const attemptTimeout = () => {
			const perAttempt = definition.timeoutMs ?? this.settings?.tierTimeoutMs(alias) ?? this.env.AI_MODEL_TIMEOUT_MS;
			return deadline ? Math.max(1, Math.min(perAttempt, deadline - Date.now())) : perAttempt;
		};
		let failures = 0;
		let billingFailures = 0;
		let rateLimitFailures = 0;
		const { value, model, latencyMs, fallbacks } = await runWithFallback(
			chain,
			async (candidate) => {
				const result = await generateText({
					model: candidate.model,
					instructions: cacheableInstructions(definition.instructions(input, ctx), candidate.provider),
					prompt: jsonMode ? withJsonCue(definition.prompt(input)) : definition.prompt(input),
					...(output ? { output } : {}),
					temperature: sampling.temperature ?? definition.temperature,
					maxOutputTokens: sampling.maxOutputTokens ?? definition.maxOutputTokens,
					timeout: attemptTimeout(),
					maxRetries: definition.maxRetries ?? 1,
				});
				const answer = textMode
					? validateTextOutput(schema, result)
					: jsonMode
						? validateJsonOutput(schema, result)
						: result.output;
				return { totalUsage: result.totalUsage, output: answer };
			},
			{
				onFailure: (candidate, error, ms) => {
					failures++;
					const billing = isProviderBillingError(error);
					if (billing) billingFailures++;
					const rateLimited = !billing && isProviderRateLimitError(error);
					if (rateLimited) rateLimitFailures++;
					return record("error", candidate, ms, {
						...errorUsage(error),
						errorCode: billing
							? "provider_insufficient_quota"
							: rateLimited
								? PROVIDER_RATE_LIMITED
								: error instanceof Error
									? error.name
									: "unknown",
					});
				},
				canFallback: () => !deadline || deadline - Date.now() > MIN_ATTEMPT_MS,
			},
		).catch((error: unknown) => {
			if (error instanceof AgentError) throw error;
			// Every provider refused for billing: say so, so callers stop spending time on more steps.
			if (failures > 0 && billingFailures === failures) {
				throw new AgentError("The AI provider has no credit left.", 402, "provider_insufficient_quota");
			}
			// Every provider answered 429 (not billing): a busy moment, not an outage. The org's own daily limit is a
			// different 429 (thrown before any provider call, without this code).
			if (failures > 0 && rateLimitFailures === failures) {
				throw new AgentError("The AI is busy right now. Try again in a minute.", 429, PROVIDER_RATE_LIMITED);
			}
			if (deadline && Date.now() >= deadline - MIN_ATTEMPT_MS) {
				throw new AgentError("The AI took too long to answer. Try again with less input.", 504);
			}
			throw new AgentError("The AI could not complete this task.", 503);
		});

		const usage = tokenUsageOf(value.totalUsage);
		await record("ok", model, latencyMs, usage);
		return {
			taskId,
			promptVersion: definition.promptVersion,
			requestId: requestId ?? randomUUID(),
			output: value.output,
			usage: {
				provider: model.provider,
				model: model.modelId,
				inputTokens: usage.inputTokens,
				outputTokens: usage.outputTokens,
				costUsdMicros: estimateCostMicros(model.provider, model.modelId, usage),
				latencyMs,
				fallbacks,
			},
		};
	}

	private async assertQuota(ctx: AiRequestContext, taskId: string): Promise<void> {
		// AI switched off for the shop's plan: 403 before anything else
		assertAiEnabled(ctx);
		// the platform's spend caps (daily / monthly; Free pauses first) before the org's own quota
		await this.spend?.assertWithinBudget(planOf(ctx));
		// then the shop's AI battery (its plan's budget, else AI_DAILY_BUDGET_USD_PER_ORG)
		await this.battery?.assertAvailable(ctx.organizationId, aiBudgetMicros(ctx, this.env));
		// the shop's calendar-month allowance, and for website-setup tasks (sitegen.*) the website budget
		await this.shopCaps?.assertAvailable(ctx, taskId);
		const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
		// only task calls (surface 'system'): copilot steps, decisions, suggestions and pictures have their own limits
		const used = await this.ledger.countSince(ctx.organizationId, since, { surface: "system" });
		if (used >= (this.settings?.runtimeEnv() ?? this.env).AI_DAILY_TASK_LIMIT_PER_ORG) {
			throw new AgentError("Your workspace reached today's AI limit. Try again tomorrow.", 429);
		}
	}
}

/**
 * JSON mode on OpenAI Responses-backed endpoints requires the word "json" in an
 * input message — the system instructions don't count — so the request carries it.
 */
export function withJsonCue(prompt: string | ModelMessage[]): string | ModelMessage[] {
	const cue = "Respond with a JSON object only.";
	if (typeof prompt === "string") return `${prompt}

${cue}`;
	const last = prompt.at(-1);
	if (last?.role === "user" && typeof last.content === "string") {
		return [...prompt.slice(0, -1), { ...last, content: `${last.content}

${cue}` }];
	}
	return [...prompt, { role: "user", content: cue }];
}

/** Text-mode answers become `{ text }`; an empty answer is a failed generation (next provider). */
function validateTextOutput(
	schema: ZodType,
	result: Pick<Awaited<ReturnType<typeof generateText>>, "text" | "response" | "usage" | "finishReason">,
): unknown {
	const checked = schema.safeParse({ text: result.text });
	if (checked.success && result.text.trim()) return checked.data;
	throw new NoObjectGeneratedError({
		message: "No text generated.",
		text: result.text,
		response: result.response,
		usage: result.usage,
		finishReason: result.finishReason,
	});
}

/**
 * JSON-mode answers are only parsed by the SDK; check them against the task
 * schema here. A mismatch is a failed generation (fallback-worthy), never a
 * caller error. Only issue paths are logged — not the generated text.
 */
function validateJsonOutput(
	schema: ZodType,
	result: Pick<Awaited<ReturnType<typeof generateText>>, "output" | "text" | "response" | "usage" | "finishReason">,
): unknown {
	const checked = schema.safeParse(result.output);
	if (checked.success) return checked.data;
	const paths = checked.error.issues.map((issue) => issue.path.join(".") || "(root)").slice(0, 5);
	throw new NoObjectGeneratedError({
		message: `No object generated: response did not match the task schema (${paths.join(", ")}).`,
		text: result.text,
		response: result.response,
		usage: result.usage,
		finishReason: result.finishReason,
	});
}
