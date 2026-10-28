import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AICP-176 — an order change reads like a site change in the chat: one place per order (number, total,
// customer), each changed value before → after, nothing to open in the editor on a waiting change, the order
// number typed to approve a cancel or refund, and the safety notes of a change that can't be undone.

const label = "ORD-K3F2 · RM 120.00 · Aisyah";
const row = (field: string, before: string | null, after: string, id = "1") => ({
	entity: { kind: "store_order", id, label },
	field,
	before,
	after,
	provenance: "generated" as const,
});

const ship: ChangeSet = {
	id: "cs_order",
	runId: "run_1",
	domain: "orders",
	title: "Ship order ORD-K3F2",
	summary: "Posted today",
	risk: "medium",
	blastRadius: { kind: "store_order", count: 1, label: "1 order" },
	diffs: [row("Status", "Confirmed", "Shipped"), row("Courier", null, "J&T"), row("Tracking number", null, "JT123")],
	guardrails: [{ rule: "undo", ok: true, detail: "You can undo it for 7 days while nobody edits these orders." }],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-22T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "store.orders_patch", payload: { steps: [], base: {}, undoable: true } },
};

describe("order change card [TC-AICP-176]", () => {
	it("groups the changes under the order and shows each value before → after", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={ship} onApprove={() => undefined} />);

		expect(html).toContain(label);
		expect(html).toContain("3 changes in ORD-K3F2");
		expect(html).toMatch(/<s[^>]*>Confirmed<\/s>/);
		expect(html).toContain("Shipped");
		expect(html).toContain("JT123");
	});

	it("offers no Open in editor on a waiting order change, and asks for the order number on a cancel", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={ship} onApprove={() => undefined} onOpenEditor={() => undefined} />);
		const cancel = renderToStaticMarkup(
			<DraftCard
				changeSet={{
					...ship,
					title: "Cancel order ORD-K3F2",
					risk: "high",
					confirmText: "ORD-K3F2",
					diffs: [row("Status", "Confirmed", "Cancelled"), row("Money", null, "RM 120.00 (the full amount) is refunded to the buyer's card through Stripe.")],
					guardrails: [{ rule: "live", ok: true, detail: "This can't be undone: it moves money and puts the stock back. Cancelling is final." }],
				}}
				onApprove={() => undefined}
			/>,
		);

		expect(html).not.toContain("ech-ag-link");
		expect(cancel).toContain("is-danger");
		expect(cancel).not.toContain('type="text"');
		expect(cancel).toContain("ORD-K3F2");
	});

	it("shows the whole cancel reason the buyer is emailed (all text, no hover-only clip) [TC-AICP-255]", () => {
		const reason = `Sorry, we sold the last piece earlier today. ${"We are very sorry about this. ".repeat(14)}`.trim();
		const html = renderToStaticMarkup(
			<DraftCard
				changeSet={{ ...ship, title: "Cancel order ORD-K3F2", risk: "high", confirmText: "ORD-K3F2", requiresClick: true, diffs: [row("Status", "Confirmed", "Cancelled"), row("Reason (emailed to the buyer as written)", null, reason)] }}
				onApprove={() => undefined}
				onOpenEditor={() => undefined}
			/>,
		);

		expect(html).toContain(reason);
		expect(html).toContain('data-full="order"');
		expect(html).not.toContain(`title="${reason}"`);
	});

	it("opens a card flagged requiresClick even while Auto-approve is on [TC-AICP-253]", () => {
		const confirm: ChangeSet = { ...ship, title: "Confirm order ORD-K3F2", diffs: [row("Status", "Pending", "Confirmed")], requiresClick: true };
		const flagged = renderToStaticMarkup(<DraftCard changeSet={confirm} autoApprove onApprove={() => undefined} />);
		const plain = renderToStaticMarkup(<DraftCard changeSet={{ ...confirm, requiresClick: undefined }} autoApprove onApprove={() => undefined} />);

		// open: the change rows are in the markup; folded (auto-approve will do it): they are not
		expect(flagged).toContain("Confirmed");
		expect(plain).not.toContain("ech-ag-sc-field");
	});
});
