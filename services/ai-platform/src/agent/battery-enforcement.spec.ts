import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { OrgBattery } from "../cost/org-battery";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { TaskEngine } from "../tasks/task-engine.service";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentError } from "./agent-errors";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

// TC-AIBAT-05 — an empty AI battery refuses a copilot start and a task start with 429 + the time it is back;
// a battery with charge, or one that cannot be read, lets both through.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "o@shop.my", role: "owner" };
const NOW = new Date("2026-10-26T10:00:00Z");
const MESSAGE = "AI is out for today. It's back at 02:00. Upgrade your plan for more.";

const ledger: UsageLedger = { record: async () => {}, countSince: async () => 0 };
const models: ModelRegistry = { resolveChain: () => [{ provider: "openai", modelId: "gpt-4.1-mini", model: new MockLanguageModelV4() }] };

const battery = (spent: number) =>
	new OrgBattery({ spent: async () => spent, rows: async () => [{ createdAt: new Date("2026-10-25T18:00:00Z"), micros: spent }] }, () => NOW.getTime());
const broken = new OrgBattery({ spent: async () => Promise.reject(new Error("db down")), rows: async () => [] });

function runs(org: OrgBattery) {
	const env = testEnv();
	const store = new InMemoryAgentStore();
	return new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env), undefined, undefined, undefined, undefined, org);
}
const tasks = (org: OrgBattery) => new TaskEngine(models, ledger, testEnv(), undefined, org);

describe("battery enforcement [TC-AIBAT-05]", () => {
	it("refuses a copilot start with 429 and the time when empty, before anything is reserved", async () => {
		const service = runs(battery(1_000_000));
		await expect(service.reserve(ctx, {}, NOW)).rejects.toMatchObject({ status: 429, message: MESSAGE });
		await expect(service.reserve(ctx, {}, NOW)).rejects.toBeInstanceOf(AgentError);
	});

	it("refuses a task start with 429 and the time when empty", async () => {
		await expect(tasks(battery(2_000_000)).run(ctx, "content.translate", { targetLocale: "ms-MY", fields: { name: "x" } })).rejects.toMatchObject({
			status: 429,
			message: MESSAGE,
		});
	});

	it("lets a copilot start through with charge left, or when the battery cannot be read", async () => {
		await expect(runs(battery(500_000)).reserve(ctx, {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
		await expect(runs(broken).reserve(ctx, {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
	});

	it("uses the plan budget from the token over the env fallback (and unlimited never refuses)", async () => {
		const spent = battery(2_000_000); // over the 1 USD env fallback
		await expect(runs(spent).reserve({ ...ctx, limits: { plan: "pro", aiBudgetUsd: 5, picturesPerDay: 50 } }, {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
		await expect(runs(spent).reserve({ ...ctx, limits: { plan: "free", aiBudgetUsd: 0.5, picturesPerDay: 5 } }, {}, NOW)).rejects.toMatchObject({ status: 429 });
		await expect(runs(spent).reserve({ ...ctx, limits: { plan: "max", aiBudgetUsd: null, picturesPerDay: null } }, {}, NOW)).resolves.toMatchObject({ runId: expect.any(String) });
		await expect(
			tasks(spent).run({ ...ctx, limits: { plan: "free", aiBudgetUsd: 0.5, picturesPerDay: 5 } }, "content.translate", { targetLocale: "ms-MY", fields: { name: "x" } }),
		).rejects.toMatchObject({ status: 429 });
	});

	it("lets a task start pass the battery check with charge left", async () => {
		// the mock model returns nothing usable: any failure is the model's, never the battery's 429
		const error = await tasks(battery(100_000)).run(ctx, "content.translate", { targetLocale: "ms-MY", fields: { name: "x" } }).catch((e) => e);
		expect(error?.message ?? "").not.toMatch(/out for today/);
	});
});
