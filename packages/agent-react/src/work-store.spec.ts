import type { AgentEvent, WorkItem, WorkList, WorkStateInput } from "@ech/agent-core";
import type { AgentGateway } from "@ech/agent-transport";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkStore, type WorkStoreEnv } from "./work-store";

// TC-WQ-046..049, 057, 059, 060 — the work queue store behind useWork(): when it reads, optimistic choices, other tabs.

afterEach(() => {
	vi.useRealTimers();
});

function item(key: string, fingerprint = "fp1"): WorkItem {
	return {
		key,
		source: "shop",
		kind: key,
		group: "now",
		order: 1,
		count: 1,
		title: key,
		area: "Orders",
		icon: "package",
		say: "Something waits.",
		short: key,
		actions: [{ label: "Open", kind: "link", value: "/orders" }],
		taskKey: key,
		taskTitle: key,
		fingerprint,
	};
}

function fakeGateway(items: WorkItem[] = [item("shop:a"), item("shop:b")]) {
	const listeners = new Set<(event: AgentEvent) => void>();
	const gateway = {
		listWork: vi.fn(async (): Promise<WorkList> => ({ items, states: [], checkedAt: new Date().toISOString() })),
		setWorkState: vi.fn(async (key: string, input: WorkStateInput) => ({
			key,
			snoozedUntil: input.snoozedUntil ?? undefined,
			dismissedFingerprint: input.dismissedFingerprint ?? undefined,
			updatedAt: "2026-10-22T00:00:00Z",
		})),
		subscribe: (listener: (event: AgentEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		emit: (event: AgentEvent) => {
			for (const listener of listeners) listener(event);
		},
	};
	return gateway;
}

function env(): Required<Pick<WorkStoreEnv, "window" | "document">> & { document: EventTarget & { visibilityState: string }; window: EventTarget } {
	const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
	return { window: new EventTarget(), document };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe("WorkStore", () => {
	it("TC-WQ-046 reads on start; focus and the tab becoming visible read again (debounced into one)", async () => {
		vi.useFakeTimers();
		const gw = fakeGateway();
		const e = env();
		const store = new WorkStore(gw as unknown as AgentGateway, { env: e });
		store.start();
		await settle();
		expect(gw.listWork).toHaveBeenCalledTimes(1);
		expect(store.getSnapshot()).toMatchObject({ loading: false, error: undefined });
		expect(store.getSnapshot().data?.items).toHaveLength(2);

		e.window.dispatchEvent(new Event("focus"));
		e.document.dispatchEvent(new Event("visibilitychange"));
		await vi.advanceTimersByTimeAsync(500);
		expect(gw.listWork).toHaveBeenCalledTimes(2);

		// hidden: neither the tab event nor the minute timer reads
		e.document.visibilityState = "hidden";
		e.document.dispatchEvent(new Event("visibilitychange"));
		await vi.advanceTimersByTimeAsync(60_000);
		expect(gw.listWork).toHaveBeenCalledTimes(2);
		e.document.visibilityState = "visible";
		await vi.advanceTimersByTimeAsync(60_000);
		expect(gw.listWork).toHaveBeenCalledTimes(3);
		store.stop();
	});

	it("TC-WQ-047 agent events that change what waits read again; a run still working does not", async () => {
		vi.useFakeTimers();
		const gw = fakeGateway();
		const store = new WorkStore(gw as unknown as AgentGateway, { env: env() });
		store.start();
		await settle();
		gw.emit({ type: "run.status", runId: "run_1", status: "running" });
		await vi.advanceTimersByTimeAsync(500);
		expect(gw.listWork).toHaveBeenCalledTimes(1);

		gw.emit({ type: "run.status", runId: "run_1", status: "awaiting_input" });
		gw.emit({ type: "thread.deleted", threadId: "thr_1" });
		await vi.advanceTimersByTimeAsync(499);
		expect(gw.listWork).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(gw.listWork).toHaveBeenCalledTimes(2);

		gw.emit({ type: "run.status", runId: "run_1", status: "applied" });
		await vi.advanceTimersByTimeAsync(500);
		expect(gw.listWork).toHaveBeenCalledTimes(3);

		store.stop();
		gw.emit({ type: "run.status", runId: "run_1", status: "failed" });
		await vi.advanceTimersByTimeAsync(60_500);
		expect(gw.listWork).toHaveBeenCalledTimes(3);
	});

	it("TC-WQ-048 a choice shows at once: dismissing at the item's fingerprint removes it", async () => {
		vi.useFakeTimers();
		const gw = fakeGateway();
		let release: () => void = () => undefined;
		gw.setWorkState.mockImplementationOnce(
			(key, input) =>
				new Promise((resolve) => {
					release = () => resolve({ key, snoozedUntil: undefined, dismissedFingerprint: input.dismissedFingerprint ?? undefined, updatedAt: "2026-10-22T01:00:00Z" });
				}),
		);
		const store = new WorkStore(gw as unknown as AgentGateway, { env: env() });
		store.start();
		await settle();
		const saving = store.setState("shop:a", { dismissedFingerprint: "fp1" });
		expect(store.getSnapshot().data?.items.map((i) => i.key)).toEqual(["shop:b"]);
		// a read landing before the save still shows the choice
		await store.refresh();
		expect(store.getSnapshot().data?.items.map((i) => i.key)).toEqual(["shop:b"]);
		release();
		await saving;
		expect(store.getSnapshot().data?.states).toEqual([{ key: "shop:a", snoozedUntil: undefined, dismissedFingerprint: "fp1", updatedAt: "2026-10-22T01:00:00Z" }]);
		store.stop();
	});

	it("TC-WQ-049 a failed save is undone and rejects", async () => {
		vi.useFakeTimers();
		const gw = fakeGateway();
		gw.setWorkState.mockRejectedValueOnce(new Error("offline"));
		const store = new WorkStore(gw as unknown as AgentGateway, { env: env() });
		store.start();
		await settle();
		await expect(store.setState("shop:a", { snoozedUntil: "2026-10-22T03:00:00Z" })).rejects.toThrow("offline");
		expect(store.getSnapshot().data?.states).toEqual([]);
		expect(store.getSnapshot().error?.message).toBe("offline");
		store.stop();
	});

	it("TC-WQ-057 without a work queue on the gateway it stays empty and reads nothing", async () => {
		const gw = fakeGateway();
		const bare = { subscribe: gw.subscribe } as unknown as AgentGateway;
		const store = new WorkStore(bare, { env: env() });
		store.start();
		await store.refresh();
		await store.setState("shop:a", { snoozedUntil: null });
		expect(store.getSnapshot()).toEqual({ data: undefined, loading: false, error: undefined });
		store.stop();
	});

	it("TC-WQ-059 tabs tell each other: a save in one tab makes the other read, without echoing back", async () => {
		const gwA = fakeGateway();
		const gwB = fakeGateway();
		const name = `ech-agent-work-test-${Math.random()}`;
		const options = (e: ReturnType<typeof env>) => ({ env: { ...e, BroadcastChannel }, channelName: name, debounceMs: 5 });
		const a = new WorkStore(gwA as unknown as AgentGateway, options(env()));
		const b = new WorkStore(gwB as unknown as AgentGateway, options(env()));
		a.start();
		b.start();
		await vi.waitFor(() => expect(b.getSnapshot().data).toBeDefined());
		await vi.waitFor(() => expect(a.getSnapshot().data).toBeDefined());
		// the start-up reads announced, but each tab's own read was newer: no extra reads
		await new Promise((resolve) => setTimeout(resolve, 30));
		const readsA = gwA.listWork.mock.calls.length;
		const readsB = gwB.listWork.mock.calls.length;

		await a.setState("shop:a", { snoozedUntil: "2026-10-22T03:00:00Z" });
		await vi.waitFor(() => expect(gwB.listWork.mock.calls.length).toBe(readsB + 1));
		await new Promise((resolve) => setTimeout(resolve, 30));
		// B's read after the ping is not announced: A does not read again
		expect(gwA.listWork.mock.calls.length).toBe(readsA);
		expect(gwB.listWork.mock.calls.length).toBe(readsB + 1);
		a.stop();
		b.stop();
	});

	it("TC-WQ-060 surfaces share one store: reads start with the first and stop with the last", async () => {
		vi.useFakeTimers();
		const gw = fakeGateway();
		const store = new WorkStore(gw as unknown as AgentGateway, { env: env() });
		store.start();
		store.start();
		await settle();
		expect(gw.listWork).toHaveBeenCalledTimes(1);
		store.stop();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(gw.listWork).toHaveBeenCalledTimes(2);
		store.stop();
		await vi.advanceTimersByTimeAsync(120_000);
		expect(gw.listWork).toHaveBeenCalledTimes(2);
	});
});
