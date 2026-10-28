import type { WorkItem } from "@ech/agent-core";
import type { AgentGateway } from "@ech/agent-transport";
import { describe, expect, it, vi } from "vitest";
import { discardOnPlatform } from "./work";

// TC-WQ-061..063 — discarding an issue from the dock: the assistant's waiting drafts in that chat are rejected, a
// question it waits on is skipped (its run cancelled), a shop issue touches nothing on the platform (it is only hidden).

const item = (patch: Partial<WorkItem>): WorkItem =>
	({
		key: "ai:review:thr_1",
		source: "ai",
		kind: "review",
		group: "you",
		order: 0,
		count: 2,
		title: "Approve: Reply to Farid Hassan",
		area: "Customers",
		icon: "mail",
		say: "…",
		short: "…",
		actions: [{ kind: "open_thread", value: "thr_1", label: "Review" }],
		taskKey: "thread:thr_1",
		taskTitle: "Reply to Farid",
		threadId: "thr_1",
		fingerprint: "thr_1:2",
		...patch,
	}) as WorkItem;

const gateway = () => {
	const changeSets = [
		{ id: "cs_a", status: "pending" },
		{ id: "cs_b", status: "applied" },
		{ id: "cs_c", status: "pending" },
	];
	return {
		getThread: vi.fn(async () => ({ thread: { id: "thr_1" }, runs: [], changeSets })),
		decideChangeSet: vi.fn(async (id: string) => ({ id, status: "rejected" })),
		cancelRun: vi.fn(async (id: string) => ({ id, status: "cancelled" })),
	} as unknown as AgentGateway & { getThread: ReturnType<typeof vi.fn>; decideChangeSet: ReturnType<typeof vi.fn>; cancelRun: ReturnType<typeof vi.fn> };
};

describe("discardOnPlatform", () => {
	it("[TC-WQ-061] rejects every draft still waiting in the issue's chat, nothing else", async () => {
		const g = gateway();
		await discardOnPlatform(g, item({}));
		expect(g.getThread).toHaveBeenCalledWith("thr_1");
		expect(g.decideChangeSet.mock.calls.map((call) => [call[0], call[1]])).toEqual([
			["cs_a", "reject"],
			["cs_c", "reject"],
		]);
	});

	it("[TC-WQ-062] skips a question by cancelling the run that asked it", async () => {
		const g = gateway();
		await discardOnPlatform(g, item({ key: "ai:ask:run_9", kind: "question", threadId: "thr_2" }));
		expect(g.cancelRun).toHaveBeenCalledWith("run_9");
		expect(g.decideChangeSet).not.toHaveBeenCalled();
	});

	it("[TC-WQ-063] leaves the platform alone for a shop issue (it is only hidden until it changes)", async () => {
		const g = gateway();
		await discardOnPlatform(g, item({ key: "shop:low_stock", source: "shop", kind: "low_stock", threadId: "thr_3" }));
		expect(g.getThread).not.toHaveBeenCalled();
		expect(g.cancelRun).not.toHaveBeenCalled();
	});
});
