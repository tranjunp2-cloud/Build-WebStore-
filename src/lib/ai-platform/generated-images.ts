import "server-only";

import config from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload, type Payload } from "payload";
import sharp from "sharp";
import { z } from "zod";
import { agentRateLimited } from "./agent-rate-limits";
import { createMediaRow } from "./appliers/picture-ingest";
import type { AgentActor } from "./context";
import { AiPlatformError, aiPlatformJson } from "./upstream";

/**
 * Generated pictures. The AI platform draws (daily limit, usage ledger) and answers with base64 bytes; this app
 * keeps them as Payload `media` rows owned by the asking workspace (`tenant`, `aiGenerated: true`, `aiPrompt`),
 * so the shop's library, products, blog posts and the copilot reuse them as `media:<id>`.
 *
 * Size: ai-platform runs on Vercel, where a request or response body is capped at 4.5 MB, so it sends WebP and
 * one picture per call. Both entry points here (the facade's `media.save_generated` and the BFF's
 * `POST /api/agent/media/generate`) stay under that: one picture per call, base64 capped below the limit.
 */

export interface GeneratedPicture {
	mediaType: string;
	/** base64 */
	data: string;
	revisedPrompt?: string;
}

/** What the copilot's `generate_image` tool gets back (ai-platform `SavedPictureSchema`). */
export interface SavedPicture {
	assetId: string;
	ref: string;
	url: string;
	name: string;
}

/** Base64 characters (not bytes) a picture may take in a request body: under Vercel's 4.5 MB with the prompt around it. */
export const GENERATED_DATA_MAX_CHARS = 4_400_000;
const FORMATS = new Set(["webp", "png", "jpeg"]);

export class GeneratedPictureError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 413 | 422,
	) {
		super(message);
		this.name = "GeneratedPictureError";
	}
}

export const GeneratedPictureSchema = z.object({
	mediaType: z.string().max(60),
	data: z.string().min(1).max(GENERATED_DATA_MAX_CHARS),
	revisedPrompt: z.string().max(2000).optional(),
});

/** A short, readable title from the prompt ("Indigo batik scarf on a linen table"). */
export function pictureTitle(prompt: string): string {
	const first = prompt.replace(/\s+/g, " ").trim().split(/[.;\n]/)[0] ?? "";
	const title = first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first;
	return title || "Generated picture";
}

const fileStem = (title: string) => title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "generated";

/** WebP bytes of a drawn picture: what arrived is checked by its content (not the claimed type); PNG/JPEG are converted. */
async function toWebp(picture: GeneratedPicture): Promise<Buffer> {
	if (picture.data.length > GENERATED_DATA_MAX_CHARS) throw new GeneratedPictureError("The generated picture is too large to keep.", 413);
	const raw = Buffer.from(picture.data, "base64");
	if (raw.length === 0) throw new GeneratedPictureError("The generated picture is empty.", 422);
	try {
		const meta = await sharp(raw).metadata();
		if (!meta.format || !FORMATS.has(meta.format)) throw new Error("not a supported picture");
		// already WebP (the Vercel setting): keep the bytes as they came
		if (meta.format === "webp") return raw;
		return await sharp(raw).rotate().webp({ quality: 86 }).toBuffer();
	} catch {
		throw new GeneratedPictureError("The generated picture could not be read.", 422);
	}
}

/** Keeps one drawn picture in the workspace's media library and says how to refer to it. */
export async function saveGeneratedPicture(cms: Payload, actor: Pick<AgentActor, "tenantId">, picture: GeneratedPicture, prompt: string): Promise<SavedPicture> {
	const data = await toWebp(picture);
	const title = pictureTitle(prompt);
	const media = await createMediaRow(
		cms,
		{
			alt: title,
			aiGenerated: true,
			aiPrompt: prompt.replace(/\s+/g, " ").trim().slice(0, 1000),
			// system-only provenance (no field-level write access for users): set here, server side
			sourceProvider: "ai",
			tenant: /^\d+$/.test(actor.tenantId) ? Number(actor.tenantId) : actor.tenantId,
		},
		{ data, mimetype: "image/webp", name: `${fileStem(title)}.webp`, size: data.length },
	);
	return { assetId: String(media.id), ref: `media:${media.id}`, url: media.url ?? "", name: title };
}

const GenerateSchema = z.object({
	prompt: z.string().trim().min(3).max(1000),
	aspect: z.enum(["square", "landscape", "portrait"]).default("square"),
});

function problem(status: number, detail: string): NextResponse {
	return NextResponse.json({ title: "Picture failed", status, detail }, { status, headers: { "cache-control": "private, no-store" } });
}

/** What the merchant is told when the platform in front of ai-platform answered without a message (timeout, size). */
function platformFailure(error: AiPlatformError): AiPlatformError {
	// ai-platform's own refusals ("Your workspace reached today's picture limit…") carry their message: pass them on
	if (!error.message.startsWith("AI platform ")) return error;
	if (error.status === 504 || error.status === 408) return new AiPlatformError("The picture took too long. Try again.", 504);
	if (error.status === 413) return new AiPlatformError("The picture is too large to keep. Try again.", 413);
	return new AiPlatformError("The picture could not be generated. Try again in a moment.", error.status >= 500 ? 502 : error.status);
}

/**
 * `POST /api/agent/media/generate` — "Generate" from any surface: draw one picture, keep it in the shop's
 * library, answer with its `media:<id>` ref. Limits and quota errors from ai-platform reach the merchant as written.
 */
export async function generatePictures(req: Request, actor: AgentActor, token: string): Promise<Response> {
	const parsed = GenerateSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return problem(400, "Describe the picture in a few words.");
	// each picture is a paid model call: 10 per user per hour here, before ai-platform's daily workspace quota
	const limited = await agentRateLimited("picture", actor);
	if (limited) return limited;
	let drawn: GeneratedPicture | undefined;
	try {
		// one picture per call: two base64 pictures would not fit ai-platform's 4.5 MB response on Vercel
		const { images } = await aiPlatformJson<{ images?: GeneratedPicture[] }>({
			method: "POST",
			path: "/v1/images",
			token,
			body: JSON.stringify({ ...parsed.data, count: 1 }),
			signal: AbortSignal.timeout(180_000),
		});
		drawn = images?.[0];
	} catch (error) {
		throw error instanceof AiPlatformError ? platformFailure(error) : error;
	}
	if (!drawn) return problem(502, "The picture could not be generated. Try again in a moment.");
	try {
		const saved = await saveGeneratedPicture(await getPayload({ config }), actor, drawn, parsed.data.prompt);
		return NextResponse.json(
			{ assets: [{ id: saved.assetId, ref: saved.ref, url: saved.url, name: saved.name }] },
			{ headers: { "cache-control": "private, no-store" } },
		);
	} catch (error) {
		if (error instanceof GeneratedPictureError) return problem(error.status, error.message);
		throw error;
	}
}
