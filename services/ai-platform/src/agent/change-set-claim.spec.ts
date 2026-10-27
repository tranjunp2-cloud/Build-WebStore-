import type { ChangeSet } from "@ech/agent-core";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentThreadService } from "./agent-thread.service";
import { CLAIM_STALE_AFTER_MS, ChangeSetDecisionService } from "./change-set-decision.service";

/**
 * TC-AISEC-025 — a change being applied is never applied twice or decided under the applier:
 * the claim outlives the prime-web apply route (300 s), reject waits for the apply, and every
 * status write only lands on the status it expects.
 */

const ctx: AiRequestContext = { organizationId: "org_1", userId: "usr_1", email: "owner@shop.my", role: "owner" };
const BFF_APPLY_MAX_MS = 300_000;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

function draft(id: string, overrides: Partial<ChangeSet> = {}): ChangeSet {
	return {
		id,
		runId: `run_${id}`,
		domain: "cms",
		title: id,
		summary: "",
		risk: "low",
		blastRadius: { kind: "blog_post", count: 1, label: "1 post" },
		diffs: [],
		guardrails: [],
		status: "pending",
		stagedBy: "agent",
		stagedAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		...overrides,
	} as ChangeSet;
}

async function setup(...changeSets: ChangeSet[]) {
	const store = new InMemoryAgentStore();
	for (const changeSet of changeSets) await store.insertChangeSet("org_1", changeSet);
	/** the claim as if the applier took it `minutes` ago */
	const claimedAgo = (id: string, minutes: number) => {
		const row = store.changeSets.get(id);
		if (row) row.claimedAt = minutesAgo(minutes);
	};
	return { store, decisions: new ChangeSetDecisionService(store), claimedAgo };
}

describe("claims outlive a slow apply [TC-AISEC-025]", () => {
	it("keeps a claim above the BFF apply limit, so a 5-minute apply is not claimed again", async () => {
		// Arrange
		const { decisions, claimedAgo } = await setup(draft("cs_1"));
		claimedAgo("cs_1", 5);

		// Act + Assert
		expect(CLAIM_STALE_AFTER_MS).toBeGreaterThan(BFF_APPLY_MAX_MS);
		await expect(decisions.claim(ctx, "cs_1")).rejects.toMatchObject({ status: 409 });
	});

	it("lets an abandoned claim (older than the stale window) be claimed again", async () => {
		// Arrange
		const { decisions, claimedAgo } = await setup(draft("cs_1"));
		claimedAgo("cs_1", 7);

		// Act + Assert
		await expect(decisions.claim(ctx, "cs_1")).resolves.toMatchObject({ id: "cs_1" });
	});

	it("refuses to delete the chat while its change is applied, with the same window", async () => {
		// Arrange
		const { store, claimedAgo } = await setup();
		const threads = new AgentThreadService(store, testEnv());
		const thread = await threads.open(ctx, { prompt: "x" });
		await store.createRun(ctx, { id: "run_cs_1", role: "merchant", domain: "cms", prompt: "x", status: "awaiting_approval", steps: [], receipts: [], changeSetIds: ["cs_1"], threadId: thread.id, startedAt: new Date().toISOString() });
		await store.insertChangeSet("org_1", draft("cs_1"));
		claimedAgo("cs_1", 5);

		// Act + Assert
		await expect(threads.remove(ctx, thread.id)).rejects.toMatchObject({ status: 409 });
	});
});

describe("reject waits for the apply [TC-AISEC-025]", () => {
	it("refuses reject while a fresh claim holds the change", async () => {
		// Arrange
		const { decisions } = await setup(draft("cs_1"));
		await decisions.claim(ctx, "cs_1");

		// Act + Assert
		await expect(decisions.decide(ctx, "cs_1", { decision: "reject" })).rejects.toMatchObject({ status: 409, message: "This change is being applied right now." });
	});

	it("rejects once the applier released its claim (the BFF's failed-apply path)", async () => {
		// Arrange
		const { decisions } = await setup(draft("cs_1"));
		await decisions.claim(ctx, "cs_1");
		await decisions.release(ctx, "cs_1");

		// Act
		const rejected = await decisions.decide(ctx, "cs_1", { decision: "reject", note: "apply failed" });

		// Assert
		expect(rejected.status).toBe("rejected");
	});

	it("does not expire a change while an apply that started in time still holds it", async () => {
		// Arrange
		const { decisions, claimedAgo, store } = await setup(draft("cs_1"));
		claimedAgo("cs_1", 3);
		const row = store.changeSets.get("cs_1");
		if (row) row.changeSet = { ...row.changeSet, expiresAt: minutesAgo(1).toISOString() };

		// Act
		const applied = await decisions.decide(ctx, "cs_1", { decision: "approve", result: { entities: [], links: [] } });

		// Assert
		expect(applied.status).toBe("applied");
	});
});

describe("status writes only land on the status they expect [TC-AISEC-025]", () => {
	it("answers 409 instead of overwriting a decision made in between", async () => {
		// Arrange: the decider read the change as pending, then someone else rejected it
		const { decisions, store } = await setup(draft("cs_1"));
		await decisions.claim(ctx, "cs_1");
		const stale = await store.getChangeSet("org_1", "cs_1");
		const row = store.changeSets.get("cs_1");
		if (row) row.changeSet = { ...row.changeSet, status: "rejected" };
		store.getChangeSet = async () => stale;

		// Act + Assert
		await expect(decisions.decide(ctx, "cs_1", { decision: "approve", result: { entities: [], links: [] } })).rejects.toMatchObject({ status: 409 });
		expect(store.changeSets.get("cs_1")?.changeSet.status).toBe("rejected");
	});

	it("does not flip a change to expired once it was decided", async () => {
		// Arrange: the reader saw an expired pending change, but it was applied meanwhile
		const { decisions, store } = await setup(draft("cs_1", { expiresAt: minutesAgo(1).toISOString() }));
		const stale = await store.getChangeSet("org_1", "cs_1");
		const row = store.changeSets.get("cs_1");
		if (row) row.changeSet = { ...row.changeSet, status: "applied" };
		const read = store.getChangeSet.bind(store);
		let calls = 0;
		store.getChangeSet = async (org, id) => (calls++ === 0 ? stale : read(org, id));

		// Act
		const seen = await decisions.get(ctx, "cs_1");

		// Assert
		expect(seen.status).toBe("applied");
		expect(store.changeSets.get("cs_1")?.changeSet.status).toBe("applied");
	});
});
