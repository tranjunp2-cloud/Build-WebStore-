import {
	type CanActivate,
	createParamDecorator,
	type ExecutionContext,
	Inject,
	Injectable,
	Optional,
	UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { SettingsService } from "../settings/settings.service";
import { type AiRequestContext, ContextTokenError, verifyContextToken } from "./context-token";

type RequestWithContext = FastifyRequest & { aiContext?: AiRequestContext };

@Injectable()
export class ContextGuard implements CanActivate {
	constructor(
		@Inject(ENV) private readonly env: Env,
		// Prime Studio settings: a stale copy is reloaded here (once a minute per instance), not in the background of a frozen function
		@Optional() @Inject(SettingsService) private readonly settings?: SettingsService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<RequestWithContext>();
		const header = request.headers.authorization ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
		if (!token) throw new UnauthorizedException({ title: "Unauthorized", detail: "Missing context token." });
		try {
			request.aiContext = { ...(await verifyContextToken(token, this.env.AI_PLATFORM_CONTEXT_SECRET)), token };
		} catch (error) {
			if (error instanceof ContextTokenError) {
				throw new UnauthorizedException({ title: "Unauthorized", detail: "Invalid context token." });
			}
			throw error;
		}
		await this.settings?.refreshIfStale();
		return true;
	}
}

export const AiContext = createParamDecorator((_: unknown, ctx: ExecutionContext): AiRequestContext => {
	const request = ctx.switchToHttp().getRequest<RequestWithContext>();
	if (!request.aiContext) throw new UnauthorizedException({ title: "Unauthorized", detail: "Missing context." });
	return request.aiContext;
});
