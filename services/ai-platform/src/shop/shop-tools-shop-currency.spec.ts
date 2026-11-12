import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { HttpShopTools } from "./shop-tools";

// TC-AIREL-69 — a Payload products search keeps the shop's currency, so the model can price drafts in it.

const ctx = { organizationId: "org_1", userId: "user_1", token: "ctx-token" } as AiRequestContext;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("HttpShopTools products search [TC-AIREL-69]", () => {
	it("TC-AIREL-69: passes the shop's currency through", async () => {
		// Arrange
		const body = { total: 1, items: [{ kind: "product", id: "42", title: "Batik Scarf" }], categories: [], shop: { currency: "SGD" } };
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

		// Act
		const out = await new HttpShopTools({ PRIME_WEB_INTERNAL_URL: "http://web.internal/" } as never).searchItems(ctx, { kind: "product" });

		// Assert
		expect(out).toMatchObject({ total: 1, shop: { currency: "SGD" } });
	});
});
