import "server-only";

import { z } from "zod";
import { blockHash, blockIdOf, blockName, type PageBlock, STRUCTURAL_BLOCKS } from "./site-blocks";

/**
 * A page edit as data: ops addressed by block id, never by position, so an
 * edit drafted from one read still lands on the right sections. Prepare and
 * apply run the same `runPagePatch`, so what the merchant reviewed is exactly
 * what gets written.
 */

const BlockId = z.string().min(1).max(120);
const PictureRef = z.object({ ref: z.string().min(1).max(200), url: z.string().max(2000).optional(), name: z.string().max(200).optional() });

export const PagePatchOpSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("set_fields"), blockId: BlockId, fields: z.record(z.string(), z.unknown()) }),
	z.object({ op: z.literal("set_variant"), blockId: BlockId, variant: z.string().min(1).max(60) }),
	/** a picture from the chat (stock, the shop's DAM, an upload) into a media field; `mediaId` is set on apply */
	z.object({
		op: z.literal("set_image"),
		blockId: BlockId,
		path: z.string().min(1).max(120),
		image: z.object({ ref: z.string().min(1).max(200), url: z.string().max(2000).optional(), name: z.string().max(200).optional() }),
		mediaId: z.union([z.number().int().positive(), z.string().min(1).max(40)]).optional(),
		/** set with mediaId on apply: fields stored as JSON (hero slides) keep the picture as { url, alt } */
		mediaUrl: z.string().max(2000).optional(),
	}),
	/**
	 * a section's whole picture list (a gallery's `images`), in order: each row's
	 * picture from the chat and its caption (undefined keeps the caption at that position)
	 */
	z.object({
		op: z.literal("set_pictures"),
		blockId: BlockId,
		path: z.string().min(1).max(40),
		items: z
			.array(
				z.object({
					image: z.object({ ref: z.string().min(1).max(200), url: z.string().max(2000).optional(), name: z.string().max(200).optional() }),
					caption: z.string().max(300).optional(),
					mediaId: z.union([z.number().int().positive(), z.string().min(1).max(40)]).optional(),
				}),
			)
			.min(1)
			.max(24),
	}),
	/**
	 * a list of a section (cards, buttons, links, questions…) in its new order:
	 * each row keeps a current row (by its id, or its position for a row without
	 * one) with everything it holds — pictures included — plus `fields`; a row
	 * without `keep` is new; a current row left out is removed. Prepare stores
	 * `keep` as the row's position (the version guard pins the rows).
	 */
	z.object({
		op: z.literal("edit_list"),
		blockId: BlockId,
		path: z.string().min(1).max(120),
		rows: z
			.array(
				z.object({
					keep: z.union([z.string().min(1).max(60), z.number().int().min(0).max(199)]).optional(),
					fields: z.record(z.string(), z.unknown()).optional(),
					/** a chat picture for the item's picture field (`key`, set by prepare); mediaId / mediaUrl are set on apply */
					picture: z.object({ key: z.string().min(1).max(40).optional(), image: PictureRef }).optional(),
					mediaId: z.union([z.number().int().positive(), z.string().min(1).max(40)]).optional(),
					mediaUrl: z.string().max(2000).optional(),
				}),
			)
			.max(60),
	}),
	/** one text / link / number / switch anywhere in a section ("features.2.title", "ctaButtons.0.url") */
	z.object({
		op: z.literal("set_value"),
		blockId: BlockId,
		path: z.string().min(1).max(160),
		value: z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]),
	}),
	/** afterBlockId null = first section after the navigation */
	z.object({ op: z.literal("insert_block"), afterBlockId: BlockId.nullable(), block: z.record(z.string(), z.unknown()) }),
	z.object({ op: z.literal("remove_block"), blockId: BlockId }),
	z.object({ op: z.literal("move_block"), blockId: BlockId, afterBlockId: BlockId.nullable() }),
]);
export type PagePatchOp = z.infer<typeof PagePatchOpSchema>;

/**
 * An edit made while a language other than the written one is on screen: the
 * text ops write that language's copy (`pages.locale_content`), guarded by the
 * fingerprint of the text the merchant saw (`localeExpect`), not the sections'.
 */
export const PageLanguageFields = {
	locale: z.enum(["en", "ms"]).optional(),
	/** section id → fingerprint of the section as the merchant saw it in `locale` */
	localeExpect: z.record(z.string(), z.string()).optional(),
};

export const PagePatchPlanSchema = z.object({
	siteId: z.string().min(1).max(40),
	pageId: z.string().min(1).max(40),
	ops: z.array(PagePatchOpSchema).min(1).max(30),
	/** fingerprint of every existing section the ops touch or anchor on, as drafted */
	expect: z.record(z.string(), z.string()),
	...PageLanguageFields,
});
export type PagePatchPlan = z.infer<typeof PagePatchPlanSchema>;

export class PagePatchError extends Error {}

/** Lists stored as JSON, not Payload rows: their pictures are image objects, not media ids (block-normalization). */
export const JSON_PICTURE_FIELDS: Record<string, ReadonlySet<string>> = { hero: new Set(["slides"]) };

type Entry = { id: string; block: PageBlock };

function entries(blocks: PageBlock[]): Entry[] {
	return blocks.map((block, index) => ({ id: blockIdOf(block, index), block }));
}

function insertIndex(list: Entry[], afterId: string | null): number {
	const footer = list.findIndex((e) => e.block.blockType === "footer");
	let index: number;
	if (afterId === null) {
		const nav = list.findIndex((e) => e.block.blockType === "navigation");
		index = nav >= 0 ? nav + 1 : 0;
	} else {
		const anchor = list.findIndex((e) => e.id === afterId);
		if (anchor < 0) throw new PagePatchError(`No section ${afterId} to place it after.`);
		index = anchor + 1;
	}
	// the footer stays last
	return footer >= 0 && index > footer ? footer : index;
}

/** Applies the ops to a copy of the page; touched = ids of existing sections whose content/position the ops depend on. */
export function runPagePatch(blocks: PageBlock[], ops: PagePatchOp[]): { next: PageBlock[]; touched: Set<string> } {
	const list = entries(blocks);
	const original = new Set(list.map((e) => e.id));
	const touched = new Set<string>();
	const find = (id: string) => {
		const index = list.findIndex((e) => e.id === id);
		if (index < 0) throw new PagePatchError(`No section ${id} on this page.`);
		if (original.has(id)) touched.add(id);
		return index;
	};
	for (const op of ops) {
		switch (op.op) {
			case "set_fields": {
				const index = find(op.blockId);
				list[index] = { id: op.blockId, block: { ...list[index]!.block, ...op.fields } };
				break;
			}
			case "set_variant": {
				const index = find(op.blockId);
				list[index] = { id: op.blockId, block: { ...list[index]!.block, variant: op.variant } };
				break;
			}
			case "set_image": {
				const index = find(op.blockId);
				const block = list[index]!.block;
				const segments = pathSegments(op.path);
				// a JSON field holds the picture itself (the save checks it as { url, alt }), an upload field its media id
				const json = JSON_PICTURE_FIELDS[String(block.blockType)]?.has(String(segments[0]));
				const value = json ? (op.mediaUrl ? { url: op.mediaUrl, alt: op.image.name ?? "" } : undefined) : (op.mediaId ?? null);
				list[index] = { id: op.blockId, block: setAtPath(block, segments, value) as PageBlock };
				break;
			}
			case "set_pictures": {
				const index = find(op.blockId);
				const block = list[index]!.block;
				const rows = Array.isArray(block[op.path]) ? (block[op.path] as unknown[]) : [];
				// a row keeps what else it had (its id, link) at the same position; the picture and caption are new
				const next = op.items.map((item, i) => {
					const row = rows[i] && typeof rows[i] === "object" && !Array.isArray(rows[i]) ? (rows[i] as Record<string, unknown>) : {};
					return { ...row, image: item.mediaId ?? null, ...(item.caption !== undefined ? { caption: item.caption } : {}) };
				});
				list[index] = { id: op.blockId, block: { ...block, [op.path]: next } };
				break;
			}
			case "edit_list": {
				const index = find(op.blockId);
				const block = list[index]!.block;
				const segments = pathSegments(op.path);
				const current = valueAtPath(block, segments);
				const rows = Array.isArray(current) ? current : [];
				const json = JSON_PICTURE_FIELDS[String(block.blockType)]?.has(String(segments[0]));
				const next = op.rows.map((row) => {
					let item: Record<string, unknown> = { ...(row.fields ?? {}) };
					if (row.keep !== undefined) {
						const kept = typeof row.keep === "number" ? rows[row.keep] : rows.find((r) => r && typeof r === "object" && (r as { id?: unknown }).id === row.keep);
						if (!kept || typeof kept !== "object") throw new PagePatchError(`No item ${String(row.keep)} in ${op.path}: read the section again.`);
						item = { ...(kept as Record<string, unknown>), ...(row.fields ?? {}) };
					}
					// the item's new picture: a media id, or { url, alt } inside a JSON list
					if (row.picture?.key) item[row.picture.key] = json ? (row.mediaUrl ? { url: row.mediaUrl, alt: row.picture.image.name ?? "" } : undefined) : (row.mediaId ?? null);
					return item;
				});
				list[index] = { id: op.blockId, block: setAtPath(block, segments, next) as PageBlock };
				break;
			}
			case "set_value": {
				const index = find(op.blockId);
				list[index] = { id: op.blockId, block: setAtPath(list[index]!.block, pathSegments(op.path), op.value) as PageBlock };
				break;
			}
			case "insert_block": {
				if (op.afterBlockId !== null && original.has(op.afterBlockId)) touched.add(op.afterBlockId);
				const id = String(op.block.id ?? "");
				if (!id) throw new PagePatchError("A new section needs an id.");
				if (STRUCTURAL_BLOCKS.has(String(op.block.blockType))) throw new PagePatchError("A page has one navigation and one footer.");
				list.splice(insertIndex(list, op.afterBlockId), 0, { id, block: op.block as PageBlock });
				break;
			}
			case "remove_block":
			case "move_block": {
				const index = find(op.blockId);
				// the frame of the page stays put: navigation first, footer last
				if (STRUCTURAL_BLOCKS.has(String(list[index]!.block.blockType))) throw new PagePatchError("The navigation and footer can't be removed or moved.");
				const [taken] = list.splice(index, 1);
				if (op.op === "move_block") {
					if (op.afterBlockId !== null && original.has(op.afterBlockId)) touched.add(op.afterBlockId);
					list.splice(insertIndex(list, op.afterBlockId), 0, taken!);
				}
				break;
			}
		}
	}
	return { next: list.map((e) => e.block), touched };
}

/** Fingerprints of the given existing sections — the version guard of a page patch. */
export function fingerprints(blocks: PageBlock[], ids: Iterable<string>): Record<string, string> {
	const byId = new Map(entries(blocks).map((e) => [e.id, e.block]));
	return Object.fromEntries([...ids].flatMap((id) => (byId.has(id) ? [[id, blockHash(byId.get(id))]] : [])));
}

/** Ids of sections that changed since the patch was drafted (or are gone). */
export function changedSince(blocks: PageBlock[], expect: Record<string, string>): string[] {
	const now = fingerprints(blocks, Object.keys(expect));
	return Object.entries(expect).flatMap(([id, hash]) => (now[id] === hash ? [] : [id]));
}

/**
 * What Undo needs to put the touched sections back: each one's content and
 * position before, and its fingerprint after (null = the patch removed it;
 * `before` null = the patch added it).
 */
export function undoRecord(before: PageBlock[], after: PageBlock[], ids: Iterable<string>) {
	const beforeList = entries(before);
	const afterById = new Map(entries(after).map((e) => [e.id, e.block]));
	return [...ids].map((id) => {
		const index = beforeList.findIndex((e) => e.id === id);
		const was = index >= 0 ? beforeList[index]!.block : null;
		const now = afterById.get(id) ?? null;
		return { blockId: id, before: was, position: index, after: now ? blockHash(now) : null };
	});
}

export type UndoEntry = ReturnType<typeof undoRecord>[number];

/**
 * Where the touched sections stand against an undo record: all as the change left them (`applied`), all as they
 * were before it (`reverted`) — or neither (edited since). Read-only; the one comparison Undo and the editor's
 * "is this change still in?" check share.
 */
export function restoreState(current: PageBlock[], restore: UndoEntry[]): { applied: boolean; reverted: boolean } {
	const list = entries(current);
	const find = (id: string) => list.find((e) => e.id === id);
	const contentBack = restore.every((r) => {
		const now = find(r.blockId);
		return r.before === null ? !now : Boolean(now) && blockHash(now!.block) === blockHash(r.before);
	});
	return {
		applied: restore.every((r) => {
			const now = find(r.blockId);
			return r.after === null ? !now : Boolean(now) && blockHash(now!.block) === r.after;
		}),
		// a moved section has the same content before and after: it is back only when it also sits where it was
		reverted: contentBack && sameOrder(putBack(list, restore), list),
	};
}

/** The sections with the touched ones put back at their original positions, in order. */
function putBack(list: Entry[], restore: UndoEntry[]): Entry[] {
	const ids = new Set(restore.map((r) => r.blockId));
	const kept = list.filter((e) => !ids.has(e.id));
	for (const r of [...restore].filter((x) => x.before !== null).sort((a, b) => a.position - b.position)) {
		kept.splice(Math.min(Math.max(r.position, 0), kept.length), 0, { id: r.blockId, block: r.before as PageBlock });
	}
	return kept;
}

const sameOrder = (a: Entry[], b: Entry[]) => a.length === b.length && a.every((e, i) => e.id === b[i]!.id);

/** "the Hero section" / "the Hero and About sections" — the sections an undo can't touch, by name. */
function sectionNames(list: Entry[], ids: string[]): string {
	const names = [...new Set(ids.map((id) => list.find((e) => e.id === id)).map((e) => (e ? blockName(e.block) : null)).filter((n): n is string => Boolean(n)))];
	if (names.length === 0) return ids.length === 1 ? "A section" : "Some sections";
	if (names.length === 1) return `The ${names[0]} section`;
	return `The ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} sections`;
}

/**
 * The page with the touched sections back as they were. Already back (undone in the editor, or by an earlier
 * click) → the page as it is, nothing to write. Refuses if a section was changed after the patch.
 */
export function restoreSections(current: PageBlock[], restore: UndoEntry[]): PageBlock[] {
	if (restoreState(current, restore).reverted) return current;
	const list = entries(current);
	const stale = restore.filter((r) => {
		const now = list.find((e) => e.id === r.blockId);
		return r.after === null ? Boolean(now) : !now || blockHash(now.block) !== r.after;
	});
	if (stale.length > 0) {
		throw new PagePatchError(`${sectionNames(list, stale.map((r) => r.blockId))} was edited after the assistant changed it, so this can't be undone from here. Undo it in the editor.`);
	}
	return putBack(list, restore).map((e) => e.block);
}

/** "items.2.image" → ["items", 2, "image"]. */
export function pathSegments(path: string): Array<string | number> {
	return path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/** The value at a path, or undefined when the path doesn't exist. */
export function valueAtPath(value: unknown, segments: Array<string | number>): unknown {
	let node: unknown = value;
	for (const segment of segments) {
		if (node === null || typeof node !== "object") return undefined;
		node = (node as Record<string | number, unknown>)[segment];
	}
	return node;
}

/** A copy of `value` with `next` written at the path (every object on the way is copied). */
export function setAtPath(value: unknown, segments: Array<string | number>, next: unknown): unknown {
	if (segments.length === 0) return next;
	const [head, ...rest] = segments as [string | number, ...Array<string | number>];
	if (head === "__proto__" || head === "constructor" || head === "prototype") throw new PagePatchError("That field is not part of the section.");
	if (Array.isArray(value)) {
		const copy = [...value];
		copy[head as number] = setAtPath(copy[head as number], rest, next);
		return copy;
	}
	const record = (value && typeof value === "object" ? value : {}) as Record<string | number, unknown>;
	return { ...record, [head]: setAtPath(record[head], rest, next) };
}
