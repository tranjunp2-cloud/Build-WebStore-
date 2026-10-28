import type { AgentEvent } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import type { RunStreamLost } from "./gateway";
import { HttpGateway } from "./http";

// TC-AISEC-134 — a run waiting for a free AI slot: its `run.queued` frames reach subscribers, a stream cut while
// it waits is a lost (still live) run, and every prompt carries a fresh clientRequestId.

const queuedRun = {
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
};

const queued = {
	type: "run.queued",
	runId: "run_1",
	position: 2,
	ahead: 1,
	running: [{ runId: "run_0", title: "Batik care", requestedBy: { name: "Ali" }, startedAt: "2026-10-22T00:00:00Z", mine: false, canStop: true }],
};

function sse(frames: unknown[]): Response {
	const encoder = new TextEncoder();
	let sent = false;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			if (!sent) {
				sent = true;
				controller.enqueue(encoder.encode(frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("")));
			} else controller.close();
		},
	});
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function gatewayWith(...responses: Response[]) {
	const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? new Response("null"));
	const gw = new HttpGateway({ baseUrl: "/api", fetcher: fetcher as unknown as typeof fetch });
	const lost: RunStreamLost[] = [];
	const events: AgentEvent[] = [];
	gw.onRunStreamLost((l) => lost.push(l));
	gw.subscribe((e) => events.push(e));
	return { gw, fetcher, lost, events };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const sentBody = (fetcher: ReturnType<typeof gatewayWith>["fetcher"], call: number) => JSON.parse(String(fetcher.mock.calls[call]?.[1]?.body ?? "{}"));

describe("HttpGateway queued runs [TC-AISEC-134]", () => {
	it("TC-AISEC-134: passes run.queued frames to subscribers and resolves with the queued run", async () => {
		// Arrange
		const step = { type: "run.status", runId: "run_1", status: "planning" };
		const { gw, events } = gatewayWith(sse([{ type: "run.started", run: queuedRun }, queued, step, { type: "run.status", runId: "run_1", status: "applied", answer: "Done." }]));

		// Act
		const started = await gw.startRun({ prompt: "write a post" });
		await flush();

		// Assert
		expect(started.status).toBe("queued");
		expect(events.map((e) => e.type)).toEqual(["run.queued", "run.status", "run.status"]);
		expect(events[0]).toMatchObject({ position: 2, ahead: 1, running: [{ runId: "run_0", canStop: true }] });
		gw.close();
	});

	it("TC-AISEC-134: a stream that ends while the run still waits for a slot reports it lost (it is followed, not dropped)", async () => {
		// Arrange
		const { gw, lost } = gatewayWith(sse([{ type: "run.started", run: queuedRun }, queued]));

		// Act
		await gw.startRun({ prompt: "write a post" });
		await flush();

		// Assert
		expect(lost).toEqual([{ runId: "run_1", reason: "ended" }]);
		gw.close();
	});

	it("TC-AISEC-134: sends a fresh clientRequestId with every prompt, and keeps one the caller gave", async () => {
		// Arrange
		const started = { type: "run.started", run: { ...queuedRun, status: "applied" } };
		const { gw, fetcher } = gatewayWith(sse([started]), sse([started]), sse([started]));

		// Act
		await gw.startRun({ prompt: "one" });
		await gw.startRun({ prompt: "two" });
		await gw.startRun({ prompt: "three", clientRequestId: "req-mine" });

		// Assert
		const ids = [0, 1, 2].map((call) => sentBody(fetcher, call).clientRequestId as string);
		expect(ids[0]).toMatch(/^[\w-]{8,64}$/);
		expect(ids[1]).toMatch(/^[\w-]{8,64}$/);
		expect(ids[0]).not.toBe(ids[1]);
		expect(ids[2]).toBe("req-mine");
		gw.close();
	});
});
