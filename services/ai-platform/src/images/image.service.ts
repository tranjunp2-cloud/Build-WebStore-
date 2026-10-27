import { picturesPerDay } from "../cost/shop-limits";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateImage } from "ai";
import { z } from "zod";
import { AgentError } from "../agent/agent-errors";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { imageOutputFormat } from "../config/limits";
import { USAGE_LEDGER, type UsageLedger } from "../ledger/usage-ledger";
import { MODEL_REGISTRY } from "../models/models.module";
import type { ModelRegistry } from "../models/model-registry";
import { IMAGE_TASK, PICTURE_QUOTA, type PictureQuota } from "./picture-quota";

export { IMAGE_TASK };

export const ImageRequestSchema = z.object({
	prompt: z.string().trim().min(3).max(1_000),
	aspect: z.enum(["square", "landscape", "portrait"]).default("square"),
	count: z.number().int().min(1).max(2).default(1),
});
export type ImageRequest = z.input<typeof ImageRequestSchema>;

export interface GeneratedImage {
	mediaType: string;
	/** base64 bytes */
	data: string;
	/** what the model actually drew, when it rewrote the prompt */
	revisedPrompt?: string;
}

const SIZES = { square: "1024x1024", landscape: "1536x1024", portrait: "1024x1536" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Failures before the request left (no connection, bad arguments): nothing can have been billed. */
const NOT_SENT_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);
const NOT_SENT_NAMES = new Set(["AI_InvalidArgumentError", "AI_UnsupportedFunctionalityError"]);
export function neverReachedProvider(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
		const { code, name, cause } = current as { code?: unknown; name?: unknown; cause?: unknown };
		if ((typeof code === "string" && NOT_SENT_CODES.has(code)) || (typeof name === "string" && NOT_SENT_NAMES.has(name))) return true;
		current = cause;
	}
	return false;
}

/**
 * Picture generation for every surface (DAM "Generate", the copilot): one
 * quota per organization counted in pictures, one ledger row per picture.
 * The pictures are reserved before the provider is called (parallel requests
 * cannot pass the cap); a failure gives them back only when no provider was
 * reached. Returns bytes; where they are kept (the DAM) is the caller's business.
 */
@Injectable()
export class ImageService {
	private readonly logger = new Logger(ImageService.name);

	constructor(
		@Inject(MODEL_REGISTRY) private readonly models: ModelRegistry,
		@Inject(USAGE_LEDGER) private readonly ledger: UsageLedger,
		@Inject(ENV) private readonly env: Env,
		@Inject(PICTURE_QUOTA) private readonly quota: PictureQuota,
	) {}

	get available(): boolean {
		return (this.models.resolveImageChain?.() ?? []).length > 0;
	}

	async generate(
		ctx: AiRequestContext,
		request: ImageRequest,
		options: { surface?: "merchant" | "system"; runId?: string; now?: Date } = {},
	): Promise<GeneratedImage[]> {
		const parsed = ImageRequestSchema.safeParse(request);
		if (!parsed.success) throw new AgentError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400);
		const input = parsed.data;
		const chain = this.models.resolveImageChain?.() ?? [];
		if (chain.length === 0) throw new AgentError("Picture generation is not set up in this environment.", 503);

		const now = options.now ?? new Date();
		const reservation = await this.quota.reserve(ctx, { pictures: input.count, since: new Date(now.getTime() - DAY_MS), now }, (used) => {
			const limit = picturesPerDay(ctx, this.env);
			if (limit === null) return; // the plan has no picture cap
			const left = limit - used;
			if (left >= input.count) return;
			throw new AgentError(
				left > 0 ? `Only ${left} more picture${left === 1 ? "" : "s"} can be generated today.` : "Your workspace reached today's picture limit. Try again tomorrow.",
				429,
			);
		});

		const format = imageOutputFormat(this.env);
		let lastError: unknown;
		let reached = false;
		for (const candidate of chain) {
			const started = Date.now();
			try {
				const result = await generateImage({
					model: candidate.model,
					prompt: input.prompt,
					n: input.count,
					size: SIZES[input.aspect],
					abortSignal: AbortSignal.timeout(this.env.AI_IMAGE_TIMEOUT_MS),
					maxRetries: 0,
					providerOptions: { openai: { quality: "medium", ...(format ? { outputFormat: format, ...(format === "png" ? {} : { outputCompression: 85 }) } : {}) } },
				});
				const revised = result.providerMetadata?.[candidate.provider]?.images as Array<{ revisedPrompt?: string } | null> | undefined;
				const images = result.images.slice(0, input.count).map((image, index) => ({
					mediaType: image.mediaType || (format ? `image/${format}` : "image/png"),
					data: image.base64,
					...(revised?.[index]?.revisedPrompt ? { revisedPrompt: revised[index]?.revisedPrompt } : {}),
				}));
				for (const _ of images) await this.record(ctx, options, candidate, Date.now() - started, "ok");
				return images;
			} catch (error) {
				lastError = error;
				if (!neverReachedProvider(error)) reached = true;
				await this.record(ctx, options, candidate, Date.now() - started, "error", error instanceof Error ? error.name : "unknown");
				this.logger.warn(`image ${candidate.provider}:${candidate.modelId} failed: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`);
			}
		}
		// the provider may bill for a call it saw (even a timed-out one): only an unsent request gives the pictures back
		if (!reached) {
			await this.quota.release(ctx.organizationId, reservation).catch((error: unknown) => {
				this.logger.warn(`picture reservation release failed: ${error instanceof Error ? error.message : String(error)}`);
			});
		}
		const timedOut = lastError instanceof Error && /abort|timeout/i.test(`${lastError.name} ${lastError.message}`);
		throw new AgentError(timedOut ? "The picture took too long. Try again." : "The picture could not be generated. Try other words.", timedOut ? 504 : 503);
	}

	private record(
		ctx: AiRequestContext,
		options: { surface?: "merchant" | "system"; runId?: string },
		candidate: { provider: string; modelId: string },
		latencyMs: number,
		outcome: "ok" | "error",
		errorCode?: string,
	) {
		return this.ledger.record({
			organizationId: ctx.organizationId,
			userId: ctx.userId,
			surface: options.surface ?? "merchant",
			task: IMAGE_TASK,
			...(options.runId ? { runId: options.runId } : {}),
			provider: candidate.provider,
			model: candidate.modelId,
			images: outcome === "ok" ? 1 : 0,
			latencyMs,
			outcome,
			...(errorCode ? { errorCode } : {}),
		});
	}
}
