// @vitest-environment jsdom
import type { AgentRun, ChangeSet } from "@ech/agent-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentAssistantPanel, type PanelDecideOptions } from "./assistant-panel";
import type { AgentChatView } from "./chat";

// TC-AISEC-143 — the panel tells the server who decided: a card approved by the merchant's click carries
// `manual: true` (the server refuses a `requiresClick` card without it); Auto-approve never sends it.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const run: AgentRun = {
	id: "run_1",
	role: "merchant",
	domain: "crm",
	prompt: "Reply to Ahmad",
	status: "awaiting_approval",
	steps: [],
	receipts: [],
	changeSetIds: [],
	startedAt: "2026-10-21T00:00:00Z",
};
const card = (id: string, extra: Partial<ChangeSet> = {}): ChangeSet => ({
	id,
	runId: "run_1",
	domain: "crm",
	title: `Reply ${id}`,
	summary: "",
	risk: "low",
	blastRadius: { kind: "lead", count: 1, label: "1 lead" },
	diffs: [{ entity: { kind: "lead", id: "2" }, field: "reply", before: null, after: "Terima kasih", provenance: "generated" }],
	guardrails: [],
	status: "pending",
	stagedBy: "agent",
	stagedAt: "2026-10-21T00:00:00Z",
	expiresAt: "2999-01-01T00:00:00Z",
	...extra,
});
const view = (changeSets: ChangeSet[]): AgentChatView => ({
	turns: changeSets.length > 0 ? [{ id: "run_1", role: "assistant", run, changeSets }] : [],
	busy: false,
	send: async () => undefined,
	canSend: () => true,
	retry: async () => undefined,
	answer: async () => undefined,
	searchOptions: async () => [],
	attachments: [],
	attachmentError: undefined,
	attachFiles: async () => undefined,
	attachPicked: async () => undefined,
	uploadPictures: async () => [],
	removeAttachment: () => undefined,
	listMedia: async () => [],
});

let host: HTMLDivElement;
let root: Root;
const onDecide = vi.fn(async (changeSet: ChangeSet, _decision: "approve" | "reject", _options?: PanelDecideOptions) => ({ ...changeSet, status: "applied" as const }));
const render = (changeSets: ChangeSet[]) =>
	act(async () => {
		root.render(<AgentAssistantPanel chat={view(changeSets)} pending={changeSets} onDecide={onDecide} placement="inline" />);
	});

beforeEach(() => {
	// jsdom has no CSS.supports (the composer sizes itself with it)
	vi.stubGlobal("CSS", { supports: () => true });
	window.localStorage.clear();
	onDecide.mockClear();
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
});
afterEach(() => {
	act(() => root.unmount());
	host.remove();
	vi.unstubAllGlobals();
});

describe("who decided reaches the server [TC-AISEC-143]", () => {
	it("a click on Approve sends manual: true", async () => {
		const flagged = card("cs_click", { requiresClick: true });
		await render([flagged]);

		const approve = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Approve");
		expect(approve).toBeDefined();
		await act(async () => {
			approve?.click();
		});

		expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: "cs_click" }), "approve", { manual: true });
	});

	it("Auto-approve sends auto: true and never manual", async () => {
		window.localStorage.setItem("ech-agent:auto-approve", "1");
		await render([]);

		await render([card("cs_auto")]);

		expect(onDecide).toHaveBeenCalledTimes(1);
		const [changeSet, decision, options] = onDecide.mock.calls[0] ?? [];
		expect([changeSet?.id, decision]).toEqual(["cs_auto", "approve"]);
		expect(options).toEqual({ auto: true });
	});
});
