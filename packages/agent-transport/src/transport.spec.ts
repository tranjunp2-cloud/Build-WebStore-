import type { AgentEvent } from "@ech/agent-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "./cache";
import { FixtureGateway } from "./fixture/fixture-gateway";
import { HttpGateway } from "./http";
import { RequestPool } from "./pool";

afterEach(() => {
	vi.useRealTimers();
});

describe("RequestPool", () => {
	it("coalesces identical in-flight GETs", async () => {
		const pool = new RequestPool({ concurrency: 4 });
		let calls = 0;
		const fetcher = async () => {
			calls += 1;
			await new Promise((r) => setTimeout(r, 5));
			return 42;
		};
		const [a, b] = await Promise.all([pool.get("k", fetcher), pool.get("k", fetcher)]);
		expect(a).toBe(42);
		expect(b).toBe(42);
		expect(calls).toBe(1);
	});

	it("caps concurrency", async () => {
		const pool = new RequestPool({ concurrency: 2 });
		let running = 0;
		let peak = 0;
		const fetcher = async () => {
			running += 1;
			peak = Math.max(peak, running);
			await new Promise((r) => setTimeout(r, 5));
			running -= 1;
		};
		await Promise.all([1, 2, 3, 4, 5].map(() => pool.mutate(fetcher)));
		expect(peak).toBe(2);
	});

	it("aborts in-flight work on close", async () => {
		const pool = new RequestPool({ concurrency: 1 });
		const blocked = pool.mutate(
			(signal) =>
				new Promise((_, reject) => {
					signal.addEventListener("abort", () => reject(new Error("aborted")));
				}),
		);
		pool.close();
		await expect(blocked).rejects.toThrow("aborted");
	});
});

describe("TtlCache", () => {
	it("expires entries", () => {
		const cache = new TtlCache(10);
		cache.set("k", "v");
		expect(cache.get("k")).toBe("v");
		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + 50);
		expect(cache.get("k")).toBeUndefined();
		vi.useRealTimers();
	});

	it("invalidates by prefix", () => {
		const cache = new TtlCache();
		cache.set("changesets:a", 1);
		cache.set("runs:b", 2);
		cache.invalidate("changesets");
		expect(cache.get("changesets:a")).toBeUndefined();
		expect(cache.get("runs:b")).toBe(2);
	});
});

describe("FixtureGateway", () => {
	it("serves fixture reads", async () => {
		const gw = new FixtureGateway({ latencyMs: 0 });
		expect((await gw.listInsights()).length).toBeGreaterThan(0);
		expect((await gw.listChangeSets({ status: "pending" })).every((c) => c.status === "pending")).toBe(true);
		expect((await gw.listConversations()).length).toBeGreaterThan(0);
		gw.close();
	});

	it("emits a scripted run sequence on startRun", async () => {
		vi.useFakeTimers();
		const gw = new FixtureGateway({ latencyMs: 0, eventDelayMs: 10 });
		const events: AgentEvent[] = [];
		gw.subscribe((e) => events.push(e));
		const pending = gw.startRun({ prompt: "fix it", domain: "listings" });
		await vi.advanceTimersByTimeAsync(0);
		await pending;
		await vi.advanceTimersByTimeAsync(10 * 20);
		const types = events.map((e) => e.type);
		expect(types).toContain("run.step");
		expect(types).toContain("run.receipt");
		expect(types).toContain("changeset.staged");
		expect(types).toContain("run.status");
		gw.close();
	});

	it("decides change sets and emits the decision", async () => {
		const gw = new FixtureGateway({ latencyMs: 0 });
		const events: AgentEvent[] = [];
		gw.subscribe((e) => events.push(e));
		const decided = await gw.decideChangeSet("chg_4474", "approve", "mizuki");
		expect(decided.status).toBe("applied");
		expect(decided.decidedBy).toBe("mizuki");
		expect(events.some((e) => e.type === "changeset.decided")).toBe(true);
		gw.close();
	});
});

describe("HttpGateway", () => {
	it("validates responses against contracts", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify([{ bad: true }]), { status: 200 }));
		const gw = new HttpGateway({ baseUrl: "https://api.example", fetcher: fetcher as unknown as typeof fetch });
		await expect(gw.listInsights()).rejects.toThrow();
		gw.close();
	});

	it("sends decision writes with actor", async () => {
		const changeSet = {
			id: "chg_1",
			runId: "run_1",
			domain: "listings",
			title: "t",
			summary: "s",
			risk: "low",
			blastRadius: { kind: "listing", count: 1, label: "1" },
			diffs: [
				{
					entity: { kind: "product", id: "prd_1" },
					field: "title",
					before: "a",
					after: "b",
					provenance: "tool_output",
				},
			],
			guardrails: [],
			status: "applied",
			stagedBy: "agent",
			stagedAt: "2026-01-01T00:00:00Z",
			expiresAt: "2026-01-02T00:00:00Z",
			decidedBy: "mizuki",
			decidedAt: "2026-01-01T01:00:00Z",
		};
		const fetcher = vi.fn(async () => new Response(JSON.stringify(changeSet), { status: 200 }));
		const gw = new HttpGateway({ baseUrl: "https://api.example", fetcher: fetcher as unknown as typeof fetch });
		const result = await gw.decideChangeSet("chg_1", "approve", "mizuki");
		expect(result.status).toBe("applied");
		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toContain("/agent/change-sets/chg_1/decision");
		expect(JSON.parse(String(init.body))).toMatchObject({ decision: "approve", actor: "mizuki" });
		gw.close();
	});
});

describe("RequestPool after close [TC-AICP-45]", () => {
	it("does not hand an aborted read to the next caller (StrictMode remount)", async () => {
		const { RequestPool } = await import("./pool");
		const pool = new RequestPool();
		let calls = 0;
		const fetcher = (signal: AbortSignal) =>
			new Promise<string>((resolve, reject) => {
				calls += 1;
				const n = calls;
				signal.addEventListener("abort", () => reject(new Error("aborted")));
				setTimeout(() => resolve(`ok ${n}`), 5);
			});
		const first = pool.get("threads", fetcher);
		pool.close();
		// remount asks again before the aborted read has even settled
		const second = pool.get("threads", fetcher);
		await expect(first).rejects.toThrow("aborted");
		await expect(second).resolves.toBe("ok 2");
		// and the settled first read did not evict the second one's entry
		await expect(pool.get("threads", fetcher)).resolves.toBe("ok 3");
	});
});
