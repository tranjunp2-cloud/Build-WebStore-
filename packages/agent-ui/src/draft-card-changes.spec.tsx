import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DraftCard } from "./draft-card";

// TC-AICP-70 — edit / archive / trash cards: before → after rows and safety notes,
// a red Approve that asks Yes / No for destructive changes (no typing the name), Undo
// offered while the change kept undo data, "Undone" once reverted.

const base: ChangeSet = {
	id: "cs_1",
	runId: "run_1",
	domain: "cms",
	title: "Move to trash: Batik care",
	summary: "Bài thử",
	risk: "high",
	blastRadius: { kind: "blog_post", count: 1, label: "1 post" },
	diffs: [{ entity: { kind: "blog_post", id: "4", label: "Batik care" }, field: "status", before: "Draft", after: "In the trash", provenance: "user_input" }],
	guardrails: [
		{ rule: "version_guard", ok: true, detail: "Applied only if nobody edited it since this draft — otherwise nothing is written." },
		{ rule: "reversible", ok: true, detail: "The post stays in the trash; Restore brings it back." },
	],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-20T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	confirmText: "Batik care",
	action: { kind: "blog.set_status", payload: {} },
};

describe("DraftCard changes [TC-AICP-70]", () => {
	it("shows before → after and a red Approve that asks Yes / No, with nothing to type", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={base} onApprove={() => undefined} />);
		expect(html).toContain("<s>Draft</s>");
		expect(html).toContain("In the trash");
		expect(html).toContain("Restore brings it back");
		expect(html).not.toContain("nobody edited it since");
		expect(html).toMatch(/<button[^>]*is-danger[^>]*>Approve/);
		expect(html).not.toContain('type="text"');
		expect(html).not.toMatch(/<button[^>]*is-danger[^>]*disabled=""/);
	});

	it("offers Undo while undo data lasts, and shows Undone after", () => {
		const applied: ChangeSet = {
			...base,
			status: "applied",
			result: { entities: [], links: [], undo: { kind: "blog.set_status", payload: {}, until: "2099-01-01T00:00:00Z" } },
		};
		expect(renderToStaticMarkup(<DraftCard changeSet={applied} onUndo={() => undefined} />)).toMatch(/Saved[\s\S]*Undo/);
		const expired = { ...applied, result: { ...applied.result!, undo: { ...applied.result!.undo!, until: "2020-01-01T00:00:00Z" } } };
		expect(renderToStaticMarkup(<DraftCard changeSet={expired} onUndo={() => undefined} />)).not.toContain(">Undo<");
		const reverted: ChangeSet = { ...applied, status: "reverted", result: { entities: [], links: [] } };
		const html = renderToStaticMarkup(<DraftCard changeSet={reverted} onUndo={() => undefined} />);
		expect(html).toContain("Undone");
		expect(html).not.toContain(">Undo<");
	});

	it("shows the new cover as a picture on an edit", () => {
		const edit: ChangeSet = {
			...base,
			title: "Edit post: Batik care",
			risk: "low",
			confirmText: undefined,
			diffs: [{ entity: { kind: "blog_post", id: "4", label: "Batik care" }, field: "cover", before: "old.jpg", after: "laptop on a desk", provenance: "generated" }],
			action: { kind: "blog.update", payload: { changes: { cover: { ref: "pixabay:1", url: "https://cdn.pixabay.com/1.jpg" } } } },
		};
		const html = renderToStaticMarkup(<DraftCard changeSet={edit} />);
		expect(html).toContain("ech-ag-change-pic");
		expect(html).toContain("https://cdn.pixabay.com/1.jpg");
		const unsafe = { ...edit, action: { kind: "blog.update", payload: { changes: { cover: { url: "javascript:x" } } } } };
		expect(renderToStaticMarkup(<DraftCard changeSet={unsafe} />)).not.toContain("ech-ag-change-pic");
	});
});
