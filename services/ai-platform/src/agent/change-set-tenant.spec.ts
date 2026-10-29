import type { AgentRun, ChangeSet } from "@ech/agent-core";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import type { UsageLedger } from "../ledger/usage-ledger";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentController } from "./agent.controller";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";
import { ChangeSetDecisionService } from "./change-set-decision.service";
import { queueView } from "./run-queue";

// TC-AISEC-147..148 — shops sharing one organization (prime-web `metaData.platformOrgId`) never see or
// decide each other's drafts, nor stop or list each other's runs. A run without a tenant stays visible.

const shopA: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_a", email: "a@shop.my", role: "owner", name: "Aina" };
const shopB: AiRequestContext = { organizationId: "org_1", tenantId: "8", userId: "usr_b", email: "b@shop.my", role: "owner", name: "Badrul" };
const shopAAdmin: AiRequestContext = { ...shopA, userId: "usr_a2", email: "a2@shop.my", role: "admin", name: "Amir" };
const noTenant: AiRequestContext = { organizationId: "org_1", userId: "usr_c", email: "c@shop.my", role: "owner" };
const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };

function run(id: string, status: AgentRun["status"] = "awaiting_approval"): AgentRun {
	return { id, role: "merchant", domain: "cms", prompt: "write a post", status, steps: [], receipts: [], changeSetIds: [], startedAt: new Date().toISOString() };
}

function draft(id: string, runId: string, status: ChangeSet["status"] = "pending"): ChangeSet {
	return {
		id,
		runId,
		domain: "cms",
		title: id,
		summary: "",
		risk: "low",
		blastRadius: { kind: "blog_post", count: 1, label: "1 post" },
		diffs: [],
		guardrails: [],
		status,
		stagedBy: "agent",
		stagedAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
	} as ChangeSet;
}

async function workspace() {
	const store = new InMemoryAgentStore();
	await store.createRun(shopA, run("run_a"));
	await store.insertChangeSet("org_1", draft("cs_a", "run_a"));
	await store.createRun(shopA, run("run_a_done", "applied"));
	await store.insertChangeSet("org_1", draft("cs_a_done", "run_a_done", "applied"));
	await store.createRun(noTenant, run("run_c"));
	await store.insertChangeSet("org_1", draft("cs_c", "run_c"));
	const env = testEnv();
	const decisions = new ChangeSetDecisionService(store);
	const runs = new AgentRunService(store, { resolveChain: () => [] }, ledger, env, new AgentThreadService(store, env));
	// built by position, without pinning the constructor's arity
	const controller = Reflect.construct(AgentController, [runs, decisions, store, {}, {}, env, {}, { nudge: async () => 0 }]) as AgentController;
	return { store, decisions, runs, controller };
}

describe("drafts of another shop in the same organization [TC-AISEC-147]", () => {
	it("TC-AISEC-147: get, claim, decide, revert and reinstate answer 404 for another shop's draft", async () => {
		// Arrange
		const { decisions } = await workspace();

		// Act + Assert
		await expect(decisions.get(shopB, "cs_a")).rejects.toMatchObject({ status: 404 });
		await expect(decisions.claim(shopB, "cs_a")).rejects.toMatchObject({ status: 404 });
		await expect(decisions.decide(shopB, "cs_a", { decision: "reject" })).rejects.toMatchObject({ status: 404 });
		await expect(decisions.revert(shopB, "cs_a_done", undefined)).rejects.toMatchObject({ status: 404 });
		await expect(decisions.reinstate(shopB, "cs_a_done")).rejects.toMatchObject({ status: 404 });
		expect((await decisions.get(shopA, "cs_a")).status).toBe("pending");
	});

	it("TC-AISEC-147: the review list shows only the caller's shop (and drafts without a tenant)", async () => {
		// Arrange
		const { controller } = await workspace();

		// Act
		const seenByB = await controller.listChangeSets(shopB);
		const seenByA = await controller.listChangeSets(shopA);

		// Assert
		expect(seenByB.map((cs) => cs.id).sort()).toEqual(["cs_c"]);
		expect(seenByA.map((cs) => cs.id).sort()).toEqual(["cs_a", "cs_a_done", "cs_c"]);
	});

	it("TC-AISEC-147: an owner cannot stop another shop's working run; an admin of the same shop can", async () => {
		// Arrange
		const { store, runs } = await workspace();
		await store.createRun(shopA, run("run_working", "running"));

		// Act + Assert
		await expect(runs.cancel(shopB, "run_working")).rejects.toMatchObject({ status: 404 });
		expect(store.runs.get("run_working")?.run.status).toBe("running");
		expect((await runs.cancel(shopAAdmin, "run_working")).status).toBe("cancelled");
	});
});

describe("the queue lists only the caller's shop [TC-AISEC-148]", () => {
	it("TC-AISEC-148: an owner waiting sees their shop's working requests, not another shop's", () => {
		// Arrange
		const startedAt = new Date();
		const working = [
			{ runId: "run_a", userId: "usr_a2", threadId: null, threadTitle: "Shop A post", prompt: null, userName: "Amir", startedAt, pending: false, tenantId: "7" },
			{ runId: "run_b", userId: "usr_b", threadId: null, threadTitle: "Shop B refunds", prompt: null, userName: "Badrul", startedAt, pending: false, tenantId: "8" },
			{ runId: "run_old", userId: "usr_c", threadId: null, threadTitle: "No tenant", prompt: null, userName: null, startedAt, pending: false, tenantId: null },
		];

		// Act
		const view = queueView(shopA, { working, queue: [] }, { admitted: false, position: 1, ahead: 0 });

		// Assert
		expect(view.running.map((r) => r.runId)).toEqual(["run_a", "run_old"]);
	});
});
