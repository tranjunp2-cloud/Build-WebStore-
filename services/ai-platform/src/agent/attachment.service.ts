import {
	ATTACHMENT_DOCUMENT_TYPES,
	ATTACHMENT_IMAGE_TYPES,
	type AgentAttachment,
	type ChangeSet,
} from "@ech/agent-core";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { attachmentMaxBytes, formatLimit } from "../config/limits";
import { AgentError } from "./agent-errors";
import { toAgentAttachment } from "./agent-run.service";
import { AGENT_STORE, type AgentStore } from "./agent-store";
import { newId } from "./ids";

/** Text kept from one document — what the model may read. */
export const DOCUMENT_TEXT_MAX_CHARS = 200_000;

const IMAGE_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_IMAGE_TYPES);
const DOCUMENT_TYPES: ReadonlySet<string> = new Set(ATTACHMENT_DOCUMENT_TYPES);

/** Upload body from the BFF (it parsed the browser's multipart and read documents to text). */
export const AttachmentUploadSchema = z.object({
	name: z.string().trim().min(1).max(200),
	mime: z.string().min(1).max(100),
	origin: z.enum(["upload", "media", "product", "stock"]),
	ref: z.string().max(200).nullish(),
	credit: z.string().max(200).nullish(),
	/** documents: their text, read by the BFF */
	text: z.string().max(DOCUMENT_TEXT_MAX_CHARS * 2).nullish(),
	dataBase64: z.string().min(4),
});
export type AttachmentUpload = z.infer<typeof AttachmentUploadSchema>;

/** The bytes really are what the type says (no renamed executables). */
function looksLike(mime: string, bytes: Buffer): boolean {
	const head = bytes.subarray(0, 12);
	switch (mime) {
		case "image/jpeg":
			return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
		case "image/png":
			return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
		case "image/webp":
			return head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP";
		case "application/pdf":
			return head.subarray(0, 5).toString("ascii") === "%PDF-";
		case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			return head[0] === 0x50 && head[1] === 0x4b;
		default:
			// CSV: plain text, no NUL bytes in the first KB
			return !bytes.subarray(0, 1024).includes(0);
	}
}

/**
 * Files the merchant gives the assistant: images (JPG/PNG/WebP) usable in
 * drafts, documents (PDF/CSV/XLSX) read for facts. Private to the uploader
 * until sent; then they belong to the chat and go with it (retention).
 */
@Injectable()
export class AttachmentService {
	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		@Inject(ENV) private readonly env: Env,
	) {}

	/** 413 with the limit named, so the BFF can show the merchant what to do. */
	private tooLarge(name: string): AgentError {
		return new AgentError(`${name} is larger than ${formatLimit(attachmentMaxBytes(this.env))}. Choose a smaller file.`, 413);
	}

	async upload(ctx: AiRequestContext, input: AttachmentUpload): Promise<AgentAttachment> {
		const isImage = IMAGE_TYPES.has(input.mime);
		if (!isImage && !DOCUMENT_TYPES.has(input.mime)) {
			throw new AgentError("Only JPG, PNG, WebP, PDF, CSV and XLSX files can be attached.", 400);
		}
		const maxBytes = attachmentMaxBytes(this.env);
		// refuse on the encoded length first: no point decoding a payload that cannot fit
		if (input.dataBase64.length > Math.ceil((maxBytes * 4) / 3) + 8) throw this.tooLarge(input.name);
		const bytes = Buffer.from(input.dataBase64, "base64");
		if (bytes.length === 0) throw new AgentError("The file is empty.", 400);
		if (bytes.length > maxBytes) throw this.tooLarge(input.name);
		if (!looksLike(input.mime, bytes)) throw new AgentError(`${input.name} is not a valid ${input.mime} file.`, 400);
		const record = {
			id: newId("att"),
			kind: isImage ? ("image" as const) : ("document" as const),
			origin: input.origin,
			ref: input.ref ?? null,
			name: input.name,
			mime: input.mime,
			size: bytes.length,
			textContent: isImage ? null : (input.text ?? "").slice(0, DOCUMENT_TEXT_MAX_CHARS),
			credit: input.credit ?? null,
		};
		await this.store.insertAttachment(ctx, { ...record, content: bytes });
		return toAgentAttachment({ ...record, organizationId: ctx.organizationId, userId: ctx.userId, threadId: null, createdAt: new Date() });
	}

	/** The uploader's own file (thumbnails in the composer and the chat). */
	async content(ctx: AiRequestContext, id: string): Promise<{ mime: string; name: string; content: Buffer }> {
		const [owned] = await this.store.getAttachments({ organizationId: ctx.organizationId, userId: ctx.userId }, [id]);
		const found = owned ? await this.store.getAttachmentContent(ctx.organizationId, id) : null;
		if (!found) throw new AgentError("File not found.", 404);
		return { mime: found.record.mime, name: found.record.name, content: found.content };
	}

	/**
	 * A file a staged draft uses — readable by whoever approves it (any member
	 * of the org may approve), but only when the change set references it.
	 */
	async forChangeSet(organizationId: string, changeSet: ChangeSet, id: string): Promise<{ mime: string; name: string; content: Buffer }> {
		const referenced = JSON.stringify(changeSet.action?.payload ?? {}).includes(`"attachment:${id}"`);
		const found = referenced ? await this.store.getAttachmentContent(organizationId, id) : null;
		if (!found) throw new AgentError("File not found.", 404);
		return { mime: found.record.mime, name: found.record.name, content: found.content };
	}
}
