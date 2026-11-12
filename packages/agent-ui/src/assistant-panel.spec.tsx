import type { AgentAsk, AgentRun, ChangeSet, ProductDraftDoc } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { attributeCounts, DraftCard, variantSummary, DEFAULT_DRAFT_LABELS } from "./draft-card";
import { AgentChatThread, type AgentChatView, DEFAULT_CHAT_LABELS, nextPrompts, queuedAfterReply, TypingDots } from "./chat";
import { AgentRecentChats } from "./chat-history";
import { ChatComposer } from "./composer";
import { AgentAssistantPanel, type AgentPanelHistory, draftsToAutoApprove, joinInFlight, needsHandApproval, pendingForChat } from "./assistant-panel";
import { AgentFloatDock } from "./float-dock";
import { AnsweredRow, QuestionCard } from "./question-card";
import { ReviewSheet } from "./review-sheet";

// TC-AICP-47 — option A panel pieces: header actions, question card (tool call),
// draft card facts and the wide review with per-field sources.

const ask: AgentAsk = {
	toolCallId: "call_1",
	index: 0,
	total: 3,
	next: "fit, material",
	question: {
		id: "family",
		kind: "family",
		label: "Family",
		title: "Which family is this product in?",
		why: "The family decides which attributes are required to publish.",
		options: [
			{ value: "f1", label: "Tops › Shirts & Blouses", meta: "14 attributes · 6 required" },
			{ value: "f2", label: "Dresses", meta: "16 attributes · 7 required" },
		],
		suggested: "f1",
		total: 23,
		multiple: false,
		allowText: false,
		allowSkip: true,
	},
};

const doc: ProductDraftDoc = {
	type: "product",
	name: "Oversized Cotton Shirt",
	sku: "OCS",
	price: "RM 89.00",
	family: { code: "shirts", label: "Tops › Shirts & Blouses" },
	fields: [
		{ key: "name", label: "Name", value: "Oversized Cotton Shirt", source: "ai", group: "product" },
		{ key: "fit", label: "Fit", value: "Oversized", source: "you", group: "required" },
		{ key: "pattern", label: "Pattern", value: "Solid", source: "auto", group: "required" },
		{ key: "season", label: "Season", value: "", source: "missing", group: "optional" },
		{ key: "care", label: "Care", value: "Wash cold", source: "ai", group: "optional" },
	],
	variants: {
		axes: [
			{ code: "color", label: "Colour" },
			{ code: "size", label: "Size" },
		],
		rows: ["Grey", "Ivory"].flatMap((c) =>
			["S", "M"].map((size) => ({
				label: `${c} / ${size}`,
				sku: `OCS-${c}-${size}`,
				values: [
					{ axis: "color", value: c },
					{ axis: "size", value: size },
				],
				stock: 0,
			})),
		),
	},
	images: [{ url: "/api/agent/attachments/att_1/content", origin: "upload", role: "main" }],
};

const changeSet: ChangeSet = {
	id: "cs_1",
	runId: "run_1",
	domain: "products",
	title: "Create draft product",
	summary: "",
	risk: "low",
	blastRadius: { kind: "product", count: 1, label: "1" },
	diffs: [],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-20T00:00:00Z",
	expiresAt: "2026-10-21T00:00:00Z",
	drafts: [doc],
};

describe("assistant panel header [TC-AICP-47]", () => {
	it("keeps the header to title, drafts to review, new chat, more and close", () => {
		const html = renderToStaticMarkup(
			<AgentFloatDock
				open
				title="Oversized cotton shirt — new product"
				subtitle="ECH Agent · Products page"
				approvals={[{ id: "cs_1", title: "Oversized Cotton Shirt" }]}
				onNewChat={() => undefined}
				onWideChange={() => undefined}
				menu={[{ label: "Customer inbox", href: "/inbox" }]}
			>
				<div />
			</AgentFloatDock>,
		);
		expect(html).toContain("1 to review");
		for (const label of ["New chat", "More", "Close"]) {
			expect(html).toContain(`aria-label="${label}"`);
		}
		// expand moved into "…"; the page line is a hover title, not a second header row
		expect(html).not.toContain('aria-label="Expand panel"');
		expect(html).not.toContain("<small>ECH Agent · Products page</small>");
		expect(html).not.toContain('role="tab"');
		expect(html).not.toContain("For you");
	});

	it("hides the review pill when no drafts wait", () => {
		const html = renderToStaticMarkup(
			<AgentFloatDock open title="New chat" approvals={[]} onNewChat={() => undefined}>
				<div />
			</AgentFloatDock>,
		);
		expect(html).not.toContain("ech-ag-review-pill");
	});

	it("shows a typing bubble, not a spinner, while a reply is on its way", () => {
		const html = renderToStaticMarkup(<TypingDots label="Thinking" />);
		expect(html).toContain('class="ech-ag-typing"');
		expect(html).toContain('role="status"');
		expect(html).toContain('aria-label="Thinking"');
		expect(html).not.toContain("ech-ag-spin");
	});

	it("inline placement renders the panel open in the rail: no launcher and no close [TC-AIWB-37]", () => {
		const html = renderToStaticMarkup(
			<AgentFloatDock placement="inline" title="Homepage copy" onNewChat={() => undefined} badge={2}>
				<div />
			</AgentFloatDock>,
		);
		expect(html).toContain("ech-ag-panel ech-ag-inline");
		expect(html).toContain('aria-label="New chat"');
		expect(html).not.toContain('aria-label="Close"');
		expect(html).not.toContain("ech-ag-fab");
		expect(html).not.toContain("ech-ag-float-root");
	});
});

describe("question card — the ask_user tool call [TC-AICP-47]", () => {
	it("shows progress, why, shop options with meta, the suggestion pre-selected, search over all and what comes next", () => {
		const html = renderToStaticMarkup(<QuestionCard ask={ask} onAnswer={() => undefined} onSearch={async () => []} />);
		expect(html).toContain("Question 1 of 3");
		expect(html).toContain("14 attributes · 6 required");
		expect(html).toMatch(/aria-checked="true"[^>]*>.*Tops › Shirts &amp; Blouses.*Suggested/);
		expect(html).toContain("Search all 23 families…");
		expect(html).toContain("Next: fit, material");
		expect(html).toContain("Skip, decide later");
	});

	it("collapses answers into one row and marks the decision model's picks", () => {
		const html = renderToStaticMarkup(
			<AnsweredRow
				onChange={() => undefined}
				answers={[
					{ questionId: "a", kind: "attribute", label: "Fit", values: ["o"], display: "Oversized", source: "you" },
					{ questionId: "b", kind: "attribute", label: "Pattern", values: ["s"], display: "Solid", source: "auto", confidence: 0.93 },
				]}
			/>,
		);
		expect(html).toContain("Fit <b>Oversized</b>");
		expect(html).toContain("Pattern <b>Solid</b>");
		// the decision model's pick is a chip that never truncates; the full sentence is its tooltip
		expect(html).toMatch(/class="ech-ag-auto" title="Picked for you from your catalog[^"]*"><svg[^>]*>.*<\/svg>Auto</);
		expect(html).toContain(">Change<");
	});
});

describe("photo question [TC-AICP-51]", () => {
	it("shows photo tiles to pick several, an Upload tile and a photo search", () => {
		const pictures: AgentAsk = {
			toolCallId: "call_1",
			index: 2,
			total: 3,
			question: {
				id: "images",
				kind: "images",
				label: "Photos",
				title: "Add product photos?",
				options: [
					{ value: "asset:1", label: "Grey shirt", imageUrl: "/a1.jpg" },
					{ value: "pixabay:9", label: "Linen", imageUrl: "https://cdn.pixabay.com/9.jpg", credit: "Pixabay · Ann" },
				],
				multiple: true,
				allowText: false,
				allowSkip: true,
				allowUpload: true,
			},
		};
		const html = renderToStaticMarkup(
			<QuestionCard ask={pictures} onAnswer={() => undefined} onSearch={async () => []} onUpload={async () => []} />,
		);
		expect(html.match(/class="ech-ag-q-tile"/g)).toHaveLength(2);
		expect(html).toContain('role="checkbox"');
		expect(html).toContain('title="Linen · Pixabay · Ann"');
		expect(html).toContain("ech-ag-q-tile is-add");
		expect(html).toContain('placeholder="Search photos…"');
		expect(html).toContain("Skip, add later");
		expect(html).not.toContain("Or type your answer");
	});
});

describe("draft card and wide review [TC-AICP-47]", () => {
	it("counts filled attributes and summarises variants", () => {
		expect(attributeCounts(doc)).toEqual({ required: { done: 2, all: 2 }, optional: { done: 1, all: 2 } });
		expect(variantSummary(doc, DEFAULT_DRAFT_LABELS)).toBe("2 colours × 2 sizes · 4 SKUs");
	});

	it("renders the product facts and actions; shrinks to a reference while open on the right", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={changeSet} onApprove={() => undefined} onReview={() => undefined} />);
		expect(html).toContain("Needs you");
		expect(html).toContain("RM 89.00 · Tops › Shirts &amp; Blouses");
		expect(html).toContain("2 of 2");
		expect(html).toContain("1 of 2 filled");
		expect(html).toContain("Review all fields");
		expect(renderToStaticMarkup(<DraftCard changeSet={changeSet} open />)).toContain("data-open");
	});

	it("tags every field with where it came from, folds unset optional fields, keeps nothing saved until approval", () => {
		const html = renderToStaticMarkup(<ReviewSheet changeSet={changeSet} onApprove={() => undefined} onAskChanges={() => undefined} />);
		for (const tag of ["From you", "Picked for you", "AI"]) expect(html).toContain(`>${tag}<`);
		// "Season" is not set: one folded line, not a Missing row
		expect(html).toContain("1 optional not set<small> · Season</small>");
		expect(html).not.toContain("<dt>Season</dt>");
		expect(html).toContain("Attributes");
		expect(html).toContain("Variants");
		expect(html).toContain("Nothing is saved until you approve.");
		expect(html).toContain("Approve and create draft");
	});
});

describe("next messages, Stop and the composer hint [TC-AICP-117]", () => {
	const base: AgentRun = {
		id: "run_1",
		role: "merchant",
		domain: "products",
		prompt: "Analyse my products",
		status: "applied",
		steps: [],
		receipts: [
			{ id: "r1", tool: "search_items", summary: "", durationMs: 1, status: "ok", entityIds: [], phrase: { key: "content.search.product", values: { n: 24 } } },
		],
		changeSetIds: [],
		startedAt: "2026-10-21T00:00:00Z",
	};
	const labels = { followUps: DEFAULT_CHAT_LABELS.followUps };

	it("offers tool follow-ups first, then the assistant's own, deduped and capped at three", () => {
		const run: AgentRun = {
			...base,
			suggestions: [
				{ prompt: "Which of these products have no photos?", source: "model" },
				{ prompt: "Write descriptions for 5 drafts", source: "model" },
				{ prompt: "Raise prices on slow sellers", source: "model" },
				{ prompt: "Archive old drafts", source: "model" },
			],
		};
		expect(nextPrompts(run, labels)).toEqual([
			"Which of these products have no photos?",
			"Write descriptions for 5 drafts",
			"Raise prices on slow sellers",
		]);
	});

	it("offers nothing after a stopped, failed or still-working reply", () => {
		for (const status of ["cancelled", "failed", "running"] as const) {
			expect(nextPrompts({ ...base, status }, labels)).toEqual([]);
		}
	});

	it("turns send into Stop while replying and says typing can go on", () => {
		const html = renderToStaticMarkup(
			<ChatComposer attachments={[]} onFiles={() => undefined} onRemove={() => undefined} onPick={() => undefined} listMedia={async () => []} canSend={() => true} onSend={() => undefined} busy onStop={() => undefined} />,
		);
		expect(html).toContain('aria-label="Stop reply"');
		expect(html).not.toContain('aria-label="Send"');
		expect(html).toContain('placeholder="Type your next message…"');
	});

	it("shows the suggested next message in the empty box with a Tab hint", () => {
		const html = renderToStaticMarkup(
			<ChatComposer attachments={[]} onFiles={() => undefined} onRemove={() => undefined} onPick={() => undefined} listMedia={async () => []} canSend={() => true} onSend={() => undefined} hint="Which products have no photos?" />,
		);
		expect(html).toContain('placeholder="Which products have no photos?"');
		expect(html).toContain("ech-ag-tab-hint");
	});

	it("lets the recent chats list switch into selecting several to delete", () => {
		const thread = { id: "thr_1", title: "Analyse my products", runCount: 1, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" };
		const withDelete = renderToStaticMarkup(
			<AgentRecentChats threads={[thread]} onOpen={() => undefined} onDelete={() => undefined} onClose={() => undefined} />,
		);
		// a trash button by the search (not a "Select" text button) and a trash on each row
		expect(withDelete).toContain('aria-label="Delete several"');
		expect(withDelete).toContain('aria-label="Delete this chat"');
		const readOnly = renderToStaticMarkup(<AgentRecentChats threads={[thread]} onOpen={() => undefined} onClose={() => undefined} />);
		expect(readOnly).not.toContain("Delete several");
		expect(readOnly).not.toContain("ech-ag-recent-del");
	});
});

describe("questions split a run into two replies [TC-AICP-118]", () => {
	const chatView = (run: AgentRun): AgentChatView => ({
		turns: [
			{ id: "u1", role: "user", text: "Fix the button link" },
			{ id: run.id, role: "assistant", run, changeSets: [] },
		],
		busy: run.status === "running",
		send: async () => undefined,
		canSend: () => true,
		retry: async () => undefined,
		answer: async () => undefined,
		searchOptions: async () => [],
		attachments: [],
		attachmentError: undefined,
		attachFiles: async () => undefined,
		attachPicked: async () => undefined,
		uploadPictures: async () => [],
		removeAttachment: () => undefined,
		listMedia: async () => [],
	});
	const asked: AgentRun = {
		id: "run_q",
		role: "merchant",
		domain: "webbuilder",
		prompt: "Fix the button link",
		status: "running",
		steps: [
			{ id: "model_1", label: "Thinking", status: "done", phrase: { key: "step.thinking" } },
			{ id: "model_2", label: "Drafting with your answers", status: "running", phrase: { key: "step.drafting" } },
		],
		receipts: [],
		changeSetIds: [],
		answer: "The hero button has no link. Where should it go?",
		answers: [{ questionId: "q1", kind: "choice", label: "Link", values: [], display: "Shop Now page", source: "you" }],
		intro: { answer: "The hero button has no link. Where should it go?", steps: 1, receipts: 0, thoughtMs: 8_000, resumedAt: "2026-10-21T00:00:10Z" },
		startedAt: "2026-10-21T00:00:00Z",
	};

	it("shows the asking reply as finished and a new typing reply after the answers", () => {
		const html = renderToStaticMarkup(<AgentChatThread chat={chatView(asked)} />);
		expect(html.match(/class="ech-ag-arow"/g)).toHaveLength(2);
		expect(html).toContain("Thought for 8s");
		expect(html.match(/The hero button has no link/g)).toHaveLength(1);
		expect(html).toContain('class="ech-ag-typing"');
		expect(html).toContain("Drafting with your answers");
		// the answers sit under the reply that asked, before the second reply
		expect(html.indexOf("Shop Now page")).toBeLessThan(html.indexOf("ech-ag-typing"));
	});

	it("replaces the typing bubble with the second answer once written", () => {
		const done: AgentRun = {
			...asked,
			status: "applied",
			steps: asked.steps.map((step) => ({ ...step, status: "done" as const })),
			answer: "Linked it to the Shop page.",
			finishedAt: "2026-10-21T00:00:16Z",
		};
		const html = renderToStaticMarkup(<AgentChatThread chat={chatView(done)} />);
		expect(html).not.toContain("ech-ag-typing");
		expect(html).toContain("Linked it to the Shop page.");
		expect(html).toContain("The hero button has no link");
		expect(html).toContain("Thought for 6s");
	});
});

describe("auto-approve switch in the chat footer [TC-AICP-119]", () => {
	it("approves only drafts staged after it went on, still pending, without a typed confirmation", () => {
		// Arrange: one draft already on screen when switched on
		const seen = new Set(["cs_old"]);
		const old = { ...changeSet, id: "cs_old" };
		const fresh = { ...changeSet, id: "cs_new" };
		const destructive = { ...changeSet, id: "cs_delete", confirmText: "Batik Scarf" };
		const decided = { ...changeSet, id: "cs_done", status: "applied" as const };

		// Act
		const picked = draftsToAutoApprove([old, fresh, destructive, decided], seen, true);

		// Assert
		expect(picked.map((c) => c.id)).toEqual(["cs_new"]);
		expect(draftsToAutoApprove([fresh], seen, true)).toEqual([]);
	});

	it("leaves a card flagged requiresClick (money, buyer emails, live codes) to the merchant even with the switch on [TC-AICP-253]", () => {
		const seen = new Set<string>();
		const order = { ...changeSet, id: "cs_confirm", requiresClick: true };
		const plain = { ...changeSet, id: "cs_plain" };
		const typedAndFlagged = { ...changeSet, id: "cs_cancel", requiresClick: true, confirmText: "DEMO-1007" };
		const notFlagged = { ...changeSet, id: "cs_false", requiresClick: false };

		const picked = draftsToAutoApprove([order, plain, typedAndFlagged, notFlagged], seen, true);

		expect(picked.map((c) => c.id)).toEqual(["cs_plain", "cs_false"]);
		// it is not picked up later either: it was seen
		expect(draftsToAutoApprove([order], seen, true)).toEqual([]);
		expect(needsHandApproval(order)).toBe(true);
		expect(needsHandApproval(plain)).toBe(false);
	});

	it("approves nothing while off, and those drafts are not picked up later", () => {
		const seen = new Set<string>();
		expect(draftsToAutoApprove([{ ...changeSet, id: "cs_a" }], seen, false)).toEqual([]);
		expect(draftsToAutoApprove([{ ...changeSet, id: "cs_a" }], seen, true)).toEqual([]);
	});

	it("renders as a switch in the composer footer", () => {
		const html = renderToStaticMarkup(
			<ChatComposer attachments={[]} onFiles={() => undefined} onRemove={() => undefined} onPick={() => undefined} listMedia={async () => []} canSend={() => true} onSend={() => undefined} autoApprove={{ on: true, onChange: () => undefined }} />,
		);
		expect(html).toContain('role="switch"');
		expect(html).toContain('aria-checked="true"');
		expect(html).toContain("Auto-approve");
	});
});

describe("one message waits while a reply is written [TC-AICP-120]", () => {
	it("sends it after a normal reply, puts it back after a question, failure or Stop", () => {
		expect(queuedAfterReply("applied")).toBe("send");
		expect(queuedAfterReply("awaiting_approval")).toBe("send");
		for (const status of ["awaiting_input", "failed", "cancelled", undefined] as const) {
			expect(queuedAfterReply(status)).toBe("restore");
		}
	});
});

describe("next messages are compact quick replies [TC-AICP-117]", () => {
	it("puts the first in the empty box and the rest as one row of chips above it", () => {
		const run: AgentRun = {
			id: "run_s",
			role: "merchant",
			domain: "webbuilder",
			prompt: "Improve my site",
			status: "applied",
			steps: [],
			receipts: [],
			changeSetIds: [],
			answer: "Done.",
			suggestions: [
				{ prompt: "Translate the homepage to English", source: "model" },
				{ prompt: "Check the homepage SEO", source: "model" },
				{ prompt: "Brighten the theme colours", source: "model" },
			],
			startedAt: "2026-10-21T00:00:00Z",
			finishedAt: "2026-10-21T00:00:05Z",
		};
		const chat: AgentChatView = {
			turns: [
				{ id: "u1", role: "user", text: "Improve my site" },
				{ id: run.id, role: "assistant", run, changeSets: [] },
			],
			busy: false,
			send: async () => undefined,
			canSend: () => true,
			retry: async () => undefined,
			answer: async () => undefined,
			searchOptions: async () => [],
			attachments: [],
			attachmentError: undefined,
			attachFiles: async () => undefined,
			attachPicked: async () => undefined,
			uploadPictures: async () => [],
			removeAttachment: () => undefined,
			listMedia: async () => [],
		};
		const html = renderToStaticMarkup(<AgentChatThread chat={chat} />);
		expect(html).toContain('placeholder="Translate the homepage to English"');
		expect(html.match(/class="ech-ag-quick-chip"/g)).toHaveLength(2);
		expect(html).not.toContain(">Ask next<");
	});
});

describe("the review list follows the open chat [TC-AICP-125]", () => {
	const run = (id: string): AgentRun => ({
		id,
		role: "merchant",
		domain: "products",
		prompt: "Draft it",
		status: "awaiting_approval",
		steps: [],
		receipts: [],
		changeSetIds: [],
		startedAt: "2026-10-21T00:00:00Z",
	});
	const mine = { ...changeSet, id: "cs_mine", runId: "run_mine" };
	const other = { ...changeSet, id: "cs_other", runId: "run_other" };
	const another = { ...changeSet, id: "cs_another", runId: "run_another" };
	const view = (turns: AgentChatView["turns"]): AgentChatView => ({
		turns,
		busy: false,
		send: async () => undefined,
		canSend: () => true,
		retry: async () => undefined,
		answer: async () => undefined,
		searchOptions: async () => [],
		attachments: [],
		attachmentError: undefined,
		attachFiles: async () => undefined,
		attachPicked: async () => undefined,
		uploadPictures: async () => [],
		removeAttachment: () => undefined,
		listMedia: async () => [],
	});
	const history = (threadId: string | undefined) => ({
		threadId,
		threads: [],
		restoring: false,
		error: undefined,
		newThread: () => undefined,
		openThread: async () => undefined,
		deleteThread: async () => undefined,
		refresh: async () => undefined,
	});

	it("lists only the open chat's waiting drafts, in their latest state", () => {
		const turns: AgentChatView["turns"] = [{ id: "run_mine", role: "assistant", run: run("run_mine"), changeSets: [mine] }];
		expect(pendingForChat([mine, other, another], turns, "thr_1").map((c) => c.id)).toEqual(["cs_mine"]);
		// approved in the chat while the pending list is stale: nothing left to review
		const decided: AgentChatView["turns"] = [{ id: "run_mine", role: "assistant", run: run("run_mine"), changeSets: [{ ...mine, status: "applied" }] }];
		expect(pendingForChat([mine, other], decided, "thr_1")).toEqual([]);
		// staged in this chat before the pending list refreshed
		expect(pendingForChat([other], turns, "thr_1").map((c) => c.id)).toEqual(["cs_mine"]);
	});

	it("lists every waiting draft on a new, empty chat", () => {
		expect(pendingForChat([mine, other, another], [], undefined).map((c) => c.id)).toEqual(["cs_mine", "cs_other", "cs_another"]);
	});

	it("counts the open chat's drafts in the header pill", () => {
		const turns: AgentChatView["turns"] = [
			{ id: "u_mine", role: "user", text: "Draft it" },
			{ id: "run_mine", role: "assistant", run: run("run_mine"), changeSets: [mine] },
		];
		const open = renderToStaticMarkup(
			<AgentAssistantPanel chat={{ ...view(turns), history: history("thr_1") }} pending={[mine, other, another]} onDecide={async (c) => c} open />,
		);
		// the pill reads "{n} to review" (or the count beside "Drafts waiting for approval")
		expect(open).toMatch(/1 to review|approval \(1\)/);
		const fresh = renderToStaticMarkup(
			<AgentAssistantPanel chat={{ ...view([]), history: history(undefined) }} pending={[mine, other, another]} onDecide={async (c) => c} open />,
		);
		expect(fresh).toMatch(/3 to review|approval \(3\)/);
	});
});

describe("the chat started on the record on screen is offered [TC-AICP-126]", () => {
	const linked = { id: "thr_shirt", title: "Grey Shirt photos", runCount: 2, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z", entity: { kind: "product", id: "prod_1" } };
	const chat: AgentChatView = {
		turns: [],
		busy: false,
		send: async () => undefined,
		canSend: () => true,
		retry: async () => undefined,
		answer: async () => undefined,
		searchOptions: async () => [],
		attachments: [],
		attachmentError: undefined,
		attachFiles: async () => undefined,
		attachPicked: async () => undefined,
		uploadPictures: async () => [],
		removeAttachment: () => undefined,
		listMedia: async () => [],
	};
	const history = (threadId: string | undefined) => ({
		threadId,
		threads: [linked],
		restoring: false,
		error: undefined,
		newThread: () => undefined,
		openThread: async () => undefined,
		deleteThread: async () => undefined,
		refresh: async () => undefined,
		linked,
		openLinked: async () => undefined,
	});

	it("offers it while another (or a new) chat is open, not when it is the open one", () => {
		const other = renderToStaticMarkup(<AgentAssistantPanel chat={{ ...chat, history: history(undefined) }} pending={[]} onDecide={async (c) => c} open />);
		expect(other).toContain('class="ech-ag-linked"');
		expect(other).toContain("Your earlier chat here: Grey Shirt photos");
		const same = renderToStaticMarkup(<AgentAssistantPanel chat={{ ...chat, history: history("thr_shirt") }} pending={[]} onDecide={async (c) => c} open />);
		expect(same).not.toContain("ech-ag-linked");
	});
});

// TC-AIWB-101 — the web editor keeps one chat: the header has the drafts to review and
// "Start over" (off while the chat is empty); no chat title / recent chats, new chat,
// "…" (Expand panel, delete) or earlier-chat offer; the hello says how to attach things
// on the page, and the box asks about the one attached.
describe("one chat in the web editor [TC-AIWB-101]", () => {
	const linked = { id: "thr_old", title: "Hero copy", runCount: 1, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" };
	const button = { kind: "button" as const, label: "Beli sekarang", blockId: "blk_hero", path: "ctaButtons.0.label" };
	const chat = (turns: AgentChatView["turns"], elements: AgentChatView["elements"] = []): AgentChatView & { history: AgentPanelHistory } => ({
		turns,
		busy: false,
		send: async () => undefined,
		canSend: () => true,
		retry: async () => undefined,
		answer: async () => undefined,
		searchOptions: async () => [],
		attachments: [],
		attachmentError: undefined,
		attachFiles: async () => undefined,
		attachPicked: async () => undefined,
		uploadPictures: async () => [],
		removeAttachment: () => undefined,
		listMedia: async () => [],
		elements,
		removeElement: () => undefined,
		history: {
			threadId: turns.length ? "thr_1" : undefined,
			threads: [linked],
			restoring: false,
			error: undefined,
			newThread: () => undefined,
			openThread: async () => undefined,
			deleteThread: async () => undefined,
			refresh: async () => undefined,
			linked,
			openLinked: async () => undefined,
		},
	});
	const render = (view: AgentChatView & { history: AgentPanelHistory }) =>
		renderToStaticMarkup(
			<AgentAssistantPanel
				chat={view}
				pending={[]}
				onDecide={async (c) => c}
				placement="inline"
				singleChat
				helloHint="Click anything on the page to ask about it."
				menu={[{ label: "Customer inbox", href: "/inbox" }]}
			/>,
		);

	it("in a conversation: shows its title read-only and Start over, no new chat or … menu", () => {
		const html = render(chat([{ id: "u_1", role: "user", text: "Friendlier title" }]));

		expect(html).toContain("Start over");
		expect(html).toContain("ech-ag-thread-title-static");
		expect(html).not.toMatch(/<button[^>]*class="ech-ag-thread-title/);
		for (const label of ["New chat", "More", "Expand panel"]) expect(html).not.toContain(`aria-label="${label}"`);
		expect(html).not.toContain("ech-ag-linked");
	});

	it("a new chat has no header (no Start over) and opens like a conversation (no how-to line)", () => {
		const html = render(chat([]));

		expect(html).not.toContain("ech-ag-head");
		expect(html).not.toContain("ech-ag-start-over-btn");
		expect(html).not.toContain("Click anything on the page to ask about it.");
		expect(html).toMatch(/class="ech-ag-arow"[\s\S]*class="ech-ag-hello-bubble"[\s\S]*class="ech-ag-starters"|class="ech-ag-hello-bubble"/);
	});

	it("asks about the attached element in the box", () => {
		expect(render(chat([], [button]))).toContain('placeholder="What should change on this button?"');
		expect(render(chat([], [button, { ...button, path: "ctaButtons.1.label", label: "Lihat" }]))).toContain('placeholder="Ask about these 2…"');
	});
});

describe("every reply's pictures can be used [TC-AICP-128]", () => {
	it("shows Use this under an earlier reply's photos too", () => {
		const withPhotos = (id: string, n: number): AgentRun => ({
			id,
			role: "merchant",
			domain: "cms",
			prompt: "Find coffee photos",
			status: "applied",
			steps: [],
			receipts: [
				{
					id: `r_${id}`,
					tool: "media.search_stock",
					summary: "photos",
					durationMs: 1,
					status: "ok",
					entityIds: [],
					media: [{ url: `https://cdn.pixabay.com/${n}.jpg`, label: "Pixabay · a", imageId: `img_${n}`, ref: `pixabay:${n}` }],
				},
			],
			changeSetIds: [],
			answer: "Found one.",
			startedAt: "2026-10-21T00:00:00Z",
			finishedAt: "2026-10-21T00:00:05Z",
		});
		const chat: AgentChatView = {
			turns: [
				{ id: "u1", role: "user", text: "Find coffee photos" },
				{ id: "run_1", role: "assistant", run: withPhotos("run_1", 1), changeSets: [] },
				{ id: "u2", role: "user", text: "More please" },
				{ id: "run_2", role: "assistant", run: withPhotos("run_2", 2), changeSets: [] },
			],
			busy: false,
			send: async () => undefined,
			canSend: () => true,
			retry: async () => undefined,
			answer: async () => undefined,
			searchOptions: async () => [],
			attachments: [],
			attachmentError: undefined,
			attachFiles: async () => undefined,
			attachPicked: async () => undefined,
			uploadPictures: async () => [],
			removeAttachment: () => undefined,
			listMedia: async () => [],
		};
		const html = renderToStaticMarkup(<AgentChatThread chat={chat} />);
		expect(html.match(/class="ech-ag-pic-use"/g)).toHaveLength(2);
	});
});

// TC-AICP-131 — Approve pressed while auto-approve is applying the same draft waits for that call and
// shows its outcome, instead of a second claim answered "This change is already being applied".
describe("one decision per draft at a time [TC-AICP-131]", () => {
	it("joins the running call, then starts a new one once it settled", async () => {
		const running = new Map<string, Promise<string>>();
		let release: (value: string) => void = () => undefined;
		let calls = 0;
		const start = () => {
			calls += 1;
			return new Promise<string>((resolve) => {
				release = resolve;
			});
		};
		const auto = joinInFlight(running, "cs_1:approve", start);
		const click = joinInFlight(running, "cs_1:approve", start);
		expect(click).toBe(auto);
		expect(calls).toBe(1);
		release("applied");
		await expect(click).resolves.toBe("applied");
		expect(running.size).toBe(0);
		void joinInFlight(running, "cs_1:approve", start);
		expect(calls).toBe(2);
	});

	it("a failed call is shared too, and forgotten so the next press tries again", async () => {
		const running = new Map<string, Promise<string>>();
		const failing = joinInFlight(running, "cs_1:approve", () => Promise.reject(new Error("The picture could not be downloaded.")));
		await expect(joinInFlight(running, "cs_1:approve", () => Promise.resolve("second"))).rejects.toThrow("could not be downloaded");
		await expect(failing).rejects.toThrow();
		expect(running.size).toBe(0);
	});
});
