import "server-only";

import type { ChangeSetResult } from "@ech/agent-core";
import config from "@payload-config";
import { sql } from "drizzle-orm";
import { getPayload, type Payload, type User } from "payload";
import { z } from "zod";
import { tenantIdForQuery } from "@/lib/auth";
import { deleteCategoryAs, saveCategoryAs } from "@/lib/products/category-service";
import type { AgentActor } from "../context";
import { type CategoryRow, type PlannedStep, type StoreCategoriesPlan, tenantCategories, tenantProducts } from "../store/store-categories";
import { ChangeSetApplyError, PutBackError, putBack, putBackFailed, staleChange } from "./errors";
import { until } from "./site-edits";

/**
 * Applies a drafted category change (`store.categories_patch`) step by step, with the Categories
 * page's own functions and the approver's access. What each step changed is kept, so undo
 * (`store.categories_restore`) puts it back in reverse order — also after a step failed half way.
 */

const CHANGED = "These categories or products changed after the assistant drafted this. Ask again.";
const ERRORS: Record<string, string> = {
	CATEGORY_NAME_DUPLICATE: "A category with that name is already at that level.",
	CATEGORY_SLUG_DUPLICATE: "Another category already uses that web address — pick another name.",
	CATEGORY_PARENT_ID_INVALID: "That parent category does not exist.",
	CATEGORY_HAS_PRODUCTS: "That category still has products: move them to another category first.",
	CATEGORY_REPARENT_NAME_CONFLICT: "Deleting it would put two categories with the same name on one level.",
	CATEGORY_LOCK_BUSY: "Categories are being changed right now. Try again in a moment.",
	CATEGORY_MAX_DEPTH_ERROR: "Categories go 3 levels deep at most.",
	CATEGORY_CYCLE_ERROR: "A category can't go inside its own sub-category.",
};
const explain = (code: string) => ERRORS[code] ?? Object.entries(ERRORS).find(([key]) => code.includes(key))?.[1] ?? "The category change was refused.";

const userOf = (actor: AgentActor) => actor.user as unknown as User;

/** The Categories page writes in the user's own tenant: it must be the workspace the change was drafted in. */
function assertTenant(actor: AgentActor) {
	if (String(tenantIdForQuery(actor.user) ?? "") !== String(actor.tenantId)) {
		throw new ChangeSetApplyError("Switch to the workspace this change was drafted in, then approve it again.", 409);
	}
}

/** One category write; the page's soft failures ({ success: false, error }) become apply errors. */
async function save(actor: AgentActor, data: Record<string, unknown>, id?: number): Promise<{ id: number }> {
	try {
		const result = (await saveCategoryAs(userOf(actor), data, id)) as { success?: boolean; error?: string; id?: unknown };
		if (result && result.success === false) throw new ChangeSetApplyError(explain(String(result.error)), 409);
		return { id: Number(result.id ?? id) };
	} catch (error) {
		if (error instanceof ChangeSetApplyError) throw error;
		throw new ChangeSetApplyError(explain(error instanceof Error ? error.message : String(error)), 422);
	}
}

async function remove(actor: AgentActor, id: number) {
	try {
		const result = (await deleteCategoryAs(userOf(actor), id)) as { success?: boolean; error?: string };
		if (result && result.success === false) throw new ChangeSetApplyError(explain(String(result.error)), 409);
	} catch (error) {
		if (error instanceof ChangeSetApplyError) throw error;
		throw new ChangeSetApplyError(explain(error instanceof Error ? error.message : String(error)), 422);
	}
}

async function setProductCategories(cms: Payload, actor: AgentActor, id: number, categories: number[]) {
	await cms.update({ collection: "products", id, data: { category: categories } as never, user: userOf(actor), overrideAccess: false });
}

const Undo = z.object({
	created: z.array(z.number().int()).default([]),
	updated: z.array(z.object({ id: z.number().int(), name: z.string(), parent: z.number().int().nullable(), description: z.string().nullable() })).default([]),
	deleted: z.array(z.object({ id: z.number().int(), children: z.array(z.number().int()) })).default([]),
	products: z.array(z.object({ id: z.number().int(), categories: z.array(z.number().int()) })).default([]),
});
type UndoRecord = z.infer<typeof Undo>;

const Plan = z.object({ steps: z.array(z.record(z.string(), z.unknown())).min(1).max(10), base: z.object({ categories: z.record(z.string(), z.string()), products: z.record(z.string(), z.string()) }) });

export async function applyStoreCategoriesPatch(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const plan = Plan.parse(raw) as unknown as StoreCategoriesPlan;
	assertTenant(actor);
	const cms = await getPayload({ config });
	const categories = new Map((await tenantCategories(cms, actor)).map((c) => [c.id, c]));
	const productIds = Object.keys(plan.base.products).map(Number);
	const products = new Map((await tenantProducts(cms, actor, productIds)).map((p) => [p.id, p]));
	// changed or gone since the draft: this card can never apply, it is closed with the reason
	for (const [id, at] of Object.entries(plan.base.categories)) if (categories.get(Number(id))?.updatedAt !== at) throw staleChange(CHANGED);
	for (const [id, at] of Object.entries(plan.base.products)) if (products.get(Number(id))?.updatedAt !== at) throw staleChange(CHANGED);

	const undo: UndoRecord = { created: [], updated: [], deleted: [], products: [] };
	const refs = new Map<string, number>();
	const target = (where: { id: number } | { ref: string }) => ("id" in where ? where.id : refs.get(where.ref));
	const moveProducts = async (category: number, ids: readonly number[]) => {
		for (const id of ids) {
			const product = products.get(id);
			if (!product) throw staleChange(CHANGED);
			if (!undo.products.some((p) => p.id === id)) undo.products.push({ id, categories: [...product.categories] });
			await setProductCategories(cms, actor, id, [category]);
			product.categories = [category];
		}
	};

	try {
		for (const step of plan.steps as PlannedStep[]) {
			if (step.op === "create") {
				const parent = step.parent === null ? null : target(step.parent);
				const { id } = await save(actor, { name: step.name, parent, ...(step.description ? { description: step.description } : {}) });
				undo.created.push(id);
				refs.set(step.ref, id);
				await moveProducts(id, step.productIds);
			} else if (step.op === "update") {
				const row = categories.get(step.categoryId) as CategoryRow | undefined;
				if (!row) throw staleChange(CHANGED);
				undo.updated.push({ id: row.id, name: row.name, parent: row.parent, description: row.description });
				await save(
					actor,
					{
						name: step.name ?? row.name,
						parent: step.parent === "keep" ? row.parent : step.parent === null ? null : step.parent.id,
						...(step.description !== null ? { description: step.description } : {}),
					},
					row.id,
				);
				// the page's save updates the moved category only: its sub-categories' paths follow here
				if (step.parent !== "keep") await rebuildBreadcrumbs(cms, actor.tenantId, row.id);
			} else if (step.op === "delete") {
				const children = [...categories.values()].filter((c) => c.parent === step.categoryId).map((c) => c.id);
				await remove(actor, step.categoryId);
				undo.deleted.push({ id: step.categoryId, children });
			} else {
				const id = target(step.category);
				if (id === undefined) throw new ChangeSetApplyError("A step names a category this change did not make.", 422);
				await moveProducts(id, step.productIds);
			}
		}
	} catch (error) {
		// put back what already ran: a half-applied change is never left behind — and when that fails too, the card
		// closes saying what is still in place
		try {
			await restore(cms, actor, undo);
		} catch (failure) {
			throw putBackFailed("Categories", error, describe(undo, categories), failure);
		}
		throw error;
	}
	return {
		entities: [...undo.created, ...undo.updated.map((u) => u.id)].map((id) => ({ kind: "store_category", id: String(id) })),
		links: [{ label: "Open categories", href: "/products/categories" }],
		undo: { kind: "store.categories_restore", payload: undo, until: until() },
	};
}

/** Rebuild the breadcrumbs of a category's whole subtree (a delete flattened them; undo puts the levels back). */
async function rebuildBreadcrumbs(cms: Payload, tenantId: string, rootId: number) {
	const db = cms.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } };
	await db.drizzle.execute(sql`WITH RECURSIVE up AS (
			SELECT c.id, c.parent_id, c.name::text AS path, 1 AS hops FROM categories c WHERE c.id = ${rootId} AND c.tenant_id = ${Number(tenantId)}
			UNION ALL
			SELECT up.id, p.parent_id, (p.name || ' > ' || up.path)::text, up.hops + 1 FROM up JOIN categories p ON p.id = up.parent_id WHERE up.hops < 5
		),
		root AS (SELECT path FROM up WHERE parent_id IS NULL ORDER BY hops DESC LIMIT 1),
		down AS (
			SELECT c.id, (SELECT path FROM root) AS path FROM categories c WHERE c.id = ${rootId}
			UNION ALL
			SELECT c.id, (down.path || ' > ' || c.name)::text FROM categories c JOIN down ON c.parent_id = down.id WHERE c.deleted_at IS NULL
		)
		UPDATE categories c SET breadcrumbs = down.path, updated_at = NOW() FROM down WHERE c.id = down.id AND c.tenant_id = ${Number(tenantId)}`);
}

/** What the change did, in the merchant's words (names as the categories were before it). */
function describe(record: UndoRecord, before: ReadonlyMap<number, CategoryRow>): string[] {
	const name = (id: number) => before.get(id)?.name ?? `category #${id}`;
	return [
		...record.created.map((id) => `created category #${id}`),
		...record.updated.map((u) => `changed ${u.name}`),
		...record.deleted.map((d) => `deleted ${name(d.id)}`),
		...(record.products.length > 0 ? [`moved ${record.products.length} product${record.products.length === 1 ? "" : "s"}`] : []),
	];
}

const sameCategories = (a: readonly number[], b: readonly number[]) => a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);

/**
 * Leaves out of `record` what is already as it was before the change (an undo whose record was lost, a second
 * tab, the merchant's own put-back): a created category that is gone, a changed one that reads as before, a deleted
 * one that is back with its sub-categories, a product in its old categories. A repeated undo then succeeds.
 */
async function stillToRestore(cms: Payload, actor: AgentActor, record: UndoRecord): Promise<UndoRecord> {
	const live = new Map((await tenantCategories(cms, actor)).map((c) => [c.id, c]));
	const products = new Map((await tenantProducts(cms, actor, record.products.map((p) => p.id))).map((p) => [p.id, p]));
	return {
		created: record.created.filter((id) => live.has(id)),
		updated: record.updated.filter((u) => {
			const now = live.get(u.id);
			return !now || now.name !== u.name || now.parent !== u.parent || (now.description ?? null) !== (u.description || null);
		}),
		deleted: record.deleted.filter((d) => !live.has(d.id) || d.children.some((child) => live.has(child) && live.get(child)!.parent !== d.id)),
		products: record.products.filter((p) => !products.has(p.id) || !sameCategories(products.get(p.id)!.categories, p.categories)),
	};
}

async function restore(cms: Payload, actor: AgentActor, record: UndoRecord) {
	// products first: a category made by the change can only go once it is empty again
	for (const product of [...record.products].reverse()) await putBack(`product #${product.id}`, () => setProductCategories(cms, actor, product.id, product.categories));
	for (const deleted of [...record.deleted].reverse()) {
		await putBack(`category #${deleted.id}`, async () => {
			const db = cms.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } };
			await db.drizzle.execute(sql`UPDATE categories SET deleted_at = NULL, updated_at = NOW() WHERE id = ${deleted.id} AND tenant_id = ${Number(actor.tenantId)}`);
			if (deleted.children.length > 0) {
				await db.drizzle.execute(sql`UPDATE categories SET parent_id = ${deleted.id}, updated_at = NOW() WHERE tenant_id = ${Number(actor.tenantId)} AND deleted_at IS NULL AND id IN (${sql.join(deleted.children.map((id) => sql`${id}`), sql`, `)})`);
			}
			await rebuildBreadcrumbs(cms, actor.tenantId, deleted.id);
		});
	}
	for (const updated of [...record.updated].reverse()) {
		await putBack(updated.name, async () => {
			await save(actor, { name: updated.name, parent: updated.parent, description: updated.description ?? "" }, updated.id);
			await rebuildBreadcrumbs(cms, actor.tenantId, updated.id);
		});
	}
	for (const id of [...record.created].reverse()) await putBack(`category #${id}`, () => remove(actor, id));
}

export async function applyStoreCategoriesRestore(raw: unknown, actor: AgentActor): Promise<ChangeSetResult> {
	const record = Undo.parse(raw);
	assertTenant(actor);
	const cms = await getPayload({ config });
	try {
		await restore(cms, actor, await stillToRestore(cms, actor, record));
	} catch (error) {
		if (error instanceof PutBackError) throw error.reason instanceof ChangeSetApplyError ? new ChangeSetApplyError(`${error.what}: ${error.reason.message}`, error.reason.status) : error.reason;
		throw error;
	}
	return { entities: [], links: [{ label: "Open categories", href: "/products/categories" }] };
}
