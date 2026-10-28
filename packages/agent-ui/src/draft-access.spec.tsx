import type { BlogDraftDoc, ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentAssistantPanel, autoApprovable, draftsToAutoApprove } from "./assistant-panel";
import { campaignQueue } from "./campaign-group";
import type { AgentChatView } from "./chat";
import { askedByLine, decideBlockedLine } from "./draft-access";
import { DEFAULT_DRAFT_LABELS, DraftCard } from "./draft-card";
import { PRODUCT_EDIT_LABELS } from "./locales/product-edit-labels";
import { ReviewSheet } from "./review-sheet";

// TC-AISEC-077 — a teammate's draft says who asked; a draft the caller may not decide shows one plain sentence
//   instead of Approve / Discard / Undo (en, ms, vi), on the card and in the wide review.
// TC-AISEC-078 — Auto-approve and "Approve all" never act on a draft that is not the caller's or not theirs to decide;
//   owners / admins find their teammates' waiting drafts in the review list, labelled.

const blog: BlogDraftDoc = { type: "blog", title: "Raya sale", html: "<p>Hi</p>", words: 120, sections: 2, images: [] };

function card(id: string, extra: Partial<ChangeSet> = {}): ChangeSet {
	return {
		id,
		runId: `run_${id}`,
		domain: "webbuilder",
		title: `Change ${id}`,
		summary: "Shorter headline",
		risk: "low",
		blastRadius: { kind: "site_page", count: 1, label: "1 section" },
		diffs: [{ entity: { kind: "site_page", id: "12" }, field: "headline", before: "Old", after: "New", provenance: "generated" }],
		guardrails: [],
		status: "pending",
		stagedBy: "agent",
		stagedAt: "2026-10-22T00:00:00Z",
		expiresAt: "2099-01-01T00:00:00Z",
		action: { kind: "site.page_patch", payload: {} },
		...extra,
	};
}

const viewersOwn = (extra: Partial<ChangeSet> = {}) =>
	card("cs_v", { requestedBy: { id: "usr_v", name: "Chong Wei" }, mine: true, access: { canDecide: false, reason: "needs_owner_or_admin" }, ...extra });
const teammatesForOwner = (name: string | null = "Ben Tan", extra: Partial<ChangeSet> = {}) =>
	card("cs_t", { requestedBy: { id: "usr_t", name }, mine: false, access: { canDecide: true }, ...extra });
const undoData = { entities: [], links: [], undo: { kind: "site.page_restore", payload: {}, until: "2099-01-01T00:00:00Z" } };

describe("draft cards between teammates [TC-AISEC-077]", () => {
	it("TC-AISEC-077: an owner sees who asked for a teammate's draft and can still approve it", () => {
		// Act
		const named = renderToStaticMarkup(<DraftCard changeSet={teammatesForOwner()} onApprove={() => undefined} onDismiss={() => undefined} />);
		const unnamed = renderToStaticMarkup(<DraftCard changeSet={teammatesForOwner(null)} onApprove={() => undefined} />);
		const own = renderToStaticMarkup(<DraftCard changeSet={card("cs_o", { mine: true, access: { canDecide: true } })} onApprove={() => undefined} />);

		// Assert
		expect(named).toContain("Asked by Ben Tan");
		expect(named).toContain(">Approve<");
		expect(named).toContain('aria-label="Discard"');
		expect(unnamed).toContain("Asked by a teammate");
		expect(own).not.toContain("Asked by");
	});

	it("TC-AISEC-077: a viewer's own draft has no Approve / Discard, only the sentence saying who approves it", () => {
		// Act
		const html = renderToStaticMarkup(<DraftCard changeSet={viewersOwn()} onApprove={() => undefined} onDismiss={() => undefined} onOpenEditor={() => undefined} />);

		// Assert
		expect(html).toContain("An owner or admin needs to approve this.");
		expect(html).not.toContain(">Approve<");
		expect(html).not.toContain('aria-label="Discard"');
		expect(html).not.toContain("Open in editor");
	});

	it("TC-AISEC-077: an applied draft the caller may not decide has no Undo", () => {
		// Act
		const blocked = renderToStaticMarkup(<DraftCard changeSet={viewersOwn({ status: "applied", result: undoData })} onUndo={() => undefined} />);
		const allowed = renderToStaticMarkup(<DraftCard changeSet={teammatesForOwner("Ben Tan", { status: "applied", result: undoData })} onUndo={() => undefined} />);

		// Assert
		expect(blocked).not.toContain(">Undo<");
		expect(allowed).toContain(">Undo<");
	});

	it("TC-AISEC-077: the sentences come in Malay and Vietnamese, and an unknown reason reads as not yours", () => {
		// Arrange
		const ms = { ...DEFAULT_DRAFT_LABELS, ...PRODUCT_EDIT_LABELS.ms };
		const vi = { ...DEFAULT_DRAFT_LABELS, ...PRODUCT_EDIT_LABELS.vi };

		// Act + Assert
		expect(decideBlockedLine(viewersOwn(), ms)).toBe("Pemilik atau admin perlu meluluskan ini.");
		expect(askedByLine(teammatesForOwner(), ms)).toBe("Diminta oleh Ben Tan");
		expect(decideBlockedLine(viewersOwn(), vi)).toBe("Cần chủ cửa hàng hoặc quản trị viên duyệt.");
		expect(askedByLine(teammatesForOwner(), vi)).toBe("Ben Tan yêu cầu");
		expect(decideBlockedLine(card("cs_x", { access: { canDecide: false, reason: "something_new" } }), DEFAULT_DRAFT_LABELS)).toBe(DEFAULT_DRAFT_LABELS.notYours);
		expect(decideBlockedLine(card("cs_y"), DEFAULT_DRAFT_LABELS)).toBeUndefined();
	});

	it("TC-AISEC-077: the wide review hides Approve and Discard on a viewer's own draft and says why", () => {
		// Act
		const html = renderToStaticMarkup(<ReviewSheet changeSet={viewersOwn({ drafts: [blog] })} onApprove={() => undefined} onDiscard={() => undefined} onAskChanges={() => undefined} />);

		// Assert
		expect(html).toContain("An owner or admin needs to approve this.");
		expect(html).not.toContain("is-primary");
		expect(html).not.toContain('aria-label="Discard"');
	});

	it("TC-AISEC-077: a teammate's change with nothing to preview opens as its card in the review, labelled", () => {
		// Act
		const html = renderToStaticMarkup(<ReviewSheet changeSet={teammatesForOwner()} onApprove={() => undefined} onAskChanges={() => undefined} />);

		// Assert
		expect(html).toContain("Asked by Ben Tan");
		expect(html).toContain(">Approve<");
	});
});

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

describe("Auto-approve, Approve all and the review list [TC-AISEC-078]", () => {
	it("TC-AISEC-078: Auto-approve leaves a viewer's draft and a teammate's draft alone; the caller's own still goes", () => {
		// Arrange
		const own = card("cs_own", { mine: true, access: { canDecide: true } });
		const legacy = card("cs_legacy");
		const seen = new Set<string>();

		// Act
		const picked = draftsToAutoApprove([viewersOwn(), teammatesForOwner(), own, legacy], seen, true);

		// Assert
		expect(picked.map((c) => c.id)).toEqual(["cs_own", "cs_legacy"]);
		expect(autoApprovable(viewersOwn())).toBe(false);
		expect(autoApprovable(teammatesForOwner())).toBe(false);
	});

	it("TC-AISEC-078: Approve all never takes a card the caller may not decide", () => {
		// Arrange
		const group = { id: "camp_1", label: "Raya" };
		const cards = [viewersOwn({ id: "cs_a", group }), viewersOwn({ id: "cs_b", group })];

		// Act + Assert
		expect(campaignQueue(cards)).toEqual([]);
		expect(campaignQueue([card("cs_c", { group }), card("cs_d", { group })]).map((c) => c.id)).toEqual(["cs_c", "cs_d"]);
	});

	it("TC-AISEC-078: an owner's review list labels a teammate's draft; with the work queue it lists teammates' drafts only", () => {
		// Arrange
		const own = card("cs_own", { mine: true, access: { canDecide: true } });
		const teammate = teammatesForOwner();
		const history = { threadId: undefined, threads: [], restoring: false, error: undefined, newThread: () => undefined, openThread: async () => undefined, deleteThread: async () => undefined, refresh: async () => undefined };
		const work = { items: [], states: [], onLater: () => undefined };

		// Act
		const plain = renderToStaticMarkup(<AgentAssistantPanel chat={{ ...view([]), history }} pending={[own, teammate]} onDecide={async (c) => c} open />);
		const withQueue = renderToStaticMarkup(<AgentAssistantPanel chat={{ ...view([]), history }} pending={[own, teammate]} onDecide={async (c) => c} work={work} open />);
		const ownOnly = renderToStaticMarkup(<AgentAssistantPanel chat={{ ...view([]), history }} pending={[own]} onDecide={async (c) => c} work={work} open />);

		// Assert
		expect(plain).toMatch(/2 to review|approval \(2\)/);
		expect(withQueue).toMatch(/1 to review|approval \(1\)/);
		expect(ownOnly).not.toMatch(/to review|approval \(/);
	});
});
