import type { FlowLanguage } from "./ask/flow-copy";

/** Never start a model call (or a fallback attempt) with less time than this left. */
export const MIN_CALL_MS = 20_000;

/** Why a run stopped starting model calls: out of time, or out of tokens. */
export type BudgetStop = "time" | "tokens";

/**
 * One request's model budget: a deadline inside the 300 s function (`AI_RUN_BUDGET_MS`, from the
 * request's start) and a token ceiling for the whole run (`AI_RUN_TOKEN_BUDGET`, summed across its
 * pauses by the caller). The run checks it before each model call and clamps each call's timeout.
 */
export class RunBudget {
	private readonly endsAt: number;

	constructor(
		startedAt: number,
		budgetMs: number,
		private readonly tokenLimit: number,
		private readonly now: () => number = Date.now,
	) {
		this.endsAt = startedAt + budgetMs;
	}

	remainingMs(): number {
		return Math.max(0, this.endsAt - this.now());
	}

	/** Why no new model call may start now, or null. `tokensUsed`: the run's input + output tokens so far. */
	stop(tokensUsed: number): BudgetStop | null {
		if (tokensUsed > this.tokenLimit) return "tokens";
		if (this.remainingMs() < MIN_CALL_MS) return "time";
		return null;
	}

	/** A call's timeout: its own limit, never past the deadline. */
	callTimeoutMs(perCallMs: number): number {
		return Math.max(1, Math.min(perCallMs, this.remainingMs()));
	}
}

/** The stopped run's line, in the language the merchant writes in (same tone as the run's failure lines). */
const BUDGET_LINES: Record<
	FlowLanguage,
	Record<BudgetStop | "kept" | "retry", string>
> = {
	en: {
		time: "This took too long, so I stopped.",
		tokens: "This needed more AI work than one request allows, so I stopped.",
		kept: "What I drafted so far is below for your approval.",
		retry: "Try a smaller request, or split it into steps.",
	},
	ms: {
		time: "Ini mengambil masa terlalu lama, jadi saya berhenti.",
		tokens:
			"Ini memerlukan lebih banyak kerja AI daripada yang dibenarkan untuk satu permintaan, jadi saya berhenti.",
		kept: "Draf yang sudah siap ada di bawah untuk kelulusan anda.",
		retry:
			"Cuba permintaan yang lebih kecil, atau bahagikan kepada beberapa langkah.",
	},
	vi: {
		time: "Việc này mất quá lâu nên tôi đã dừng lại.",
		tokens:
			"Việc này cần nhiều xử lý AI hơn mức cho phép của một yêu cầu nên tôi đã dừng lại.",
		kept: "Những bản nháp đã soạn nằm bên dưới để bạn duyệt.",
		retry: "Hãy thử yêu cầu nhỏ hơn hoặc chia thành từng bước.",
	},
};

/** "This took too long, so I stopped. …" — what was kept when something was staged, else what to try. */
export function budgetLine(
	reason: BudgetStop,
	staged: boolean,
	language: FlowLanguage = "en",
): string {
	const lines = BUDGET_LINES[language];
	return `${lines[reason]} ${staged ? lines.kept : lines.retry}`;
}
