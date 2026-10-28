import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { runWithRequestId } from "../observability/request-context";
import { HttpShopTools } from "./shop-tools";

// TC-AISEC-034 — agent tool facade calls carry the request id they were made for.

const ctx = { organizationId: "org_1", userId: "user_1", token: "ctx-token" } as AiRequestContext;
const fetchMock = vi.fn<typeof fetch>();
const ok = () => new Response(JSON.stringify({ total: 0, items: [], categories: [] }), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("HttpShopTools request id [TC-AISEC-034]", () => {
	it("TC-AISEC-034: forwards x-request-id inside a request, and sends none outside one", async () => {
		// Arrange
		fetchMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok());
		const tools = new HttpShopTools({ PRIME_WEB_INTERNAL_URL: "http://web.internal/" } as never);

		// Act
		await runWithRequestId("pw-req-0001", () => tools.searchItems(ctx, { kind: "product" }));
		await tools.searchItems(ctx, { kind: "product" });

		// Assert
		const headers = fetchMock.mock.calls.map((call) => call[1]?.headers as Record<string, string>);
		expect(headers[0]).toMatchObject({ authorization: "Bearer ctx-token", "x-request-id": "pw-req-0001" });
		expect(headers[1]).not.toHaveProperty("x-request-id");
	});
});
