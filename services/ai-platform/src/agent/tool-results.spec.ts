import { describe, expect, it, vi } from "vitest";
import { type Call, ctx, runHarness, toolResults } from "./run-harness.spec-helper";
import { createResultMemory, MAX_RESULT_CHARS, shapeToolResult } from "./tool-results";

// TC-AISEC-085..086 — what a read feeds back to the model: parts an earlier read of the run already returned
// become a pointer (only within what the model has), long results are clipped with a note, a section's
// version hash is dropped, and the reads a change is drafted from are never touched.

const categories = Array.from({ length: 40 }, (_, i) => ({ id: String(i + 1), name: `Category ${i + 1}`, path: `Shop > Category ${i + 1}` }));

describe("repeats of earlier reads [TC-AISEC-085]", () => {
	it("replaces a large part an earlier read returned with a pointer, and keeps what is new", () => {
		// Arrange
		const memory = createResultMemory();
		const first = { total: 2, items: [{ id: "1", title: "Batik scarf" }], categories };
		const second = { total: 1, items: [{ id: "9", title: "Rattan basket" }], categories };

		// Act
		const one = shapeToolResult("content.search", first, memory) as Record<string, unknown>;
		const two = shapeToolResult("content.search", second, memory) as Record<string, unknown>;

		// Assert
		expect(one).toEqual(first);
		expect(two.items).toEqual(second.items);
		expect(two.categories).toBe("(unchanged: same as shown earlier in your search_items result)");
	});

	it("never points at a read the model does not have: each request of a run starts from what was committed", () => {
		// Arrange: memory of a failed attempt is thrown away, a new one starts empty
		const failedAttempt = createResultMemory();
		shapeToolResult("store.categories", { categories }, failedAttempt);

		// Act
		const fresh = shapeToolResult("store.categories", { categories }, createResultMemory()) as Record<string, unknown>;

		// Assert
		expect(fresh.categories).toEqual(categories);
	});

	it("in a run, the second search's category list is a pointer to the first one's", async () => {
		// Arrange
		const searchItems = vi.fn(async (_: unknown, input: { query?: string }) => ({ total: 1, items: [{ kind: "product", id: input.query ?? "x", title: "Item" }], categories }));
		const search = (query: string) => ({ tool: "search_items", input: { kind: "product", query, status: "any", limit: 5 } });
		const { service, model } = runHarness({ turns: [search("scarf"), search("basket"), { text: "Found both." }], shop: { searchItems } as never });

		// Act
		await service.start(ctx, { prompt: "find the scarf and the basket products" }, () => undefined);
		const results = toolResults(model.doGenerateCalls[2] as Call).map((r) => JSON.stringify(r.output));

		// Assert
		expect(results).toHaveLength(2);
		expect(results[0]).toContain("Shop > Category 40");
		expect(results[1]).not.toContain("Shop > Category 40");
		expect(results[1]).toContain("same as shown earlier in your search_items result");
	});
});

describe("long results and fields the model never sends back [TC-AISEC-086]", () => {
	it("clips a result over the limit: long texts say how much was cut, long lists how many are left", () => {
		// Arrange
		const huge = { block: { rows: Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, text: "x".repeat(400) })) } };

		// Act
		const shaped = shapeToolResult("site.read", huge, createResultMemory()) as { block: { rows: unknown[] }; shortened: string };

		// Assert
		expect(JSON.stringify(shaped).length).toBeLessThanOrEqual(MAX_RESULT_CHARS + 400);
		expect(shaped.shortened).toMatch(/long texts and lists were cut/);
		expect(String(shaped.block.rows.at(-1))).toMatch(/more not shown/);
	});

	it("drops a section's version hash (prime-web guards the version itself) and leaves small results alone", () => {
		// Arrange
		const block = { id: "b1", type: "hero", data: { title: "Hi" }, version: "a".repeat(32) };

		// Act
		const shaped = shapeToolResult("site.read", block, createResultMemory());

		// Assert
		expect(shaped).toEqual({ id: "b1", type: "hero", data: { title: "Hi" } });
	});

	it("never changes the fresh reads a change is drafted from, nor errors", () => {
		// Arrange
		const memory = createResultMemory();
		const snapshot = { version: "v1", fields: { body: "y".repeat(40_000) } };
		const error = { error: { code: "not_found", message: "No such item in this shop." } };

		// Act + Assert
		expect(shapeToolResult("content.check", snapshot, memory)).toBe(snapshot);
		expect(shapeToolResult("site.check", snapshot, memory)).toBe(snapshot);
		expect(shapeToolResult("site.read", error, memory)).toBe(error);
	});
});
