import type { AgentAttachment, AgentEvent, AgentRun, AnswerInput, StartRunInput } from "@ech/agent-core";
import type { AgentGateway } from "@ech/agent-transport";
import { describe, expect, it, vi } from "vitest";
import { ATTACHMENTS_ONLY_PROMPT, attachmentRefusal, ChatSession } from "./chat-session";
import { memoryThreadHint } from "./chat-turns";

// TC-AICP-46 — composer attachments and clarifying answers in the chat session.

const askingRun = (id: string): AgentRun => ({
	id,
	role: "merchant",
	domain: "products",
	prompt: "Create a shirt",
	status: "awaiting_input",
	steps: [],
	receipts: [],
	changeSetIds: [],
	threadId: "thr_1",
	startedAt: "2026-10-20T00:00:00Z",
	ask: {
		toolCallId: "call_1",
		index: 0,
		total: 1,
		question: {
			id: "family",
			kind: "family",
			label: "Family",
			title: "Which family?",
			options: [{ value: "fam_1", label: "Shirts" }],
			multiple: false,
			allowText: false,
			allowSkip: true,
		},
	},
});

const uploaded = (name: string, kind: AgentAttachment["kind"] = "image"): AgentAttachment => ({
	id: `att_${name}`,
	kind,
	origin: "upload",
	name,
	mime: kind === "image" ? "image/jpeg" : "application/pdf",
	size: 10,
	url: kind === "image" ? `/api/agent/attachments/att_${name}/content` : undefined,
});

function gateway() {
	const listeners = new Set<(event: AgentEvent) => void>();
	return {
		listThreads: vi.fn(async () => []),
		getThread: vi.fn(async () => null),
		startRun: vi.fn(async (input: StartRunInput) => ({ ...askingRun("run_1"), prompt: input.prompt })),
		answerRun: vi.fn(async (runId: string, _input: AnswerInput) => ({ ...askingRun(runId), status: "running" as const, ask: undefined })),
		uploadAttachment: vi.fn(async (file: File, options?: { onProgress?: (n: number) => void }) => {
			options?.onProgress?.(0.5);
			return uploaded(file.name, file.type.startsWith("image/") ? "image" : "document");
		}),
		pickMedia: vi.fn(async (item: AgentAttachment) => ({ ...item, id: "att_picked" })),
		subscribe: (listener: (event: AgentEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		emit: (event: AgentEvent) => {
			for (const listener of listeners) listener(event);
		},
		close: () => undefined,
	};
}

function open(gw: ReturnType<typeof gateway>) {
	const s = new ChatSession(gw as unknown as AgentGateway, { hint: memoryThreadHint(""), history: false });
	s.start();
	return s;
}

const file = (name: string, type: string, size = 100) => new File([new Uint8Array(size)], name, { type });

describe("attachments in the composer [TC-AICP-46]", () => {
	it("refuses other types and files over 10 MB, explaining why", () => {
		expect(attachmentRefusal({ name: "a.exe", type: "application/x-msdownload", size: 10 })).toMatch(/only JPG/);
		expect(attachmentRefusal({ name: "big.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
		expect(attachmentRefusal({ name: "chart.csv", type: "text/csv", size: 10 })).toBeNull();
	});

	it("uploads into the tray, sends ready files with the prompt and empties the tray", async () => {
		const gw = gateway();
		const s = open(gw);
		await s.attachFiles([file("shirt.jpg", "image/jpeg"), file("virus.exe", "application/x-msdownload")]);
		expect(s.getSnapshot().attachments.map((a) => [a.name, a.status])).toEqual([["shirt.jpg", "ready"]]);
		expect(s.getSnapshot().attachmentError).toMatch(/virus.exe/);
		expect(s.canSend("")).toBe(true);

		await s.send("");
		expect(gw.startRun).toHaveBeenCalledWith(expect.objectContaining({ prompt: ATTACHMENTS_ONLY_PROMPT, attachmentIds: ["att_shirt.jpg"] }));
		expect(s.getSnapshot().attachments).toEqual([]);
		const userTurn = s.getSnapshot().turns[0];
		expect(userTurn?.role === "user" && userTurn.attachments?.[0]?.name).toBe("shirt.jpg");
	});

	it("adds a picture picked from the library as an attachment", async () => {
		const gw = gateway();
		const s = open(gw);
		await s.attachPicked({ ...uploaded("library.jpg"), id: "asset:asset_1", origin: "media" });
		expect(s.getSnapshot().attachments[0]).toMatchObject({ status: "ready", attachment: { id: "att_picked" } });
	});
});

describe("clarifying answers [TC-AICP-46]", () => {
	it("answers the open question; typing while it is open answers it in your own words", async () => {
		const gw = gateway();
		const s = open(gw);
		await s.send("Create a shirt");
		gw.emit({ type: "run.ask", runId: "run_1", ask: askingRun("run_1").ask ?? null, answers: [] });
		gw.emit({ type: "run.status", runId: "run_1", status: "awaiting_input" });

		await s.send("It is a linen shirt");
		expect(gw.startRun).toHaveBeenCalledTimes(1);
		expect(gw.answerRun).toHaveBeenCalledWith("run_1", { toolCallId: "call_1", questionId: "family", text: "It is a linen shirt" });

		await s.answer("run_1", { toolCallId: "call_1", questionId: "family", values: ["fam_1"] });
		expect(gw.answerRun).toHaveBeenLastCalledWith("run_1", { toolCallId: "call_1", questionId: "family", values: ["fam_1"] });
	});

	it("Try again sends a failed turn once more with the same words and files", async () => {
		const gw = gateway();
		gw.startRun.mockRejectedValueOnce(new Error("The AI took too long to answer."));
		const s = open(gw);
		await s.attachFiles([file("size.pdf", "application/pdf")]);
		await s.send("Create from the chart");
		const failed = s.getSnapshot().turns[1];
		expect(failed?.role === "assistant" && failed.run?.status).toBe("failed");

		await s.retry(failed?.id ?? "");
		expect(gw.startRun).toHaveBeenLastCalledWith(
			expect.objectContaining({ prompt: "Create from the chart", attachmentIds: ["att_size.pdf"] }),
		);
		expect(s.getSnapshot().turns.filter((t) => t.role === "user")).toHaveLength(1);
	});
});
