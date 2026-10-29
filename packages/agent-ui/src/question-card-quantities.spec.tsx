// @vitest-environment jsdom
import type { AgentAsk, AnswerInput } from "@ech/agent-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseQuantity, QuestionCard } from "./question-card";

// TC-AIAUD-110..113 — ask_user "quantities": one labelled whole-number input per row, nothing invented,
// Skip always allowed, the numbers go back keyed by row id.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ask: AgentAsk = {
	toolCallId: "call_1",
	index: 0,
	total: 1,
	question: {
		id: "q_stock",
		kind: "quantities",
		label: "How many in stock?",
		title: "How many do you have in stock?",
		why: "Products with 0 stock show as sold out.",
		options: [],
		multiple: false,
		allowText: false,
		allowSkip: true,
		unit: "pcs",
		rows: [
			{ id: "11", label: "Rose serum" },
			{ id: "12", label: "Night cream", suggested: 4 },
			{ id: "13", label: "Lip balm" },
		],
	},
};

let host: HTMLDivElement;
let root: Root;
const onAnswer = vi.fn(async (_input: AnswerInput) => undefined);

beforeEach(() => {
	onAnswer.mockClear();
	host = document.createElement("div");
	document.body.append(host);
	root = createRoot(host);
});
afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

const render = () => act(() => root.render(<QuestionCard ask={ask} onAnswer={onAnswer} />));
const type = (el: HTMLInputElement, value: string) =>
	act(() => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});
const button = (name: RegExp) => [...host.querySelectorAll("button")].find((b) => name.test(b.textContent ?? ""));

describe("parseQuantity [TC-AIAUD-110]", () => {
	it("accepts whole numbers from 0, reads empty as left out, and flags anything else", () => {
		expect(parseQuantity("12")).toBe(12);
		expect(parseQuantity(" 0 ")).toBe(0);
		expect(parseQuantity("")).toBeNull();
		for (const bad of ["-1", "1.5", "1e3", "abc", "1,000", "12345678", "1000001"]) expect(parseQuantity(bad), bad).toBeNaN();
	});

	it("takes up to two decimals (a comma counts as the point) only where amounts are asked", () => {
		expect(parseQuantity("29.9", true)).toBe(29.9);
		expect(parseQuantity("29,90", true)).toBe(29.9);
		expect(parseQuantity("12", true)).toBe(12);
		for (const bad of ["29.999", "-1.5", ".5", "1.", "12.5.1"]) expect(parseQuantity(bad, true), bad).toBeNaN();
	});
});

describe("QuestionCard quantities [TC-AIAUD-111..113]", () => {
	it("renders one labelled number input per row with the unit, and no free-text or option controls [TC-AIAUD-111]", () => {
		render();
		const labels = [...host.querySelectorAll("label")].map((l) => l.textContent);
		expect(labels).toEqual(["Rose serum", "Night cream", "Lip balm"]);
		const inputs = [...host.querySelectorAll<HTMLInputElement>(".ech-ag-q-row input")];
		expect(inputs).toHaveLength(3);
		for (const el of inputs) expect(host.querySelector(`label[for="${el.id}"]`)).not.toBeNull();
		expect(inputs.map((el) => el.inputMode)).toEqual(["numeric", "numeric", "numeric"]);
		expect(inputs[1]?.placeholder).toBe("4");
		expect(host.querySelectorAll(".ech-ag-q-unit")).toHaveLength(3);
		expect(host.querySelector(".ech-ag-opts")).toBeNull();
		expect(host.querySelector('input[type="search"]')).toBeNull();
		expect(button(/skip/i)).toBeDefined();
	});

	it("sends only the filled rows, keyed by row id, and disables Done until one row is valid [TC-AIAUD-112]", async () => {
		render();
		const [serum, cream] = [...host.querySelectorAll<HTMLInputElement>(".ech-ag-q-row input")];
		const done = button(/done/i) as HTMLButtonElement;
		expect(done.disabled).toBe(true);

		type(serum as HTMLInputElement, "-3");
		expect((serum as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
		expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/valid number/i);
		expect((button(/done/i) as HTMLButtonElement).disabled).toBe(true);

		type(serum as HTMLInputElement, "12");
		type(cream as HTMLInputElement, "0");
		expect((button(/done/i) as HTMLButtonElement).disabled).toBe(false);
		await act(async () => {
			(button(/done/i) as HTMLButtonElement).click();
		});
		expect(onAnswer).toHaveBeenCalledWith({ toolCallId: "call_1", questionId: "q_stock", rows: { "11": 12, "12": 0 } });
	});

	it("moves to the next input on Enter, submits on Enter in the last one, and Skip sends skip [TC-AIAUD-113]", async () => {
		render();
		const inputs = [...host.querySelectorAll<HTMLInputElement>(".ech-ag-q-row input")];
		type(inputs[0] as HTMLInputElement, "5");
		(inputs[0] as HTMLInputElement).focus();
		act(() => {
			inputs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		});
		expect(document.activeElement).toBe(inputs[1]);
		expect(onAnswer).not.toHaveBeenCalled();

		await act(async () => {
			inputs[2]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		});
		expect(onAnswer).toHaveBeenCalledWith({ toolCallId: "call_1", questionId: "q_stock", rows: { "11": 5 } });

		onAnswer.mockClear();
		await act(async () => {
			(button(/skip/i) as HTMLButtonElement).click();
		});
		expect(onAnswer).toHaveBeenCalledWith({ toolCallId: "call_1", questionId: "q_stock", skip: true });
	});
});
