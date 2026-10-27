import { afterEach, describe, expect, it, vi } from "vitest";
import { FixtureGateway } from "./fixture/fixture-gateway";
import { HttpGateway } from "./http";

// TC-AICP-39 — chat threads on the gateway port (fixture + HTTP).

afterEach(() => {
	vi.useRealTimers();
});

const thread = {
	id: "thr_1",
	title: "Create draft products",
	preview: "Create draft products: scarf",
	runCount: 1,
	createdAt: "2026-10-20T00:00:00Z",
	updatedAt: "2026-10-20T00:05:00Z",
};

const run = {
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "Create draft products: scarf",
	status: "awaiting_approval",
	steps: [],
	receipts: [],
	changeSetIds: [],
	threadId: "thr_1",
	answer: "Staged 1 draft.",
	startedAt: "2026-10-20T00:00:00Z",
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function httpGateway(fetcher: ReturnType<typeof vi.fn>): HttpGateway {
	return new HttpGateway({ baseUrl: "https://api.example", fetcher: fetcher as unknown as typeof fetch });
}

describe("FixtureGateway threads [TC-AICP-39]", () => {
	it("opens a thread on the first run and continues it when threadId is sent", async () => {
		vi.useFakeTimers();
		const gw = new FixtureGateway({ latencyMs: 0, eventDelayMs: 5 });

		const first = gw.startRun({ prompt: "Write a blog post about batik" });
		await vi.advanceTimersByTimeAsync(0);
		const firstRun = await first;
		expect(firstRun.threadId).toMatch(/^thr_/);

		const second = gw.startRun({ prompt: "Make it shorter", threadId: firstRun.threadId });
		await vi.advanceTimersByTimeAsync(0);
		const secondRun = await second;
		expect(secondRun.threadId).toBe(firstRun.threadId);
		await vi.advanceTimersByTimeAsync(5 * 40);

		const listing = gw.listThreads();
		await vi.advanceTimersByTimeAsync(0);
		const threads = await listing;
		expect(threads).toHaveLength(1);
		expect(threads[0]).toMatchObject({ title: "Write a blog post about batik", runCount: 2, preview: "Make it shorter" });

		const detailing = gw.getThread(firstRun.threadId as string);
		await vi.advanceTimersByTimeAsync(0);
		const detail = await detailing;
		// oldest first, with the scripted answer + staged sets persisted
		expect(detail?.runs.map((r) => r.prompt)).toEqual(["Write a blog post about batik", "Make it shorter"]);
		expect(detail?.runs[0]?.answer).toBeTruthy();
		expect(detail?.changeSets.map((c) => c.runId).sort()).toEqual([firstRun.id, secondRun.id].sort());
		gw.close();
	});

	it("refuses an unknown thread id, renames and deletes threads", async () => {
		const gw = new FixtureGateway({ latencyMs: 0, eventDelayMs: 1 });
		await expect(gw.startRun({ prompt: "x", threadId: "thr_missing" })).rejects.toThrow();

		const started = await gw.startRun({ prompt: "Create draft products" });
		const id = started.threadId as string;
		expect((await gw.renameThread(id, { title: "Launch drafts" })).title).toBe("Launch drafts");

		await gw.deleteThread(id);
		expect(await gw.getThread(id)).toBeNull();
		expect(await gw.listThreads()).toEqual([]);
		gw.close();
	});
});

describe("HttpGateway threads [TC-AICP-39]", () => {
	it("parses the thread list and serves a repeat read from cache", async () => {
		const fetcher = vi.fn(async () => json([thread]));
		const gw = httpGateway(fetcher);
		const first = await gw.listThreads(5);
		const again = await gw.listThreads(5);
		expect(first[0]?.id).toBe("thr_1");
		expect(again).toEqual(first);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(String((fetcher.mock.calls[0] as unknown[] | undefined)?.[0])).toBe("https://api.example/agent/threads?limit=5");
		gw.close();
	});

	it("rejects a thread list that breaks the contract", async () => {
		const gw = httpGateway(vi.fn(async () => json([{ id: "thr_1" }])));
		await expect(gw.listThreads()).rejects.toThrow();
		gw.close();
	});

	it("returns null for a missing thread instead of throwing", async () => {
		const gw = httpGateway(vi.fn(async () => json({ title: "Not found", status: 404, detail: "gone" }, 404)));
		expect(await gw.getThread("thr_gone")).toBeNull();
		gw.close();
	});

	it("loads a thread detail and surfaces other failures", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json({ thread, runs: [run], changeSets: [] }))
			.mockResolvedValueOnce(json({ detail: "AI platform down" }, 502));
		const gw = httpGateway(fetcher);
		const detail = await gw.getThread("thr_1");
		expect(detail?.runs[0]?.answer).toBe("Staged 1 draft.");
		await expect(gw.getThread("thr_2")).rejects.toThrow("AI platform down");
		gw.close();
	});

	it("sends threadId on startRun and refetches the list afterwards", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json([thread]))
			.mockResolvedValueOnce(json(run))
			.mockResolvedValueOnce(json([{ ...thread, runCount: 2 }]));
		const gw = httpGateway(fetcher);
		await gw.listThreads();
		await gw.startRun({ prompt: "again", threadId: "thr_1" });
		const [, init] = fetcher.mock.calls[1] as [string, RequestInit];
		expect(JSON.parse(String(init.body))).toMatchObject({ prompt: "again", threadId: "thr_1" });
		expect((await gw.listThreads())[0]?.runCount).toBe(2);
		expect(fetcher).toHaveBeenCalledTimes(3);
		gw.close();
	});

	it("renames with PATCH and deletes with DELETE (204), invalidating cached reads", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json([thread]))
			.mockResolvedValueOnce(json({ ...thread, title: "Renamed" }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(json([]));
		const gw = httpGateway(fetcher);
		await gw.listThreads();
		expect((await gw.renameThread("thr_1", { title: "Renamed" })).title).toBe("Renamed");
		await gw.deleteThread("thr_1");
		expect(await gw.listThreads()).toEqual([]);
		const calls = fetcher.mock.calls as Array<[string, RequestInit]>;
		expect(calls[1]?.[1].method).toBe("PATCH");
		expect(JSON.parse(String(calls[1]?.[1].body))).toEqual({ title: "Renamed" });
		expect(calls[2]?.[0]).toBe("https://api.example/agent/threads/thr_1");
		expect(calls[2]?.[1].method).toBe("DELETE");
		gw.close();
	});
});

// TC-AIWB-104 — deleting a chat deletes its drafts waiting for review: the cached list of
// change sets is dropped and subscribers hear "thread.deleted", so "N to review" goes too
describe("deleting a chat reloads the drafts to review [TC-AIWB-104]", () => {
	it("drops the cached change sets and tells subscribers", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(json([]))
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(json([]));
		const gw = httpGateway(fetcher);
		const events: unknown[] = [];
		gw.subscribe((event) => events.push(event));
		await gw.listChangeSets({ status: "pending" });

		await gw.deleteThread("thr_1");
		await gw.listChangeSets({ status: "pending" });

		const urls = (fetcher.mock.calls as Array<[string]>).map(([url]) => url);
		expect(urls.filter((url) => url.includes("/agent/change-sets"))).toHaveLength(2);
		expect(events).toEqual([{ type: "thread.deleted", threadId: "thr_1" }]);
		gw.close();
	});
});

describe("threads started on a record [TC-AICP-126]", () => {
	it("asks for the chats of one record and parses the record link", async () => {
		const linked = { ...thread, entity: { kind: "product", id: "prod 1", label: "Grey Shirt" } };
		const fetcher = vi.fn(async () => json([linked]));
		const gw = httpGateway(fetcher);
		const [found] = await gw.listThreads(3, { entity: { kind: "product", id: "prod 1" } });
		expect(found?.entity).toEqual(linked.entity);
		expect(String((fetcher.mock.calls[0] as unknown[] | undefined)?.[0])).toBe("https://api.example/agent/threads?limit=3&entity=product%3Aprod+1");
		gw.close();
	});

	it("the fixture gateway filters by record too", async () => {
		const gw = new FixtureGateway({ latencyMs: 0 });
		expect(await gw.listThreads(5, { entity: { kind: "product", id: "nope" } })).toEqual([]);
	});
});
