import type { AiTaskId, AiTaskInput } from "@ech/ai-contracts";
import type { ModelMessage } from "ai";
import type { AiRequestContext } from "../auth/context-token";
import type { ZodType } from "zod";
import type { ModelAlias } from "../models/model-registry";
import type { ReasoningEffort } from "../models/providers";

/**
 * Server-side half of a task: which model tier answers it and the versioned
 * prompt. The I/O schemas live in @ech/ai-contracts so callers share them.
 * Bump `promptVersion` whenever instructions/prompt change (ledger + evals key on it).
 */
export interface TaskDefinition<T extends AiTaskId = AiTaskId> {
	id: T;
	alias: ModelAlias;
	promptVersion: string;
	instructions: (input: AiTaskInput<T>, ctx: AiRequestContext) => string;
	/** A text prompt, or the conversation turns (e.g. chat history + the latest request). */
	prompt: (input: AiTaskInput<T>) => string | ModelMessage[];
	/**
	 * Schema sent to the model when the contract's output can't be expressed in
	 * strict JSON schema (e.g. records). Must produce values the contract accepts.
	 */
	modelOutput?: (input: AiTaskInput<T>) => ZodType;
	/**
	 * "schema" (default): strict structured output from the schema above.
	 * "json": plain JSON mode (no schema sent) for outputs strict JSON schema can't
	 * express, e.g. free-form objects; the engine validates the parsed JSON against
	 * the same schema afterwards and treats a mismatch like a failed generation
	 * (next provider in the chain). The instructions must spell out the JSON shape
	 * and contain the word "JSON" (OpenAI-compatible json_object mode requires it).
	 *
	 * "text": no structured output at all; the answer is `{ text }` (the contract's
	 * output must be that shape). For callers that parse free-form answers themselves.
	 */
	outputMode?: "schema" | "json" | "text";
	/**
	 * Sampling chosen per request, for tasks whose caller composes the prompt
	 * (bounded by the contract); falls back to `temperature` / `maxOutputTokens`.
	 */
	sampling?: (input: AiTaskInput<T>) => { temperature?: number; maxOutputTokens?: number };
	/** Per-attempt model timeout when the call site needs a tighter bound than AI_MODEL_TIMEOUT_MS. */
	timeoutMs?: number;
	/** SDK retries per provider (default 1); 0 when the caller's time budget only fits one attempt. */
	maxRetries?: number;
	/**
	 * Wall-clock budget for the whole alias chain. Attempts are capped to what is
	 * left, no fallback starts without room to finish, and running out → 504.
	 */
	deadlineMs?: number;
	/**
	 * Thinking effort for this task on every tier, over Studio / AI_EFFORT_* (models that take one). For a task
	 * whose long JSON answer must fit `maxOutputTokens`: thinking tokens count toward that limit and cut the answer.
	 */
	effort?: ReasoningEffort;
	/** Sampling settings carried over from the call site's original prompt. */
	temperature?: number;
	maxOutputTokens?: number;
}

export function defineTask<T extends AiTaskId>(definition: TaskDefinition<T>): TaskDefinition<T> {
	return definition;
}

/** Shared guardrail text so every content task refuses to invent facts the same way. */
export const NO_INVENTED_FACTS =
	"Never invent prices, stock, measurements, certifications (halal, organic, SIRIM…), awards or claims that are not in the input.";
