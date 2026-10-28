import "server-only";

import config from "@payload-config";
import { sql } from "drizzle-orm";
import { getPayload, type Payload } from "payload";
import { z } from "zod";
import type { AgentActor } from "../context";
import type { PreparedSiteChange } from "../site/site-prepare";

/**
 * The Product Store's categories for the copilot (the dashboard's Products → Categories): read the
 * tree with product counts, find store products by name, and draft a change of up to 10 steps —
 * create (with products put in it, under a category made in the same change), rename / describe,
 * move, delete, put products in a category. Nothing is written here: the applier
 * (appliers/store-categories.ts) runs the same rules as the Categories page, as the approver.
 */

export const MAX_LEVELS = 3;
export const MAX_CHANGES = 10;
const MAX_PRODUCTS_PER_STEP = 50;

export type CategoryRow = { id: number; name: string; parent: number | null; breadcrumbs: string; description: string | null; updatedAt: string };
export type ProductRow = { id: number; name: string; status: string | null; categories: number[]; updatedAt: string };

const relId = (value: unknown): number | null => {
	const raw = value && typeof value === "object" ? (value as { id?: unknown }).id : value;
	const id = typeof raw === "string" ? Number(raw) : raw;
	return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
};

function userOf(actor: AgentActor) {
	return actor.user as unknown as Parameters<Payload["find"]>[0]["user"];
}

/** The tenant's live categories, as its user may see them. */
export async function tenantCategories(cms: Payload, actor: AgentActor): Promise<CategoryRow[]> {
	const result = await cms.find({
		collection: "categories",
		where: { and: [{ tenant: { equals: actor.tenantId } }, { deletedAt: { exists: false } }] },
		depth: 0,
		limit: 1000,
		sort: "name",
		overrideAccess: false,
		user: userOf(actor),
	} as Parameters<Payload["find"]>[0]);
	return (result.docs as unknown as Array<Record<string, unknown>>).map((doc) => ({
		id: Number(doc.id),
		name: String(doc.name ?? ""),
		parent: relId(doc.parent),
		breadcrumbs: String(doc.breadcrumbs ?? doc.name ?? ""),
		description: typeof doc.description === "string" && doc.description ? doc.description : null,
		updatedAt: String(doc.updatedAt ?? ""),
	}));
}

/** Products of the tenant by id (the ones the change names), as its user may see them. */
export async function tenantProducts(cms: Payload, actor: AgentActor, ids: readonly number[]): Promise<ProductRow[]> {
	if (ids.length === 0) return [];
	const result = await cms.find({
		collection: "products",
		where: { and: [{ tenant: { equals: actor.tenantId } }, { id: { in: [...ids] } }] },
		depth: 0,
		limit: ids.length,
		overrideAccess: false,
		user: userOf(actor),
	} as Parameters<Payload["find"]>[0]);
	return (result.docs as unknown as Array<Record<string, unknown>>)
		.filter((doc) => !doc.deletedAt)
		.map(productRow);
}

const productRow = (doc: Record<string, unknown>): ProductRow => ({
	id: Number(doc.id),
	name: String(doc.name ?? doc.id),
	status: typeof doc.status === "string" ? doc.status : null,
	categories: (Array.isArray(doc.category) ? doc.category : doc.category ? [doc.category] : []).map(relId).filter((id): id is number => id !== null),
	updatedAt: String(doc.updatedAt ?? ""),
});

/** Level of a category (1 = top), and how many levels sit below it. */
export function treeFacts(categories: readonly CategoryRow[]) {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const level = (id: number): number => {
		let depth = 0;
		let node = byId.get(id);
		const seen = new Set<number>();
		while (node && !seen.has(node.id)) {
			seen.add(node.id);
			depth += 1;
			node = node.parent ? byId.get(node.parent) : undefined;
		}
		return depth;
	};
	const children = (id: number | null) => categories.filter((c) => c.parent === id);
	const below = (id: number): number => {
		const kids = children(id);
		return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => below(k.id)));
	};
	const inSubtree = (root: number, id: number): boolean => {
		let node = byId.get(id);
		const seen = new Set<number>();
		while (node && !seen.has(node.id)) {
			if (node.id === root) return true;
			seen.add(node.id);
			node = node.parent ? byId.get(node.parent) : undefined;
		}
		return false;
	};
	return { byId, level, children, below, inSubtree };
}

/** Products directly in each category (not counting sub-categories). */
async function productCounts(cms: Payload, tenantId: string): Promise<Map<number, number>> {
	const db = cms.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Array<{ id: unknown; count: unknown }> }> } };
	const result = await db.drizzle.execute(sql`
		SELECT r.categories_id AS id, COUNT(DISTINCT p.id)::int AS count
		FROM products_rels r
		JOIN products p ON p.id = r.parent_id AND p.deleted_at IS NULL
		WHERE r.path = 'category' AND p.tenant_id = ${Number(tenantId)}
		GROUP BY r.categories_id`);
	return new Map(result.rows.map((row) => [Number(row.id), Number(row.count)]));
}

export const StoreCategoriesReadSchema = z.object({
	/** words of store product names: those products with their category */
	query: z.string().trim().max(80).nullish(),
});

export async function readStoreCategories(actor: AgentActor, raw: unknown) {
	const input = StoreCategoriesReadSchema.parse(raw ?? {});
	const cms = await getPayload({ config });
	const [categories, counts] = await Promise.all([tenantCategories(cms, actor), productCounts(cms, actor.tenantId)]);
	const tree = treeFacts(categories);
	let products: ProductRow[] = [];
	if (input.query) {
		const found = await cms.find({
			collection: "products",
			where: { and: [{ tenant: { equals: actor.tenantId } }, { name: { like: input.query } }] },
			depth: 0,
			limit: 20,
			sort: "-updatedAt",
			overrideAccess: false,
			user: userOf(actor),
		} as Parameters<Payload["find"]>[0]);
		products = (found.docs as unknown as Array<Record<string, unknown>>).filter((doc) => !doc.deletedAt).map(productRow);
	}
	const path = (id: number) => tree.byId.get(id)?.breadcrumbs ?? String(id);
	return {
		note: `Product Store categories, up to ${MAX_LEVELS} levels (path = where it sits). products = products directly in it. Change them with propose_store_categories.`,
		categories: categories.map((c) => ({
			id: String(c.id),
			name: c.name,
			path: c.breadcrumbs,
			level: tree.level(c.id),
			parentId: c.parent ? String(c.parent) : null,
			products: counts.get(c.id) ?? 0,
			...(c.description ? { description: c.description.slice(0, 160) } : {}),
		})),
		...(input.query
			? { products: products.map((p) => ({ id: String(p.id), name: p.name, status: p.status, category: p.categories.length > 0 ? p.categories.map(path).join(", ") : null })) }
			: {}),
	};
}

// ─── Draft ───────────────────────────────────────────────────────────────────

const Id = z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(z.string().regex(/^[1-9]\d{0,9}$/, "a category or product id (digits)"));
const Name = z.string().trim().min(1).max(80);
const Ref = z.string().trim().min(1).max(20);

export const StoreCategoryStepSchema = z.discriminatedUnion("op", [
	z.object({
		op: z.literal("create"),
		/** a name for this new category inside the change: a later step can put a category or products in it */
		ref: Ref,
		name: Name,
		parentId: Id.nullish(),
		parentRef: Ref.nullish(),
		description: z.string().trim().max(500).nullish(),
		productIds: z.array(Id).max(MAX_PRODUCTS_PER_STEP).nullish(),
	}),
	z.object({
		op: z.literal("update"),
		categoryId: Id,
		name: Name.nullish(),
		description: z.string().trim().max(500).nullish(),
		/** move under this category; moveToTop = make it a top category */
		parentId: Id.nullish(),
		moveToTop: z.boolean().nullish(),
	}),
	z.object({ op: z.literal("delete"), categoryId: Id }),
	z.object({
		op: z.literal("assign"),
		categoryId: Id.nullish(),
		categoryRef: Ref.nullish(),
		productIds: z.array(Id).min(1).max(MAX_PRODUCTS_PER_STEP),
	}),
]);
export type StoreCategoryStep = z.infer<typeof StoreCategoryStepSchema>;

export const StoreCategoriesChangeSchema = z.object({
	why: z.string().trim().min(1).max(300),
	changes: z.array(StoreCategoryStepSchema).min(1).max(MAX_CHANGES),
});

/** What the applier runs: ids resolved, refs kept for categories the change makes. */
export type PlannedStep =
	| { op: "create"; ref: string; name: string; parent: { id: number } | { ref: string } | null; description: string | null; productIds: number[] }
	| { op: "update"; categoryId: number; name: string | null; description: string | null; parent: { id: number } | null | "keep" }
	| { op: "delete"; categoryId: number }
	| { op: "assign"; category: { id: number } | { ref: string }; productIds: number[] };

export type StoreCategoriesPlan = {
	steps: PlannedStep[];
	/** updatedAt of every category and product the change touches: anything edited since is not overwritten */
	base: { categories: Record<string, string>; products: Record<string, string> };
};

type Refusal = { error: { code: string; message: string } };
const refuse = (code: string, message: string): Refusal => ({ error: { code, message } });
const same = (a: string, b: string) => a.normalize("NFC").trim().toLowerCase() === b.normalize("NFC").trim().toLowerCase();

export async function prepareStoreCategories(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | Refusal> {
	const input = StoreCategoriesChangeSchema.parse(raw);
	const cms = await getPayload({ config });
	const categories = await tenantCategories(cms, actor);
	const counts = await productCounts(cms, actor.tenantId);
	const productIds = [...new Set(input.changes.flatMap((s) => (s.op === "create" ? (s.productIds ?? []) : s.op === "assign" ? s.productIds : [])).map(Number))];
	const products = new Map((await tenantProducts(cms, actor, productIds)).map((p) => [p.id, p]));
	const original = new Map([...products.values()].map((p) => [p.id, [...p.categories]]));
	const missingProduct = productIds.find((id) => !products.has(id));
	if (missingProduct) return refuse("unknown_product", `Product ${missingProduct} is not in this store (read store_categories with a query for product ids).`);

	// the tree as it will be, step by step: new categories get negative ids
	const tree: CategoryRow[] = categories.map((c) => ({ ...c }));
	const refs = new Map<string, number>();
	let nextNew = -1;
	const facts = () => treeFacts(tree);
	const label = (id: number) => (id < 0 ? `${tree.find((c) => c.id === id)?.name ?? "new category"} (new)` : (tree.find((c) => c.id === id)?.name ?? String(id)));
	const pathOf = (id: number | null): string => {
		if (id === null) return "Top level";
		const names: string[] = [];
		let node = tree.find((c) => c.id === id);
		while (node && names.length < 5) {
			names.unshift(node.name);
			node = node.parent === null ? undefined : tree.find((c) => c.id === node!.parent);
		}
		return names.join(" > ");
	};
	const siblingsNamed = (parent: number | null, name: string, except?: number) => tree.some((c) => c.parent === parent && c.id !== except && same(c.name, name));

	const steps: PlannedStep[] = [];
	const diffs: PreparedSiteChange["diffs"] = [];
	const touched = new Set<number>();
	const touchedProducts = new Set<number>();
	const deleted: string[] = [];
	const entity = (id: number) => ({ kind: "store_category", id: id < 0 ? `new:${id}` : String(id), label: pathOf(id) });

	const assign = (target: number, ids: readonly number[]) => {
		for (const id of ids) {
			const product = products.get(id)!;
			const before = product.categories.length > 0 ? product.categories.map(label).join(", ") : null;
			if (product.categories.length === 1 && product.categories[0] === target) continue;
			diffs.push({ entity: { kind: "product", id: String(id), label: product.name }, field: "category", before, after: pathOf(target) });
			product.categories = [target];
			touchedProducts.add(id);
		}
	};

	for (const step of input.changes) {
		if (step.op === "create") {
			if (refs.has(step.ref)) return refuse("invalid_input", `Two new categories are called "${step.ref}" in this change: give each its own ref.`);
			let parent: number | null = null;
			if (step.parentRef) {
				const id = refs.get(step.parentRef);
				if (id === undefined) return refuse("invalid_input", `No earlier step makes "${step.parentRef}".`);
				parent = id;
			} else if (step.parentId) {
				parent = Number(step.parentId);
				if (!tree.some((c) => c.id === parent)) return refuse("unknown_category", `Category ${step.parentId} is not in this store.`);
			}
			if (parent !== null && facts().level(parent) >= MAX_LEVELS) return refuse("too_deep", `"${pathOf(parent)}" is at level ${MAX_LEVELS}: categories go ${MAX_LEVELS} levels deep at most.`);
			if (siblingsNamed(parent, step.name)) return refuse("name_taken", `"${pathOf(parent)}" already has a category called "${step.name}".`);
			const id = nextNew--;
			refs.set(step.ref, id);
			tree.push({ id, name: step.name, parent, breadcrumbs: "", description: step.description ?? null, updatedAt: "" });
			diffs.push({ entity: entity(id), field: "new category", before: null, after: pathOf(id) });
			if (step.description) diffs.push({ entity: entity(id), field: "description", before: null, after: step.description });
			const ids = (step.productIds ?? []).map(Number);
			assign(id, ids);
			steps.push({ op: "create", ref: step.ref, name: step.name, parent: parent === null ? null : parent < 0 ? { ref: [...refs].find(([, v]) => v === parent)![0] } : { id: parent }, description: step.description ?? null, productIds: ids });
		} else if (step.op === "update") {
			const id = Number(step.categoryId);
			const row = tree.find((c) => c.id === id);
			if (!row || id < 0) return refuse("unknown_category", `Category ${step.categoryId} is not in this store.`);
			let parent: { id: number } | null | "keep" = "keep";
			const beforePath = pathOf(id);
			if (step.moveToTop) parent = null;
			else if (step.parentId) parent = { id: Number(step.parentId) };
			const newParent = parent === "keep" ? row.parent : parent === null ? null : parent.id;
			if (parent !== "keep") {
				if (newParent !== null && !tree.some((c) => c.id === newParent && c.id > 0)) return refuse("unknown_category", `Category ${step.parentId} is not in this store.`);
				if (newParent !== null && facts().inSubtree(id, newParent)) return refuse("invalid_move", `"${row.name}" can't go inside itself or one of its own sub-categories.`);
				const depth = (newParent === null ? 0 : facts().level(newParent)) + 1 + facts().below(id);
				if (depth > MAX_LEVELS) return refuse("too_deep", `Moving "${row.name}" there makes it ${depth} levels deep with its sub-categories; categories go ${MAX_LEVELS} levels deep at most.`);
			}
			const name = step.name ?? row.name;
			if ((step.name || parent !== "keep") && siblingsNamed(newParent, name, id)) return refuse("name_taken", `"${pathOf(newParent)}" already has a category called "${name}".`);
			const description = step.description === undefined || step.description === null ? null : step.description;
			if (!step.name && parent === "keep" && description === null) return refuse("no_change", "Say what changes: name, description or where it goes.");
			if (step.name && step.name !== row.name) diffs.push({ entity: entity(id), field: "name", before: row.name, after: step.name });
			if (description !== null && description !== (row.description ?? "")) diffs.push({ entity: entity(id), field: "description", before: row.description, after: description || "(empty)" });
			row.name = name;
			row.parent = newParent;
			if (parent !== "keep") diffs.push({ entity: entity(id), field: "place", before: beforePath, after: pathOf(id) });
			if (description !== null) row.description = description;
			touched.add(id);
			steps.push({ op: "update", categoryId: id, name: step.name ?? null, description, parent });
		} else if (step.op === "delete") {
			const id = Number(step.categoryId);
			const row = tree.find((c) => c.id === id);
			if (!row || id < 0) return refuse("unknown_category", `Category ${step.categoryId} is not in this store.`);
			// what is in it now, less what this change moves out, plus what it moves in
			const movedOut = [...products.values()].filter((p) => original.get(p.id)?.includes(id) && !p.categories.includes(id)).length;
			const movedIn = [...products.values()].filter((p) => !original.get(p.id)?.includes(id) && p.categories.includes(id)).length;
			const left = (counts.get(id) ?? 0) - movedOut + movedIn;
			if (left > 0) return refuse("has_products", `"${row.name}" still has ${left} product${left === 1 ? "" : "s"}: put them in another category first (assign), then delete it.`);
			const kids = tree.filter((c) => c.parent === id);
			diffs.push({ entity: entity(id), field: "deleted", before: pathOf(id), after: kids.length > 0 ? `Deleted — ${kids.map((k) => k.name).join(", ")} move up a level` : "Deleted" });
			for (const kid of kids) kid.parent = row.parent;
			tree.splice(tree.indexOf(row), 1);
			touched.add(id);
			deleted.push(row.name);
			steps.push({ op: "delete", categoryId: id });
		} else {
			const id = step.categoryRef ? refs.get(step.categoryRef) : step.categoryId ? Number(step.categoryId) : undefined;
			if (id === undefined || !tree.some((c) => c.id === id)) return refuse("unknown_category", "Say which category: categoryId of the store, or categoryRef of a category this change makes.");
			const ids = step.productIds.map(Number);
			assign(id, ids);
			steps.push({ op: "assign", category: id < 0 ? { ref: step.categoryRef! } : { id }, productIds: ids });
		}
	}
	if (diffs.length === 0) return refuse("no_change", "Nothing would change: the products are already there and the categories are as asked.");

	const base: StoreCategoriesPlan["base"] = {
		categories: Object.fromEntries(categories.filter((c) => touched.has(c.id) || steps.some((s) => (s.op === "create" && s.parent && "id" in s.parent && s.parent.id === c.id) || (s.op === "assign" && "id" in s.category && s.category.id === c.id))).map((c) => [String(c.id), c.updatedAt])),
		products: Object.fromEntries([...touchedProducts].map((id) => [String(id), products.get(id)!.updatedAt])),
	};
	const created = steps.filter((s) => s.op === "create").length;
	const moved = touchedProducts.size;
	const title =
		deleted.length > 0 && steps.length === 1
			? `Delete category: ${deleted[0]}`
			: created > 0 && moved > 0
				? `New categor${created === 1 ? "y" : "ies"} with ${moved} product${moved === 1 ? "" : "s"}`
				: created > 0
					? `New categor${created === 1 ? "y" : "ies"}`
					: moved > 0 && touched.size === 0
						? `Move ${moved} product${moved === 1 ? "" : "s"} to a category`
						: "Change categories";
	const guardrails: PreparedSiteChange["guardrails"] = [
		{ rule: "same_rules", ok: true, detail: `Same rules as Products → Categories: ${MAX_LEVELS} levels at most, one name per level.` },
		{ rule: "undo", ok: true, detail: "You can undo it for 7 days while nobody edits these categories or products." },
	];
	if (moved > 0) guardrails.push({ rule: "live", ok: true, detail: "Products change category in the store at once; the store's category pages follow." });
	return {
		kind: "store.categories_patch",
		title,
		why: input.why,
		risk: deleted.length > 0 ? "high" : moved > 0 ? "medium" : "low",
		diffs,
		guardrails,
		// deleting a category: the card asks Yes / No (the names are echoed back as the confirm)
		...(deleted.length > 0 ? { confirmText: deleted.join(", ").slice(0, 200) } : {}),
		plan: { steps, base } satisfies StoreCategoriesPlan,
	};
}
