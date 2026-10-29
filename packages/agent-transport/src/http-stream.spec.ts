import type { AgentEvent } from "@ech/agent-core";
import { describe, expect, it, vi } from "vitest";
import { HttpGateway } from "./http";
import { readSseStream } from "./sse";

const run = {
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "create 2 drafts",
	status: "planning",
	steps: [],
	receipts: [],
	changeSetIds: [],
	startedAt: "2026-10-19T00:00:00Z",
};

function sseResponse(frames: unknown[], chunkSplit = false): Response {
	const text = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			if (chunkSplit) {
				// split mid-frame to prove the parser buffers across chunks
				const mid = Math.floor(text.length / 2);
				controller.enqueue(encoder.encode(text.slice(0, mid)));
				controller.enqueue(encoder.encode(text.slice(mid)));
			} else {
				controller.enqueue(encoder.encode(text));
			}
			controller.close();
		},
	});
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("readSseStream", () => {
	it("joins frames split across chunks and multi-line data", async () => {
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode("data: a\r\ndata: b\r\n\r\nda"));
				controller.enqueue(encoder.encode("ta: c\n\n: comment\n\n"));
				controller.close();
			},
		});
		const seen: string[] = [];
		await readSseStream(body, (d) => seen.push(d));
		expect(seen).toEqual(["a\nb", "c"]);
	});
});

describe("HttpGateway streamed runs", () => {
	it("resolves on run.started and dispatches the run's events to subscribers", async () => {
		const events: AgentEvent[] = [];
		const fetcher = vi.fn(async () =>
			sseResponse(
				[
					{ type: "run.started", run },
					{ type: "run.step", runId: "run_1", step: { id: "s1", label: "Understanding", status: "running" } },
					{ type: "run.status", runId: "run_1", status: "applied", answer: "done" },
				],
				true,
			),
		);
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		gw.subscribe((e) => events.push(e));
		const started = await gw.startRun({ prompt: "create 2 drafts" });
		expect(started.id).toBe("run_1");
		await vi.waitFor(() => expect(events.map((e) => e.type)).toEqual(["run.step", "run.status"]));
		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("/api/agent/agent/runs");
		expect((init.headers as Record<string, string>).accept).toContain("text/event-stream");
		gw.close();
	});

	it("rejects with the server reason when the run is refused before it starts", async () => {
		const fetcher = vi.fn(async () => sseResponse([{ type: "run.error", message: "Daily AI limit reached" }]));
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		await expect(gw.startRun({ prompt: "x" })).rejects.toThrow("Daily AI limit reached");
		gw.close();
	});

	it("surfaces problem-details detail on HTTP errors", async () => {
		const fetcher = vi.fn(
			async () => new Response(JSON.stringify({ title: "Forbidden", detail: "AI is not enabled" }), { status: 403 }),
		);
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		await expect(gw.startRun({ prompt: "x" })).rejects.toThrow("AI is not enabled");
		gw.close();
	});

	it("falls back to a JSON run response", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify(run), { status: 201 }));
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		await expect(gw.startRun({ prompt: "x" })).resolves.toMatchObject({ id: "run_1" });
		gw.close();
	});

	it("emits changeset.decided after a decision so open threads update", async () => {
		const decided = {
			id: "cs_1",
			runId: "run_1",
			domain: "cms",
			title: "Create blog draft",
			summary: "",
			risk: "low",
			blastRadius: { kind: "blog_post", count: 1, label: "1 new draft post" },
			diffs: [{ entity: { kind: "blog_post", id: "new-1" }, field: "title", before: null, after: "Hi", provenance: "generated" }],
			guardrails: [],
			status: "applied",
			stagedBy: "agent",
			stagedAt: "2026-10-19T00:00:00Z",
			expiresAt: "2026-10-20T00:00:00Z",
			result: { entities: [], links: [{ label: "Open blog draft", href: "/blog/7" }] },
		};
		const fetcher = vi.fn(async () => new Response(JSON.stringify(decided), { status: 200 }));
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		const events: AgentEvent[] = [];
		gw.subscribe((e) => events.push(e));
		const result = await gw.decideChangeSet("cs_1", "approve", "owner@example.com");
		expect(result.result?.links[0]?.href).toBe("/blog/7");
		expect(events).toEqual([{ type: "changeset.decided", changeSet: result }]);
		gw.close();
	});

	// TC-AISEC-144 — the decision body says a hand click (`manual: true`) only when the caller says so
	it("sends manual: true for a hand click and leaves it out otherwise", async () => {
		const decided = {
			id: "cs_1",
			runId: "run_1",
			domain: "crm",
			title: "Reply",
			summary: "",
			risk: "low",
			blastRadius: { kind: "lead", count: 1, label: "1 lead" },
			diffs: [{ entity: { kind: "lead", id: "2" }, field: "reply", before: null, after: "Hi", provenance: "generated" }],
			guardrails: [],
			status: "applied",
			stagedBy: "agent",
			stagedAt: "2026-10-19T00:00:00Z",
			expiresAt: "2026-10-20T00:00:00Z",
		};
		const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(decided), { status: 200 }));
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });

		await gw.decideChangeSet("cs_1", "approve", "self", undefined, { manual: true, confirm: "ORD-1" });
		await gw.decideChangeSet("cs_1", "approve", "self", undefined, { manual: false });
		await gw.decideChangeSet("cs_1", "approve", "self");

		const bodies = fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
		expect(bodies).toEqual([
			{ decision: "approve", actor: "self", confirm: "ORD-1", manual: true },
			{ decision: "approve", actor: "self" },
			{ decision: "approve", actor: "self" },
		]);
		gw.close();
	});

	// TC-AIREL-311 — the site editor's Undo / Redo asks the server to compare the page with a change; the answer
	// carries the status it settled on and the open chat follows it.
	it("reconciles a change and emits changeset.decided with the settled status", async () => {
		const reverted = {
			id: "cs_1",
			runId: "run_1",
			domain: "webbuilder",
			title: "Edit page: Home",
			summary: "",
			risk: "low",
			blastRadius: { kind: "site_page", count: 1, label: "1 section" },
			diffs: [{ entity: { kind: "site_page", id: "12" }, field: "headline", before: "a", after: "b", provenance: "generated" }],
			guardrails: [],
			status: "reverted",
			stagedBy: "agent",
			stagedAt: "2026-10-22T00:00:00Z",
			expiresAt: "2026-10-23T00:00:00Z",
		};
		const fetcher = vi.fn(async () => new Response(JSON.stringify({ changeSet: reverted, verdict: "reverted" }), { status: 200 }));
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		const events: AgentEvent[] = [];
		gw.subscribe((e) => events.push(e));
		const result = await gw.reconcileChangeSet("cs_1");
		expect(result.verdict).toBe("reverted");
		expect(String((fetcher.mock.calls[0] as unknown[])[0])).toContain("/agent/change-sets/cs_1/reconcile");
		expect(events).toEqual([{ type: "changeset.decided", changeSet: result.changeSet }]);
		gw.close();
	});

	it("refuses an answer that is not a verdict", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify({ changeSet: {}, verdict: "maybe" }), { status: 200 }));
		const gw = new HttpGateway({ baseUrl: "/api/agent", fetcher: fetcher as unknown as typeof fetch });
		await expect(gw.reconcileChangeSet("cs_1")).rejects.toBeDefined();
		gw.close();
	});
});
