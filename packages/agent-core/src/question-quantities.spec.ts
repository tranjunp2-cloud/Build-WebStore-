import { describe, expect, it } from "vitest";
import { AgentEventSchema } from "./events";
import { AgentAskSchema, AgentRunSchema, AnsweredQuestionSchema, MAX_QUESTION_NUMBER, MAX_QUESTION_ROWS, QuantitySchema, QuestionKindSchema } from "./schemas";

// TC-AIAUD-139 — the "quantities" question kind: rows to count, a unit, whole numbers or amounts, and the
// answered row that carries the numbers by row id.

const ask = (question: Record<string, unknown>) => ({
	toolCallId: "call_1",
	index: 0,
	total: 1,
	question: { id: "q_stock", kind: "quantities", label: "Stock", title: "How many in stock?", options: [], ...question },
});

describe("quantities question [TC-AIAUD-139]", () => {
	it("is a question kind with rows, a unit and an amounts flag, and defaults like the others", () => {
		expect(QuestionKindSchema.options).toContain("quantities");
		const parsed = AgentAskSchema.parse(ask({ rows: [{ id: "11", label: "Rose serum", suggested: 4 }, { id: "12", label: "Night cream" }], unit: "pcs", decimals: false }));
		expect(parsed.question).toMatchObject({ multiple: false, allowText: false, allowSkip: true, unit: "pcs", rows: [{ id: "11", suggested: 4 }, { id: "12" }] });
	});

	it("holds at most 20 rows, each with an id and a label", () => {
		const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), label: `P${i}` }));
		expect(AgentAskSchema.safeParse(ask({ rows: rows(MAX_QUESTION_ROWS) })).success).toBe(true);
		expect(AgentAskSchema.safeParse(ask({ rows: rows(MAX_QUESTION_ROWS + 1) })).success).toBe(false);
		expect(AgentAskSchema.safeParse(ask({ rows: [{ id: "", label: "x" }] })).success).toBe(false);
		expect(AgentAskSchema.safeParse(ask({ rows: [{ id: "1", label: "" }] })).success).toBe(false);
		expect(AgentAskSchema.safeParse(ask({ rows: [{ id: "1", label: "x", suggested: -1 }] })).success).toBe(false);
	});

	it("keeps the numbers of an answered question by row id", () => {
		const answered = AnsweredQuestionSchema.parse({ questionId: "q_stock", kind: "quantities", label: "Stock", display: "Rose serum: 12", source: "you", rows: { "11": 12 } });
		expect(answered.rows).toEqual({ "11": 12 });
		expect(AnsweredQuestionSchema.safeParse({ ...answered, rows: { "11": -2 } }).success).toBe(false);
	});

	it("QuantitySchema: 0 up to the stock limit, at most two decimals", () => {
		for (const ok of [0, 1, 29.9, 12.34, MAX_QUESTION_NUMBER]) expect(QuantitySchema.safeParse(ok).success, String(ok)).toBe(true);
		for (const bad of [-0.01, 12.345, MAX_QUESTION_NUMBER + 1]) expect(QuantitySchema.safeParse(bad).success, String(bad)).toBe(false);
	});
});

// TC-AIAUD-158 — a reader meeting a question kind it does not know (deploy order: the service ships a new kind
// before the client, or a stored run from a newer deploy) takes it as a plain choice instead of failing the
// whole event, run or thread; the strict kind list itself is unchanged.

describe("an unknown question kind is tolerated [TC-AIAUD-158]", () => {
	const future = ask({ kind: "sliders", label: "Budget", title: "Pick a budget", options: [] });

	it("TC-AIAUD-158: an ask with a kind from a later version parses as a choice (text box when it has no options)", () => {
		const parsed = AgentAskSchema.parse(future);
		expect(parsed.question).toMatchObject({ kind: "choice", title: "Pick a budget", options: [] });
	});

	it("TC-AIAUD-158: the run.ask event, a stored run and an answered row keep working with it", () => {
		const event = AgentEventSchema.safeParse({ type: "run.ask", runId: "run_1", ask: future, answers: [{ questionId: "q", kind: "sliders", label: "Budget", display: "RM 50", source: "you" }] });
		expect(event.success).toBe(true);
		if (event.success && event.data.type === "run.ask") {
			expect(event.data.ask?.question.kind).toBe("choice");
			expect(event.data.answers[0]?.kind).toBe("choice");
		}
		const run = AgentRunSchema.safeParse({ id: "run_1", role: "merchant", domain: "products", prompt: "hi", status: "awaiting_input", ask: future, startedAt: "2026-10-29T08:00:00.000Z" });
		expect(run.success, JSON.stringify(run.error?.issues)).toBe(true);
	});

	it("TC-AIAUD-158: the kinds this version offers are not changed by the tolerance", () => {
		expect(QuestionKindSchema.safeParse("sliders").success).toBe(false);
		expect(AgentAskSchema.parse(ask({})).question.kind).toBe("quantities");
	});
});
