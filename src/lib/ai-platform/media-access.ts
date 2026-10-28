import "server-only";

import type { Payload } from "payload";
import { Pages } from "@/collections/Pages";
import { Sites } from "@/collections/Sites";

/**
 * Which Payload `media` rows a workspace's AI copilot may reuse (`media:<id>` refs, the library listing).
 * One rule, used everywhere a `media:` ref used to be refused:
 *
 * A row is allowed for a workspace when
 *   1. `media.tenant` is that workspace (uploaded by it, or ingested for it by the copilot), OR
 *   2. `media.tenant` is empty (a legacy upload from before the column existed) AND the row is already used by
 *      that workspace: a site's social image, a page block picture, a product image or a blog cover.
 * Everything else is refused: another workspace's file, and an untenanted file nobody here uses (payment QR
 * codes, avatars, other shops' legacy uploads). Reads of the file itself stay public (storefront); this only
 * decides what the copilot may pick for a shop.
 */

type Cms = Pick<Payload, "find">;
type FindArgs = Parameters<Payload["find"]>[0];

export interface MediaLite {
	id: string;
	url: string | null;
	alt: string;
	filename: string;
	mimeType: string;
	width?: number;
	height?: number;
	/** how the workspace owns it: uploaded for it, or a legacy file its pages/products/blogs already use */
	via: "tenant" | "referenced";
	createdAt?: string;
}

const MEDIA_REF = /^media:(\d{1,12})$/;
const REFERENCE_LIMIT = 500;
const MAX_IDS = 200;
/** Upload fields that are not pictures a shop would reuse (payment QR). */
const NEVER_PICTURES = new Set(["merchantQrCode", "halalCertImage"]);

/** `media:<id>` -> the id, or null for any other ref. */
export function mediaRefId(ref: string): string | null {
	return MEDIA_REF.exec(ref)?.[1] ?? null;
}

const asId = (value: string | number) => (/^\d+$/.test(String(value)) ? Number(value) : value);

function relationId(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	if (typeof value === "object") return relationId((value as { id?: unknown }).id);
	return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

let pageUploadKeys: Set<string> | null = null;

/** Names of the upload-to-media fields in Pages (any block, any depth) and Sites, minus payment/certificate ones. */
function uploadKeys(): Set<string> {
	if (pageUploadKeys) return pageUploadKeys;
	const keys = new Set<string>();
	const visit = (fields: readonly unknown[] | undefined) => {
		for (const field of fields ?? []) {
			const f = field as { type?: string; name?: string; relationTo?: unknown; fields?: unknown[]; blocks?: Array<{ fields?: unknown[] }>; tabs?: Array<{ fields?: unknown[] }> };
			if (f.type === "upload" && f.relationTo === "media" && f.name && !NEVER_PICTURES.has(f.name)) keys.add(f.name);
			visit(f.fields);
			for (const block of f.blocks ?? []) visit(block.fields);
			for (const tab of f.tabs ?? []) visit(tab.fields);
		}
	};
	visit(Pages.fields);
	visit(Sites.fields);
	// pictures kept in JSON fields (hero slides…) use the same names
	for (const name of ["image", "backgroundImage", "posterImage", "ogImage", "logo", "avatar"]) keys.add(name);
	pageUploadKeys = keys;
	return keys;
}

/** Every media id stored under an upload field name anywhere in a document (depth 0 ids or populated objects). */
export function collectUploadIds(node: unknown, out: Set<string> = new Set(), keys: Set<string> = uploadKeys(), depth = 0): Set<string> {
	if (node === null || typeof node !== "object" || depth > 12) return out;
	if (Array.isArray(node)) {
		for (const child of node) collectUploadIds(child, out, keys, depth + 1);
		return out;
	}
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (keys.has(key)) {
			const id = relationId(value);
			if (id && /^\d+$/.test(id)) out.add(id);
		}
		if (value && typeof value === "object") collectUploadIds(value, out, keys, depth + 1);
	}
	return out;
}

async function findAll(cms: Cms, args: Record<string, unknown>) {
	return cms.find({ depth: 0, limit: REFERENCE_LIMIT, pagination: false, overrideAccess: true, ...args } as FindArgs);
}

/**
 * Media ids this workspace's sites, pages, products and blogs already use. With `candidates`, only those that
 * are among them (cheaper queries); without, every referenced id (for the library listing).
 */
export async function referencedMediaIds(cms: Cms, tenantId: string, candidates?: readonly string[]): Promise<Set<string>> {
	const tenant = asId(tenantId);
	const wanted = candidates ? new Set(candidates) : null;
	const found = new Set<string>();
	const keep = (ids: Iterable<string>) => {
		for (const id of ids) if (!wanted || wanted.has(id)) found.add(id);
	};
	const inCandidates = candidates ? { in: candidates.map(asId) } : undefined;

	const [sites, blogs, products] = await Promise.all([
		findAll(cms, { collection: "sites", where: { tenant: { equals: tenant } } }),
		findAll(cms, {
			collection: "blogs",
			where: { and: [{ tenant: { equals: tenant } }, inCandidates ? { thumbnail: inCandidates } : { thumbnail: { exists: true } }] },
			select: { thumbnail: true },
		}),
		findAll(cms, {
			collection: "products",
			where: { and: [{ tenant: { equals: tenant } }, inCandidates ? { "images.image": inCandidates } : { "images.image": { exists: true } }] },
			select: { images: true },
		}),
	]);
	for (const blog of blogs.docs as Array<{ thumbnail?: unknown }>) {
		const id = relationId(blog.thumbnail);
		if (id) keep([id]);
	}
	for (const product of products.docs as Array<{ images?: Array<{ image?: unknown }> }>) {
		keep((product.images ?? []).flatMap((row) => relationId(row?.image) ?? []));
	}
	for (const site of sites.docs) keep(collectUploadIds(site));
	const siteIds = sites.docs.map((site) => (site as { id: string | number }).id);
	if (siteIds.length > 0) {
		// the editor draft is the latest version; published-only pages come back as they are
		const pages = await findAll(cms, { collection: "pages", where: { site: { in: siteIds } }, draft: true });
		for (const page of pages.docs) keep(collectUploadIds(page));
	}
	return found;
}

function lite(doc: Record<string, unknown>, via: MediaLite["via"]): MediaLite {
	const text = (value: unknown) => (typeof value === "string" ? value : "");
	return {
		id: String(doc.id),
		url: typeof doc.url === "string" && doc.url ? doc.url : null,
		alt: text(doc.alt),
		filename: text(doc.filename),
		mimeType: text(doc.mimeType),
		...(typeof doc.width === "number" ? { width: doc.width } : {}),
		...(typeof doc.height === "number" ? { height: doc.height } : {}),
		via,
		...(typeof doc.createdAt === "string" ? { createdAt: doc.createdAt } : {}),
	};
}

/**
 * The rows among `ids` that `tenantId` may reuse (see the rule above). Unknown ids, other workspaces' rows and
 * untenanted rows nobody here uses are simply absent from the result.
 */
export async function resolveAllowedMedia(cms: Cms, tenantId: string, ids: readonly (string | number)[]): Promise<Map<string, MediaLite>> {
	const unique = [...new Set(ids.map(String).filter((id) => /^\d{1,12}$/.test(id)))].slice(0, MAX_IDS);
	const allowed = new Map<string, MediaLite>();
	if (unique.length === 0 || !tenantId) return allowed;
	const rows = await cms.find({
		collection: "media",
		where: { id: { in: unique.map(asId) } },
		depth: 0,
		limit: unique.length,
		pagination: false,
		overrideAccess: true,
	} as FindArgs);
	const legacy: Array<Record<string, unknown>> = [];
	for (const doc of rows.docs as Array<Record<string, unknown>>) {
		const owner = relationId(doc.tenant);
		if (owner === String(tenantId)) allowed.set(String(doc.id), lite(doc, "tenant"));
		else if (owner === null) legacy.push(doc);
		// owner is another workspace: refused
	}
	if (legacy.length > 0) {
		const used = await referencedMediaIds(
			cms,
			tenantId,
			legacy.map((doc) => String(doc.id)),
		);
		for (const doc of legacy) if (used.has(String(doc.id))) allowed.set(String(doc.id), lite(doc, "referenced"));
	}
	return allowed;
}

/** One row, if the workspace may reuse it. */
export async function resolveAllowedMediaOne(cms: Cms, tenantId: string, id: string | number): Promise<MediaLite | null> {
	return (await resolveAllowedMedia(cms, tenantId, [id])).get(String(id)) ?? null;
}

/** True for a `media:<id>` ref this workspace may use. Not a `media:` ref -> false. */
export async function isMediaRefAllowed(cms: Cms, tenantId: string, ref: string): Promise<boolean> {
	const id = mediaRefId(ref);
	return id !== null && (await resolveAllowedMediaOne(cms, tenantId, id)) !== null;
}

const escapeLike = (value: string) => value.replace(/[%_\\]/g, " ").trim().slice(0, 80);

/**
 * The shop's picture library as the copilot sees it: exactly the allowed set (rows of the workspace first,
 * then legacy rows its pages/products/blogs already use), images only, newest first, matched on alt text
 * or file name.
 */
export async function listAllowedMedia(cms: Cms, tenantId: string, input: { query?: string; limit?: number } = {}): Promise<MediaLite[]> {
	const limit = Math.min(Math.max(Math.trunc(input.limit ?? 12), 1), 24);
	const query = escapeLike(input.query ?? "");
	const match = query ? [{ or: [{ alt: { like: query } }, { filename: { like: query } }] }] : [];
	const images = { mimeType: { like: "image/" } };
	const owned = await cms.find({
		collection: "media",
		where: { and: [{ tenant: { equals: asId(tenantId) } }, images, ...match] },
		sort: "-createdAt",
		limit,
		depth: 0,
		overrideAccess: true,
	} as FindArgs);
	const rows = (owned.docs as Array<Record<string, unknown>>).map((doc) => lite(doc, "tenant"));
	if (rows.length >= limit) return rows;
	const used = [...(await referencedMediaIds(cms, tenantId))].filter((id) => !rows.some((row) => row.id === id)).slice(0, MAX_IDS);
	if (used.length === 0) return rows;
	const legacy = await cms.find({
		collection: "media",
		where: { and: [{ id: { in: used.map(asId) } }, { tenant: { exists: false } }, images, ...match] },
		sort: "-createdAt",
		limit: limit - rows.length,
		depth: 0,
		overrideAccess: true,
	} as FindArgs);
	return [...rows, ...(legacy.docs as Array<Record<string, unknown>>).map((doc) => lite(doc, "referenced"))];
}
