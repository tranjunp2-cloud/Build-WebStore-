import { describe, expect, it } from "vitest";
import { type WorkItem, type WorkState, mergeWork, nextToRaise, snoozeFor } from "./work";

// TC-WQ-001..006 — one ranked work list from the shop and the assistant, and when the assistant may raise an item
// on its own (one at a time, not again too soon, at most 3 an hour, quiet at night unless something is late).

const item = (key: string, patch: Partial<WorkItem> = {}): WorkItem => ({
	key,
	source: "shop",
	kind: key.split(":")[1] ?? key,
	group: "now",
	order: 0,
	count: 1,
	title: key,
	area: "Orders",
	icon: "shopping-cart",
	say: `About ${key}`,
	short: key,
	actions: [{ label: "Go", kind: "prompt", value: `Help with ${key}` }],
	taskKey: key,
	taskTitle: key,
	fingerprint: `${key}#1`,
	...patch,
});
const at = (iso: string) => new Date(iso);

describe("mergeWork [TC-WQ-001]", () => {
	it("ranks now → waiting on you → this week, then by order and age", () => {
		const shop = [
			item("shop:discounts_expiring", { group: "week" }),
			item("shop:orders_to_confirm", { order: 2, since: "2026-10-22T08:00:00Z" }),
			item("shop:payment_proofs", { order: 1 }),
		];
		const ai = [item("ai:ask:run_1", { source: "ai", group: "you", taskKey: "thread:t1" })];
		expect(mergeWork(shop, ai, [], []).map((i) => i.key)).toEqual(["shop:payment_proofs", "shop:orders_to_confirm", "ai:ask:run_1", "shop:discounts_expiring"]);
	});

	it("lets the assistant's item replace the shop item of the same task, and gives a shop item its existing chat [TC-WQ-002]", () => {
		const shop = [item("shop:payment_proofs"), item("shop:out_of_stock")];
		const ai = [item("ai:review:t9", { source: "ai", group: "you", taskKey: "shop:payment_proofs", threadId: "t9" })];
		const tasks = [
			{ taskKey: "shop:out_of_stock", threadId: "t_new", status: "working" as const, updatedAt: "2026-10-22T10:00:00Z" },
			{ taskKey: "shop:out_of_stock", threadId: "t_old", status: "done" as const, updatedAt: "2026-10-20T10:00:00Z" },
		];
		const merged = mergeWork(shop, ai, tasks, []);
		expect(merged.map((i) => i.key)).toEqual(["shop:out_of_stock", "ai:review:t9"]);
		expect(merged[0]?.threadId).toBe("t_new");
	});

	it("hides a dismissed item until its fingerprint changes [TC-WQ-003]", () => {
		const states: WorkState[] = [{ key: "shop:low_stock", dismissedFingerprint: "shop:low_stock#1", updatedAt: "2026-10-22T09:00:00Z" }];
		expect(mergeWork([item("shop:low_stock")], [], [], states)).toEqual([]);
		expect(mergeWork([item("shop:low_stock", { fingerprint: "shop:low_stock#2" })], [], [], states)).toHaveLength(1);
	});
});

describe("nextToRaise [TC-WQ-004]", () => {
	const items = [item("shop:payment_proofs", { fact: { text: "waiting 40 min", tone: "late" } }), item("shop:orders_to_confirm"), item("shop:low_stock", { group: "week" })];
	const noon = at("2026-10-22T12:00:00");

	it("raises the first open item, skipping snoozed and recently raised ones", () => {
		expect(nextToRaise(items, [], [], noon)?.key).toBe("shop:payment_proofs");
		const states: WorkState[] = [
			{ key: "shop:payment_proofs", snoozedUntil: "2026-10-22T13:00:00", updatedAt: "x" },
			{ key: "shop:orders_to_confirm", lastRaisedAt: "2026-10-22T11:50:00", updatedAt: "x" },
		];
		expect(nextToRaise(items, states, [], noon)?.key).toBe("shop:low_stock");
	});

	it("stays quiet after 3 raises in the last hour [TC-WQ-005]", () => {
		const raised = [noon.getTime() - 50 * 60_000, noon.getTime() - 30 * 60_000, noon.getTime() - 5 * 60_000];
		expect(nextToRaise(items, [], raised, noon)).toBeUndefined();
		expect(nextToRaise(items, [], raised.slice(1), noon)?.key).toBe("shop:payment_proofs");
	});

	it("at night raises only a late urgent item, and Later is shorter for urgent ones [TC-WQ-006]", () => {
		const night = at("2026-10-22T23:30:00");
		expect(nextToRaise(items, [], [], night)?.key).toBe("shop:payment_proofs");
		expect(nextToRaise(items.slice(1), [], [], night)).toBeUndefined();
		expect(snoozeFor({ group: "now" })).toBe(60 * 60_000);
		expect(snoozeFor({ group: "week" })).toBe(180 * 60_000);
	});
});
