/**
 * Decision port — pick one of N options the caller supplies (System One /
 * JEV "typed choice"). The port never invents options and may abstain
 * (`choice === null`). Governance stays with the caller: it maps
 * `confidence` through its policy (auto-apply above a floor, else ask).
 */

export const DECISION_NONE = "none_of_these";

export interface DecisionCandidate {
	/** Stable option key — family code, attribute option code… */
	code: string;
	/** What the decision model reads for this option (label + disambiguating path). */
	description: string;
}

export interface DecisionQuestion {
	/** Caller's correlation key, unique within one call. */
	key: string;
	instructions: string;
	candidates: readonly DecisionCandidate[];
	/** Add the `none_of_these` sentinel so abstaining is an option (default true). */
	allowNone?: boolean;
}

/** Low-cardinality label for metering: which step spent the call. */
export type DecisionStage = "family" | "attribute" | "variant_axis" | "image";

export interface Decision {
	/** Chosen candidate code, or null when the model abstained. */
	choice: string | null;
	/** Confidence of `choice`, 0..1. */
	confidence: number;
	/** Probability per candidate code. */
	probabilities: Record<string, number>;
	/** Where the answer came from — a cache hit costs nothing. */
	source: "model" | "cache" | "heuristic";
	provider: string;
	model: string;
}

export interface DecisionRequest {
	organizationId: string;
	userId?: string;
	runId?: string;
	stage: DecisionStage;
	/** Shared context every question is judged against (the product as described). */
	state: Record<string, unknown>;
	questions: readonly DecisionQuestion[];
	signal?: AbortSignal;
}

/** A decision backend (System One, or the offline lexical fallback). */
export interface Decider {
	readonly provider: string;
	readonly model: string;
	/** false while unconfigured or cooling down after an auth failure */
	isAvailable(): boolean;
	/** Answers keyed by question key; a missing key = unanswered. */
	decide(request: DecisionRequest): Promise<{
		answers: Map<string, Omit<Decision, "source" | "provider" | "model">>;
		usage: { inputTokens: number; outputTokens: number } | null;
		latencyMs: number;
	}>;
}
