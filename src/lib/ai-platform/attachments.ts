import "server-only";

import {
	ATTACHMENT_DOCUMENT_TYPES,
	ATTACHMENT_IMAGE_TYPES,
	type AgentAttachment,
	AgentAttachmentSchema,
} from "@ech/agent-core";
import { NextResponse } from "next/server";
import { z } from "zod";
import config from "@payload-config";
import { getPayload } from "payload";
import { downloadLibraryPicture, downloadMedia, MediaSourceUnavailableError, type MediaSource, searchMedia, StockPhotosUnavailableError } from "./agent-tools/media-tools";
import { DocumentReadTimeoutError, readDocumentText } from "./agent-tools/read-document";
import type { AgentActor } from "./context";
import { mediaRefId, resolveAllowedMediaOne } from "./media-access";
import { AiPlatformError, aiPlatformJson, callAiPlatform } from "./upstream";

/** Upload media type ai-platform parses with its larger body limit. */
const ATTACHMENT_CONTENT_TYPE = "application/vnd.ech.attachment+json";
/**
 * ai-platform runs as a Vercel function, which caps a request body at 4.5 MB: it refuses a file
 * above 3 MB (decoded) and a body above 4.4 MB (the file in base64 + its text + the JSON around
 * it). Same numbers as its `limits.ts` Vercel defaults; refusing here gives the merchant the answer
 * without sending megabytes first.
 */
export const ATTACHMENT_FILE_MAX_BYTES = 3_000_000;
export const ATTACHMENT_BODY_MAX_BYTES = 4_400_000;
const FILE_TOO_LARGE = (name: string) => `${name} is larger than 3 MB. Choose a smaller file.`;
const ACCEPTED: ReadonlySet<string> = new Set([...ATTACHMENT_IMAGE_TYPES, ...ATTACHMENT_DOCUMENT_TYPES]);

function problem(status: number, detail: string) {
	return NextResponse.json({ title: "Attachment refused", status, detail }, { status });
}


/** CSV often arrives as text/plain or application/vnd.ms-excel from browsers. */
function normaliseMime(file: File): string {
	const type = file.type.toLowerCase();
	if (/\.csv$/i.test(file.name) && (type === "" || type === "text/plain" || type === "application/vnd.ms-excel")) return "text/csv";
	if (/\.xlsx$/i.test(file.name) && type === "") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
	return type;
}

async function store(
	token: string,
	input: { name: string; mime: string; buffer: Buffer; origin: AgentAttachment["origin"]; ref?: string; credit?: string; text?: string },
): Promise<AgentAttachment> {
	if (input.buffer.length > ATTACHMENT_FILE_MAX_BYTES) throw new AiPlatformError(FILE_TOO_LARGE(input.name), 413);
	const body = JSON.stringify({
		name: input.name,
		mime: input.mime,
		origin: input.origin,
		ref: input.ref ?? null,
		credit: input.credit ?? null,
		text: input.text ?? null,
		dataBase64: input.buffer.toString("base64"),
	});
	if (Buffer.byteLength(body) > ATTACHMENT_BODY_MAX_BYTES) {
		throw new AiPlatformError(`${input.name} is too large to attach together with its text. Choose a smaller file.`, 413);
	}
	try {
		return AgentAttachmentSchema.parse(
			// a few MB of base64 upload: more room than the 10 s JSON default
			await aiPlatformJson<unknown>({ method: "POST", path: "/agent/attachments", token, contentType: ATTACHMENT_CONTENT_TYPE, body, timeoutMs: 30_000 }),
		);
	} catch (error) {
		// ai-platform's own refusal ({ title, status, detail }: 413 too large, 400 type) reaches the merchant
		// with its message. A 413 from the platform in front of it (Vercel) carries no detail: say what it means.
		if (error instanceof AiPlatformError && error.status === 413 && error.message.startsWith("AI platform ")) {
			throw new AiPlatformError(`${input.name} is too large to attach. Choose a smaller file.`, 413);
		}
		throw error;
	}
}

/** Browser upload (multipart): type/size checked, documents read to text here, bytes stored by ai-platform. */
export async function uploadAttachment(req: Request, token: string): Promise<Response> {
	const form = await req.formData().catch(() => null);
	const file = form?.get("file");
	if (!(file instanceof File)) return problem(400, "Attach one file.");
	const mime = normaliseMime(file);
	if (!ACCEPTED.has(mime)) return problem(400, `${file.name}: only JPG, PNG, WebP, PDF, CSV and XLSX files can be attached.`);
	if (file.size > ATTACHMENT_FILE_MAX_BYTES) return problem(413, FILE_TOO_LARGE(file.name));
	const buffer = Buffer.from(await file.arrayBuffer());
	let text: string | undefined;
	if (!mime.startsWith("image/")) {
		try {
			text = await readDocumentText(buffer, mime);
		} catch (error) {
			if (error instanceof DocumentReadTimeoutError) return problem(400, `${file.name} took too long to read. Try a shorter or simpler file.`);
			return problem(400, `${file.name} could not be read. Try a PDF, CSV or XLSX that opens normally.`);
		}
		if (!text.trim()) return problem(400, `${file.name} has no readable text (a scanned PDF?). Attach a photo of it instead.`);
	}
	return NextResponse.json(await store(token, { name: file.name.slice(0, 200), mime, buffer, origin: "upload", text }), {
		status: 201,
	});
}

const PickSchema = z.object({
	origin: z.enum(["media", "product", "stock"]),
	ref: z.string().min(1).max(200),
	url: z.string().url().max(2000).optional(),
	name: z.string().max(200).optional(),
	credit: z.string().max(200).optional(),
});

/**
 * A picture picked from the attach menu's grid becomes an attachment like an upload.
 * - stock: only `pixabay:` refs; the download is host-allowlisted to Pixabay, so a browser-supplied URL can't make
 *   this fetch anything else;
 * - library and product photos: only `media:<id>` of a row this workspace may use (media-access.ts); the
 *   browser-supplied URL is ignored, the bytes are read from the row's own file.
 */
export async function pickAttachment(req: Request, actor: AgentActor, token: string): Promise<Response> {
	const parsed = PickSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return problem(400, "Pick a picture.");
	const pick = parsed.data;
	const name = pick.name ?? "Photo";
	let downloaded: { buffer: Buffer; mime: string };
	let ref = pick.ref;
	if (pick.origin === "stock" && pick.ref.startsWith("pixabay:") && pick.url) {
		try {
			downloaded = await downloadMedia({ ref: pick.ref, url: pick.url });
		} catch {
			return problem(502, "The picture could not be downloaded. Try another one.");
		}
	} else if ((pick.origin === "media" || pick.origin === "product") && mediaRefId(pick.ref) !== null) {
		// a product's photo is a library row too: same workspace rule, bytes from the row's own file
		const row = await resolveAllowedMediaOne(await getPayload({ config }), actor.tenantId, mediaRefId(pick.ref) as string);
		if (!row) return problem(403, "This picture is not in your library.");
		ref = `media:${row.id}`;
		try {
			downloaded = await downloadLibraryPicture(row, new URL(req.url).origin);
		} catch {
			return problem(502, "The picture could not be read. Try another one.");
		}
	} else {
		return problem(400, "This picture can't be used.");
	}
	const mime = ATTACHMENT_IMAGE_TYPES.find((type) => type === downloaded.mime) ?? null;
	if (!mime) return problem(400, "Only JPG, PNG and WebP pictures can be used.");
	return NextResponse.json(
		await store(token, {
			name: `${name}`.slice(0, 200),
			mime,
			buffer: downloaded.buffer,
			origin: pick.origin,
			ref,
			credit: pick.credit,
		}),
		{ status: 201 },
	);
}

/** The attach menu's picture grid: stock photos (Pixabay), the shop's library and photos of its products. */
export async function listMedia(req: Request, actor: AgentActor): Promise<Response> {
	const params = new URL(req.url).searchParams;
	const source = (params.get("source") ?? "stock") as MediaSource;
	if (!["media", "product", "stock"].includes(source)) return problem(400, "Unknown source.");
	let items: Awaited<ReturnType<typeof searchMedia>>;
	try {
		items = await searchMedia({ source, query: params.get("q") ?? "", limit: Number(params.get("limit")) || 24 }, actor.tenantId);
	} catch (error) {
		if (error instanceof StockPhotosUnavailableError) return problem(503, error.message);
		if (error instanceof MediaSourceUnavailableError) return problem(501, error.message);
		throw error;
	}
	const rows: AgentAttachment[] = items.map((item) => ({
		id: item.ref.slice(0, 80),
		kind: "image",
		origin: source,
		name: item.name.slice(0, 200) || "Photo",
		mime: "image/jpeg",
		size: 0,
		url: item.url,
		...(item.credit ? { credit: item.credit } : {}),
	}));
	return NextResponse.json(rows, { headers: { "cache-control": "private, max-age=60" } });
}

/** Bytes of a file an approved draft uses — read by the applier with the approver's token. */
export async function loadChangeSetAttachment(
	token: string,
	changeSetId: string,
	attachmentId: string,
): Promise<{ buffer: Buffer; mime: string; name: string }> {
	const response = await callAiPlatform({
		method: "GET",
		path: `/agent/change-sets/${encodeURIComponent(changeSetId)}/attachments/${encodeURIComponent(attachmentId)}`,
		token,
		accept: "*/*",
		// the bytes are read inside the same limit
		timeoutMs: 30_000,
	});
	if (!response.ok) throw new AiPlatformError("An attached file is no longer available.", response.status);
	const mime = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0] ?? "";
	const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
	return { buffer: Buffer.from(await response.arrayBuffer()), mime, name: `${attachmentId}.${extension}` };
}
