import { describe, expect, it } from "vitest";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { buildStatusChangeSet, buildUpdateChangeSet, type RecordState, type UpdateInput } from "./change-set-builders";
import { ChangeSetDecisionService } from "./change-set-decision.service";

// TC-AICP-66 — edits and archive / trash of existing records are drafted from a fresh
// snapshot: only real changes, editable fields only, a version guard, typed confirmation
// for anything destructive, and nothing that is not reversible.
// TC-AICP-67 — an applied change with undo data can be reverted once.

const ctx = { id: "cs_1", runId: "run_1", now: new Date("2026-10-20T00:00:00Z") };
const product: RecordState = {
	kind: "product",
	id: "prod_1",
	title: "Grey Shirt",
	status: "draft",
	version: '"ped-v1-abc"',
	removed: false,
	fields: { name: "Grey Shirt", description: "Old text" },
	attributes: [
		{ code: "primary_color", label: "Primary color", value: "grey", dataType: "string" },
		{ code: "item_weight", label: "Item weight", value: null, dataType: "measurement" },
	],
};
const none = { name: null, description: null, attributes: null, title: null, contentHtml: null, seoTitle: null, seoDescription: null, coverImageId: null };
const edit = (changes: Partial<UpdateInput["changes"]>, kind: UpdateInput["kind"] = "product"): UpdateInput => ({
	kind,
	id: "prod_1",
	reason: "Sửa theo yêu cầu",
	changes: { ...none, ...changes },
});

describe("record edits [TC-AICP-66]", () => {
	it("stages only what changes, with the version it was drafted from", () => {
		const built = buildUpdateChangeSet(
			edit({ name: "Grey Shirt", description: "New text", attributes: [{ code: "primary_color", value: "charcoal" }, { code: "item_weight", value: "200 g" }] }),
			product,
			ctx,
		);
		if ("error" in built) throw new Error(built.error);
		expect(built.diffs.map((d) => [d.field, d.before, d.after])).toEqual([
			["description", "Old text", "New text"],
			["attribute.Primary color", "grey", "charcoal"],
		]);
		expect(built.action).toEqual({
			kind: "product.update",
			payload: { id: "prod_1", base: '"ped-v1-abc"', changes: { description: "New text", attributes: [{ code: "primary_color", value: "charcoal", dataType: "string" }] } },
		});
		expect(built.guardrails).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ rule: "version_guard", ok: true }),
				expect.objectContaining({ rule: "skipped_value", ok: false, detail: "Item weight (measurement) is set in the editor." }),
			]),
		);
		expect(built.confirmText).toBeUndefined();
	});

	it("refuses no-op edits, edits of archived records and blog fields on a product", () => {
		expect(buildUpdateChangeSet(edit({ name: "Grey Shirt" }), product, ctx)).toMatchObject({ error: expect.stringContaining("Nothing would change") });
		expect(buildUpdateChangeSet(edit({ description: "x" }), { ...product, removed: true }, ctx)).toMatchObject({ error: expect.stringContaining("restore it first") });
		expect(buildUpdateChangeSet(edit({ title: "A new blog title" }), product, ctx)).toMatchObject({ error: expect.stringContaining("blog field") });
	});

	it("archive and trash are high risk, typed-confirmed and reversible; impossible moves are refused", () => {
		const archive = buildStatusChangeSet({ kind: "product", id: "prod_1", action: "archive", reason: "bản thử" }, product, ctx);
		if ("error" in archive) throw new Error(archive.error);
		expect(archive).toMatchObject({
			risk: "high",
			confirmText: "Grey Shirt",
			action: { kind: "product.set_status", payload: { id: "prod_1", base: "draft", to: "archived" } },
			diffs: [expect.objectContaining({ before: "Draft", after: "Archived" })],
		});
		expect(buildStatusChangeSet({ kind: "product", id: "prod_1", action: "restore", reason: "x" }, product, ctx)).toHaveProperty("error");

		const post: RecordState = { ...product, kind: "blog_post", id: "4", title: "Batik care", status: "published", fields: {} };
		const trash = buildStatusChangeSet({ kind: "blog_post", id: "4", action: "trash", reason: "cũ" }, post, ctx);
		expect(trash).toMatchObject({ confirmText: "Batik care", action: { payload: { base: { status: "published", removed: false }, to: "trash" } } });
		expect(buildStatusChangeSet({ kind: "blog_post", id: "4", action: "publish", reason: "x" }, post, ctx)).toHaveProperty("error");
		const restore = buildStatusChangeSet({ kind: "blog_post", id: "4", action: "restore", reason: "x" }, { ...post, removed: true }, ctx);
		expect(restore).toMatchObject({ risk: "low", diffs: [expect.objectContaining({ before: "In the trash" })] });
		expect(restore).not.toHaveProperty("confirmText");
	});
});

describe("revert and reinstate for the site editor's Undo / Redo [TC-AIREL-310]", () => {
	const actx = { organizationId: "org_1", userId: "usr_1", email: "o@shop.my", role: "owner" };
	const undo = { kind: "site.page_restore", payload: { pageId: "12" }, until: "2999-01-01T00:00:00Z" };
	async function applied() {
		const store = new InMemoryAgentStore();
		const decisions = new ChangeSetDecisionService(store);
		const built = buildUpdateChangeSet(edit({ description: "New text" }), product, ctx);
		if ("error" in built) throw new Error(built.error);
		await store.insertChangeSet("org_1", { ...built, status: "applied", result: { entities: [], links: [], undo } });
		return decisions;
	}

	it("keeps the undo data when asked, so Redo can put the change back", async () => {
		const decisions = await applied();

		const reverted = await decisions.revert(actx, "cs_1", undefined, { keepUndo: true });
		expect(reverted.status).toBe("reverted");
		expect(reverted.result?.undo).toEqual(undo);

		const again = await decisions.reinstate(actx, "cs_1");
		expect(again.status).toBe("applied");
		expect(again.result?.undo).toEqual(undo);
		expect(again.result).not.toHaveProperty("revertedAt");
		// and it can be taken back again
		expect((await decisions.revert(actx, "cs_1", undefined, { keepUndo: true })).status).toBe("reverted");
	});

	it("reinstate refuses a change that was undone for good (no undo data), one that is applied, and an expired one", async () => {
		const decisions = await applied();
		await expect(decisions.reinstate(actx, "cs_1")).rejects.toMatchObject({ status: 409 });
		await decisions.revert(actx, "cs_1", undefined);
		await expect(decisions.reinstate(actx, "cs_1")).rejects.toMatchObject({ status: 409 });

		const store = new InMemoryAgentStore();
		const expired = new ChangeSetDecisionService(store);
		const built = buildUpdateChangeSet(edit({ description: "New text" }), product, ctx);
		if ("error" in built) throw new Error(built.error);
		await store.insertChangeSet("org_1", { ...built, status: "reverted", result: { entities: [], links: [], undo: { ...undo, until: "2020-01-01T00:00:00Z" } } });
		await expect(expired.reinstate(actx, "cs_1")).rejects.toMatchObject({ status: 409 });
	});
});

describe("revert [TC-AICP-67]", () => {
	it("reverts an applied change with undo data once", async () => {
		const store = new InMemoryAgentStore();
		const decisions = new ChangeSetDecisionService(store);
		const actx = { organizationId: "org_1", userId: "usr_1", email: "o@shop.my", role: "owner" };
		const built = buildUpdateChangeSet(edit({ description: "New text" }), product, ctx);
		if ("error" in built) throw new Error(built.error);
		await store.insertChangeSet("org_1", {
			...built,
			status: "applied",
			result: { entities: [], links: [], undo: { kind: "product.update", payload: {}, until: "2026-10-27T00:00:00Z" } },
		});

		const reverted = await decisions.revert(actx, "cs_1", undefined);
		expect(reverted.status).toBe("reverted");
		expect(reverted.result).toMatchObject({ revertedBy: "o@shop.my" });
		expect(reverted.result?.undo).toBeUndefined();
		await expect(decisions.revert(actx, "cs_1", undefined)).rejects.toMatchObject({ status: 409 });
	});
});
