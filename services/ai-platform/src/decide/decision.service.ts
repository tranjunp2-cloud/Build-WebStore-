import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { AGENT_STORE, type AgentStore } from "../agent/agent-store";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { USAGE_LEDGER, type UsageLedger } from "../ledger/usage-ledger";
import type { Decider, Decision, DecisionRequest } from "./decision-types";
import { DECISION_NONE } from "./decision-types";
import { decisionFingerprint } from "./fingerprint";
import { LexicalDecider } from "./lexical-decider";
import { TypeSafeDecider } from "./typesafe-decider";

export const DECIDER = Symbol("AI_PLATFORM_DECIDER");

const DAY_MS = 24 * 60 * 60 * 1000;
const L1_MAX_ENTRIES = 5_000;

/**
 * Decision models for the copilot's clarifying questions (System One / JEV).
 * Cheap typed-choice calls rank the shop's own options so the chat model
 * never reads long option lists, and a confident answer is applied without
 * asking the merchant at all.
 *
 * Governance: answers are memoized by question fingerprint — in process (L1)
 * and in `ai_decisions` (L2, shared by every instance) — so the same family
 * or attribute question for similar products is free after the first time.
 * Every System One call lands in the usage ledger (`agent.decide.<stage>`).
 * Without a key the lexical fallback only orders options (never auto-applies).
 */
@Injectable()
export class DecisionService {
	private readonly logger = new Logger(DecisionService.name);
	private readonly primary: Decider;
	private readonly fallback = new LexicalDecider();
	private readonly l1 = new Map<string, { decision: Decision; expiresAt: number }>();

	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		@Inject(USAGE_LEDGER) private readonly ledger: UsageLedger,
		@Inject(ENV) private readonly env: Env,
		@Optional() @Inject(DECIDER) decider?: Decider,
	) {
		this.primary =
			decider ??
			new TypeSafeDecider({
				apiKey: env.TYPESAFE_API_KEY,
				endpoint: env.TYPESAFE_API_URL,
				model: env.TYPESAFE_MODEL,
				timeoutMs: env.TYPESAFE_TIMEOUT_MS,
			});
	}

	/** A choice at or above this confidence is applied without asking (visible and changeable). */
	get autoConfidence(): number {
		return this.env.AI_DECISION_AUTO_CONFIDENCE;
	}

	/** True when a real decision model answers (not the lexical fallback). */
	get modelBacked(): boolean {
		return this.primary.isAvailable();
	}

	async decide(request: DecisionRequest): Promise<Map<string, Decision>> {
		const results = new Map<string, Decision>();
		const questions = request.questions.filter((q) => q.candidates.length > 0);
		if (questions.length === 0) return results;
		const backend = this.primary.isAvailable() ? this.primary : this.fallback;
		if (backend === this.fallback) return this.ask(this.fallback, request, questions, results);

		const freshSince = new Date(Date.now() - this.env.AI_DECISION_CACHE_TTL_DAYS * DAY_MS);
		const misses: typeof questions = [];
		const keys = new Map<string, string>();
		for (const question of questions) {
			const criteria = Object.fromEntries(question.candidates.map((c) => [c.code, c.description]));
			if (question.allowNone !== false) criteria[DECISION_NONE] = "None of the candidates reasonably matches";
			const fingerprint = decisionFingerprint({
				organizationId: request.organizationId,
				model: backend.model,
				instructions: question.instructions,
				criteria,
				state: request.state,
			});
			keys.set(question.key, fingerprint);
			const hot = this.l1.get(fingerprint);
			if (hot && hot.expiresAt > Date.now()) {
				results.set(question.key, { ...hot.decision, source: "cache" });
				continue;
			}
			const stored = await this.store.getDecision(request.organizationId, fingerprint, freshSince).catch(() => null);
			if (stored) {
				const decision: Decision = {
					choice: stored.choice,
					confidence: stored.confidence,
					probabilities: stored.probabilities,
					source: "cache",
					provider: stored.provider,
					model: stored.model,
				};
				this.remember(fingerprint, decision);
				results.set(question.key, decision);
				continue;
			}
			misses.push(question);
		}
		if (misses.length === 0) return results;

		try {
			const answered = await this.ask(backend, request, misses, results);
			for (const question of misses) {
				const decision = answered.get(question.key);
				const fingerprint = keys.get(question.key);
				if (!decision || !fingerprint || decision.source !== "model") continue;
				this.remember(fingerprint, decision);
				await this.store
					.putDecision(request.organizationId, fingerprint, {
						stage: request.stage,
						provider: decision.provider,
						model: decision.model,
						choice: decision.choice,
						confidence: decision.confidence,
						probabilities: decision.probabilities,
						createdAt: new Date(),
					})
					.catch((error: unknown) => this.logger.warn(`decision cache write failed: ${String(error)}`));
			}
			return answered;
		} catch (error) {
			this.logger.warn(`System One failed (${request.stage}); falling back to lexical ranking: ${String(error)}`);
			return this.ask(this.fallback, request, misses, results);
		}
	}

	private async ask(
		backend: Decider,
		request: DecisionRequest,
		questions: DecisionRequest["questions"],
		results: Map<string, Decision>,
	): Promise<Map<string, Decision>> {
		const ledgerBase = {
			organizationId: request.organizationId,
			userId: request.userId,
			surface: "merchant" as const,
			task: `agent.decide.${request.stage}`,
			runId: request.runId,
			provider: backend.provider,
			model: backend.model,
		};
		let outcome;
		try {
			outcome = await backend.decide({ ...request, questions });
		} catch (error) {
			if (backend !== this.fallback) {
				await this.ledger.record({ ...ledgerBase, latencyMs: 0, outcome: "error", errorCode: "DecisionFailed" });
			}
			throw error;
		}
		if (backend !== this.fallback) {
			await this.ledger.record({
				...ledgerBase,
				inputTokens: outcome.usage?.inputTokens,
				outputTokens: outcome.usage?.outputTokens,
				latencyMs: outcome.latencyMs,
				outcome: "ok",
			});
		}
		for (const [key, answer] of outcome.answers) {
			results.set(key, {
				...answer,
				source: backend === this.fallback ? "heuristic" : "model",
				provider: backend.provider,
				model: backend.model,
			});
		}
		return results;
	}

	private remember(fingerprint: string, decision: Decision): void {
		if (this.l1.size >= L1_MAX_ENTRIES) {
			const oldest = this.l1.keys().next().value;
			if (oldest) this.l1.delete(oldest);
		}
		this.l1.set(fingerprint, {
			decision,
			expiresAt: Date.now() + this.env.AI_DECISION_CACHE_TTL_DAYS * DAY_MS,
		});
	}
}
