import "server-only";

import type { getPayload } from "payload";
import { withMediaCreateLock } from "@/lib/ai/media-create-lock";
import { downloadMedia } from "../agent-tools/media-tools";
import { mediaRefId, resolveAllowedMediaOne } from "../media-access";
import { ChangeSetApplyError, type AttachmentLoader } from "./errors";

/**
 * Pictures the copilot places on the site, in a blog post or on a product are Payload `media` rows, and the
 * section stores the row's id (`media:<id>` is what the picture is called everywhere else). Three sources:
 *
 * - `attachment:<id>` the merchant's own upload in the chat (bytes read from ai-platform): a new row;
 * - `pixabay:<id>` a stock photo (downloaded from the Pixabay host allowlist): a new row;
 * - `media:<id>` a picture already in the shop's library: REUSED as it is (no copy), but only when the
 *   workspace may use it (`media-access.ts`: its own row, or a legacy row its pages/products/blogs use).
 *
 * Every new row is written with the workspace as its `tenant`, so it shows in that shop's library and in
 * no other.
 */

export type PictureRef = { ref: string; url?: string; name?: string; credit?: string | null };
export type MediaDoc = { id: number | string; url?: string | null };
type Cms = Awaited<ReturnType<typeof getPayload>>;

const IMAGE_TYPES = new Map([
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
]);
const PIXABAY_LICENSE = { name: "Pixabay Content License", url: "https://pixabay.com/service/license-summary/" };
const PIXABAY_HOSTS = new Set(["pixabay.com", "cdn.pixabay.com"]);

/** True for the ref kinds `ingestPicture` can turn into a media row (`media:` still has to pass the workspace check). */
export function isIngestableRef(ref: string): boolean {
	return /^(attachment|pixabay):[A-Za-z0-9_-]{1,120}$/.test(ref) || mediaRefId(ref) !== null;
}

function pixabayPageUrl(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return PIXABAY_HOSTS.has(new URL(url).hostname) ? url.slice(0, 500) : undefined;
	} catch {
		return undefined;
	}
}

export async function ingestPicture(
	cms: Cms,
	image: PictureRef,
	alt: string,
	loadAttachment: AttachmentLoader | undefined,
	/** the workspace the picture is for: owner of new rows, and the scope `media:<id>` is checked against */
	tenantId: string,
): Promise<MediaDoc> {
	const reuse = mediaRefId(image.ref);
	if (reuse !== null) {
		const own = await resolveAllowedMediaOne(cms, tenantId, reuse);
		if (!own) throw new ChangeSetApplyError("A picture is not in this shop's library. Choose one from the library or upload it.", 422);
		if (!own.mimeType.startsWith("image/")) throw new ChangeSetApplyError("Only pictures can be used here.", 422);
		return { id: Number(own.id), url: own.url };
	}
	let file: { buffer: Buffer; mime: string; name: string };
	let provenance: Record<string, unknown> = {};
	if (/^attachment:/.test(image.ref) && loadAttachment) {
		file = await loadAttachment(image.ref.slice("attachment:".length));
	} else if (/^pixabay:/.test(image.ref) && image.url) {
		const { buffer, mime } = await downloadMedia({ ref: image.ref, url: image.url });
		file = { buffer, mime, name: `${image.ref.replace(":", "-")}` };
		// system-only fields (no field-level write access for users): set here, server side, on purpose.
		// A stock row carries the shop's tenant, so that shop's merchant can delete it; provenance stays system-only.
		provenance = {
			sourceProvider: "pixabay",
			licenseName: PIXABAY_LICENSE.name,
			licenseUrl: PIXABAY_LICENSE.url,
			...(pixabayPageUrl(image.url) ? { sourceUrl: pixabayPageUrl(image.url) } : {}),
			...(image.credit ? { attribution: image.credit.slice(0, 200) } : {}),
		};
	} else {
		throw new ChangeSetApplyError("This picture can't be used here.", 422);
	}
	const extension = IMAGE_TYPES.get(file.mime);
	if (!extension) throw new ChangeSetApplyError("Only JPG, PNG and WebP pictures can be used.", 422);
	const filename = `${file.name.replace(/\.[A-Za-z0-9]{2,5}$/, "")}.${extension}`;
	return createMediaRow(
		cms,
		{ alt: alt.trim().slice(0, 200) || "Picture", aiGenerated: false, tenant: tenantNumber(tenantId), ...provenance },
		{ data: file.buffer, mimetype: file.mime, name: filename, size: file.buffer.length },
	);
}

const tenantNumber = (tenantId: string) => (/^\d+$/.test(tenantId) ? Number(tenantId) : tenantId);

/**
 * One new `media` row through the Local API (access rules skipped: the caller already decided who it is for),
 * read back for its public url. Concurrent creates lose rows (GH-1185), so they run one at a time, and a
 * passing failure is retried once.
 */
export async function createMediaRow(
	cms: Cms,
	data: Record<string, unknown>,
	file: { data: Buffer; mimetype: string; name: string; size: number },
): Promise<MediaDoc> {
	const createArgs = { collection: "media", data, file } as Parameters<Cms["create"]>[0];
	const create = () => withMediaCreateLock(() => cms.create(createArgs));
	let created: { id: number | string };
	try {
		created = (await create()) as { id: number | string };
	} catch (error) {
		console.warn("[ai-agent] media create failed, retrying once:", error instanceof Error ? error.message : error);
		await new Promise((resolve) => setTimeout(resolve, 300));
		created = (await create()) as { id: number | string };
	}
	// read back: the storage plugin fills in the public url after the row is saved
	return (await cms.findByID({ collection: "media", id: created.id, depth: 0 })) as MediaDoc;
}
