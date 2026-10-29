import { AnswerInputSchema, MAX_QUESTION_ROWS } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../../auth/context-token";
import { parseEnv } from "../../config/env";
import { DecisionService } from "../../decide/decision.service";
import type { Decider } from "../../decide/decision-types";
import type { UsageEvent, UsageLedger } from "../../ledger/usage-ledger";
import type { ModelRegistry } from "../../models/model-registry";
import type { ShopTools } from "../../shop/shop-tools";
import { InMemoryAgentStore } from "../../testing/in-memory-agent-store";
import { AgentRunService } from "../agent-run.service";
import { AgentThreadService } from "../agent-thread.service";
import { AskUserInputSchema, askUserInputSchemaFor } from "./ask-tool";
import { QuestionFlowService } from "./question-flow";

// TC-AIAUD-100..105 — ask_user "quantities": one question that asks for a number per row (stock, prices), answered
// with numbers keyed by row id; the rows are the items to count, never numbers the model made up.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", token: "t" };
const usage = {
	inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 100, text: 100, reasoning: undefined },
};

type Turn = { tool: string; input: unknown } | { text: string };

function scripted(turns: Turn[]) {
	let call = 0;
	return new MockLanguageModelV4({
		doGenerate: async () => {
			const turn = turns[Math.min(call, turns.length - 1)] as Turn;
			call += 1;
			if ("tool" in turn) {
				return {
					content: [{ type: "tool-call", toolCallId: `call_${call}`, toolName: turn.tool, input: JSON.stringify(turn.input) }],
					finishReason: { unified: "tool-calls", raw: undefined },
					usage,
					warnings: [],
				};
			}
			return { content: [{ type: "text", text: turn.text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
		},
	});
}

// a custom table question never reads the catalog
const shop = {} as unknown as ShopTools;
const decider: Decider = { provider: "typesafe", model: "jev-latest", isAvailable: () => true, decide: async () => ({ answers: new Map(), usage: { inputTokens: 0, outputTokens: 0 }, latencyMs: 1 }) };

const noQuestion = { options: [], multiple: false, pictures: null };
const stockQuestion = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
	id: "stock",
	title: "How many do you have in stock?",
	why: "Products with 0 stock show as sold out.",
	...noQuestion,
	table: {
		rows: [
			{ id: "11", label: "Rose serum" },
			{ id: "12", label: "Night cream" },
			{ id: "13", label: "Lip balm" },
		],
		unit: "pcs",
		decimals: false,
		...extra,
	},
});
const askStock = (question: Record<string, unknown> = stockQuestion()): Turn => ({ tool: "ask_user", input: { purpose: "custom", product: null, questions: [question], language: "en" } });

function setup(turns: Turn[]) {
	const env = parseEnv({ AI_PLATFORM_DATABASE_URL: "postgres://x/y", AI_PLATFORM_CONTEXT_SECRET: "test-context-secret-at-least-32-characters" });
	const store = new InMemoryAgentStore();
	const recorded: UsageEvent[] = [];
	const ledger: UsageLedger = { record: async (e) => void recorded.push(e), countSince: async () => 0 };
	const model = scripted(turns);
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	const flows = new QuestionFlowService(shop, new DecisionService(store, ledger, env, decider), store);
	const service = new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), flows, shop);
	return { service, model };
}

const answerOf = (rows: Record<string, number>, questionId = "q_stock") => ({ toolCallId: "call_1", questionId, rows });
const lastToolResult = (model: ReturnType<typeof scripted>) => JSON.stringify(model.doGenerateCalls.at(-1)?.prompt);

describe("ask_user table input [TC-AIAUD-100]", () => {
	const input = (question: unknown) => ({ purpose: "custom", product: null, questions: [question] });

	it("takes 1–20 rows with a unit, and a question without a table is the ordinary question it was", () => {
		expect(AskUserInputSchema.safeParse(input(stockQuestion())).success).toBe(true);
		expect(AskUserInputSchema.safeParse(input({ id: "a", title: "Which?", why: null, ...noQuestion })).success).toBe(true);
		expect(AskUserInputSchema.safeParse(input({ ...stockQuestion(), table: null })).success).toBe(true);
		const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), label: `P${i}` }));
		expect(AskUserInputSchema.safeParse(input(stockQuestion({ rows: rows(MAX_QUESTION_ROWS) }))).success).toBe(true);
		expect(AskUserInputSchema.safeParse(input(stockQuestion({ rows: rows(MAX_QUESTION_ROWS + 1) }))).success).toBe(false);
		expect(AskUserInputSchema.safeParse(input(stockQuestion({ rows: [] }))).success).toBe(false);
	});

	it("gives the model no way to put a number in a row, and keeps the table in the narrowed tool a deployment gets", () => {
		const withNumber = stockQuestion({ rows: [{ id: "11", label: "Rose serum", suggested: 50 }] });
		const parsed = AskUserInputSchema.parse(input(withNumber));
		expect(JSON.stringify(parsed)).not.toContain("suggested");
		const narrowed = askUserInputSchemaFor({ productDetails: false, pictureSources: [] });
		expect(narrowed.safeParse({ purpose: "custom", product: null, questions: [{ ...stockQuestion(), pictures: null }] }).success).toBe(true);
	});
});

describe("quantities question and its answer [TC-AIAUD-101..102]", () => {
	it("pauses on one card with a number per row, and hands the numbers back keyed by row id", async () => {
		const { service, model } = setup([askStock(), { text: "Stock updated in the next step." }]);
		const paused = await service.start(ctx, { prompt: "Finish my store" }, () => {});

		expect(paused.status).toBe("awaiting_input");
		expect(paused.ask?.question).toMatchObject({
			id: "q_stock",
			kind: "quantities",
			title: "How many do you have in stock?",
			unit: "pcs",
			allowText: false,
			allowSkip: true,
			options: [],
			rows: [{ id: "11", label: "Rose serum" }, { id: "12", label: "Night cream" }, { id: "13", label: "Lip balm" }],
		});
		expect(paused.ask).toMatchObject({ index: 0, total: 1 });

		// "Lip balm" left empty: it is not in the answer
		const done = await service.answer(ctx, paused.id, answerOf({ "12": 0, "11": 12 }), () => {});

		expect(done.answers?.[0]).toMatchObject({ kind: "quantities", values: ["11", "12"], rows: { "11": 12, "12": 0 }, display: "Rose serum: 12 pcs · Night cream: 0 pcs", source: "you" });
		expect(model.doGenerateCalls).toHaveLength(2);
		const result = lastToolResult(model);
		expect(result).toContain('"toolName":"ask_user"');
		expect(result).toContain("numbers the merchant typed, by row id");
		expect(result).toContain('{\\"11\\":12,\\"12\\":0}');
		expect(result).toContain('left empty (change nothing for these): [\\"13\\"]');
		expect(result).toContain('"rows"');
	});

	it("takes prices with two decimals only where the question asks for amounts [TC-AIAUD-102]", async () => {
		const prices = stockQuestion({ unit: "RM", decimals: true });
		const { service } = setup([askStock(prices), { text: "ok" }]);
		const paused = await service.start(ctx, { prompt: "Finish my store" }, () => {});

		expect(paused.ask?.question).toMatchObject({ unit: "RM", decimals: true });
		const done = await service.answer(ctx, paused.id, answerOf({ "11": 29.9 }), () => {});
		expect(done.answers?.[0]).toMatchObject({ rows: { "11": 29.9 } });
	});
});

describe("answers are checked [TC-AIAUD-103..104]", () => {
	it("refuses a row the question never offered, an empty answer and a decimal stock, and the card stays open", async () => {
		const { service, model } = setup([askStock(), { text: "ok" }]);
		const paused = await service.start(ctx, { prompt: "Finish my store" }, () => {});

		await expect(service.answer(ctx, paused.id, answerOf({ "11": 5, "99": 3 }), () => {})).rejects.toThrow(/don't match the question/);
		await expect(service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "q_stock", values: ["11"] }, () => {})).rejects.toThrow(/at least one number/);
		await expect(service.answer(ctx, paused.id, answerOf({ "11": 2.5 }), () => {})).rejects.toThrow(/whole numbers/);
		await expect(service.answer(ctx, paused.id, answerOf({ "11": 5 }, "q_other"), () => {})).rejects.toThrow(/already answered/);

		// every refusal put the question back: it still takes a good answer, and no model call was spent
		expect(model.doGenerateCalls).toHaveLength(1);
		const done = await service.answer(ctx, paused.id, answerOf({ "11": 5 }), () => {});
		expect(done.answers?.[0]).toMatchObject({ rows: { "11": 5 } });
	});

	it("Skip leaves it to the model: nothing is changed [TC-AIAUD-104]", async () => {
		const { service, model } = setup([askStock(), { text: "ok" }]);
		const paused = await service.start(ctx, { prompt: "Finish my store" }, () => {});

		const done = await service.answer(ctx, paused.id, { toolCallId: "call_1", questionId: "q_stock", skip: true }, () => {});

		expect(done.answers?.[0]).toMatchObject({ kind: "quantities", source: "skipped", display: "" });
		expect(done.answers?.[0]?.rows).toBeUndefined();
		expect(lastToolResult(model)).toContain("(skipped — decide yourself)");
	});

	it("repeats a row id once when the model repeats it", async () => {
		const twice = stockQuestion({ rows: [{ id: "11", label: "Rose serum" }, { id: "11", label: "Rose serum again" }] });
		const { service } = setup([askStock(twice), { text: "ok" }]);
		const paused = await service.start(ctx, { prompt: "Finish my store" }, () => {});

		expect(paused.ask?.question.rows).toEqual([{ id: "11", label: "Rose serum" }]);
	});
});

describe("the answer on the wire [TC-AIAUD-105]", () => {
	const parse = (rows: unknown, extra: Record<string, unknown> = {}) => AnswerInputSchema.safeParse({ toolCallId: "call_1", questionId: "q_stock", rows, ...extra }).success;

	it("accepts numbers from 0 with at most two decimals, and nothing else", () => {
		expect(parse({ "11": 0, "12": 12, "13": 29.9, "14": 1_000_000 })).toBe(true);
		for (const bad of [-1, 1_000_001, 1.005, Number.NaN, "5"]) expect(parse({ "11": bad }), String(bad)).toBe(false);
	});

	it("holds at most 20 rows and needs a number, a pick, a text or a skip", () => {
		const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), 1]));
		expect(parse(many(MAX_QUESTION_ROWS))).toBe(true);
		expect(parse(many(MAX_QUESTION_ROWS + 1))).toBe(false);
		expect(parse({})).toBe(false);
		expect(parse({}, { skip: true })).toBe(true);
		expect(parse({ "": 1 })).toBe(false);
	});
});
