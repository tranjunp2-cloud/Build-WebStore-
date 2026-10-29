import { timingSafeEqual } from "node:crypto";
import { Controller, Get, HttpCode, HttpException, Inject, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { ThreadRetentionService } from "./thread-retention.service";

function problem(status: number, title: string, detail: string): HttpException {
	return new HttpException({ title, status, detail }, status);
}

function sameSecret(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduled jobs for deployments without a long-lived process (Vercel Cron).
 * Vercel calls these with GET and `Authorization: Bearer $CRON_SECRET`; POST is
 * accepted for manual runs. With no CRON_SECRET configured every call is refused.
 */
@Controller("internal/cron")
export class InternalCronController {
	constructor(
		@Inject(ENV) private readonly env: Env,
		private readonly retention: ThreadRetentionService,
	) {}

	private authorize(request: FastifyRequest): void {
		const secret = this.env.CRON_SECRET;
		if (!secret) throw problem(401, "Unauthorized", "Cron is not configured: set CRON_SECRET.");
		const header = request.headers.authorization ?? "";
		const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
		if (!given || !sameSecret(given, secret)) throw problem(401, "Unauthorized", "Invalid cron secret.");
	}

	@Get("thread-retention")
	threadRetentionCron(@Req() request: FastifyRequest) {
		return this.threadRetention(request);
	}

	@Post("thread-retention")
	@HttpCode(200)
	async threadRetention(@Req() request: FastifyRequest) {
		this.authorize(request);
		const counts = await this.retention.sweep();
		// sweep() logs and swallows its own failure; surface it so the cron run shows as failed
		if (!counts) throw problem(500, "Sweep failed", "The retention sweep failed; see the function logs.");
		return { ok: true, ...counts };
	}
}
