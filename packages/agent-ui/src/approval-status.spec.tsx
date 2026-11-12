import type { AgentChatTurn, AgentRun, ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { approvalLine, approvalState, DEFAULT_APPROVAL_LABELS, sentencesOf, withoutApprovalClaims } from "./approval-status";
import { AgentChatThread, type AgentChatView } from "./chat";

// TC-AICHAT-014 — issue #2217: whether a reply's change waits, is applied or was undone comes from the cards, never
// from the model's words. Its own status sentences are taken out and one line drawn from the cards replaces them.

const card = (over: Partial<ChangeSet> = {}): ChangeSet => ({
	id: "cs_1",
	runId: "run_1",
	domain: "webbuilder",
	title: "Edit page: Home",
	summary: "Change the hero heading",
	risk: "low",
	blastRadius: { kind: "site_block", count: 1, label: "1 section" },
	diffs: [{ entity: { kind: "site_block", id: "blk_hero", label: "Hero · Home" }, field: "Headline", before: "Old", after: "QA-TEST", provenance: "generated" }],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-11-04T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "site.page_patch", payload: { siteId: "1", pageId: "7", ops: [], expect: {} } },
	...over,
});

const run: AgentRun = {
	id: "run_1",
	role: "merchant",
	domain: "webbuilder",
	prompt: "Change the heading",
	status: "applied",
	steps: [],
	receipts: [],
	changeSetIds: ["cs_1"],
	threadId: "thr_1",
	startedAt: "2026-11-04T00:00:00Z",
	answer: "Changes the hero heading to “QA-TEST”. It waits for your approval and goes live when you publish.",
};

function view(changeSets: ChangeSet[]): AgentChatView {
	const turns: AgentChatTurn[] = [{ id: "run_1", role: "assistant", run, changeSets }];
	return {
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
	};
}

describe("approval state from the card [TC-AICHAT-014]", () => {
	it("TC-AICHAT-014: maps each card status, and Auto-approve, to what the merchant must know", () => {
		expect(approvalState(card())).toBe("waiting");
		expect(approvalState(card(), true)).toBe("applying");
		expect(approvalState(card({ requiresClick: true }), true)).toBe("waiting_click");
		expect(approvalState(card({ confirmText: "Kedai" }), true)).toBe("waiting_typed");
		expect(approvalState(card({ access: { canDecide: false } } as Partial<ChangeSet>))).toBe("waiting_owner");
		expect(approvalState(card({ status: "applied" }))).toBe("applied");
		expect(approvalState(card({ status: "reverted" }))).toBe("undone");
		expect(approvalState(card({ status: "rejected" }))).toBe("rejected");
		expect(approvalState(card({ expiresAt: "2020-01-01T00:00:00Z" }))).toBe("expired");
	});

	it("TC-AICHAT-014: one line for one state, the count of each when the cards differ", () => {
		expect(approvalLine([card({ status: "applied" })], DEFAULT_APPROVAL_LABELS)?.text).toBe("Applied. You can undo it from the card.");
		expect(approvalLine([card({ status: "applied" }), card({ id: "cs_2" })], DEFAULT_APPROVAL_LABELS)).toEqual({ state: "waiting", text: "1 applied · 1 waiting for approval" });
		expect(approvalLine([], DEFAULT_APPROVAL_LABELS)).toBeNull();
	});
});

describe("the reply's own status sentences are taken out [TC-AICHAT-014]", () => {
	it("TC-AICHAT-014: drops approval / applied / undo claims in English, Malay and Vietnamese, keeps the rest", () => {
		expect(withoutApprovalClaims(run.answer ?? "")).toBe("Changes the hero heading to “QA-TEST”.");
		expect(withoutApprovalClaims("Changes the heading to “QA-TEST”. The change is applied; you can undo it from its card.")).toBe("Changes the heading to “QA-TEST”.");
		expect(withoutApprovalClaims("Tajuk ditukar kepada “QA”. Ia menunggu kelulusan anda.")).toBe("Tajuk ditukar kepada “QA”.");
		expect(withoutApprovalClaims("Đổi tiêu đề thành “QA”. Thay đổi đang chờ bạn duyệt.")).toBe("Đổi tiêu đề thành “QA”.");
		expect(withoutApprovalClaims("Add a price to finish the product. Which photo should I use?")).toBe("Add a price to finish the product. Which photo should I use?");
		// "done" wording is a status claim too: right only once the card is applied
		expect(withoutApprovalClaims("The Home page hero heading is now “QA”. Add a photo next?")).toBe("Add a photo next?");
		expect(withoutApprovalClaims("I've changed the button text to “Shop”.")).toBe("");
		expect(withoutApprovalClaims("Mình đã đổi tiêu đề thành “QA”.")).toBe("");
		expect(withoutApprovalClaims("Changes the hero heading to “QA”.")).toBe("Changes the hero heading to “QA”.");
	});
});

describe("sentences are cut only at a real sentence end [TC-AICHAT-014]", () => {
	it("TC-AICHAT-014: prices, addresses, versions and e.g. stay whole", () => {
		expect(sentencesOf("Prices start at RM 19.90 on example.com, e.g. the v2.1 range. Check the preview.")).toEqual([
			"Prices start at RM 19.90 on example.com, e.g. the v2.1 range. ",
			"Check the preview.",
		]);
	});

	it("TC-AICHAT-014: a status sentence with a price or link goes whole; nothing is left cut", () => {
		expect(withoutApprovalClaims("Changes the price to RM 19.90. It waits for your approval. Check the preview.")).toBe("Changes the price to RM 19.90. Check the preview.");
		expect(withoutApprovalClaims("Prices are now shown in RM 19.90. Check the preview.")).toBe("Prices are now shown in RM 19.90. Check the preview.");
		expect(withoutApprovalClaims("The button links to https://example.com/sale. Undo is on the card.")).toBe("The button links to https://example.com/sale.");
	});
});

describe("sentences that are not about the card's status stay [TC-AICHAT-014]", () => {
	it.each([
		"The banner stays pending review by legal until Friday.",
		"Gallery images are live on the homepage already.",
		"Sản phẩm này đã hoàn tác lại từ đơn trước.",
		"Done with that, here is the list.",
		"Your shop is now on the Pro plan.",
		"Đơn hàng giờ là của khách mới.",
	])("TC-AICHAT-014: keeps %s", (text) => {
		expect(withoutApprovalClaims(text)).toBe(text);
	});
});

describe("a reply with a card shows the card's status, not the model's [TC-AICHAT-014]", () => {
	it("TC-AICHAT-014: approved by hand → the line says applied, the model's 'waits for your approval' is gone", () => {
		const html = renderToStaticMarkup(<AgentChatThread chat={view([card({ status: "applied" })])} />);

		expect(html).toContain("Applied. You can undo it from the card.");
		expect(html).not.toContain("waits for your approval");
		expect(html).toContain("Changes the hero heading to “QA-TEST”.");
	});

	it("TC-AICHAT-014: still pending → the line says it waits; undone → says undone", () => {
		expect(renderToStaticMarkup(<AgentChatThread chat={view([card()])} />)).toContain("Waiting for your approval — nothing changes until you click Approve.");
		expect(renderToStaticMarkup(<AgentChatThread chat={view([card({ status: "reverted" })])} />)).toContain("Undone — the change was taken back.");
	});

	it("TC-AICHAT-014: the host's language is used", () => {
		const html = renderToStaticMarkup(<AgentChatThread chat={view([card({ status: "applied" })])} labels={{ approval: { line: { applied: "Đã áp dụng. Bạn có thể hoàn tác trên thẻ." } } }} />);

		expect(html).toContain("Đã áp dụng. Bạn có thể hoàn tác trên thẻ.");
	});
});
