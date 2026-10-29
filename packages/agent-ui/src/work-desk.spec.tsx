import type { AgentThread, WorkItem } from "@ech/agent-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentFloatDock } from "./float-dock";
import { currentItem, IssuesButton, IssuesList, WorkRaise } from "./work-desk";

// TC-WQ-070..078 — Issues in the dock: the header's Issues button (label of the most urgent group, else a count
// badge), the Issues list grouped (one label per group, no badge per row, the urgent fact coloured inside the detail
// line), quiet / loading / error states, the mascot's raise bubble and the dock header (History = the plain chat list, no … menu).

const item = (key: string, patch: Partial<WorkItem> = {}): WorkItem => ({
	key,
	source: "shop",
	kind: key,
	group: "now",
	order: 0,
	count: 1,
	title: `${key} title`,
	detail: "Order #1042 · RM 86.00",
	area: "Orders",
	icon: "receipt",
	say: "Lim Wei Jie sent a bank transfer slip for order #1042 (RM 86.00) 40 minutes ago. Want to check it now?",
	short: "Payment slip for #1042 waiting 40 min.",
	actions: [
		{ label: "Check the slip", kind: "prompt", value: "Check the payment slip of order #1042" },
		{ label: "Open order", kind: "link", value: "/orders/1042" },
	],
	taskKey: `shop:${key}`,
	taskTitle: `Task ${key}`,
	fingerprint: `${key}#1`,
	...patch,
});
const noop = () => undefined;
const items = [
	item("payment_proofs", { fact: { text: "waiting 40 min", tone: "late" } }),
	item("orders_to_confirm", { fact: { text: "waiting 2 h", tone: "late" } }),
	item("ask", { source: "ai", group: "you", threadId: "t1", icon: "message-circle-question" }),
	item("discounts_expiring", { group: "week", fact: { text: "end Fri and Sat", tone: "near" } }),
];
const thread = (id: string, patch: Partial<AgentThread> = {}): AgentThread => ({
	id,
	title: `Chat ${id}`,
	runCount: 1,
	createdAt: "2026-10-22T08:00:00Z",
	updatedAt: new Date().toISOString(),
	...patch,
});

describe("IssuesButton [TC-WQ-070]", () => {
	it("is named by the most pressing group: Urgent, then Needs you, then Soon", () => {
		const urgent = renderToStaticMarkup(<IssuesButton items={items} onClick={noop} />);
		expect(urgent).toContain('data-tone="now"');
		expect(urgent).toContain("<span>Urgent</span>");
		expect(urgent).toContain('aria-label="Issues · 4 issues"');
		expect(renderToStaticMarkup(<IssuesButton items={items.slice(2)} onClick={noop} />)).toContain("<span>Needs you</span>");
		expect(renderToStaticMarkup(<IssuesButton items={items.slice(3)} onClick={noop} />)).toContain("<span>Soon</span>");
		expect(renderToStaticMarkup(<IssuesButton items={[]} onClick={noop} />)).not.toContain("ech-ag-issues-badge");
	});

	it("skips an issue put off with Later when picking what leads [TC-WQ-071]", () => {
		const states = [{ key: "payment_proofs", snoozedUntil: new Date(Date.now() + 3_600_000).toISOString(), updatedAt: "x" }];
		expect(currentItem(items, states)?.key).toBe("orders_to_confirm");
		expect(currentItem(items, [{ ...states[0], snoozedUntil: "2000-01-01T00:00:00Z" }] as never)?.key).toBe("payment_proofs");
	});
});

describe("IssuesList [TC-WQ-072]", () => {
	it("groups the issues under one label each, with the urgent fact coloured and no badge words per row", () => {
		const html = renderToStaticMarkup(<IssuesList items={items} onOpenItem={noop} />);
		const order = ["Urgent", "Needs you", "Soon"].map((label) => html.indexOf(`>${label}<`));
		expect([...order].sort((x, y) => x - y)).toEqual(order);
		expect(order.every((index) => index >= 0)).toBe(true);
		expect(html).toContain('data-tone="late">waiting 40 min<');
		expect(html).toContain('data-tone="near">end Fri and Sat<');
	});

	it("is quiet with no issues, shows a skeleton on the first load and a retry on an error [TC-WQ-073]", () => {
		expect(renderToStaticMarkup(<IssuesList items={[]} onOpenItem={noop} />)).toContain("No issues right now");
		expect(renderToStaticMarkup(<IssuesList items={[]} loading onOpenItem={noop} />)).toContain('aria-busy="true"');
		const error = renderToStaticMarkup(<IssuesList items={[]} error onRetry={noop} onOpenItem={noop} />);
		expect(error).toContain("Couldn&#x27;t load your issues");
		expect(error).toContain("Try again");
	});
});

describe("WorkRaise [TC-WQ-074]", () => {
	it("says one item over the mascot with its position, main button and Later", () => {
		const html = renderToStaticMarkup(<WorkRaise item={items[0] as WorkItem} index={0} total={4} onTake={noop} onLater={noop} onHide={noop} />);
		expect(html).toContain("1 / 4");
		expect(html).toContain("Check the slip");
		expect(html).toContain("Later");
		expect(html).not.toContain("Open order");
	});
});

describe("dock header in work mode [TC-WQ-076]", () => {
	const history = { threads: [thread("t1")], onNew: noop, onOpen: noop, onDelete: async () => undefined };

	it("shows the chat's name only, Issues and History on the right, no … menu, Expand only when there is something to review", () => {
		const html = renderToStaticMarkup(
			<AgentFloatDock open title="New chat" staticTitle actions={<IssuesButton items={items} onClick={noop} />} historyButton hideMenu history={history} onWideChange={noop} menu={[{ label: "Customer inbox" }]} />,
		);
		expect(html).toContain("ech-ag-thread-title-static");
		expect(html).not.toContain("chevron-down");
		expect(html).toContain('aria-label="History"');
		expect(html).not.toContain('aria-label="More"');
		expect(html).not.toContain('aria-label="Expand panel"');
		const reviewing = renderToStaticMarkup(<AgentFloatDock open title="Reply to Farid" staticTitle historyButton hideMenu expandable history={history} onWideChange={noop} />);
		expect(reviewing).toContain('aria-label="Expand panel"');
	});
});

describe("quick discard on an Issues row [TC-WQ-077]", () => {
	it("says what it does by kind: discard the drafts, skip the question, dismiss a shop issue", () => {
		const html = renderToStaticMarkup(
			<IssuesList
				items={[items[0] as WorkItem, item("review", { source: "ai", kind: "review", group: "you", key: "ai:review:t1", threadId: "t1" }), item("ask", { source: "ai", kind: "question", group: "you", key: "ai:ask:r1" })]}
				onOpenItem={noop}
				onDiscard={noop}
			/>,
		);
		expect(html).toContain('aria-label="Dismiss: payment_proofs title"');
		expect(html).toContain('aria-label="Discard the drafts: review title"');
		expect(html).toContain('aria-label="Skip the question: ask title"');
		expect(renderToStaticMarkup(<IssuesList items={items} onOpenItem={noop} />)).not.toContain("ech-ag-work-discard");
	});
});
