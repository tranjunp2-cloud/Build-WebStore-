import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AICP-152 — a discount change reads like a site change in the chat: one place per code (the code and how it
// stands today), each changed value before → after, no "Open in editor" on a waiting change, and a delete asks
// Yes / No behind a red Approve (no typing the code).

const code = "SUMMER10 · 10% off · until 31 Dec 2026 · 23/100 used";
const row = (field: string, before: string | null, after: string, id = "1") => ({
	entity: { kind: "store_discount", id, label: code },
	field,
	before,
	after,
	provenance: "generated" as const,
});

const change: ChangeSet = {
	id: "cs_disc",
	runId: "run_1",
	domain: "campaigns",
	title: "Change discount: SUMMER10",
	summary: "Raya campaign",
	risk: "medium",
	blastRadius: { kind: "store_discount", count: 1, label: "1 discount code" },
	diffs: [row("Discount", "10% off", "15% off"), row("Ends", "31 Dec 2026", "15 Jan 2027")],
	guardrails: [{ rule: "live", ok: true, detail: "An active discount applies at checkout at once." }],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-22T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "store.discounts_patch", payload: { steps: [], base: {} } },
};

describe("discount change card [TC-AICP-152]", () => {
	it("groups the changes under the code and shows each value before → after", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={change} onApprove={() => undefined} />);

		expect(html).toContain(code);
		expect(html).toContain("2 changes in SUMMER10");
		expect(html).toMatch(/<s[^>]*>10% off<\/s>/);
		expect(html).toContain("15% off");
		expect(html).toMatch(/<s[^>]*>31 Dec 2026<\/s>/);
		expect(html).toContain("15 Jan 2027");
		expect(html).toContain("An active discount applies at checkout at once.");
	});

	it("offers no Open in editor on a waiting discount change, and asks for the code to delete", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={change} onApprove={() => undefined} onOpenEditor={() => undefined} />);
		const del = renderToStaticMarkup(
			<DraftCard
				changeSet={{ ...change, title: "Delete discount: SUMMER10", risk: "high", confirmText: "SUMMER10", diffs: [row("Deleted", "Used 23 times", "Deleted — the code stops working")] }}
				onApprove={() => undefined}
			/>,
		);

		expect(html).not.toContain("ech-ag-link");
		expect(del).toContain("SUMMER10");
		expect(del).toContain("is-danger");
		expect(del).not.toContain('type="text"');
	});
});
