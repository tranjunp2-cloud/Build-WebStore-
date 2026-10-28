import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { ComposedPromptTaskId } from "@ech/ai-contracts";
import { isAiTasksEnabled } from "./config";
import type { AgentActor } from "./context";

/**
 * Who a long AI pipeline runs as. Site generation fans out into many model
 * calls deep inside helpers (sample products, blog seeds, image keywords…);
 * instead of threading the caller through every signature, the entry point
 * (generate-site, admin rerun, recovery worker, PW1 migration) wraps the run
 * in `runWithAiActor` and each step reads it back here.
 */
const scope = new AsyncLocalStorage<AgentActor>();

export function runWithAiActor<T>(actor: AgentActor, run: () => T): T {
	return scope.run(actor, run);
}

/**
 * For entry points that only learn the actor halfway (generate-site resolves
 * the workspace first): the rest of the calling async function, and the work
 * it starts, runs as `actor`.
 */
export function enterAiActorScope(actor: AgentActor): void {
	scope.enterWith(actor);
}

/** Keeps the current actor for work that runs later (after(), queued callbacks). */
export function bindAiActor<T>(task: () => T): () => T {
	const actor = scope.getStore();
	return actor ? () => scope.run(actor, task) : task;
}

/** The actor of the enclosing pipeline, when AI may run at all. */
export function currentAiActor(): AgentActor | null {
	if (!isAiTasksEnabled()) return null;
	return scope.getStore() ?? null;
}

/** Actors whose workspace hit its AI quota during this run (per request: actors are built per request). */
const quotaHits = new WeakSet<AgentActor>();
/** Actors whose run found the model provider out of credit: nothing else will succeed this run. */
const providerCreditGone = new WeakSet<AgentActor>();

/** True when a step of the current run was refused for the workspace's quota or the provider's credit. */
export function aiQuotaHitInScope(): boolean {
	const actor = scope.getStore();
	return actor ? quotaHits.has(actor) || providerCreditGone.has(actor) : false;
}

/** The platform answers 402 when every model provider refused for billing (no credit left). */
export const PROVIDER_CREDIT_STATUS = 402;

export class AiUnavailableError extends Error {
	constructor() {
		super("AI is not available for this run.");
		this.name = "AiUnavailableError";
	}
}

/**
 * The provider has no credit left. A subclass of AiUnavailableError so every step takes its existing
 * non-AI path, but raised locally: once one step saw 402, the rest of the run skips the platform call
 * instead of paying a round trip (and the SDK's billing-429 retry) per step.
 */
export class AiProviderCreditError extends AiUnavailableError {
	constructor() {
		super();
		this.message = "The AI provider has no credit left for this run.";
		this.name = "AiProviderCreditError";
	}
}

/** Steps answering free text (`{ text }`); every other step answers a JSON object. */
const TEXT_STEPS: ReadonlySet<ComposedPromptTaskId> = new Set(["i18n.translate-image-terms", "i18n.translate-user-input"]);

export type ComposedCompletion = {
	/** The model's answer as text — a JSON object string for JSON steps. */
	content: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
};

/**
 * One generator step on the AI platform with the caller-composed prompt.
 * Throws AiUnavailableError outside an actor scope, so steps fall back to
 * their non-AI path exactly as they did without an API key.
 */
export async function completeComposed(
	taskId: ComposedPromptTaskId,
	messages: { system?: string; user: string; temperature?: number; maxOutputTokens?: number },
	options: { signal?: AbortSignal } = {},
): Promise<ComposedCompletion> {
	const actor = currentAiActor();
	if (!actor) throw new AiUnavailableError();
	if (providerCreditGone.has(actor)) throw new AiProviderCreditError();
	const { getAiTaskClient } = await import("./task-client");
	const { output, usage } = await getAiTaskClient(actor)
		.runTask(
			taskId,
			{
				system: messages.system ?? "",
				user: messages.user,
				...(messages.temperature !== undefined ? { temperature: messages.temperature } : {}),
				...(messages.maxOutputTokens !== undefined ? { maxOutputTokens: messages.maxOutputTokens } : {}),
			},
			{ signal: options.signal },
		)
		.catch((error: unknown) => {
			// a step falls back on its own; the run still has to say the workspace ran out
			const status = (error as { status?: unknown } | null)?.status;
			if (status === 429) quotaHits.add(actor);
			if (status === PROVIDER_CREDIT_STATUS) providerCreditGone.add(actor);
			throw error;
		});
	const content = TEXT_STEPS.has(taskId) ? String((output as { text?: unknown }).text ?? "") : JSON.stringify(output);
	return { content, model: usage.model, inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 };
}
