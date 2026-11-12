import type { AgentChatTurn, AgentRun, ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_CHAT_LABELS } from "./chat";
import { AgentFloatDock } from "./float-dock";
import { DEFAULT_REPLY_BUBBLE_LABELS, ReplyBubble, replyBubbleState } from "./reply-bubble";

// TC-AICP-122 — the reply bubble over the mascot while the panel is closed.

const run = (extra: Partial<AgentRun>): AgentRun => ({
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "Add 3 summer dresses, RM 120 each",
	status: "running",
	steps: [],
	receipts: [],
	changeSetIds: [],
	startedAt: "2026-10-21T09:00:00Z",
	...extra,
});
const draft = (id: string, status: ChangeSet["status"]) => ({ id, status }) as ChangeSet;
const turns = (r: AgentRun, changeSets: ChangeSet[] = []): AgentChatTurn[] => [
	{ id: "u1", role: "user", text: "Add 3 summer dresses, RM 120 each" },
	{ id: r.id, role: "assistant", run: r, changeSets },
];
const state = (t: AgentChatTurn[]) => replyBubbleState(t, DEFAULT_CHAT_LABELS);

describe("replyBubbleState [TC-AICP-122]", () => {
	it("says the running step while the assistant works", () => {
		const s = state(
			turns(
				run({
					steps: [
						{ id: "s1", label: "Searching Product Master", status: "done" },
						{ id: "s2", label: "Drafting 3 products", status: "running" },
					],
				}),
			),
		);
		expect(s).toMatchObject({ phase: "working", line: "Drafting 3 products", prompt: "Add 3 summer dresses, RM 120 each" });
	});

	it("tells the reply as plain words, without markdown marks", () => {
		const s = state(turns(run({ status: "applied", answer: "The store product **PROBE-MUG-002B** has no photos.\n- `Whey` too" })));
		expect(s?.detail).toBe("The store product PROBE-MUG-002B has no photos. Whey too");
	});

	it("shows the reply as it is written", () => {
		expect(state(turns(run({ answer: "I drafted three dresses in the Dresses family." })))).toMatchObject({
			phase: "writing",
			line: "Replying…",
			detail: "I drafted three dresses in the Dresses family.",
		});
	});

	it("puts a waiting question first, with its options", () => {
		const s = state(
			turns(
				run({
					status: "awaiting_input",
					ask: {
						toolCallId: "c1",
						index: 0,
						total: 1,
						question: {
							id: "family",
							kind: "family",
							label: "Family",
							title: "Which family should these go in?",
							options: [
								{ value: "f1", label: "Dresses" },
								{ value: "f2", label: "Tops" },
							],
							multiple: false,
						},
					} as AgentRun["ask"],
				}),
			),
		);
		expect(s).toMatchObject({ phase: "asking", line: "Which family should these go in?", detail: "Dresses · Tops" });
	});

	it("counts the drafts still waiting when the reply is done", () => {
		const s = state(turns(run({ status: "awaiting_approval" }), [draft("a", "pending"), draft("b", "pending"), draft("c", "applied")]));
		expect(s).toMatchObject({ phase: "done", line: "2 drafts ready to review", drafts: 2 });
	});

	it("says it failed, and stays quiet for a stopped reply or an empty chat", () => {
		expect(state(turns(run({ status: "failed" })))?.phase).toBe("failed");
		expect(state(turns(run({ status: "cancelled" })))).toBeUndefined();
		expect(state([])).toBeUndefined();
	});
});

describe("ReplyBubble [TC-AICP-122]", () => {
	it("offers Review and Later on finished drafts", () => {
		const html = renderToStaticMarkup(
			<ReplyBubble
				state={{ runId: "r", phase: "done", prompt: "Add dresses", line: "3 drafts ready to review", drafts: 3 }}
				labels={DEFAULT_REPLY_BUBBLE_LABELS}
				onOpen={() => undefined}
				onDismiss={() => undefined}
			/>,
		);
		expect(html).toContain("3 drafts ready to review");
		expect(html).toContain(">Review<");
		expect(html).toContain(">Later<");
	});

	it("shows over the mascot while the panel is closed and a reply is going, never over the open panel", () => {
		const reply = { runId: "r", phase: "working" as const, prompt: "Add dresses", line: "Drafting 3 products", drafts: 0 };
		expect(renderToStaticMarkup(<AgentFloatDock reply={reply} open={false} />)).toContain("ech-ag-reply");
		expect(renderToStaticMarkup(<AgentFloatDock reply={reply} open />)).not.toContain("ech-ag-reply");
	});
});
