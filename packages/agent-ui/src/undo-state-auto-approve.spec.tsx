import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AutoApproveWait, autoApproveOutcome } from "./assistant-panel";
import { DraftCard } from "./draft-card";

// TC-AIREL-308 — a card's Undo that would be refused is disabled and says why; the host can relabel it.
// TC-AIREL-309 — Auto-approve: a host "wait" keeps the card pending and retries; any other failure is shown, not swallowed.

const applied: ChangeSet = {
	id: "cs_1",
	runId: "run_1",
	domain: "webbuilder",
	title: "Change hero headline",
	summary: "",
	risk: "low",
	blastRadius: { kind: "site_page", count: 1, label: "1 section" },
	diffs: [{ entity: { kind: "site_page", id: "12" }, field: "headline", before: "Old", after: "New", provenance: "generated" }],
	guardrails: [],
	status: "applied",
	stagedBy: "agent",
	stagedAt: "2026-10-22T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "site.page_patch", payload: {} },
	result: { entities: [], links: [], undo: { kind: "site.page_restore", payload: {}, until: "2099-01-01T00:00:00Z" } },
};

describe("DraftCard Undo state from the host [TC-AIREL-308]", () => {
	it("is enabled and plain without a host state", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={applied} onUndo={() => undefined} />);
		expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Undo<\/button>/);
		expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Undo/);
	});

	it("is disabled, titled and explained when the host blocks it", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={applied} onUndo={() => undefined} undoState={{ blocked: "Undo “Shorter headline” first." }} />);
		expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Undo “Shorter headline” first\."/);
		expect(html).toContain("ech-ag-pe-note");
		expect(html).toContain("Undo “Shorter headline” first.");
	});

	it("takes the host's label and note", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={applied} onUndo={() => undefined} undoState={{ label: "Restore previous version", note: "Ctrl+Z undoes it" }} />);
		expect(html).toContain("Restore previous version");
		// the note is a sentence on its own line under the buttons, never squeezed beside them
		expect(html).toMatch(/class="ech-ag-pe-note ech-ag-undo-note">Ctrl\+Z undoes it</);
		expect(html).toContain("Ctrl+Z undoes it");
	});

	it("shows no Undo for a change that is not applied", () => {
		const reverted: ChangeSet = { ...applied, status: "reverted", result: { entities: [], links: [] } };
		const html = renderToStaticMarkup(<DraftCard changeSet={reverted} onUndo={() => undefined} undoState={{ blocked: "x" }} />);
		expect(html).not.toContain(">x<");
	});
});

describe("Auto-approve outcome and notice [TC-AIREL-309]", () => {
	it("a host wait is retried and shown as a waiting note, not an error", () => {
		expect(autoApproveOutcome(new AutoApproveWait("Waiting until you finish editing…"))).toEqual({ text: "Waiting until you finish editing…", error: false, retry: true });
	});

	it("any other failure is shown as an error and not retried", () => {
		expect(autoApproveOutcome(new Error("Your latest edits could not be saved."))).toEqual({ text: "Your latest edits could not be saved.", error: true, retry: false });
		expect(autoApproveOutcome("boom")).toMatchObject({ error: true, retry: false });
	});

	it("a pending card shows the note: waiting as a status line, a failure as an alert", () => {
		const pending: ChangeSet = { ...applied, status: "pending", result: undefined };
		const wait = renderToStaticMarkup(<DraftCard changeSet={pending} onApprove={() => undefined} notice={{ text: "Waiting until you finish editing…", error: false }} />);
		expect(wait).toMatch(/role="status"[^>]*>Waiting until you finish editing…/);
		const failed = renderToStaticMarkup(<DraftCard changeSet={pending} onApprove={() => undefined} notice={{ text: "Could not apply", error: true }} />);
		expect(failed).toMatch(/ech-ag-draft-error[^>]*role="alert"[^>]*>Could not apply|role="alert"[^>]*>Could not apply/);
	});
});
