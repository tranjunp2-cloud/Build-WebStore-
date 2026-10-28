import type { AgentChatTurn, AgentRun } from "@ech/agent-core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentChatThread, type AgentChatView } from "./chat";
import { DEFAULT_QUEUE_LABELS, QueueNotice, stopLabel } from "./queue-notice";

// TC-AISEC-136 — a reply waiting for a free AI slot shows one short notice instead of the spinner: its place, one
// "Stop … and run mine" per request the merchant may stop (a teammate's with their name for owners / admins), Cancel.

const queuedRun: AgentRun = {
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "write a post",
	status: "queued",
	steps: [],
	receipts: [],
	changeSetIds: [],
	threadId: "thr_1",
	startedAt: "2026-10-22T00:00:00Z",
	queue: {
		position: 3,
		ahead: 2,
		running: [
			{ runId: "run_mine", title: "Batik care", requestedBy: { name: "Ali" }, startedAt: "2026-10-22T00:00:00Z", mine: true, canStop: true },
			{ runId: "run_team", title: "Sales report", requestedBy: { name: "Mei" }, startedAt: "2026-10-22T00:00:01Z", mine: false, canStop: true },
			{ runId: "run_other", title: "Hidden", requestedBy: { name: null }, startedAt: "2026-10-22T00:00:02Z", mine: false, canStop: false },
		],
	},
};

/** The buttons of a rendered element tree (function components called, no DOM). */
function buttons(node: ReactNode): ReactElement<{ onClick: () => void; children: ReactNode }>[] {
	if (!isValidElement(node)) return Array.isArray(node) ? node.flatMap(buttons) : [];
	const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
	if (element.type === "button") return [element as ReactElement<{ onClick: () => void; children: ReactNode }>];
	return buttons(element.props.children);
}

function chatView(turns: AgentChatTurn[], extra: Partial<AgentChatView> = {}): AgentChatView {
	return {
		turns,
		busy: true,
		send: async () => undefined,
		canSend: () => false,
		retry: async () => undefined,
		stop: async () => undefined,
		stopRun: async () => true,
		answer: async () => undefined,
		searchOptions: async () => [],
		attachments: [],
		attachmentError: undefined,
		attachFiles: async () => undefined,
		attachPicked: async () => undefined,
		uploadPictures: async () => [],
		removeAttachment: () => undefined,
		listMedia: async () => [],
		...extra,
	};
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("queue notice [TC-AISEC-136]", () => {
	it("TC-AISEC-136: says how many are ahead and offers a stop per stoppable request, with a teammate's name, and Cancel", () => {
		// Act
		const html = renderToStaticMarkup(<QueueNotice run={queuedRun} labels={DEFAULT_QUEUE_LABELS} onStopRun={() => undefined} onCancel={() => undefined} />);

		// Assert
		expect(html).toContain("Waiting for a free AI slot — 2 ahead.");
		expect(html).toContain("Stop “Batik care” and run mine");
		expect(html).toContain("Stop “Mei: Sales report” and run mine");
		expect(html).not.toContain("Hidden");
		expect(html).toContain(">Cancel</button>");
		expect(html).toContain('role="status"');
	});

	it("TC-AISEC-136: the buttons stop the listed request (not the waiting one) and Cancel leaves the queue", () => {
		// Arrange
		const onStopRun = vi.fn();
		const onCancel = vi.fn();
		const tree = QueueNotice({ run: queuedRun, labels: DEFAULT_QUEUE_LABELS, onStopRun, onCancel });
		const [mine, team, cancel] = buttons(tree);

		// Act
		mine?.props.onClick();
		team?.props.onClick();
		cancel?.props.onClick();

		// Assert
		expect(onStopRun.mock.calls).toEqual([["run_mine"], ["run_team"]]);
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("TC-AISEC-136: a reopened chat whose place is not known yet says it is waiting, and an older reply has no buttons", () => {
		// Arrange
		const { queue: _queue, ...unknownPlace } = queuedRun;

		// Act
		const html = renderToStaticMarkup(<QueueNotice run={unknownPlace} labels={DEFAULT_QUEUE_LABELS} />);

		// Assert
		expect(html).toContain("Waiting for a free AI slot.");
		expect(html).not.toContain("<button");
	});

	it("TC-AISEC-136: in the chat, the waiting reply shows the notice instead of the thinking spinner", () => {
		// Arrange
		const turns: AgentChatTurn[] = [
			{ id: "user_1", role: "user", text: "write a post" },
			{ id: "run_1", role: "assistant", run: queuedRun, changeSets: [] },
		];

		// Act
		const html = renderToStaticMarkup(<AgentChatThread chat={chatView(turns)} labels={{ queue: { waiting: "Menunggu slot AI — {n} di hadapan." } }} />);

		// Assert
		expect(html).toContain("Menunggu slot AI — 2 di hadapan.");
		expect(html).toContain("Stop “Mei: Sales report” and run mine");
		expect(html).not.toContain("ech-ag-typing");
	});

	it("TC-AISEC-136: a reply an owner stopped for another request says who stopped it", () => {
		// Arrange
		const stopped: AgentRun = { ...queuedRun, queue: undefined, status: "cancelled", error: "Stopped by Siti to run another request." };
		const turns: AgentChatTurn[] = [
			{ id: "user_1", role: "user", text: "write a post" },
			{ id: "run_1", role: "assistant", run: stopped, changeSets: [] },
		];

		// Act
		const html = renderToStaticMarkup(<AgentChatThread chat={chatView(turns, { busy: false })} />);

		// Assert
		expect(html).toContain("<span>Stopped by Siti to run another request.</span>");
	});

	it("TC-AISEC-136: a member's own request shows its title only", () => {
		expect(stopLabel({ runId: "r", title: "Batik care", requestedBy: { name: "Ali" }, startedAt: "", mine: true, canStop: true }, DEFAULT_QUEUE_LABELS)).toBe(
			"Stop “Batik care” and run mine",
		);
	});
});
