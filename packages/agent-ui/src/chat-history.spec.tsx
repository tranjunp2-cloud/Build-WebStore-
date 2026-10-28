import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AgentThread } from "@ech/agent-core";
import { AgentRecentChats } from "./chat-history";
import { relativeTime } from "./relative-time";

// TC-AICP-41 — mascot panel chat-history UI (labels + relative times).
// agent/ui has no DOM test setup; interaction is covered by ChatSession (TC-AICP-40).

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("relativeTime [TC-AICP-41]", () => {
	it("reads as now / minutes / hours / days, then a short date", () => {
		expect(relativeTime("2026-10-20T11:59:40Z", "en", NOW)).toBe("now");
		expect(relativeTime("2026-10-20T11:55:00Z", "en", NOW)).toBe("5 min. ago");
		expect(relativeTime("2026-10-20T09:00:00Z", "en", NOW)).toBe("3 hr. ago");
		expect(relativeTime("2026-10-19T11:00:00Z", "en", NOW)).toBe("yesterday");
		expect(relativeTime("2026-09-02T11:00:00Z", "en", NOW)).toBe("Sep 2");
		expect(relativeTime("2025-09-02T11:00:00Z", "en", NOW)).toBe("Sep 2, 2025");
	});

	it("localises and tolerates bad input", () => {
		expect(relativeTime("2026-10-19T11:00:00Z", "vi", NOW)).toMatch(/^hôm qua$/i);
		expect(relativeTime("not a date", "en", NOW)).toBe("");
	});
});

describe("AgentRecentChats [TC-AICP-41]", () => {
	const thread = (id: string, updatedAt: string, extra: Partial<AgentThread> = {}): AgentThread => ({
		id,
		title: `Chat ${id}`,
		runCount: 1,
		createdAt: updatedAt,
		updatedAt,
		...extra,
	});

	it("groups rows by day and marks the open chat", () => {
		const now = Date.now();
		const html = renderToStaticMarkup(
			<AgentRecentChats
				threads={[
					thread("a", new Date(now).toISOString(), { domain: "products", pendingDrafts: 1 }),
					thread("b", new Date(now - 24 * 60 * 60 * 1000).toISOString(), { domain: "cms" }),
				]}
				activeThreadId="a"
				onOpen={() => undefined}
				onClose={() => undefined}
			/>,
		);
		expect(html).toContain("Today");
		expect(html).toContain("Product · 1 draft waiting");
		expect(html).toContain('aria-current="true"');
		expect(html).toContain("Chats are kept for 90 days after your last message.");
	});

	it("names a chat by the page it was asked from when that says more than its domain [TC-AICP-121]", () => {
		const html = renderToStaticMarkup(
			<AgentRecentChats
				threads={[thread("s", new Date().toISOString(), { domain: "products", module: "store" })]}
				onOpen={() => undefined}
				onClose={() => undefined}
			/>,
		);
		expect(html).toContain("Product Store · answered");
	});

	it("shows the empty state with the retention note", () => {
		const html = renderToStaticMarkup(
			<AgentRecentChats threads={[]} onOpen={() => undefined} onClose={() => undefined} />,
		);
		expect(html).toContain("No past chats yet");
		expect(html).toContain("Chats are kept for 90 days.");
	});
});
