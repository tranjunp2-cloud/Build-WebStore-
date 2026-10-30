import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilitySet } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import { type Call, ctx, runHarness, STAGING_FULL, systemText, toolNames } from "./run-harness.spec-helper";

// TC-AISEC-081..082 — a routed copilot request sends only the loaded groups' tools and instructions (static
// bytes per variant: the prompt cache hits across orgs, users and days), use_tools or a call to a tool that
// was not sent loads more for the next step, and AI_TOOL_ROUTING=off sends everything as before.

const full = capabilitySet(STAGING_FULL.split(",") as Parameters<typeof capabilitySet>[0] & string[]);
const ordersPage = { context: { module: "orders" } };
const reports = vi.fn(async () => ({ metric: "sales", period: { key: "today", from: "2026-10-22", to: "2026-10-22", days: 1 }, current: { revenue: 10, orders: 1 } }));
const orders = vi.fn(async () => ({ counts: { toConfirm: 2 }, orders: [] }));

afterEach(() => vi.useRealTimers());

describe("a routed request sends only what the message needs [TC-AISEC-081]", () => {
	it("sends the orders group's tools + use_tools and that variant's instructions, byte-identical for every org, user and day", async () => {
		// Arrange
		const a = runHarness({ turns: [{ text: "ok" }] });
		const b = runHarness({ turns: [{ text: "ok" }] });

		// Act
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-22T03:00:00Z"));
		await a.service.start(ctx, { prompt: "Confirm the pending orders", ...ordersPage }, () => undefined);
		vi.setSystemTime(new Date("2026-12-31T23:00:00Z"));
		await b.service.start({ organizationId: "org_9", userId: "usr_9", locale: "vi-VN" }, { prompt: "Xác nhận đơn hàng", ...ordersPage }, () => undefined);
		const [callA, callB] = [a.model.doGenerateCalls[0], b.model.doGenerateCalls[0]] as [Call, Call];

		// Assert
		expect(toolNames(callA)).toEqual(["ask_user", "current_page", "store_orders", "propose_store_orders", "use_tools"]);
		expect(systemText(callA)).toBe(JSON.stringify([{ role: "system", content: merchantInstructions(capabilitySet(["store_orders"]), full) }]));
		expect(systemText(callB)).toBe(systemText(callA));
		expect(JSON.stringify(callB.tools)).toBe(JSON.stringify(callA.tools));
		// the routed prefix is a fraction of the whole set's
		expect(systemText(callA).length + JSON.stringify(callA.tools).length).toBeLessThan(0.3 * (merchantInstructions(full).length + 78_000));
	});

	it("keeps what the deployment allows: the whole set's abilities are named and use_tools lists only its groups", async () => {
		// Arrange
		const { service, model } = runHarness({ turns: [{ text: "ok" }] });

		// Act
		await service.start(ctx, { prompt: "hi", ...ordersPage }, () => undefined);
		const call = model.doGenerateCalls[0] as Call;
		const useTools = JSON.stringify(call.tools?.find((t) => t.name === "use_tools"));

		// Assert
		expect(systemText(call)).toContain("call use_tools first");
		expect(systemText(call)).toContain("manage discount codes");
		expect(useTools).toContain('"website"');
		expect(useTools).not.toContain('"inventory"');
	});

	it("never sends or runs a tool the request's token does not allow, even when the model calls it", async () => {
		// Arrange: the token narrows the request to orders; the model tries the reports
		const { service, model } = runHarness({ turns: [{ tool: "store_reports", input: { metric: "sales", period: "today", from: null, to: null, compare: null, rankBy: null, limit: null } }, { text: "ok" }], shop: { storeReports: reports, storeOrders: orders } });
		reports.mockClear();

		// Act
		await service.start({ ...ctx, capabilities: ["store_orders"] }, { prompt: "hi", ...ordersPage }, () => undefined);

		// Assert
		expect(reports).not.toHaveBeenCalled();
		for (const call of model.doGenerateCalls) expect(toolNames(call)).not.toContain("store_reports");
		// orders is all this request may have: nothing left to load, so no use_tools
		expect(toolNames(model.doGenerateCalls[0])).not.toContain("use_tools");
	});
});

describe("loading more tools mid-request [TC-AISEC-082]", () => {
	it("use_tools loads a group: the next step has its tools and instructions", async () => {
		// Arrange
		const { service, model } = runHarness({ turns: [{ tool: "use_tools", input: { groups: ["reports"] } }, { text: "Sales today: RM 10." }] });

		// Act
		const run = await service.start(ctx, { prompt: "and the money?", ...ordersPage }, () => undefined);
		const [first, second] = model.doGenerateCalls as [Call, Call];

		// Assert
		expect(run.answer).toBe("Sales today: RM 10.");
		expect(toolNames(first)).not.toContain("store_reports");
		expect(toolNames(second)).toEqual(expect.arrayContaining(["store_orders", "store_reports", "store_todos"]));
		expect(systemText(second)).toBe(JSON.stringify([{ role: "system", content: merchantInstructions(capabilitySet(["store_orders", "store_reports"]), full) }]));
	});

	it("a call to an allowed tool that was not sent still runs, and its group is loaded for the next step", async () => {
		// Arrange
		const input = { metric: "sales", period: "today", from: null, to: null, compare: null, rankBy: null, limit: null };
		const { service, model } = runHarness({ turns: [{ tool: "store_reports", input }, { text: "RM 10 today." }], shop: { storeReports: reports } });
		reports.mockClear();

		// Act
		await service.start(ctx, { prompt: "hi", ...ordersPage }, () => undefined);

		// Assert
		expect(reports).toHaveBeenCalledTimes(1);
		expect(toolNames(model.doGenerateCalls[1])).toContain("store_reports");
	});

	it("keeps the loaded groups across a chat's turns, so the next message starts from the same prefix", async () => {
		// Arrange
		const { service, model } = runHarness({ turns: [{ text: "Code drafted." }, { text: "Glad to help." }] });

		// Act
		const first = await service.start(ctx, { prompt: "Create a 10% discount code" }, () => undefined);
		await service.start(ctx, { prompt: "thanks", threadId: first.threadId }, () => undefined);
		const [one, two] = model.doGenerateCalls as [Call, Call];

		// Assert
		expect(toolNames(two)).toEqual(toolNames(one));
		expect(systemText(two)).toBe(systemText(one));
	});

	it("AI_TOOL_ROUTING=off sends every allowed tool and the whole set's instructions, as before", async () => {
		// Arrange
		const { service, model } = runHarness({ turns: [{ text: "ok" }], env: { AI_TOOL_ROUTING: "off" } });

		// Act
		await service.start(ctx, { prompt: "Confirm the pending orders", ...ordersPage }, () => undefined);
		const call = model.doGenerateCalls[0] as Call;

		// Assert
		expect(toolNames(call)).toHaveLength(35);
		expect(toolNames(call)).not.toContain("use_tools");
		expect(systemText(call)).toBe(JSON.stringify([{ role: "system", content: merchantInstructions(full) }]));
	});
});
