import { describe, expect, it, vi } from "vitest";
import { capabilitySet } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import { createMerchantTools, type MerchantToolDeps, READ_ITEM_MAX } from "./merchant-tools";
import { type Call, ctx, runHarness, toolResults } from "./run-harness.spec-helper";

// TC-AISEC-090..091 — fewer steps: read_item reads up to 5 records in one call, and the instructions ask the
// model to read what it needs together instead of one read per step.

const deps = (readItem: MerchantToolDeps["readItem"]) => ({ readItem }) as unknown as MerchantToolDeps;
const execute = (tools: ReturnType<typeof createMerchantTools>, input: unknown) =>
	(tools.read_item as unknown as { execute: (i: unknown, o: unknown) => Promise<unknown> }).execute(input, { toolCallId: "t", messages: [] });

describe("several records in one read [TC-AISEC-090]", () => {
	it("reads id + moreIds (distinct, at most 5) and answers them as one list", async () => {
		// Arrange
		const readItem = vi.fn(async (input: { id: string }) => ({ id: input.id, title: `Post ${input.id}` }));
		const tools = createMerchantTools(deps(readItem));

		// Act
		const out = await execute(tools, { kind: "blog_post", id: "1", moreIds: ["2", "1", "3", "4", "5", "6"] });

		// Assert
		expect(readItem.mock.calls.map(([input]) => input)).toEqual(["1", "2", "3", "4", "5"].map((id) => ({ kind: "blog_post", id })));
		expect(READ_ITEM_MAX).toBe(5);
		expect(out).toEqual({ items: ["1", "2", "3", "4", "5"].map((id) => ({ id, title: `Post ${id}` })) });
	});

	it("keeps one id answering exactly as before (moreIds null or left out)", async () => {
		// Arrange
		const readItem = vi.fn(async (input: { id: string }) => ({ id: input.id }));
		const tools = createMerchantTools(deps(readItem));

		// Act
		const a = await execute(tools, { kind: "product", id: "7", moreIds: null });
		const b = await execute(tools, { kind: "product", id: "7" });

		// Assert
		expect(a).toEqual({ id: "7" });
		expect(b).toEqual({ id: "7" });
	});

	it("in a run, two posts are read in one step: each gets its own receipt and the model one result", async () => {
		// Arrange
		const readItem = vi.fn(async (_: unknown, input: { kind: "blog_post"; id: string }) => ({ kind: input.kind, id: input.id, title: `Post ${input.id}`, text: "…" }));
		const { service, model } = runHarness({ turns: [{ tool: "read_item", input: { kind: "blog_post", id: "1", moreIds: ["2"] } }, { text: "Both read." }], shop: { readItem } as never });

		// Act
		const run = await service.start(ctx, { prompt: "compare these two blog posts", context: { module: "blog" } }, () => undefined);

		// Assert
		expect(readItem).toHaveBeenCalledTimes(2);
		expect(run.receipts.filter((r) => r.tool === "content.read")).toHaveLength(2);
		expect(model.doGenerateCalls).toHaveLength(2);
		expect(JSON.stringify(toolResults(model.doGenerateCalls[1] as Call))).toContain("Post 2");
	});
});

describe("the instructions ask for batched reads [TC-AISEC-091]", () => {
	it("tells the model to read several records in one call or in the same step", () => {
		// Arrange + Act
		const text = merchantInstructions(capabilitySet(["blog", "shop_products"]));

		// Assert
		expect(text).toContain("read them in one read_item call (moreIds) or call the read tools you need together in the same step");
		expect(merchantInstructions(capabilitySet(["store_reports"]))).not.toContain("moreIds");
	});
});
