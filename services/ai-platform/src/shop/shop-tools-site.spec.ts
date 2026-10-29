import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { HttpShopTools, ShopToolError } from "./shop-tools";

// TC-AIWB-09 — the platform's calls into prime-web's web builder facade: the endpoint per call, the
// merchant token forwarded, refusals returned as data, malformed drafts refused.

const ctx = { organizationId: "org_1", userId: "user_1", token: "ctx-token" } as AiRequestContext;
const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const PREPARED = {
	kind: "site.page_patch",
	title: "Edit page: Home",
	why: "Warmer hero",
	risk: "low",
	diffs: [{ entity: { kind: "site_block", id: "00000000-0000-4000-8000-0000000000b1", label: "Hero · Home" }, field: "headline", before: "Old", after: "New" }],
	guardrails: [{ rule: "undo", ok: true, detail: "undo" }],
	plan: { siteId: "5", pageId: "10", ops: [], expect: {} },
};

function tools() {
	return new HttpShopTools({ PRIME_WEB_INTERNAL_URL: "http://web.internal/" } as never);
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("HttpShopTools web builder calls [TC-AIWB-09]", () => {
	it("drafts a page edit at site.prepare_patch with the merchant's token", async () => {
		fetchMock.mockResolvedValueOnce(json(PREPARED));

		const out = await tools().sitePrepare(ctx, "patch", { siteId: "5", pageId: "10", why: "x", ops: [] });

		const [url, init] = fetchMock.mock.calls[0]!;
		expect(url).toBe("http://web.internal/api/agent-tools/site.prepare_patch");
		expect(new Headers(init?.headers).get("authorization")).toBe("Bearer ctx-token");
		expect(out).toMatchObject({ kind: "site.page_patch", risk: "low" });
	});

	it("drafts a theme change at site.prepare_theme", async () => {
		fetchMock.mockResolvedValueOnce(json({ ...PREPARED, kind: "site.theme_patch", risk: "high", confirmText: "Kedai Batik" }));

		await tools().sitePrepare(ctx, "theme", { siteId: "5", why: "x", changes: {} });

		expect(fetchMock.mock.calls[0]![0]).toBe("http://web.internal/api/agent-tools/site.prepare_theme");
	});

	it.each([
		["pages", "site.prepare_pages", "site.pages_patch"],
		["page_create", "site.prepare_page_create", "site.page_create"],
		["nav", "site.prepare_nav", "site.nav_patch"],
		["publish", "site.prepare_publish", "site.publish"],
	] as const)("drafts a %s change at %s [TC-AIWB-28..31]", async (kind, tool, actionKind) => {
		fetchMock.mockResolvedValueOnce(json({ ...PREPARED, kind: actionKind, risk: "high", confirmText: "Kedai Batik", plan: { siteId: "5" } }));

		const out = await tools().sitePrepare(ctx, kind, { siteId: "5", why: "x" });

		expect(fetchMock.mock.calls[0]![0]).toBe(`http://web.internal/api/agent-tools/${tool}`);
		expect(out).toMatchObject({ kind: actionKind, confirmText: "Kedai Batik" });
	});

	it("gives the new prepare calls the same 30s budget as a page edit [TC-AIWB-28..31]", async () => {
		const timeout = vi.spyOn(AbortSignal, "timeout");
		fetchMock.mockImplementation(async () => json({ ...PREPARED, kind: "site.publish" }));

		for (const kind of ["pages", "page_create", "nav", "publish"] as const) await tools().sitePrepare(ctx, kind, { siteId: "5", why: "x" });

		expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([30_000, 30_000, 30_000, 30_000]);
		timeout.mockRestore();
	});

	it("passes a refusal back exactly as prime-web wrote it", async () => {
		const refusal = { error: { code: "site_403", message: "This site belongs to another workspace." } };
		fetchMock.mockResolvedValueOnce(json(refusal));

		expect(await tools().sitePrepare(ctx, "patch", { siteId: "9", pageId: "10", why: "x", ops: [] })).toEqual(refusal);
	});

	it("reads the site at site.read", async () => {
		fetchMock.mockResolvedValueOnce(json({ pages: [] }));

		const out = await tools().siteRead(ctx, { view: "pages", siteId: "5" });

		expect(fetchMock.mock.calls[0]![0]).toBe("http://web.internal/api/agent-tools/site.read");
		expect(out).toEqual({ pages: [] });
	});

	it("turns a non-OK reply into a ShopToolError with its status", async () => {
		fetchMock.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));

		const error = await tools().sitePrepare(ctx, "theme", { siteId: "5", why: "x", changes: {} }).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ShopToolError);
		expect(error).toMatchObject({ status: 403 });
	});

	it("refuses to call prime-web when its internal URL is not configured", async () => {
		const unconfigured = new HttpShopTools({} as never);

		await expect(unconfigured.siteRead(ctx, { view: "pages", siteId: "5" })).rejects.toMatchObject({ status: 503 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects a malformed draft instead of passing it to the model or the review card", async () => {
		fetchMock.mockResolvedValueOnce(json({ ...PREPARED, risk: "extreme" }));

		await expect(tools().sitePrepare(ctx, "patch", { siteId: "5", pageId: "10", why: "x", ops: [] })).rejects.toThrow();
	});
});
