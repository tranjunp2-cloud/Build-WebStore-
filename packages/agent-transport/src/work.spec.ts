import { describe, expect, it, vi } from "vitest";
import { FixtureGateway } from "./fixture/fixture-gateway";
import { HttpGateway } from "./http";

// TC-WQ-040..045 — the merchant's work queue and task-tied chats on the gateway port.

const item = {
	key: "shop:orders_to_confirm",
	source: "shop",
	kind: "orders_to_confirm",
	group: "now",
	order: 1,
	count: 3,
	title: "3 orders to confirm",
	area: "Orders",
	icon: "package",
	say: "Order #1043 has waited 2 h. Confirm it?",
	short: "Confirm 3 orders",
	actions: [{ label: "Confirm", kind: "prompt", value: "Confirm the waiting orders" }],
	taskKey: "shop:orders_to_confirm",
	taskTitle: "Confirm 3 orders",
	fingerprint: "fp1",
};

const thread = {
	id: "thr_task",
	title: "Confirm 3 orders",
	runCount: 1,
	taskKey: "shop:orders_to_confirm",
	status: "needs_you",
	createdAt: "2026-10-22T00:00:00Z",
	updatedAt: "2026-10-22T00:05:00Z",
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function httpGateway(fetcher: ReturnType<typeof vi.fn>): HttpGateway {
	return new HttpGateway({ baseUrl: "https://app.example/api/", fetcher: fetcher as unknown as typeof fetch });
}

describe("HttpGateway work queue", () => {
	it("TC-WQ-040 GET /agent/work parses the ranked list", async () => {
		const fetcher = vi.fn(async () => json({ items: [item], states: [], checkedAt: "2026-10-22T00:00:00Z", partial: true }));
		const gw = httpGateway(fetcher);
		const list = await gw.listWork();
		expect(fetcher).toHaveBeenCalledWith("https://app.example/api/agent/work", expect.objectContaining({ method: "GET" }));
		expect(list.items[0]?.key).toBe("shop:orders_to_confirm");
		expect(list.partial).toBe(true);
	});

	it("TC-WQ-041 listWork is not cached: a second read goes to the network", async () => {
		const fetcher = vi.fn(async () => json({ items: [], states: [], checkedAt: "2026-10-22T00:00:00Z" }));
		const gw = httpGateway(fetcher);
		await gw.listWork();
		await gw.listWork();
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("TC-WQ-042 rejects a malformed work list", async () => {
		const fetcher = vi.fn(async () => json({ items: [{ key: "x" }], states: [], checkedAt: "now" }));
		await expect(httpGateway(fetcher).listWork()).rejects.toThrow();
	});

	it("TC-WQ-043 PUT /agent/work/state/{key} encodes the key and parses the state", async () => {
		const state = { key: "ai:review:thr/1", snoozedUntil: "2026-10-22T03:00:00Z", updatedAt: "2026-10-22T00:00:00Z" };
		const fetcher = vi.fn(async (_url: string, _init: RequestInit) => json(state));
		const gw = httpGateway(fetcher);
		const saved = await gw.setWorkState("ai:review:thr/1", { snoozedUntil: "2026-10-22T03:00:00Z", dismissedFingerprint: null });
		const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://app.example/api/agent/work/state/ai%3Areview%3Athr%2F1");
		expect(init.method).toBe("PUT");
		expect(JSON.parse(init.body as string)).toEqual({ snoozedUntil: "2026-10-22T03:00:00Z", dismissedFingerprint: null });
		expect(saved).toEqual(state);
	});

	it("TC-WQ-044 listThreads filters by task and the list cache drops after a new run", async () => {
		const fetcher = vi.fn(async (url: string) => {
			if (url.includes("/agent/runs")) return json({ id: "run_1", role: "merchant", domain: "orders", prompt: "x", status: "planning", steps: [], receipts: [], changeSetIds: [], threadId: "thr_task", startedAt: "2026-10-22T00:00:00Z" });
			return json([thread]);
		});
		const gw = httpGateway(fetcher);
		const found = await gw.listThreads(1, { task: "shop:orders_to_confirm" });
		expect(fetcher.mock.calls[0]?.[0]).toBe("https://app.example/api/agent/threads?limit=1&task=shop%3Aorders_to_confirm");
		expect(found[0]).toMatchObject({ taskKey: "shop:orders_to_confirm", status: "needs_you" });
		await gw.listThreads(1, { task: "shop:orders_to_confirm" });
		expect(fetcher).toHaveBeenCalledTimes(1);
		await gw.startRun({ prompt: "Confirm them", task: { key: "shop:orders_to_confirm", title: "Confirm 3 orders" } });
		await gw.listThreads(1, { task: "shop:orders_to_confirm" });
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});

describe("FixtureGateway work queue", () => {
	it("TC-WQ-045 a run started with a task opens that task's chat; states are kept", async () => {
		const gw = new FixtureGateway({ latencyMs: 0, eventDelayMs: 1 });
		const run = await gw.startRun({ prompt: "Confirm them", task: { key: "shop:orders_to_confirm", title: "Confirm 3 orders" } });
		await gw.startRun({ prompt: "Something else" });
		const tasks = await gw.listThreads(5, { task: "shop:orders_to_confirm" });
		expect(tasks.map((t) => [t.id, t.title, t.taskKey])).toEqual([[run.threadId, "Confirm 3 orders", "shop:orders_to_confirm"]]);

		await gw.setWorkState("shop:low_stock", { snoozedUntil: "2026-10-22T03:00:00Z" });
		const state = await gw.setWorkState("shop:low_stock", { dismissedFingerprint: "fp9", snoozedUntil: null });
		expect(state).toMatchObject({ key: "shop:low_stock", dismissedFingerprint: "fp9" });
		expect(state.snoozedUntil).toBeUndefined();
		expect((await gw.listWork()).states).toHaveLength(1);
		gw.close();
	});
});
