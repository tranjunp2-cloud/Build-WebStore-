import type { AgentEvent } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import type { RunStreamLost } from "./gateway";
import { HttpGateway } from "./http";

// TC-AISEC-063..064 — a run's stream cut before its final status (network drop, proxy cut, function limit).

const run = {
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "create 2 drafts",
	status: "planning",
	steps: [],
	receipts: [],
	changeSetIds: [],
	threadId: "thr_1",
	startedAt: "2026-10-22T00:00:00Z",
};

const step = { type: "run.step", runId: "run_1", step: { id: "s1", label: "Understanding", status: "running" } };

/** An SSE response that sends `frames`, then closes — or fails reading when `fail` is set. */
function sse(frames: unknown[], fail?: Error): Response {
	const encoder = new TextEncoder();
	let sent = false;
	const body = new ReadableStream<Uint8Array>({
		// the frames are read first; the cut lands on the next read
		pull(controller) {
			if (!sent) {
				sent = true;
				controller.enqueue(encoder.encode(frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("")));
			} else if (fail) controller.error(fail);
			else controller.close();
		},
	});
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function json(value: unknown): Response {
	return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function gatewayWith(...responses: Response[]) {
	const fetcher = vi.fn(async () => responses.shift() ?? json(null));
	const gw = new HttpGateway({ baseUrl: "/api", fetcher: fetcher as unknown as typeof fetch });
	const lost: RunStreamLost[] = [];
	const events: AgentEvent[] = [];
	gw.onRunStreamLost((l) => lost.push(l));
	gw.subscribe((e) => events.push(e));
	return { gw, fetcher, lost, events };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("HttpGateway run stream lost [TC-AISEC-063]", () => {
	it("TC-AISEC-063: a stream that ends after run.started without a final status reports the run as lost", async () => {
		// Arrange
		const { gw, lost, events } = gatewayWith(sse([{ type: "run.started", run }, step]));

		// Act
		const started = await gw.startRun({ prompt: "create 2 drafts" });
		await flush();

		// Assert
		expect(started.id).toBe("run_1");
		expect(events.map((e) => e.type)).toEqual(["run.step"]);
		expect(lost).toEqual([{ runId: "run_1", reason: "ended" }]);
		gw.close();
	});

	it("TC-AISEC-063: a stream that fails reading after run.started reports the run as lost with the error", async () => {
		// Arrange
		const { gw, lost } = gatewayWith(sse([{ type: "run.started", run }, step], new TypeError("network error")));

		// Act
		await gw.startRun({ prompt: "x" });
		await flush();

		// Assert
		expect(lost).toEqual([{ runId: "run_1", reason: "error", error: "network error" }]);
		gw.close();
	});

	it("TC-AISEC-063: a run.error frame after the run started is kept as the reason", async () => {
		// Arrange
		const { gw, lost } = gatewayWith(sse([{ type: "run.started", run }, { type: "run.error", message: "The run could not continue." }]));

		// Act
		await gw.startRun({ prompt: "x" });
		await flush();

		// Assert
		expect(lost).toEqual([{ runId: "run_1", reason: "ended", error: "The run could not continue." }]);
		gw.close();
	});

	it("TC-AISEC-063: a stream that ends on a final status, a question or a draft to review is not lost", async () => {
		// Arrange
		const question = { id: "family", kind: "family", label: "Family", title: "Which family?", options: [{ value: "fam_1", label: "Shirts" }], multiple: false, allowText: false, allowSkip: true };
		const ask = { toolCallId: "t1", index: 0, total: 1, question };
		const { gw, lost } = gatewayWith(
			sse([{ type: "run.started", run }, step, { type: "run.status", runId: "run_1", status: "applied", answer: "done" }]),
			sse([{ type: "run.started", run: { ...run, id: "run_2" } }, { type: "run.ask", runId: "run_2", ask, answers: [] }]),
			sse([{ type: "run.started", run: { ...run, id: "run_3" } }, { type: "run.status", runId: "run_3", status: "awaiting_approval" }]),
		);

		// Act
		await gw.startRun({ prompt: "a" });
		await gw.startRun({ prompt: "b" });
		await gw.startRun({ prompt: "c" });
		await flush();

		// Assert
		expect(lost).toEqual([]);
		gw.close();
	});

	it("TC-AISEC-063: an answer's resumed stream cut mid-run is lost too", async () => {
		// Arrange
		const { gw, lost } = gatewayWith(sse([{ type: "run.started", run: { ...run, status: "running" } }, step]));

		// Act
		await gw.answerRun("run_1", { toolCallId: "t1", questionId: "q1", text: "the blue one" });
		await flush();

		// Assert
		expect(lost).toEqual([{ runId: "run_1", reason: "ended" }]);
		gw.close();
	});
});

describe("HttpGateway run status reads [TC-AISEC-064]", () => {
	it("TC-AISEC-064: getRun reads the server each time (no stale cached status while polling)", async () => {
		// Arrange
		const { gw, fetcher } = gatewayWith(json({ ...run, status: "running" }), json({ ...run, status: "running" }));

		// Act
		await gw.getRun("run_1");
		const second = await gw.getRun("run_1");

		// Assert
		expect(second?.status).toBe("running");
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(String((fetcher.mock.calls[1] as unknown[])[0])).toBe("/api/agent/runs/run_1");
		gw.close();
	});

	it("TC-AISEC-064: a run read as ended makes the next thread read fresh", async () => {
		// Arrange
		const thread = (status: string) => ({
			thread: { id: "thr_1", title: "Chat", runCount: 1, createdAt: run.startedAt, updatedAt: run.startedAt },
			runs: [{ ...run, status }],
			changeSets: [],
		});
		const { gw, fetcher } = gatewayWith(json(thread("running")), json({ ...run, status: "applied" }), json(thread("applied")));
		await gw.getThread("thr_1");

		// Act
		await gw.getRun("run_1");
		const fresh = await gw.getThread("thr_1");

		// Assert
		expect(fresh?.runs[0]?.status).toBe("applied");
		expect(fetcher).toHaveBeenCalledTimes(3);
		gw.close();
	});
});
