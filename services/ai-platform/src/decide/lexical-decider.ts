import type { Decider, DecisionRequest } from "./decision-types";

/** Never auto-applies: below any sane auto-apply floor. */
export const LEXICAL_MAX_CONFIDENCE = 0.6;

const STOP = new Set(["the", "and", "for", "with", "of", "a", "an", "in", "to", "dan", "untuk", "và", "của"]);

function tokens(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.split(/[^a-z0-9%]+/)
			.filter((t) => t.length > 1 && !STOP.has(t))
			.map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t)),
	);
}

function textOf(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.map(textOf).join(" ");
	if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(textOf).join(" ");
	return "";
}

/** Word-overlap score of each candidate against the state (0 = nothing in common). */
export function lexicalScores(
	state: Record<string, unknown>,
	candidates: ReadonlyArray<{ code: string; description: string }>,
): Array<{ code: string; score: number }> {
	const context = tokens(textOf(state));
	return candidates.map((candidate) => {
		const words = tokens(`${candidate.code.replace(/[_-]/g, " ")} ${candidate.description}`);
		let hit = 0;
		for (const word of words) if (context.has(word)) hit += 1;
		return { code: candidate.code, score: words.size > 0 ? hit / Math.sqrt(words.size) : 0 };
	});
}

/**
 * Offline fallback when System One is not configured: ranks options by word
 * overlap with the product description. Good enough to order options and
 * pre-select a likely one; its confidence is capped so it never answers a
 * question on the merchant's behalf.
 */
export class LexicalDecider implements Decider {
	readonly provider = "heuristic";
	readonly model = "lexical-v1";

	isAvailable(): boolean {
		return true;
	}

	async decide(request: DecisionRequest) {
		const started = Date.now();
		const answers = new Map<string, { choice: string | null; confidence: number; probabilities: Record<string, number> }>();
		for (const question of request.questions) {
			const scores = lexicalScores(request.state, question.candidates);
			const total = scores.reduce((sum, s) => sum + s.score, 0);
			if (total <= 0) continue;
			const probabilities = Object.fromEntries(scores.map((s) => [s.code, s.score / total]));
			const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
			answers.set(question.key, {
				choice: best.code,
				confidence: Math.min(LEXICAL_MAX_CONFIDENCE, probabilities[best.code] ?? 0),
				probabilities,
			});
		}
		return { answers, usage: null, latencyMs: Date.now() - started };
	}
}
