import { ATTACHMENT_MAX_BYTES } from "@ech/agent-core";
import type { Env } from "./env";

/** Vercel caps a function's request body at 4.5 MB; stay just under it so we answer 413 ourselves. */
const VERCEL_BODY_LIMIT_BYTES = 4_400_000;
/** 3 MB of file = 4 MB of base64, which leaves room for the JSON around it under the body limit. */
const VERCEL_ATTACHMENT_MAX_BYTES = 3_000_000;
const LOCAL_BODY_LIMIT_BYTES = 16 * 1024 * 1024;
const LOCAL_DB_POOL_MAX = 5;
const VERCEL_DB_POOL_MAX = 3;
/** A busy pool fails a request after this instead of queuing it until the function times out. */
export const DB_CONNECTION_TIMEOUT_MS = 5_000;
/** Idle connections close soon: a frozen serverless instance should not hold pooler slots. */
export const DB_IDLE_TIMEOUT_MS = 10_000;
const LOCAL_RUN_MAX_RUNNING_MS = 600_000;
/** Just above Vercel's 300 s maxDuration: a run not written for longer was killed with its function. */
const VERCEL_RUN_MAX_RUNNING_MS = 330_000;

export function isVercel(env: Pick<Env, "VERCEL">): boolean {
	return Boolean(env.VERCEL);
}

/** Every warm serverless instance opens its own pool, so Vercel gets a small one. */
export function dbPoolMax(env: Pick<Env, "VERCEL" | "AI_PLATFORM_DB_POOL_MAX">): number {
	return env.AI_PLATFORM_DB_POOL_MAX ?? (isVercel(env) ? VERCEL_DB_POOL_MAX : LOCAL_DB_POOL_MAX);
}

/** pg pool settings: small on Vercel, and every wait for a connection is bounded. */
export function pgPoolConfig(env: Pick<Env, "VERCEL" | "AI_PLATFORM_DB_POOL_MAX" | "AI_PLATFORM_DATABASE_URL">) {
	return {
		connectionString: env.AI_PLATFORM_DATABASE_URL,
		max: dbPoolMax(env),
		connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
		idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
	};
}

/** A run `planning` / `running` in the database not written for this long was left by a killed process. */
export function runMaxRunningMs(env: Pick<Env, "VERCEL" | "AI_RUN_MAX_RUNNING_MS">): number {
	return env.AI_RUN_MAX_RUNNING_MS ?? (isVercel(env) ? VERCEL_RUN_MAX_RUNNING_MS : LOCAL_RUN_MAX_RUNNING_MS);
}

/** Fastify body limit of the attachment upload media type (BFF → service). */
export function attachmentBodyLimit(env: Pick<Env, "VERCEL" | "AI_ATTACHMENT_BODY_LIMIT_BYTES">): number {
	return env.AI_ATTACHMENT_BODY_LIMIT_BYTES ?? (isVercel(env) ? VERCEL_BODY_LIMIT_BYTES : LOCAL_BODY_LIMIT_BYTES);
}

/** Largest decoded attachment; never above the contract's own cap. */
export function attachmentMaxBytes(env: Pick<Env, "VERCEL" | "AI_ATTACHMENT_MAX_BYTES">): number {
	const limit = env.AI_ATTACHMENT_MAX_BYTES ?? (isVercel(env) ? VERCEL_ATTACHMENT_MAX_BYTES : ATTACHMENT_MAX_BYTES);
	return Math.min(limit, ATTACHMENT_MAX_BYTES);
}

/** Generated picture format: webp on Vercel unless set — a 1536px png can pass the 4.5 MB body limit as base64. */
export function imageOutputFormat(env: Pick<Env, "VERCEL" | "AI_IMAGE_OUTPUT_FORMAT">): "png" | "jpeg" | "webp" | undefined {
	return env.AI_IMAGE_OUTPUT_FORMAT ?? (isVercel(env) ? "webp" : undefined);
}

/** "3 MB" / "64 KB" for user-facing messages (rounded down, so the text never promises more than is accepted). */
export function formatLimit(bytes: number): string {
	return bytes >= 1_000_000 ? `${Math.floor(bytes / 1_000_000)} MB` : `${Math.floor(bytes / 1024)} KB`;
}
