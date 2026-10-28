import "server-only";

import { createHash } from "node:crypto";
import type { ZodTypeAny } from "zod";
import { blockRegistry } from "@/blocks/registry";
import { storedKeys } from "./site-persisted";

/**
 * Shared vocabulary of the web builder copilot: how a page's blocks are named
 * (stable ids), fingerprinted (version guard for one block) and which of
 * their fields an AI edit may set.
 */

export type PageBlock = Record<string, unknown> & { blockType?: unknown; id?: unknown; variant?: unknown };
/** Identity and ordering stay the editor's; products embedded as snapshots are never written by the AI. */
/**
 * Never written by an AI edit: identity and ordering (the editor's), embedded
 * product snapshots, raw markup and embeds (scripts, iframes), PW1 layout data
 * and visibility.
 */
const LOCKED_KEYS = new Set([
	"blockType", "id", "_id", "_order", "_path", "blockName", "products", "sortOrder",
	"html", "code", "script", "embedUrl", "embedCode", "videoUrl", "iframe", "sourceLayout", "isVisible",
]);

/**
 * Picture / upload fields (Payload media ids). Pictures can't be changed by
 * an AI edit yet: wherever a new value has one, the section's current picture
 * at the same place is kept (so a rewritten list keeps its pictures by position).
 */
const MEDIA_KEYS = new Set(["image", "images", "backgroundImage", "logo", "avatar", "ogImage", "thumbnail", "poster", "posterImage", "photo", "media", "video", "beforeImage", "afterImage", "imageUrl", "imageUrls"]);

/**
 * Locked keys a block type uses for its own content: a video section's video,
 * the columns of a comparison table, the static cards of a quick-view section
 * (both named `products`, not product snapshots).
 */
const UNLOCKED_BY_TYPE: Record<string, ReadonlySet<string>> = {
	video: new Set(["videoUrl"]),
	hero: new Set(["videoUrl"]),
	"feature-comparison": new Set(["products"]),
	"product-quick-view": new Set(["products"]),
};

/** A video the site can embed: YouTube, Vimeo, or an https video file — never an arbitrary page in an iframe. */
export function isEmbeddableVideo(value: unknown): boolean {
	if (value === "" || value === null) return true;
	if (typeof value !== "string") return false;
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "https:") return false;
		const host = url.hostname.replace(/^www\./, "");
		return ["youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "player.vimeo.com"].includes(host) || /\.(mp4|webm)$/i.test(url.pathname);
	} catch {
		return false;
	}
}

/** Fields holding storefront product ids — every id must belong to the site's workspace. */
export const PRODUCT_ID_FIELDS = new Set(["productIds", "selectedProductIds"]);

/** Navigation and footer frame every page; the copilot edits them, never removes them. */
export const STRUCTURAL_BLOCKS = new Set(["navigation", "footer"]);

/** The id a block is addressed by: its own id, or its position for legacy rows without one. */
export function blockIdOf(block: PageBlock, index: number): string {
	return typeof block.id === "string" && block.id ? block.id : `index-${index}`;
}

function stable(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stable);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.filter((key) => key !== "id" || typeof (value as Record<string, unknown>).blockType === "string")
				.sort()
				.map((key) => [key, stable((value as Record<string, unknown>)[key])]),
		);
	}
	return value;
}

/** Content fingerprint of a block (nested row ids ignored: Payload rewrites them on save). */
export function blockHash(block: unknown): string {
	return createHash("sha256").update(JSON.stringify(stable(block) ?? null)).digest("hex").slice(0, 32);
}

function objectKeys(schema: ZodTypeAny | undefined): string[] | null {
	let current: ZodTypeAny | undefined = schema;
	for (let i = 0; i < 6 && current; i++) {
		const def = (current as { _def?: { typeName?: string; schema?: ZodTypeAny; innerType?: ZodTypeAny } })._def;
		if (def?.typeName === "ZodObject") return Object.keys((current as unknown as { shape: Record<string, unknown> }).shape);
		current = def?.schema ?? def?.innerType;
	}
	return null;
}

/** Keys an AI edit may set on this block type: its schema's fields minus identity, and only what a save keeps. */
export function editableKeys(blockType: string): Set<string> {
	const schema = (blockRegistry.getSchema(blockType) ?? undefined) as ZodTypeAny | undefined;
	const keys = objectKeys(schema) ?? blockRegistry.getBlockMeta(blockType)?.editableFields ?? [];
	const stored = storedKeys(blockType);
	return new Set(keys.filter((key) => !isLockedKey(key, blockType) && (!stored || stored.has(key))));
}

export function blockName(block: PageBlock): string {
	const type = String(block.blockType ?? "section");
	return blockRegistry.getBlockMeta(type)?.name ?? type;
}

/** A before/after cell: text in full up to 600 chars (the approver must see what is written), structures as their size. */
export function previewValue(value: unknown, max = 600): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value === "string") return value.length > max ? `${value.slice(0, max - 1)}…` : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		const texts = value
			.map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? firstText(item as Record<string, unknown>) : null))
			.filter((text): text is string => Boolean(text));
		const head = texts.slice(0, 3).join(" · ");
		return `${value.length} item${value.length === 1 ? "" : "s"}${head ? `: ${head.length > max ? `${head.slice(0, max - 1)}…` : head}` : ""}`;
	}
	if (typeof value === "object") return firstText(value as Record<string, unknown>) ?? "(settings)";
	return String(value);
}

function firstText(record: Record<string, unknown>): string | null {
	for (const key of ["title", "headline", "label", "name", "question", "quote", "alt", "url"]) {
		if (typeof record[key] === "string" && record[key]) return String(record[key]).slice(0, 80);
	}
	return null;
}

/** How a list row is named on the review card: its first text, else its position. */
export function rowLabel(row: unknown, index: number): string {
	if (row && typeof row === "object" && !Array.isArray(row)) {
		const record = row as Record<string, unknown>;
		const text = firstText(record) ?? ["caption", "text", "value", "description", "answer"].map((key) => record[key]).find((v): v is string => typeof v === "string" && v.trim() !== "");
		if (text) return `“${text.slice(0, 60)}”`;
	} else if (typeof row === "string" && row.trim()) return `“${row.slice(0, 60)}”`;
	return `item ${index + 1}`;
}

/** Absolute http(s) links inside a value, by host — to flag links that leave the site. */
export function linkHosts(value: unknown, into = new Set<string>()): Set<string> {
	if (typeof value === "string") {
		for (const match of value.matchAll(/(?:https?:)?\/\/([^\s/"'<>?#\\]+)/gi)) into.add(match[1]!.toLowerCase());
	} else if (Array.isArray(value)) value.forEach((item) => linkHosts(item, into));
	else if (value && typeof value === "object") Object.values(value).forEach((item) => linkHosts(item, into));
	return into;
}

const rowId = (row: unknown) => (row && typeof row === "object" && !Array.isArray(row) && typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : null);

/**
 * The current pictures win over whatever an AI edit put at the same place.
 * List rows that name their id get that row's pictures (a reordered list keeps
 * each card's picture); rows without an id match by position, as before.
 */
export function carryMedia(next: unknown, previous: unknown): unknown {
	if (Array.isArray(next)) {
		const before = Array.isArray(previous) ? previous : [];
		const byId = new Map(before.flatMap((row) => (rowId(row) ? [[rowId(row)!, row]] : [])));
		return next.map((item, i) => {
			const id = rowId(item);
			// a row id the list doesn't have is a new row: no picture to carry
			if (id && byId.size > 0) return carryMedia(item, byId.get(id));
			return carryMedia(item, before[i]);
		});
	}
	if (!next || typeof next !== "object") return next;
	const before = previous && typeof previous === "object" && !Array.isArray(previous) ? (previous as Record<string, unknown>) : {};
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(next as Record<string, unknown>)) {
		if (MEDIA_KEYS.has(key)) {
			if (key in before) out[key] = before[key];
			continue;
		}
		out[key] = carryMedia(value, before[key]);
	}
	// pictures the AI left out stay too
	for (const key of Object.keys(before)) if (MEDIA_KEYS.has(key) && !(key in out)) out[key] = before[key];
	return out;
}

const URL_KEY = /(url|href|link)$/i;

/**
 * Link values a section may hold: relative paths, anchors, http(s), mailto,
 * tel — the save route's rule for navigation links, for every URL-like field.
 */
export function isSafeLink(value: string): boolean {
	const url = value.trim();
	if (!url) return true;
	// browsers drop tabs/newlines and read "\" as "/", so "/\evil.com" leaves the site: no such characters anywhere
	if (/[\\\s\u0000-\u001f\u007f]/.test(url)) return false;
	if (url.startsWith("#")) return true;
	if (url.startsWith("/")) {
		try {
			// a path must stay on the site it is resolved against
			return !url.startsWith("//") && new URL(url, "https://site.invalid").origin === "https://site.invalid";
		} catch {
			return false;
		}
	}
	if (/^(mailto|tel):/i.test(url)) return true;
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/** URL-like string fields (…url / …href / …link) whose value is not a safe link. */
export function unsafeLinks(value: unknown, key = "", into: string[] = []): string[] {
	if (typeof value === "string") {
		if (URL_KEY.test(key) && !isSafeLink(value)) into.push(value.slice(0, 80));
	} else if (Array.isArray(value)) value.forEach((item) => unsafeLinks(item, key, into));
	else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => unsafeLinks(v, k, into));
	return into;
}

type ZodDef = { typeName?: string; schema?: ZodTypeAny; innerType?: ZodTypeAny; type?: ZodTypeAny };

/** A schema without its optional / default / nullable / effects wrappers. */
function unwrap(schema: ZodTypeAny | null | undefined): ZodTypeAny | null {
	let current = schema ?? null;
	for (let i = 0; i < 8 && current; i++) {
		const def = (current as { _def?: ZodDef })._def;
		if (!def || !["ZodOptional", "ZodDefault", "ZodNullable", "ZodEffects", "ZodCatch", "ZodReadonly"].includes(def.typeName ?? "")) return current;
		current = def.innerType ?? def.schema ?? null;
	}
	return current;
}

/**
 * The schema at a path inside a block type ("features", "categories.0.items",
 * "features.2.title"): list positions step into the row schema. null = unknown.
 */
export function schemaAt(blockType: string, segments: Array<string | number>): ZodTypeAny | null {
	let current: ZodTypeAny | null = typeof segments[0] === "string" ? unwrap(fieldSchema(blockType, segments[0])) : null;
	for (const segment of segments.slice(1)) {
		if (!current) return null;
		const def = (current as { _def?: ZodDef })._def;
		if (def?.typeName === "ZodArray") current = typeof segment === "number" ? unwrap(def.type) : null;
		else if (def?.typeName === "ZodObject" && typeof segment === "string") current = unwrap((current as unknown as { shape: Record<string, ZodTypeAny> }).shape[segment]);
		else return null;
	}
	return current;
}

/** The row schema of a list field (its keys are what a row may hold), or null. */
export function rowSchemaOf(listSchema: ZodTypeAny | null): ZodTypeAny | null {
	const def = (listSchema as { _def?: ZodDef } | null)?._def;
	return def?.typeName === "ZodArray" ? unwrap(def.type) : null;
}

/** The keys of an object schema, or null when it is not an object. */
export function keysOf(schema: ZodTypeAny | null): string[] | null {
	return objectKeys(schema ?? undefined);
}

/** The schema of one field of a block type, to check an edited value on its own. */
export function fieldSchema(blockType: string, key: string): ZodTypeAny | null {
	let current = (blockRegistry.getSchema(blockType) ?? undefined) as ZodTypeAny | undefined;
	for (let i = 0; i < 6 && current; i++) {
		const def = (current as { _def?: { typeName?: string; schema?: ZodTypeAny; innerType?: ZodTypeAny } })._def;
		if (def?.typeName === "ZodObject") return ((current as unknown as { shape: Record<string, ZodTypeAny> }).shape[key] ?? null);
		current = def?.schema ?? def?.innerType;
	}
	return null;
}

/** Ids that survive a save (editor UUIDs, Payload 24-hex) — others are re-assigned, which would break undo. */
export function isStableBlockId(id: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || /^[0-9a-f]{24}$/.test(id);
}

/**
 * The value as a block schema can check it: Payload stores pictures as media
 * ids (the schema expects image objects) and unset optional fields as null,
 * so both are left out of the check — the stored value itself is unchanged.
 */
export function forValidation(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(forValidation);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([key, v]) => v !== null && !MEDIA_KEYS.has(key))
			.map(([key, v]) => [key, forValidation(v)]),
	);
}

export function isMediaKey(key: string): boolean {
	return MEDIA_KEYS.has(key);
}

export function isLockedKey(key: string, blockType?: string): boolean {
	return LOCKED_KEYS.has(key) && !(blockType && UNLOCKED_BY_TYPE[blockType]?.has(key));
}
