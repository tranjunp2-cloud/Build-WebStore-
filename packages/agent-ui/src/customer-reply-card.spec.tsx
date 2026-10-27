import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AICP-200 — an email reply to a contact lead in the chat: the merchant reads To, Subject and the whole
// message (line breaks kept, not clamped to two lines) before approving, types the lead's address to approve,
// is told it can't be taken back, and gets no "Open in editor".

const body = "Hai Ahmad,\n\nTerima kasih kerana menghubungi kami. Kami akan menelefon anda dalam 24 jam.\n\nKedai Batik";
const reply = (field: string, after: string) => ({ entity: { kind: "lead_reply", id: "reply:5", label: "Email to Ahmad" }, field, before: null, after, provenance: "generated" as const });

const change: ChangeSet = {
	id: "cs_reply",
	runId: "run_1",
	domain: "crm",
	title: "Reply to Ahmad",
	summary: "Thank them and call back in 24 hours",
	risk: "high",
	confirmText: "ahmad@x.my",
	blastRadius: { kind: "crm_record", count: 1, label: "1 lead" },
	diffs: [
		reply("To", "Ahmad <ahmad@x.my>"),
		reply("Subject", "Terima kasih"),
		reply("Message", body),
		{ entity: { kind: "contact_lead", id: "5", label: "Lead: Ahmad · ahmad@x.my" }, field: "Status", before: "New", after: "Contacted (once the email is sent)", provenance: "generated" as const },
	],
	guardrails: [{ rule: "live", ok: true, detail: "The email is sent as soon as you approve. It can't be taken back." }],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-22T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "store.customers_patch", payload: { steps: [], base: {} } },
};

describe("lead reply card [TC-AICP-200]", () => {
	it("shows To, Subject and the whole message with its line breaks, open for a hand approval", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={change} onApprove={() => undefined} />);

		expect(html).toContain("Ahmad &lt;ahmad@x.my&gt;");
		expect(html).toContain("Terima kasih");
		// the message is one block that keeps its breaks and is not clamped like a site change's text
		expect(html).toMatch(/<b data-full=""[^>]*>Hai Ahmad,\n\nTerima kasih kerana menghubungi kami\. Kami akan menelefon anda dalam 24 jam\.\n\nKedai Batik<\/b>/);
		// other lines of the card stay as before: no data-full on the status line
		expect(html.match(/data-full=""/g)).toHaveLength(3);
		expect(html).toContain("The email is sent as soon as you approve. It can&#x27;t be taken back.");
	});

	it("asks Yes / No behind a red Approve (no address to type), and offers no Open in editor", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={change} onApprove={() => undefined} onOpenEditor={() => undefined} />);

		expect(html).toContain("is-danger");
		expect(html).not.toContain('type="text"');
		expect(html).toContain("ahmad@x.my");
		expect(html).not.toContain("ech-ag-link");
	});
});
