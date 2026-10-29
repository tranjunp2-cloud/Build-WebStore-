import "server-only";

import { randomUUID } from "node:crypto";
import config from "@payload-config";
import { getPayload, type User } from "payload";
import { z } from "zod";
import { blockRegistry } from "@/blocks/registry";
import { aiVisibleBlockMetas } from "@/lib/ai/summarize";
import { sanitizeTheme } from "@/lib/theme/sanitize-theme";
import type { AgentActor } from "../context";
import { isMediaRefAllowed, mediaRefId } from "../media-access";
import { blockHash, blockIdOf, blockName, carryMedia, editableKeys, fieldSchema, forValidation, isEmbeddableVideo, isLockedKey, isMediaKey, isStableBlockId, keysOf, linkHosts, type PageBlock, PRODUCT_ID_FIELDS, previewValue, rowLabel, rowSchemaOf, schemaAt, STRUCTURAL_BLOCKS, unsafeLinks } from "./site-blocks";
import { PagePatchError, type PagePatchOp, PagePatchOpSchema, type PagePatchPlan, fingerprints, pathSegments, runPagePatch, setAtPath, valueAtPath } from "./site-patch";
import { brandOf, languageName, type LocaleContent, localeTextProblem, readLocaleContent, shownFingerprints, shownLayout, slotLocaleOf, splitLocaleOps } from "./site-locale-view";
import { type CopyNote, copyGuardrails, copyNotes, copyRefusal } from "./site-copy-check";
import { missingRequired, storedKeys } from "./site-persisted";
import { sanitizeSingleBlockRequiredFields } from "@/lib/ai/normalize-required-titles";
import { describeProductChoice, productChoice } from "./site-products";
import { draftPage, layoutOf, SiteToolError, siteForActor } from "./site-read";
import { type SectionContextLoader, sectionContextLoader, STARTER_TYPES, withSectionDefaults } from "./site-section-defaults";

/**
 * Drafts (never writes) a web builder change from a fresh read of the page
 * draft or the site theme: every op checked against the block registry and
 * the merchant's own data, then shaped as before → after for the review card.
 * Whatever can't be applied comes back as a skipped note or an error the
 * model can fix; nothing reaches the page until the merchant approves.
 */

const Id = z.union([z.string().min(1).max(40), z.number().int().positive()]).transform(String);

export const PagePatchInputSchema = z.object({
	siteId: Id,
	pageId: Id,
	why: z.string().min(1).max(300),
	ops: z.array(PagePatchOpSchema).min(1).max(30),
	/** the merchant's own words: generic-sounding copy is kept (with a note on the card) instead of refused */
	keepWording: z.boolean().optional(),
	/** the language on the editor canvas (set by the platform from the pin, never by the model) */
	language: z.string().max(12).optional(),
});

export const ThemeChangeInputSchema = z.object({
	siteId: Id,
	why: z.string().min(1).max(300),
	changes: z.record(z.string(), z.unknown()),
});

/** `path`: where the change is in the section (dot path), so "Show" goes to that field — `field` is the card's words. */
type Diff = { entity: { kind: string; id: string; label?: string }; field: string; path?: string; before: string | null; after: string };
type Guardrail = { rule: string; ok: boolean; detail: string };

export interface PreparedSiteChange {
	kind: "site.page_patch" | "site.theme_patch" | "site.seo_patch" | "site.translate_page" | "site.pages_patch" | "site.page_create" | "site.nav_patch" | "site.languages_patch" | "site.publish" | "store.categories_patch" | "store.discounts_patch" | "store.orders_patch" | "store.customers_patch";
	title: string;
	why: string;
	risk: "low" | "medium" | "high";
	diffs: Diff[];
	guardrails: Guardrail[];
	confirmText?: string;
	/** money / buyer-email / irreversible: the copilot UI's Auto-approve never applies it, the merchant clicks Approve */
	requiresClick?: boolean;
	plan: Record<string, unknown>;
}

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_SECTIONS_TOUCHED = 20;

function firstIssue(error: string | undefined): string {
	try {
		const issues = JSON.parse(error ?? "[]") as Array<{ path?: unknown[]; message?: string }>;
		const issue = issues[0];
		if (issue) return `${(issue.path ?? []).join(".") || "value"}: ${issue.message ?? "invalid"}`;
	} catch {
		// not a zod issue list
	}
	return (error ?? "invalid").slice(0, 200);
}

const PICTURE_REFUSED = "Use an image id from find_images, generate_image or the merchant's attachments.";

/**
 * Pictures the copilot may place: the merchant's chat attachments, stock photos, and `media:<id>` rows of this
 * workspace's library (its own uploads, or legacy files its pages/products/blogs already use: media-access.ts).
 */
async function usablePictureRefs(tenantId: string, refs: readonly string[]): Promise<boolean> {
	const media = [...new Set(refs.filter((ref) => !/^(attachment|pixabay):/.test(ref)))];
	if (media.some((ref) => mediaRefId(ref) === null)) return false;
	if (media.length === 0) return true;
	const cms = await getPayload({ config });
	return (await Promise.all(media.map((ref) => isMediaRefAllowed(cms, tenantId, ref)))).every(Boolean);
}

/** `shows`: what each product section will put on the live site (Shows N of M…), one entry per section whose products were chosen. */
type OpCheck = { ops: PagePatchOp[]; skipped: string[]; shows?: ProductShows[] } | { error: { code: string; message: string } };
type ProductShows = { ok: boolean; detail: string };

/** Sections that list the store's products: one of each per page (a second is a copy of the first). */
/**
 * What a Products Grid lists: its category, its mode and (hand-picked) the set of products.
 * Two grids with the same key show the same products. Same rule as the pending-card check in the ai-platform service.
 */
export function productsGridKey(grid: Record<string, unknown>): string {
	const ids = Array.isArray(grid.selectedProductIds) ? grid.selectedProductIds.map(String) : [];
	// a stored grid without a mode renders as "all"; a new one with products is made "fixed" before this runs
	const mode = typeof grid.selectionMode === "string" ? grid.selectionMode : "all";
	const category = typeof grid.category === "string" ? grid.category : "";
	return `${category}|${mode}|${mode === "fixed" ? [...new Set(ids)].sort().join(",") : ""}`;
}

const FEATURED_NEWEST = 'Featured Products always shows the store\'s newest products; it can\'t be given chosen ones. For specific products use a Products Grid: selectionMode "fixed" with selectedProductIds (ids from site_read view "products") and a limit of at least that many (up to 20).';

/**
 * A products grid shows picked products only in "fixed" mode, and one category by its id: picking products
 * switches the mode (the card shows it), and a category must be one of the store's (site_read view "categories").
 */
async function productsGridChoice(actor: AgentActor, block: PageBlock | null, fields: Record<string, unknown>, mode: "prepare" | "apply") {
	const picked = Array.isArray(fields.selectedProductIds) && fields.selectedProductIds.length > 0;
	// drafting only (the card shows it as a change): on apply the stored plan already says so
	if (mode === "prepare" && picked && (fields.selectionMode ?? block?.selectionMode) !== "fixed") fields.selectionMode = "fixed";
	// the grid lists at most `limit` products (6 unless set): a fixed choice of N needs room for all N
	if (mode === "prepare" && picked) {
		const wanted = (fields.selectedProductIds as unknown[]).length;
		const limit = Number(fields.limit ?? block?.limit ?? 6);
		if (wanted > 20) return { error: { code: "too_many_products", message: "A products grid shows at most 20 products. Choose up to 20, or use several grids." } };
		if (limit < wanted) fields.limit = wanted;
	}
	const category = fields.category;
	if (typeof category !== "string" || category === "" || /^pcat_[a-z0-9]{8,40}$/.test(category)) return null;
	const cms = await getPayload({ config });
	const found = await cms.find({ collection: "categories", where: { id: { equals: category } }, depth: 0, limit: 1, overrideAccess: false, user: actor.user as unknown as User, select: { name: true } } as Parameters<typeof cms.find>[0]).catch(() => ({ docs: [] }));
	return found.docs.length > 0 ? null : { error: { code: "unknown_category", message: `"${category.slice(0, 40)}" is not a category of this store. Use an id from site_read view "categories".` } };
}

const VIDEO_ONLY = "A video must be a YouTube or Vimeo link, or an https .mp4 / .webm file.";
const UNSTABLE_ID = "This section has no saved id yet. Save the page in the editor once, then ask again.";
const FRAME = "The navigation and footer are shared by every page: change them in the editor's header and footer settings.";

/** What a picture list accepts (a gallery's rows): checked against the field's own schema. */
const PICTURE_LIST_PROBE = [{ image: { url: "https://example.com/a.jpg" }, caption: "" }];

/** Sections whose empty picture list shows sample pictures (the card's "before"). */
const SAMPLE_LISTS = new Set(["gallery", "products-featured"]);

/** Fields holding exactly one picture (a media id) — the only ones `set_image` writes. */
const SINGLE_PICTURE_KEYS = new Set(["image", "backgroundImage", "avatar", "logo", "photo", "thumbnail", "poster", "beforeImage", "afterImage"]);
const UNSAFE_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/** The value at a path through own properties only (never the prototype chain). */
function ownValueAtPath(value: unknown, segments: Array<string | number>): unknown {
	let node: unknown = value;
	for (const segment of segments) {
		if (node === null || typeof node !== "object" || !Object.hasOwn(node, segment)) return undefined;
		node = (node as Record<string | number, unknown>)[segment];
	}
	return node;
}

/**
 * Every op checked against the page as it is now and against the merchant's
 * own store. Prepare runs it on the model's ops; apply runs it again on the
 * stored plan (it came back from the AI platform) and refuses anything this
 * would change. Pictures are kept as they are, links must be safe, every
 * edited field must pass its schema on its own.
 */
export async function checkPagePatchOps(
	actor: AgentActor,
	tenantId: string,
	before: PageBlock[],
	inputOps: PagePatchOp[],
	mode: "prepare" | "apply",
	/** drafting only: lets a new section the model left incomplete take the template's copy for what is missing */
	sectionContext?: SectionContextLoader,
	/** the site the sections are on: the products they list must be on sale there (omitted = the workspace's) */
	siteId?: string | number,
): Promise<OpCheck> {
	const byId = new Map(before.map((block, index) => [blockIdOf(block, index), block]));
	const skipped: string[] = [];
	const ops: PagePatchOp[] = [];
	type Lookup = { block: PageBlock } | { error: { code: string; message: string } };
	const existing = (id: string): Lookup => {
		const block = byId.get(id);
		if (!block) return { error: { code: "unknown_section", message: `No section ${id} on this page. Read the page again (site_read view "page").` } };
		if (!isStableBlockId(id)) return { error: { code: "unsaved_section", message: UNSTABLE_ID } };
		return { block };
	};
	const anchor = (id: string | null): Lookup | null => (id === null ? null : existing(id));

	// product ids the edit would show — checked once, against the site's own store
	const wantedIds = inputOps.flatMap((op) =>
		op.op === "set_fields" || op.op === "insert_block"
			? Object.entries(op.op === "set_fields" ? op.fields : op.block).flatMap(([key, value]) => (PRODUCT_ID_FIELDS.has(key) ? (Array.isArray(value) ? value : [value]).map(String) : []))
			: [],
	);
	const choice = await productChoice(actor, tenantId, siteId, [...new Set(wantedIds)].slice(0, 100));
	const known = choice.known;
	const shows: ProductShows[] = [];

	/** The values an edit may write: allowed keys, pictures carried over, safe links, store products, valid per field. */
	const cleanFields = (type: string, name: string, raw: Record<string, unknown>, current: PageBlock | null): Record<string, unknown> | { error: { code: string; message: string } } => {
		const allowed = editableKeys(type);
		const fields: Record<string, unknown> = {};
		for (const [key, rawValue] of Object.entries(raw)) {
			if (key === "blockType" || key === "variant" || key === "id") continue;
			// Featured Products always shows the store's newest products: chosen products live in a Products Grid
			if (type === "products-featured" && (key === "productIds" || key === "selectedProductIds")) {
				return { error: { code: "use_products_grid", message: FEATURED_NEWEST } };
			}
			// On apply the plan's sections carry what the registry filled in when drafting (isVisible, default
			// pictures…): those are dropped quietly and filled in again; the comparison with the plan catches the rest.
			if (!allowed.has(key)) {
				if (mode === "prepare") skipped.push(`${name} has no field "${key}" an edit can set.`);
				continue;
			}
			if (isMediaKey(key)) {
				if (mode === "prepare") skipped.push(`${name}: pictures are changed with a picture edit, not text (left ${key} as it is).`);
				continue;
			}
			let value = carryMedia(rawValue, current?.[key]);
			if (key === "videoUrl" && !isEmbeddableVideo(value)) return { error: { code: "bad_video", message: VIDEO_ONLY } };
			const bad = unsafeLinks(value, key);
			if (bad.length > 0) {
				skipped.push(`Left out ${key}: unsafe link ${bad[0]} (use a page path like /contact or an https:// address).`);
				continue;
			}
			if (PRODUCT_ID_FIELDS.has(key)) {
				if (!Array.isArray(value)) return { error: { code: "invalid_section", message: `${key} takes a list of product ids from site_read view "products".` } };
				const ids = value.map(String);
				// a product left out silently showed fewer (or the newest) products: say so instead
				const notInStore = ids.filter((id) => !known.has(id));
				if (notInStore.length > 0) {
					return { error: { code: "unknown_products", message: `Not products of this store: ${notInStore.slice(0, 5).join(", ")}. Use ids from site_read view "products".` } };
				}
				value = ids;
				// drafting only: on apply the card already said it, and a product put off sale since is not a reason to refuse
				if (mode === "prepare" && ids.length > 0) shows.push(describeProductChoice(name, ids, choice, (raw.includeOutOfStock ?? current?.includeOutOfStock) !== false));
			}
			// pictures are carried over as stored (media ids), not re-checked
			const schema = isMediaKey(key) ? null : fieldSchema(type, key);
			if (schema && !schema.safeParse(forValidation(value)).success) {
				// a phone number or code the model sent as a JSON number
				if (typeof value === "number" && schema.safeParse(String(value)).success) value = String(value);
				else return { error: { code: "invalid_section", message: `That value doesn't fit ${name} → ${key} (${firstIssue(schema.safeParse(forValidation(value)).error?.message)}). Send the complete list for list fields.` } };
			}
			fields[key] = value;
		}
		return fields;
	};

	// top-level keys each section's ops write (text and pictures of one field go in separate changes)
	const written = new Map<string, Set<string>>();
	const touchedKeys = (blockId: string) => written.get(blockId) ?? written.set(blockId, new Set()).get(blockId)!;
	// keys only set_value ops wrote: several single values of one list may change together (paths "blockId path")
	const valueKeys = new Set<string>();
	const valuePaths = new Set<string>();
	const insertedProductSections = new Set<string>();
	const insertedGridKeys = new Set<string>();
	const pathError = (block: PageBlock, path: string, what: string) => ({ error: { code: "bad_path", message: `${blockName(block)} has no ${what} at "${path}". Use a path from site_read view "block" (e.g. features.2.title, ctaButtons.0.url).` } });
	for (const op of inputOps) {
		if (op.op === "insert_block") {
			const type = String(op.block.blockType ?? "");
			const meta = aiVisibleBlockMetas().find((m) => m.type === type);
			if (!meta) return { error: { code: "unknown_block_type", message: `"${type}" is not a section type you can add. See site_read view "catalog".` } };
			if (STRUCTURAL_BLOCKS.has(type)) return { error: { code: "structural", message: FRAME } };
			// a second Featured Products section on a page repeats the first: change that one instead
			if (mode === "prepare" && type === "products-featured") {
				// a section this same edit removes does not count (a swap)
				const removed = new Set(inputOps.flatMap((o) => (o.op === "remove_block" ? [o.blockId] : [])));
				const sameAt = before.findIndex((block, i) => block.blockType === type && !removed.has(blockIdOf(block, i)));
				const same = sameAt >= 0 ? before[sameAt] : undefined;
				if (same || insertedProductSections.has(type)) {
					const where = same ? ` (id ${blockIdOf(same, sameAt)})` : " (added earlier in this edit)";
					return { error: { code: "section_exists", message: `This page already has a ${meta.name} section${where}. Change that one (set_fields) instead of adding another.` } };
				}
				insertedProductSections.add(type);
			}
			const at = anchor(op.afterBlockId);
			if (at && "error" in at) return at;
			const fields = cleanFields(type, meta.name, op.block, null);
			if ("error" in fields) return fields as { error: { code: string; message: string } };
			if (type === "products-grid") {
				const problem = await productsGridChoice(actor, null, fields, mode);
				if (problem) return problem;
				// another grid is fine when it lists something else (a category, a hand-picked set); the same list twice is not
				if (mode === "prepare") {
					const key = productsGridKey(fields);
					const removed = new Set(inputOps.flatMap((o) => (o.op === "remove_block" ? [o.blockId] : [])));
					const sameAt = before.findIndex((block, i) => block.blockType === type && !removed.has(blockIdOf(block, i)) && productsGridKey(block) === key);
					if (sameAt >= 0 || insertedGridKeys.has(key)) {
						const where = sameAt >= 0 ? ` (id ${blockIdOf(before[sameAt], sameAt)})` : " (added earlier in this edit)";
						return { error: { code: "section_exists", message: `This page already has a Products Grid listing the same products${where}. Change that one (set_fields), or give the new grid a different category or products.` } };
					}
					insertedGridKeys.add(key);
				}
			}
			const variant = typeof op.block.variant === "string" && meta.variants.includes(op.block.variant) ? op.block.variant : meta.defaultVariant;
			let checked = blockRegistry.validate(type, { ...fields, blockType: type, variant });
			if (mode === "prepare" && sectionContext && STARTER_TYPES.has(type)) {
				// starter wording (site language) for what the model left empty, links pointed at the site's real pages
				const context = await sectionContext().catch((error: unknown) => {
					console.error("[site-prepare] section defaults not available", error);
					return null;
				});
				const starter = context ? withSectionDefaults(type, fields, context, !checked.success) : null;
				if (starter && starter.added.length > 0) {
					const filled = blockRegistry.validate(type, { ...starter.fields, blockType: type, variant });
					if (filled.success) {
						Object.assign(fields, starter.fields);
						checked = filled;
						skipped.push(`The new ${meta.name} section was missing ${starter.added.join(", ")}, so the usual starter wording fills it: edit it to fit the business.`);
					}
				}
			}
			if (!checked.success) return { error: { code: "invalid_section", message: `The new ${meta.name} section is not complete (${firstIssue(checked.error)}).` } };
			const id = mode === "prepare" ? randomUUID() : String(op.block.id ?? "");
			if (!isStableBlockId(id)) return { error: { code: "bad_patch", message: "A new section needs an id." } };
			ops.push({ op: "insert_block", afterBlockId: op.afterBlockId, block: { ...(checked.data as Record<string, unknown>), blockType: type, variant, id } });
			continue;
		}
		const target = existing(op.blockId);
		if ("error" in target) return target;
		const block = target.block;
		if (STRUCTURAL_BLOCKS.has(String(block.blockType))) return { error: { code: "structural", message: FRAME } };
		const type = String(block.blockType ?? "");
		if (op.op === "set_variant") {
			const variants = blockRegistry.getBlockMeta(type)?.variants ?? [];
			if (!variants.includes(op.variant)) return { error: { code: "bad_variant", message: `${blockName(block)} has no style "${op.variant}". Choose one of: ${variants.join(", ")}.` } };
			ops.push(op);
		} else if (op.op === "set_image") {
			const segments = pathSegments(op.path);
			const last = segments[segments.length - 1];
			const parent = ownValueAtPath(block, segments.slice(0, -1));
			const inBounds = segments.every((segment, i) => typeof segment !== "number" || (Array.isArray(ownValueAtPath(block, segments.slice(0, i))) && segment < (ownValueAtPath(block, segments.slice(0, i)) as unknown[]).length));
			const safe = segments.every((segment) => typeof segment === "number" || !UNSAFE_SEGMENTS.has(segment));
			if (!safe || typeof last !== "string" || !SINGLE_PICTURE_KEYS.has(last) || !parent || typeof parent !== "object" || Array.isArray(parent) || !inBounds || Array.isArray((parent as Record<string, unknown>)[last])) {
				return { error: { code: "bad_picture_field", message: `${blockName(block)} has no picture at "${op.path}". Use a single picture field from site_read view "block" (e.g. image, or items.0.image).` } };
			}
			// the path is checked against the section as stored, so it can't follow a text edit of the same field
			if (touchedKeys(op.blockId).has(String(segments[0]))) {
				return { error: { code: "bad_patch", message: `Change ${String(segments[0])} of ${blockName(block)} either by text or by picture in one change; send the other in a second change.` } };
			}
			if (!(await usablePictureRefs(tenantId, [op.image.ref]))) return { error: { code: "unknown_image", message: PICTURE_REFUSED } };
			touchedKeys(op.blockId).add(String(segments[0]));
			ops.push({ op: "set_image", blockId: op.blockId, path: op.path, image: op.image });
		} else if (op.op === "set_pictures") {
			// a list of { image, caption } rows (a gallery's images): replaced as a whole, in order
			const schema = editableKeys(type).has(op.path) ? fieldSchema(type, op.path) : null;
			const current = block[op.path];
			if (!isMediaKey(op.path) || !schema || !schema.safeParse(PICTURE_LIST_PROBE).success || (current !== undefined && current !== null && !Array.isArray(current))) {
				return { error: { code: "bad_picture_field", message: `${blockName(block)} has no picture list "${op.path}". Use set_pictures on a list of pictures (a gallery's "images"); a single picture goes in set_image.` } };
			}
			if (touchedKeys(op.blockId).has(op.path)) {
				return { error: { code: "bad_patch", message: `Change ${op.path} of ${blockName(block)} in one op.` } };
			}
			if (!(await usablePictureRefs(tenantId, op.items.map((item) => item.image.ref)))) return { error: { code: "unknown_image", message: PICTURE_REFUSED } };
			touchedKeys(op.blockId).add(op.path);
			ops.push({
				op: "set_pictures",
				blockId: op.blockId,
				path: op.path,
				items: op.items.map((item) => ({ image: item.image, ...(item.caption !== undefined ? { caption: item.caption } : {}) })),
			});
		} else if (op.op === "edit_list") {
			const name = blockName(block);
			const segments = pathSegments(op.path);
			const top = segments[0];
			const safe = segments.every((segment) => typeof segment === "number" || !UNSAFE_SEGMENTS.has(segment));
			const current = ownValueAtPath(block, segments);
			const listSchema = safe && typeof top === "string" && editableKeys(type).has(top) ? schemaAt(type, segments) : null;
			const rowSchema = rowSchemaOf(listSchema);
			// only what a save keeps (Payload drops row keys it has no field for)
			const kept = storedKeys(type, segments);
			const rowKeys = keysOf(rowSchema)?.filter((key) => !kept || kept.has(key)) ?? null;
			if (!safe || typeof top !== "string" || !listSchema || !rowKeys || (current !== undefined && current !== null && !Array.isArray(current)) || (current == null && segments.length > 1)) {
				return { error: { code: "bad_list", message: `${name} has no list of items at "${op.path}". Use a list from site_read view "block" (features, ctaButtons, faqs, items…); a list of plain words takes set_fields with the whole list.` } };
			}
			if (touchedKeys(op.blockId).has(top)) return { error: { code: "bad_patch", message: `Change ${top} of ${name} in one op (edit_list covers its order, items and text together).` } };
			const rows = (Array.isArray(current) ? current : []) as unknown[];
			const used = new Set<number>();
			const pictureKey = rowKeys.find((key) => SINGLE_PICTURE_KEYS.has(key));
			const pictureList = isMediaKey(String(segments[segments.length - 1]));
			const nextRows: Array<{ keep?: number; fields?: Record<string, unknown>; picture?: { key: string; image: { ref: string; url?: string; name?: string } } }> = [];
			for (const [i, row] of op.rows.entries()) {
				let keep: number | undefined;
				if (row.keep !== undefined) {
					keep = typeof row.keep === "number" ? row.keep : rows.findIndex((r) => r !== null && typeof r === "object" && (r as { id?: unknown }).id === row.keep);
					if (keep < 0 || keep >= rows.length || !rows[keep] || typeof rows[keep] !== "object") return { error: { code: "unknown_item", message: `${name} → ${op.path} has no item ${JSON.stringify(row.keep)}. Use the item ids from site_read view "block" (or the position for items without an id).` } };
					if (used.has(keep)) return { error: { code: "bad_patch", message: `${name} → ${op.path}: item ${JSON.stringify(row.keep)} is listed twice. To add a copy, send a new row with its text.` } };
					used.add(keep);
				}
				const fields: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(row.fields ?? {})) {
					if (key === "id" || isLockedKey(key, type) || !rowKeys.includes(key)) {
						if (mode === "prepare") skipped.push(`${name} → ${op.path}: an item has no field "${key}" (left out).`);
						continue;
					}
					if (isMediaKey(key)) {
						if (mode === "prepare") skipped.push(`${name} → ${op.path}: pictures are changed with a picture edit (left ${key} as it is).`);
						continue;
					}
					const bad = unsafeLinks(value, key);
					if (bad.length > 0) {
						if (mode === "prepare") skipped.push(`Left out ${key}: unsafe link ${bad[0]} (use a page path like /contact or an https:// address).`);
						continue;
					}
					fields[key] = value;
				}
				// the item's picture from the chat, into the row's picture field
				let picture: { key: string; image: { ref: string; url?: string; name?: string } } | undefined;
				if (row.picture) {
					if (!pictureKey) return { error: { code: "bad_picture_field", message: `Items of ${name} → ${op.path} have no picture.` } };
					if (!(await usablePictureRefs(tenantId, [row.picture.image.ref]))) return { error: { code: "unknown_image", message: PICTURE_REFUSED } };
					picture = { key: pictureKey, image: row.picture.image };
				}
				if (keep === undefined && Object.keys(fields).length === 0 && !picture) return { error: { code: "bad_patch", message: `${name} → ${op.path}: a new item needs its text (fields) or picture, or "keep" with the id of an item to keep.` } };
				if (keep === undefined && pictureList && !picture) return { error: { code: "bad_patch", message: `${name} → ${op.path} is a list of pictures: a new item needs its picture (imageId).` } };
				if (keep === undefined && pictureKey && !picture && mode === "prepare") skipped.push(`New item ${i + 1} of ${op.path} has no picture: give it one (imageId) in this edit or with set_image path "${op.path}.${i}.${pictureKey}" later.`);
				nextRows.push({ ...(keep !== undefined ? { keep } : {}), ...(Object.keys(fields).length > 0 ? { fields } : {}), ...(picture ? { picture } : {}) });
			}
			const normalized = { op: "edit_list" as const, blockId: op.blockId, path: op.path, rows: nextRows };
			let preview: PageBlock;
			try {
				preview = runPagePatch([block], [{ ...normalized, blockId: blockIdOf(block, 0) }]).next[0]!;
			} catch (error) {
				if (error instanceof PagePatchError) return { error: { code: "bad_patch", message: error.message } };
				throw error;
			}
			const fieldCheck = fieldSchema(type, top);
			if (fieldCheck && fieldCheck.safeParse(forValidation(block[top])).success && !fieldCheck.safeParse(forValidation(preview[top])).success) {
				return { error: { code: "invalid_section", message: `That list doesn't fit ${name} → ${op.path} (${firstIssue(fieldCheck.safeParse(forValidation(preview[top])).error?.message)}).` } };
			}
			touchedKeys(op.blockId).add(top);
			ops.push(normalized);
		} else if (op.op === "set_value") {
			const name = blockName(block);
			const segments = pathSegments(op.path);
			const top = segments[0];
			const last = segments[segments.length - 1];
			const safe = segments.every((segment) => typeof segment === "number" || !UNSAFE_SEGMENTS.has(segment));
			if (!safe || typeof top !== "string" || typeof last !== "string" || !editableKeys(type).has(top) || last === "id" || isLockedKey(last, type)) return pathError(block, op.path, "field you can set");
			if (isMediaKey(last) || (isMediaKey(top) && segments.length === 1)) return { error: { code: "bad_picture_field", message: `${name} → ${op.path} is a picture: use set_image (one) or set_pictures (a list).` } };
			const parent = segments.length === 1 ? block : ownValueAtPath(block, segments.slice(0, -1));
			if (!parent || typeof parent !== "object" || Array.isArray(parent)) return pathError(block, op.path, "field");
			const now = (parent as Record<string, unknown>)[last];
			if (now !== null && typeof now === "object") return { error: { code: "bad_path", message: `${name} → ${op.path} is a list or a group: use edit_list for list items, set_fields for the whole value.` } };
			const leaf = schemaAt(type, segments);
			if (now === undefined && !leaf) return pathError(block, op.path, "field");
			const stored = storedKeys(type, segments.slice(0, -1));
			if (stored && !stored.has(last)) return { error: { code: "not_stored", message: `${name} → ${op.path} is not saved with the page, so a change to it would be lost.` } };
			const key = `${op.blockId} ${op.path}`;
			if ((touchedKeys(op.blockId).has(top) && !valueKeys.has(`${op.blockId} ${top}`)) || valuePaths.has(key)) {
				return { error: { code: "bad_patch", message: `${op.path} of ${name} is already changed by another op of this change.` } };
			}
			let value = op.value;
			if (last === "videoUrl" && !isEmbeddableVideo(value)) return { error: { code: "bad_video", message: VIDEO_ONLY } };
			const bad = unsafeLinks(value, last);
			if (bad.length > 0) return { error: { code: "unsafe_link", message: `${bad[0]} is not a link the site can use: a page path like /contact, #section, an https:// address, mailto: or tel:.` } };
			const fieldCheck = fieldSchema(type, top);
			const merged = (v: unknown) => (setAtPath(block, segments, v) as PageBlock)[top];
			if (fieldCheck && fieldCheck.safeParse(forValidation(block[top])).success && !fieldCheck.safeParse(forValidation(merged(value))).success) {
				// a phone number or code sent as a number
				if (typeof value === "number" && fieldCheck.safeParse(forValidation(merged(String(value)))).success) value = String(value);
				else return { error: { code: "invalid_section", message: `That value doesn't fit ${name} → ${op.path} (${firstIssue(fieldCheck.safeParse(forValidation(merged(value))).error?.message)}).` } };
			}
			touchedKeys(op.blockId).add(top);
			valueKeys.add(`${op.blockId} ${top}`);
			valuePaths.add(key);
			ops.push({ op: "set_value", blockId: op.blockId, path: op.path, value });
		} else if (op.op === "set_fields") {
			const fields = cleanFields(type, blockName(block), op.fields, block);
			if ("error" in fields) return fields as { error: { code: string; message: string } };
			if (Object.keys(fields).length === 0) continue;
			const clash = Object.keys(fields).find((key) => touchedKeys(op.blockId).has(key));
			if (clash) return { error: { code: "bad_patch", message: `Change ${clash} of ${blockName(block)} either by text or by picture in one change; send the other in a second change.` } };
			for (const key of Object.keys(fields)) touchedKeys(op.blockId).add(key);
			if (type === "products-grid") {
				const problem = await productsGridChoice(actor, block, fields, mode);
				if (problem) return problem;
			}
			// checked as the schema sees it (no media ids, no nulls), so stored blocks are checked too
			const wasValid = blockRegistry.validate(type, forValidation(block)).success;
			const merged = blockRegistry.validate(type, forValidation({ ...block, ...fields }));
			if (wasValid && !merged.success) {
				return { error: { code: "invalid_section", message: `That change doesn't fit the ${blockName(block)} section (${firstIssue(merged.error)}). Send the complete list for list fields.` } };
			}
			ops.push({ op: "set_fields", blockId: op.blockId, fields });
		} else {
			if (op.op === "move_block") {
				const at = anchor(op.afterBlockId);
				if (at && "error" in at) return at;
			}
			ops.push(op);
		}
	}
	return { ops, skipped, ...(shows.length > 0 ? { shows } : {}) };
}

/** "features.2.title" → "features · “Fast delivery” · title": the card names the item, not its index. */
function valueLabel(block: PageBlock, path: string): string {
	const segments = pathSegments(path);
	const parts: string[] = [];
	segments.forEach((segment, i) => {
		if (typeof segment === "number") parts.push(rowLabel(valueAtPath(block, segments.slice(0, i + 1)), segment));
		else parts.push(segment);
	});
	return parts.join(" · ");
}

/** The card's lines for a list edit: items removed, added, changed (field by field) and the new order. */
function listDiffs(entity: Diff["entity"], op: Extract<PagePatchOp, { op: "edit_list" }>, block: PageBlock): Diff[] {
	const rows = (Array.isArray(valueAtPath(block, pathSegments(op.path))) ? valueAtPath(block, pathSegments(op.path)) : []) as unknown[];
	const diffs: Diff[] = [];
	const kept = new Set(op.rows.flatMap((row) => (typeof row.keep === "number" ? [row.keep] : [])));
	rows.forEach((row, i) => {
		if (!kept.has(i)) diffs.push({ entity, field: `${op.path} · ${rowLabel(row, i)}`, path: op.path, before: previewValue(row) ?? rowLabel(row, i), after: "Removed" });
	});
	op.rows.forEach((row, i) => {
		const was = typeof row.keep === "number" ? rows[row.keep] : undefined;
		const picture = row.picture ? `New picture: ${row.picture.image.name ?? "from the chat"}` : null;
		if (was === undefined) {
			if (picture) diffs.push({ entity, field: `${op.path} · new item ${i + 1} · picture`, path: `${op.path}.${i}.${row.picture?.key ?? "image"}`, before: null, after: picture });
			for (const [key, value] of Object.entries(row.fields ?? {})) diffs.push({ entity, field: `${op.path} · new item ${i + 1} · ${key}`, path: `${op.path}.${i}.${key}`, before: null, after: previewValue(value) ?? "(empty)" });
			return;
		}
		if (picture) diffs.push({ entity, field: `${op.path} · ${rowLabel(was, row.keep as number)} · picture`, path: `${op.path}.${i}.${row.picture?.key ?? "image"}`, before: (was as Record<string, unknown>)[row.picture!.key ?? ""] ? "current picture" : null, after: picture });
		for (const [key, value] of Object.entries(row.fields ?? {})) {
			const before = (was as Record<string, unknown>)[key];
			if (JSON.stringify(before) === JSON.stringify(value)) continue;
			diffs.push({ entity, field: `${op.path} · ${rowLabel(was, row.keep as number)} · ${key}`, path: `${op.path}.${i}.${key}`, before: previewValue(before), after: previewValue(value) ?? "(empty)" });
		}
	});
	// the order of the items that stay
	const keptOrder = op.rows.flatMap((row) => (typeof row.keep === "number" ? [row.keep] : []));
	const wasOrder = [...keptOrder].sort((a, b) => a - b);
	if (keptOrder.some((index, i) => index !== wasOrder[i])) {
		const names = (order: number[]) => order.map((index) => rowLabel(rows[index], index)).join(" · ");
		diffs.push({ entity, field: `${op.path} · order`, path: op.path, before: previewValue(names(wasOrder)), after: previewValue(names(keptOrder)) ?? "" });
	}
	return diffs;
}

/** One page's edit drafted from its current draft: checked ops, the card's lines and the version guard. */
export type DraftedPageEdit = {
	pageId: string;
	ops: PagePatchOp[];
	skipped: string[];
	/** what the product sections of this edit will show on the live site (see ProductShows) */
	shows: ProductShows[];
	diffs: Diff[];
	hosts: Set<string>;
	touched: Set<string>;
	structural: boolean;
	expect: Record<string, string>;
	/** generic-sounding copy kept because the merchant asked for those words */
	copy: CopyNote[];
	/** the language whose copy the text ops write (null = no text op, or the sections as stored) and the version guard of what was shown in it */
	locale: string | null;
	localeExpect: Record<string, string>;
	/**
	 * the language on screen when the sections are edited with a copy on screen (null = the sections as stored):
	 * kept in the plan even without a text op, since a change to a field every language shares also updates that copy
	 */
	planLocale: string | null;
};

export async function draftPageEdit(
	actor: AgentActor,
	tenantId: string,
	page: { id: string | number; title?: string | null } & Record<string, unknown>,
	inputOps: PagePatchOp[],
	keepWording = false,
	/** the language whose copy a text edit writes (slotLocaleOf), null = the sections as stored */
	locale: string | null = null,
	/** the site's name: the editor's template text is filled with it */
	brand: string = "Your Brand",
): Promise<DraftedPageEdit | { error: { code: string; message: string } }> {
	const before = layoutOf(page as never);
	const content: LocaleContent = locale ? await readLocaleContent(await getPayload({ config }), page.id) : {};
	// what the merchant sees: the language's copy over the sections (the sections themselves when no copy is on screen)
	const shown = shownLayout(before, locale, content, brand);
	const byId = new Map(before.map((block, index) => [blockIdOf(block, index), block]));
	const shownById = new Map(shown.map((block, index) => [blockIdOf(block, index), block]));
	const pageLabel = page.title ?? "page";
	const siteRef = typeof page.site === "object" && page.site ? (page.site as { id?: unknown }).id : page.site;
	const sectionContext = siteRef === undefined || siteRef === null ? undefined : sectionContextLoader(actor, String(siteRef));
	// text goes to the language's copy, everything else (style, pictures, structure) to the sections
	const parts = locale ? splitLocaleOps(inputOps, shown) : { text: [] as PagePatchOp[], base: inputOps };
	const siteId = siteRef === undefined || siteRef === null ? undefined : (siteRef as string | number);
	const checkedBase = parts.base.length > 0 ? await checkPagePatchOps(actor, tenantId, before, parts.base, "prepare", sectionContext, siteId) : { ops: [] as PagePatchOp[], skipped: [] as string[] };
	if ("error" in checkedBase) return checkedBase;
	const checkedText = parts.text.length > 0 ? await checkPagePatchOps(actor, tenantId, shown, parts.text, "prepare", undefined, siteId) : { ops: [] as PagePatchOp[], skipped: [] as string[] };
	if ("error" in checkedText) return checkedText;
	for (const op of checkedText.ops) {
		const problem = locale ? localeTextProblem(op, shown, content, locale, languageName(locale), brand) : null;
		if (problem) return { error: problem };
	}
	const skipped = [...checkedBase.skipped, ...checkedText.skipped];
	const shows = [...(("shows" in checkedBase && checkedBase.shows) || []), ...(("shows" in checkedText && checkedText.shows) || [])];
	const ops = [...checkedBase.ops, ...checkedText.ops];
	if (ops.length === 0) return { error: { code: "no_change", message: skipped.join(" ") || "Nothing would change." } };
	// anti-slop: filler, unverifiable claims and vague labels go back to the model unless they are the merchant's words
	const textOps = new Set<PagePatchOp>(checkedText.ops);
	const copy = [...copyNotes(before, checkedBase.ops, pageLabel), ...copyNotes(shown, checkedText.ops, pageLabel)];
	if (copy.length > 0 && !keepWording) return copyRefusal(copy);

	let next: PageBlock[];
	let touched: Set<string>;
	let shownNext: PageBlock[] = shown;
	let touchedText = new Set<string>();
	try {
		({ next, touched } = runPagePatch(before, checkedBase.ops));
		if (checkedText.ops.length > 0) ({ next: shownNext, touched: touchedText } = runPagePatch(shown, checkedText.ops));
	} catch (error) {
		if (error instanceof PagePatchError) return { error: { code: "bad_patch", message: error.message } };
		throw error;
	}
	if (new Set([...touched, ...touchedText]).size > MAX_SECTIONS_TOUCHED) return { error: { code: "too_large", message: `At most ${MAX_SECTIONS_TOUCHED} sections per change — split it.` } };
	// a field Payload requires left empty (a button with no link) would only fail at publish
	const emptied = requiredLeftEmpty(before, next, touched) ?? requiredLeftEmpty(shown, shownNext, touchedText);
	if (emptied) return { error: { code: "required_field", message: emptied } };

	const diffs: Diff[] = [];
	const hosts = new Set<string>();
	const position = (blocks: PageBlock[], id: string) => blocks.findIndex((b, i) => blockIdOf(b, i) === id) + 1;
	for (const op of ops) {
		// a text op's "before" is the text on screen in the language, not the section's stored text
		const blocks = textOps.has(op) ? shownById : byId;
		if (op.op === "set_fields") {
			const block = blocks.get(op.blockId)!;
			const entity = { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` };
			for (const [field, value] of Object.entries(op.fields)) {
				linkHosts(value, hosts);
				diffs.push({ entity, field, path: field, before: previewValue(block[field]), after: previewValue(value) ?? "(empty)" });
			}
		} else if (op.op === "set_variant") {
			const block = blocks.get(op.blockId)!;
			diffs.push({ entity: { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` }, field: "style", path: "variant", before: previewValue(block.variant), after: op.variant });
		} else if (op.op === "set_image") {
			const block = blocks.get(op.blockId)!;
			const had = valueAtPath(block, pathSegments(op.path));
			diffs.push({ entity: { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` }, field: `picture (${op.path})`, path: op.path, before: had === undefined || had === null ? null : "current picture", after: op.image.name ? `New picture: ${op.image.name}` : "New picture" });
		} else if (op.op === "set_pictures") {
			const block = blocks.get(op.blockId)!;
			const had = Array.isArray(block[op.path]) ? (block[op.path] as unknown[]).length : 0;
			const names = op.items.map((item, i) => `${i + 1}. ${(item.image.name ?? "picture").replace(/\s+/g, " ")}${item.caption ? ` — “${item.caption}”` : ""}`);
			diffs.push({
				entity: { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` },
				field: `pictures (${op.path})`,
				path: op.path,
				// an empty list of a gallery / Featured Products shows sample pictures, not nothing
				before: had > 0 ? `${had} picture${had === 1 ? "" : "s"}` : SAMPLE_LISTS.has(String(block.blockType)) ? "sample pictures" : null,
				after: previewValue(`${op.items.length} picture${op.items.length === 1 ? "" : "s"}: ${names.join("; ")}`) ?? "",
			});
		} else if (op.op === "edit_list") {
			const block = blocks.get(op.blockId)!;
			const entity = { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` };
			diffs.push(...listDiffs(entity, op, block));
			for (const row of op.rows) if (row.fields) linkHosts(row.fields, hosts);
		} else if (op.op === "set_value") {
			const block = blocks.get(op.blockId)!;
			linkHosts(op.value, hosts);
			diffs.push({ entity: { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` }, field: valueLabel(block, op.path), path: op.path, before: previewValue(valueAtPath(block, pathSegments(op.path))), after: previewValue(op.value) ?? "(empty)" });
		} else if (op.op === "insert_block") {
			linkHosts(op.block, hosts);
			const id = String(op.block.id);
			diffs.push({ entity: { kind: "site_block", id, label: `${blockName(op.block as PageBlock)} · ${pageLabel}` }, field: "section", before: null, after: `New ${blockName(op.block as PageBlock)} section (position ${position(next, id)})` });
		} else if (op.op === "remove_block") {
			const block = blocks.get(op.blockId)!;
			diffs.push({ entity: { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` }, field: "section", before: `${blockName(block)} (position ${position(before, op.blockId)})`, after: "Removed" });
		} else {
			const block = blocks.get(op.blockId)!;
			diffs.push({ entity: { kind: "site_block", id: op.blockId, label: `${blockName(block)} · ${pageLabel}` }, field: "position", before: String(position(before, op.blockId)), after: String(position(next, op.blockId)) });
		}
	}
	const structural = ops.some((op) => op.op === "remove_block" || op.op === "move_block");
	return {
		pageId: String(page.id),
		ops,
		skipped,
		shows,
		diffs,
		hosts,
		touched: new Set([...touched, ...touchedText]),
		structural,
		expect: fingerprints(before, touched),
		copy,
		locale: locale && checkedText.ops.length > 0 ? locale : null,
		localeExpect: locale ? shownFingerprints(shown, touchedText) : {},
		planLocale: locale,
	};
}

/** The card's notes shared by single- and multi-page edits. */
export function pageEditGuardrails(hosts: Set<string>, skipped: string[], copy: CopyNote[] = [], locale: string | null = null, shows: ProductShows[] = []): Guardrail[] {
	return [
		...(locale ? [{ rule: "language_copy", ok: true, detail: `Changes the ${languageName(locale)} text you are viewing; the page's original-language text stays as it is.` }] : []),
		{ rule: "page_draft", ok: true, detail: "Goes into the page draft; your live site changes when you publish." },
		{ rule: "version_guard", ok: true, detail: "Only applied if these sections are unchanged since." },
		{ rule: "undo", ok: true, detail: "You can undo it for 7 days while these sections stay as the assistant left them." },
		...[...hosts].slice(0, 5).map((host) => ({ rule: "external_link", ok: true, detail: `Links to ${host} — check it is the address you want.` })),
		...skipped.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		...shows.map(({ ok, detail }) => ({ rule: "products_shown", ok, detail })),
		...copyGuardrails(copy),
	];
}

export async function preparePagePatch(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = PagePatchInputSchema.parse(raw);
	const { site, tenantId } = await siteForActor(actor, input.siteId);
	const page = await draftPage(actor, site.id, input.pageId);
	const drafted = await draftPageEdit(actor, tenantId, page as never, input.ops, input.keepWording, slotLocaleOf(site, input.language), brandOf(site));
	if ("error" in drafted) return drafted;
	const plan: PagePatchPlan = {
		siteId: String(site.id),
		pageId: drafted.pageId,
		ops: drafted.ops,
		expect: drafted.expect,
		...(drafted.planLocale ? { locale: drafted.planLocale as "en" | "ms", localeExpect: drafted.localeExpect } : {}),
	};
	return {
		kind: "site.page_patch",
		title: `Edit page: ${page.title ?? "page"}`.slice(0, 200),
		why: input.why,
		risk: drafted.structural || drafted.touched.size > 5 ? "medium" : "low",
		diffs: drafted.diffs.slice(0, 200),
		guardrails: pageEditGuardrails(drafted.hosts, drafted.skipped, drafted.copy, drafted.locale, drafted.shows),
		plan,
	};
}

/** Theme fields this site can store; colours must be #rrggbb. */
function themeChanges(raw: Record<string, unknown>, skipped: string[]): Record<string, unknown> {
	const clean = sanitizeTheme(raw);
	for (const key of Object.keys(raw)) if (!(key in clean)) skipped.push(`"${key}" is not a theme option (or not one of its values).`);
	for (const [key, value] of Object.entries(clean)) {
		if (key.endsWith("Color") && !(typeof value === "string" && HEX.test(value))) {
			delete clean[key];
			skipped.push(`${key} needs a #rrggbb colour.`);
		}
	}
	return clean;
}

export function themeFingerprint(theme: unknown, keys: Iterable<string>): string {
	const source = (theme ?? {}) as Record<string, unknown>;
	return blockHash(Object.fromEntries([...keys].sort().map((key) => [key, source[key] ?? null])));
}

export async function prepareThemeChange(actor: AgentActor, raw: unknown): Promise<PreparedSiteChange | { error: { code: string; message: string } }> {
	const input = ThemeChangeInputSchema.parse(raw);
	const { site } = await siteForActor(actor, input.siteId);
	const current = (site.theme as Record<string, unknown> | undefined) ?? {};
	const skipped: string[] = [];
	const changes = Object.fromEntries(Object.entries(themeChanges(input.changes, skipped)).filter(([key, value]) => current[key] !== value));
	if (Object.keys(changes).length === 0) return { error: { code: "no_change", message: skipped.join(" ") || "The theme already looks like that." } };
	const siteName = (site.name ?? "").trim() || "site";
	const entity = { kind: "site_theme", id: String(site.id), label: siteName };
	return {
		kind: "site.theme_patch",
		title: `Change theme: ${siteName}`.slice(0, 200),
		why: input.why,
		risk: "high",
		diffs: Object.entries(changes).map(([field, value]) => ({ entity, field, before: previewValue(current[field]), after: previewValue(value) ?? "(default)" })),
		guardrails: [
			{ rule: "live", ok: true, detail: "The theme is not part of the page draft: your live site shows it right away." },
			{ rule: "undo", ok: true, detail: "You can undo it for 7 days while the theme stays as the assistant left it." },
			...skipped.map((detail) => ({ rule: "skipped_value", ok: false, detail })),
		],
		confirmText: siteName,
		plan: { siteId: String(site.id), base: themeFingerprint(current, Object.keys(changes)), changes },
	};
}

export { SiteToolError };

/**
 * The first required field this change leaves empty, as the model should read
 * it: "Hero → ctaButtons.0.url is required (a button needs its link): give it a
 * value." Fields the publish fills in itself (item titles) and fields that were
 * already empty before the change don't count.
 */
function requiredLeftEmpty(before: PageBlock[], next: PageBlock[], touched: ReadonlySet<string>): string | null {
	const was = new Map(before.map((block, index) => [blockIdOf(block, index), block]));
	for (const [index, block] of next.entries()) {
		const id = blockIdOf(block, index);
		if (!touched.has(id)) continue;
		const type = String(block.blockType ?? "");
		const missing = (b: PageBlock) => new Set(missingRequired(type, sanitizeSingleBlockRequiredFields(b as Record<string, unknown>)));
		const already = was.has(id) ? missing(was.get(id)!) : new Set<string>();
		const fresh = [...missing(block)].filter((path) => !already.has(path));
		if (fresh.length === 0) continue;
		const path = fresh[0]!;
		const why = /(^|\.)url$|link/i.test(path) ? " (a button or link needs where it goes: a page path like /contact, or https://…)" : "";
		return `${blockName(block)} → ${path} is required${why}: give it a value, or remove that item.`;
	}
	return null;
}
