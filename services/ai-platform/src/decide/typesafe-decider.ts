import { Logger } from "@nestjs/common";
import { DECISION_NONE, type Decider, type DecisionRequest } from "./decision-types";

const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MAX_RETRIES = 2;
const BATCH_MAX_QUESTIONS = 12;
const AUTH_COOLDOWN_MS = 5 * 60_000;
/** System One rejects a criteria map above 255 entries (none_of_these included). */
export const MAX_CANDIDATES = 254;

interface JevAnswer {
	choice?: string;
	confidence?: number;
	probabilities?: Record<string, number>;
}

export interface TypeSafeOptions {
	apiKey: string | undefined;
	endpoint?: string;
	model: string;
	timeoutMs: number;
	fetcher?: typeof fetch;
}

function usageOf(usage: Record<string, unknown> | undefined): { inputTokens: number; outputTokens: number } | null {
	if (!usage || typeof usage !== "object") return null;
	const pick = (...keys: string[]) => {
		for (const key of keys) {
			const value = Number(usage[key]);
			if (Number.isFinite(value) && value >= 0) return value;
		}
		return null;
	};
	const inputTokens = pick("input_tokens", "prompt_tokens");
	const outputTokens = pick("output_tokens", "completion_tokens");
	if (inputTokens === null && outputTokens === null) return null;
	return { inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0 };
}

/**
 * TypeSafe System One (JEV) — one typed-choice POST carries a map of
 * questions judged against a shared `state`; each answer comes back with a
 * calibrated confidence and the per-option distribution. Same wire format as
 * platform-api's JevMappingDecisionAdapter (moved here per the AI platform
 * roadmap, phase 2b). Plain fetch: the surface is a single POST.
 */
export class TypeSafeDecider implements Decider {
	readonly provider = "typesafe";
	readonly model: string;
	private readonly logger = new Logger(TypeSafeDecider.name);
	private readonly endpoint: string;
	private readonly fetcher: typeof fetch;
	private unavailableUntil = 0;

	constructor(private readonly options: TypeSafeOptions) {
		this.model = options.model;
		this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
		this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
	}

	isAvailable(): boolean {
		return Boolean(this.options.apiKey) && Date.now() >= this.unavailableUntil;
	}

	async decide(request: DecisionRequest) {
		const started = Date.now();
		const answers = new Map<string, { choice: string | null; confidence: number; probabilities: Record<string, number> }>();
		let inputTokens = 0;
		let outputTokens = 0;
		let metered = false;
		const questions = request.questions.filter((q) => q.candidates.length > 0);
		for (let i = 0; i < questions.length; i += BATCH_MAX_QUESTIONS) {
			const chunk = questions.slice(i, i + BATCH_MAX_QUESTIONS);
			const criteriaByKey = new Map<string, Record<string, string>>();
			const body = {
				model: this.model,
				state: request.state,
				questions: Object.fromEntries(
					chunk.map((question) => {
						const criteria: Record<string, string> = Object.fromEntries(
							question.candidates.slice(0, MAX_CANDIDATES).map((c) => [c.code, c.description]),
						);
						if (question.allowNone !== false) criteria[DECISION_NONE] = "None of the candidates reasonably matches";
						criteriaByKey.set(question.key, criteria);
						return [question.key, { type: "choice", instructions: question.instructions, criteria }];
					}),
				),
			};
			const json = await this.call(body, request.signal);
			const usage = usageOf(json.usage);
			if (usage) {
				metered = true;
				inputTokens += usage.inputTokens;
				outputTokens += usage.outputTokens;
			}
			for (const question of chunk) {
				const answer = json.answers?.[question.key];
				const criteria = criteriaByKey.get(question.key) ?? {};
				if (!answer?.choice || !criteria[answer.choice]) continue;
				answers.set(question.key, {
					choice: answer.choice === DECISION_NONE ? null : answer.choice,
					confidence: Math.max(0, Math.min(1, Number(answer.confidence) || 0)),
					probabilities: answer.probabilities ?? {},
				});
			}
		}
		return {
			answers,
			usage: metered ? { inputTokens, outputTokens } : null,
			latencyMs: Date.now() - started,
		};
	}

	private async call(
		body: Record<string, unknown>,
		signal: AbortSignal | undefined,
		retries = MAX_RETRIES,
	): Promise<{ answers?: Record<string, JevAnswer>; usage?: Record<string, unknown> }> {
		const timeout = AbortSignal.timeout(this.options.timeoutMs);
		const response = await this.fetcher(this.endpoint, {
			method: "POST",
			headers: { authorization: `Bearer ${this.options.apiKey}`, "content-type": "application/json" },
			body: JSON.stringify(body),
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});
		if (!response.ok) {
			if (retries > 0 && (response.status === 429 || response.status >= 500)) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * (MAX_RETRIES - retries + 1)));
				return this.call(body, signal, retries - 1);
			}
			if (response.status === 401 || response.status === 403) {
				this.unavailableUntil = Date.now() + AUTH_COOLDOWN_MS;
				this.logger.warn("System One rejected the key — decisions paused for 5 minutes; check TYPESAFE_API_KEY");
			}
			const text = await response.text().catch(() => "");
			throw new Error(`system one http ${response.status}: ${text.slice(0, 160)}`);
		}
		return (await response.json()) as { answers?: Record<string, JevAnswer>; usage?: Record<string, unknown> };
	}
}
