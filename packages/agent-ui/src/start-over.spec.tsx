import type { ChangeSet } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { undoable } from "./assistant-panel";
import { DEFAULT_START_OVER_LABELS, StartOverNotes } from "./start-over";

// TC-AIREL-287..289 — Start over says what it takes away: waiting drafts and the Undo of applied changes.

const NOW = Date.parse("2026-10-22T00:00:00Z");

function applied(id: string, until?: string): ChangeSet {
	return {
		id,
		runId: "run_1",
		domain: "cms",
		title: id,
		summary: "",
		risk: "low",
		blastRadius: { kind: "page", count: 1, label: "1 page" },
		diffs: [],
		guardrails: [],
		status: "applied",
		stagedBy: "agent",
		stagedAt: "2026-10-21T00:00:00Z",
		expiresAt: "2026-10-23T00:00:00Z",
		result: { entities: [], links: [], ...(until ? { undo: { kind: "site.update", payload: {}, until } } : {}) },
	} as ChangeSet;
}

const turn = (...changeSets: ChangeSet[]) => ({ id: "run_1", role: "assistant" as const, run: undefined, changeSets });

describe("Start over warns about lost Undo [TC-AIREL-287..289]", () => {
	it("TC-AIREL-287: counts applied changes whose undo is still open, not expired or never undoable ones", () => {
		const turns = [
			{ id: "u1", role: "user" as const, text: "go" },
			turn(applied("a", "2026-10-27T00:00:00Z"), applied("b", "2026-10-21T00:00:00Z"), applied("c"), { ...applied("d", "2026-10-27T00:00:00Z"), status: "reverted" } as ChangeSet),
		];

		expect(undoable(turns, NOW)).toBe(1);
		expect(undoable([], NOW)).toBe(0);
	});

	it("TC-AIREL-288: the confirm lists the lost undo (one / many) next to what stays", () => {
		const one = renderToStaticMarkup(<StartOverNotes labels={DEFAULT_START_OVER_LABELS} discarding={0} undoLost={1} />);
		const many = renderToStaticMarkup(<StartOverNotes labels={DEFAULT_START_OVER_LABELS} discarding={2} undoLost={3} />);

		expect(one).toContain("Changes already made stay on the page.");
		expect(one).toContain("undo 1 change made in this chat");
		expect(many).toContain("2 changes waiting for review");
		expect(many).toContain("undo 3 changes made in this chat");
	});

	it("TC-AIREL-289: nothing to undo and nothing waiting means no warning lines", () => {
		const html = renderToStaticMarkup(<StartOverNotes labels={DEFAULT_START_OVER_LABELS} discarding={0} undoLost={0} />);

		expect(html).toContain("Changes already made stay on the page.");
		expect(html).not.toContain("data-tone");
	});
});
