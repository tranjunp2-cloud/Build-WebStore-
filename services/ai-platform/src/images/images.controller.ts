import { Body, Controller, HttpException, Post, UseGuards } from "@nestjs/common";
import { AgentError } from "../agent/agent-errors";
import { AiContext, ContextGuard } from "../auth/context.guard";
import type { AiRequestContext } from "../auth/context-token";
import { ImageService } from "./image.service";

/** `POST /v1/images` — generated pictures as base64; the caller stores them (DAM). */
@Controller("v1/images")
@UseGuards(ContextGuard)
export class ImagesController {
	constructor(private readonly images: ImageService) {}

	@Post()
	async generate(@AiContext() ctx: AiRequestContext, @Body() body: unknown) {
		try {
			return { images: await this.images.generate(ctx, (body ?? {}) as never) };
		} catch (error) {
			if (error instanceof AgentError) {
				throw new HttpException({ title: "Picture failed", status: error.status, detail: error.message }, error.status);
			}
			throw error;
		}
	}
}
