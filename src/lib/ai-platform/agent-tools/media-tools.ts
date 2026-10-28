import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { FetchGuardError, fetchAllowlisted, readBodyCapped } from "@/lib/ai/fetch-capped";
import { downloadPhotoBuffer, hasPixabayKey, searchPhotos } from "@/lib/ai/pixabay-client";
import { s3PublicUrl } from "@/lib/media/s3-public-url";
import { listAllowedMedia, type MediaLite } from "../media-access";
import { listProductPhotos } from "./product-photos";

/**
 * Pictures the copilot may use: stock photos (Pixabay) and the shop's own Payload `media` library. The library
 * is exactly the set `media-access.ts` allows for the workspace (its own rows, plus legacy rows its pages,
 * products and blogs already use), never the whole collection. Product photos are the pictures the workspace's
 * own products use, labelled with the product name (`product-photos.ts`).
 */

export type MediaSource = "stock" | "media" | "product";

export class StockPhotosUnavailableError extends Error {
	constructor() {
		super("Stock photos (Pixabay) are not set up for this environment.");
	}
}

/** A source this deployment does not serve (library / product photos). */
export class MediaSourceUnavailableError extends Error {
	constructor(source: string) {
		super(`The ${source} picture source is not available here yet. Use stock photos or the merchant's attachments.`);
	}
}

export interface MediaItem {
	/** what the applier resolves: pixabay:<id> */
	ref: string;
	name: string;
	url: string;
	credit?: string;
	width?: number;
	height?: number;
}

const MAX = 24;

/** A library row as the chat shows it: `media:<id>` is what the appliers resolve (and re-check) later. */
function libraryItem(row: MediaLite): MediaItem {
	return {
		ref: `media:${row.id}`,
		name: (row.alt || row.filename || "Picture").replace(/\s+/g, " ").trim().slice(0, 120),
		url: row.url ?? "",
		...(row.width ? { width: row.width } : {}),
		...(row.height ? { height: row.height } : {}),
	};
}

/** `tenantId`: the workspace asking. Required for the library, which is scoped to it. */
export async function searchMedia(input: { source: MediaSource; query?: string; limit?: number }, tenantId?: string): Promise<MediaItem[]> {
	const limit = Math.min(Math.max(input.limit ?? 12, 1), MAX);
	if (input.source === "media") {
		if (!tenantId) throw new MediaSourceUnavailableError(input.source);
		const rows = await listAllowedMedia(await getPayload({ config }), tenantId, { query: input.query, limit });
		return rows.filter((row) => row.url).map(libraryItem);
	}
	if (input.source === "product") {
		if (!tenantId) throw new MediaSourceUnavailableError(input.source);
		const photos = await listProductPhotos(await getPayload({ config }), tenantId, { query: input.query, limit });
		return photos.map((photo) => ({ ...libraryItem(photo), name: photo.productName.replace(/\s+/g, " ").trim().slice(0, 120) }));
	}
	if (input.source !== "stock") throw new MediaSourceUnavailableError(input.source);
	const query = input.query?.trim().slice(0, 80) ?? "";
	// no key = not set up, not "nothing found": callers say so instead of an empty grid
	if (!hasPixabayKey()) throw new StockPhotosUnavailableError();
	if (!query) return [];
	const photos = await searchPhotos(query, limit);
	return photos.map((photo) => ({
		ref: `pixabay:${photo.id}`,
		name: (photo.alt ?? query).split(",").slice(0, 3).join(", "),
		url: photo.url,
		credit: `Pixabay · ${photo.photographer}`,
		width: photo.width,
		height: photo.height,
	}));
}

/** Pauses between stock download attempts: the stock CDN sometimes stalls or drops one request. */
export const STOCK_RETRY_DELAYS_MS = [400, 1200];

/** A stock download that failed for a passing reason (timeout, network, 5xx) is tried again. */
export async function withStockRetry<T>(download: () => Promise<T>, delays: readonly number[] = STOCK_RETRY_DELAYS_MS): Promise<T> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await download();
		} catch (error) {
			// PixabayError marks timeouts, network failures and 5xx as retryable
			const passing = error instanceof Error && (error as { retryable?: unknown }).retryable === true;
			if (!passing || attempt >= delays.length) throw error;
			await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
		}
	}
}

/**
 * Bytes of a picked stock photo (for the model to see it and for drafts). Only `pixabay:` refs: the
 * download is host-allowlisted by the stock client, so no other address is ever fetched here.
 */
export async function downloadMedia(item: { ref: string; url: string }): Promise<{ buffer: Buffer; mime: string }> {
	if (!item.ref.startsWith("pixabay:")) throw new Error("Unsupported picture reference.");
	const { buffer, mimetype } = await withStockRetry(() => downloadPhotoBuffer(item.url));
	return { buffer, mime: mimetype };
}

const LIBRARY_BYTES_MAX = 8_000_000;

/**
 * Bytes of a library picture (the attach menu turns a pick into an attachment). The row was already checked
 * for the workspace; the address is the row's own file URL, and only this app's origin or the configured
 * media storage host is ever fetched, so a stored URL can't point this at anything else.
 */
export async function downloadLibraryPicture(media: Pick<MediaLite, "url">, origin: string): Promise<{ buffer: Buffer; mime: string }> {
	if (!media.url) throw new Error("The picture has no file.");
	const target = new URL(media.url, origin);
	const storage = process.env.S3_BUCKET && (process.env.NEXT_PUBLIC_S3_ENDPOINT || process.env.S3_ENDPOINT) ? new URL(s3PublicUrl("x")).host : null;
	const hosts = new Set([new URL(origin).host, ...(storage ? [storage] : [])]);
	const allowed = (url: URL) => (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:")) && !url.username && !url.password && hosts.has(url.host);
	if (!allowed(target)) throw new Error("The picture is stored somewhere this can't read.");
	let buffer: Buffer;
	let mime: string;
	try {
		// `/api/media/file/<name>` may 302 to the storage host: followed (2 hops at most) only to an allowed host
		const response = await fetchAllowlisted(target, { signal: AbortSignal.timeout(15_000) }, allowed);
		if (!response.ok) {
			await response.body?.cancel().catch(() => undefined);
			throw new Error(`The picture could not be read (${response.status}).`);
		}
		mime = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
		buffer = Buffer.from(await readBodyCapped(response, LIBRARY_BYTES_MAX));
	} catch (error) {
		if (error instanceof FetchGuardError) throw new Error(error.code === "TOO_LARGE" ? "The picture is too large." : "The picture is stored somewhere this can't read.");
		throw error;
	}
	if (buffer.length === 0) throw new Error("The picture is empty or too large.");
	return { buffer, mime };
}
