import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pendingEditHref } from "./assistant-panel";
import { DraftCard } from "./draft-card";

// TC-AIWB-40 — a web builder change card shows what changes before approval
// (before → after grouped by section) and, in the site editor, offers "Show"
// instead of "Open in editor" — opening a pending change must never approve it.
// TC-AIWB-65 — "Show" is on every line (the button, the picture, the SEO title),
// not one per section.

const heroDiff = (field: string, before: string | null, after: string) => ({
	entity: { kind: "site_block", id: "blk_hero", label: "Hero · Home" },
	field,
	before,
	after,
	provenance: "generated" as const,
});

const pagePatch: ChangeSet = {
	id: "cs_site",
	runId: "run_1",
	domain: "webbuilder",
	title: "Edit page: Home",
	summary: "Sửa nút ở phần đầu trang để có nhãn rõ ràng và dẫn tới /products",
	risk: "low",
	blastRadius: { kind: "site_block", count: 2, label: "2 sections on 1 page" },
	diffs: [
		heroDiff("headline", "Bộ sưu tập mới", "Chào mừng bạn"),
		heroDiff("ctaButtons", "New Button", "Mua ngay → /products"),
		{ entity: { kind: "site_block", id: "blk_faq", label: "FAQ · Home" }, field: "title", before: "FAQ", after: "Câu hỏi thường gặp", provenance: "generated" },
	],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-21T00:00:00Z",
	expiresAt: "2099-01-01T00:00:00Z",
	action: { kind: "site.page_patch", payload: { siteId: "1", pageId: "7", ops: [], expect: {} } },
};

describe("web builder change card [TC-AIWB-40]", () => {
	it("shows every changed field before → after, grouped by section", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={pagePatch} onApprove={() => undefined} />);

		expect(html).toContain("Hero · Home");
		expect(html).toContain("FAQ · Home");
		expect(html).toMatch(/<s[^>]*>New Button<\/s>/);
		expect(html).toContain("Mua ngay → /products");
		expect(html).toContain("Câu hỏi thường gặp");
	});

	it("in the editor: Show on every changed line [TC-AIWB-65], and no Open in editor on a pending change", () => {
		const html = renderToStaticMarkup(
			<DraftCard changeSet={pagePatch} onApprove={() => undefined} onOpenEditor={() => undefined} onLocate={() => undefined} />,
		);

		// two sections, three lines: one Show per line
		expect(html.match(/class="ech-ag-sc-place"/g)).toHaveLength(2);
		expect(html.match(/class="ech-ag-change-go"/g)).toHaveLength(3);
		expect(html).toContain('aria-label="Show on page: ctaButtons"');
		expect(html).not.toContain("Open in editor");
	});

	it("without the editor (dashboard) keeps Open in editor, and opening a pending change goes to the editor without approving", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={pagePatch} onApprove={() => undefined} onOpenEditor={() => undefined} />);

		expect(html).toContain("Open in editor");
		expect(html).not.toContain("Show on page");
		expect(pendingEditHref(pagePatch)).toBe("/editor/1?pageId=7");
		expect(pendingEditHref({ ...pagePatch, status: "applied" })).toBeUndefined();
	});

	it("a theme change lists its rows but has nothing to show on the canvas", () => {
		const theme: ChangeSet = {
			...pagePatch,
			diffs: [{ entity: { kind: "site_theme", id: "1", label: "Theme" }, field: "primaryColor", before: "#0ea5e9", after: "#f97316", provenance: "generated" }],
			action: { kind: "site.theme_patch", payload: { siteId: "1" } },
		};

		const html = renderToStaticMarkup(<DraftCard changeSet={theme} onLocate={() => undefined} />);

		expect(html).toContain("#f97316");
		expect(html).toContain('class="ech-ag-sc-place"');
		expect(html).not.toContain("Show on page");
	});
});

// TC-AIWB-106 — the change card takes little room: one line (how many changes, where) that
// opens. Waiting for a hand approval (auto-approve off, or a typed confirmation) it opens in
// full; applied, or auto-approve on, it starts folded. Open, each line is the new text (2 lines),
// the old one under it (1 line); a translation's language is said once; long changes "Show all".
describe("compact web builder change card [TC-AIWB-106]", () => {
	const applied: ChangeSet = { ...pagePatch, status: "applied" };

	it("folds an applied change and a change auto-approve will apply, to one line saying how many and where", () => {
		for (const html of [
			renderToStaticMarkup(<DraftCard changeSet={applied} onLocate={() => undefined} />),
			renderToStaticMarkup(<DraftCard changeSet={pagePatch} autoApprove onApprove={() => undefined} onLocate={() => undefined} />),
		]) {
			expect(html).toContain("3 changes in Hero, FAQ");
			expect(html).toContain('aria-expanded="false"');
			expect(html).toContain("Show changes");
			expect(html).not.toContain("Câu hỏi thường gặp");
		}
	});

	it("opens a change waiting for a hand approval, and one that needs a typed confirmation even with auto-approve", () => {
		const manual = renderToStaticMarkup(<DraftCard changeSet={pagePatch} onApprove={() => undefined} />);
		const typed = renderToStaticMarkup(<DraftCard changeSet={{ ...pagePatch, confirmText: "Home" }} autoApprove onApprove={() => undefined} />);

		for (const html of [manual, typed]) {
			expect(html).toContain('aria-expanded="true"');
			expect(html).toContain("Câu hỏi thường gặp");
		}
	});

	it("says a translation's language once and shows the first sections, then Show all", () => {
		const rows = Array.from({ length: 6 }, (_, i) => ({
			entity: { kind: "site_block", id: `blk_${i}`, label: `Section ${i} · Home` },
			field: `Bahasa Melayu · headline`,
			before: `Old ${i}`,
			after: `Baru ${i}`,
			provenance: "generated" as const,
		}));
		const translate: ChangeSet = { ...pagePatch, diffs: rows, action: { kind: "site.translate_page", payload: { siteId: "1", pageId: "7", locale: "ms" } } };

		const html = renderToStaticMarkup(<DraftCard changeSet={translate} onApprove={() => undefined} onLocate={() => undefined} />);

		expect(html).toContain("6 changes in Section 0, Section 1, Section 2 +3");
		expect(html).toContain("<span>headline</span>");
		expect(html).not.toContain("<span>Bahasa Melayu · headline</span>");
		expect(html.match(/class="ech-ag-sc-row"/g)).toHaveLength(4);
		expect(html).toContain("Show all 6 changes");
	});
});

// TC-AICP-137 — any waiting change can be discarded from its card (turned down, nothing applied);
// a discarded card keeps only its head, marked Discarded.
describe("discarding a waiting change [TC-AICP-137]", () => {
	it("offers Discard on a waiting change and not on one already applied", () => {
		const pending = renderToStaticMarkup(<DraftCard changeSet={pagePatch} onApprove={() => undefined} onDismiss={() => undefined} />);
		const applied = renderToStaticMarkup(<DraftCard changeSet={{ ...pagePatch, status: "applied" }} onDismiss={() => undefined} />);

		expect(pending).toContain('aria-label="Discard"');
		expect(applied).not.toContain('aria-label="Discard"');
	});

	it("shows a discarded change as its head only", () => {
		const html = renderToStaticMarkup(<DraftCard changeSet={{ ...pagePatch, status: "rejected" }} onDismiss={() => undefined} />);

		expect(html).toContain("Discarded");
		expect(html).toContain('data-status="rejected"');
		expect(html).not.toContain("Câu hỏi thường gặp");
		expect(html).not.toContain('aria-label="Discard"');
	});
});
