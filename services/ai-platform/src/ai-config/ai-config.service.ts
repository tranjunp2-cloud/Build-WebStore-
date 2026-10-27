import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { SignJWT } from "jose";
import { z } from "zod";
import { ENV } from "../config/config.module";
import { type Env, ModelRefSchema } from "../config/env";
import { isDeepSeekPeak, type Price, setPriceOverrides } from "../ledger/price-book";
import type { ModelAlias } from "../models/model-registry";

/**
 * Runtime AI configuration owned by prime-web (Payload): price table, picture prices and model chains.
 * Pulled from `GET {PRIME_WEB_INTERNAL_URL}/api/internal/ai-config` at boot, every 5 minutes (a timer where the
 * process lives, else lazily on use once the copy is stale). It is never on the request path: reads return the
 * last good copy at once, a failed or invalid fetch keeps it, and with no URL or no copy yet the built-in price
 * table and the AI_MODEL_* env chains apply — exactly the behaviour without prime-web.
 */

export const AI_CONFIG_TOKEN_ISSUER = "ai-platform";
export const AI_CONFIG_TOKEN_AUDIENCE = "prime-web:internal";
export const AI_CONFIG_TOKEN_SUBJECT = "ai-config";
export const REFRESH_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 5_000;

const MODEL_KEY = /^[a-z0-9-]+:\S+$/;
const Rate = z.number().finite().min(0);

const LongContextSchema = z.object({ aboveInputTokens: z.number().int().min(1), input: Rate, output: Rate, cachedInput: Rate.optional(), cacheWrite: Rate.optional() });
const PriceSchema = z.object({
	input: Rate,
	output: Rate,
	cachedInput: Rate.optional(),
	cacheWrite: Rate.optional(),
	offPeakFactor: z.number().finite().min(0).max(1).optional(),
	longContext: LongContextSchema.optional(),
});
type PayloadPrice = z.infer<typeof PriceSchema>;

/** Entries are validated one by one: a bad row is logged and skipped, it never discards the rest. */
const BodySchema = z.object({
	prices: z.record(z.string(), z.unknown()).default({}),
	images: z.record(z.string(), z.unknown()).default({}),
	models: z.record(z.string(), z.unknown()).default({}),
	updatedAt: z.string().nullable().optional(),
});

export type ModelOverrides = Partial<Record<ModelAlias | "image", string>>;

export interface AiConfig {
	models: ModelOverrides;
	updatedAt: string | null;
}

const EMPTY: AiConfig = { models: {}, updatedAt: null };
const ALIASES = ["fast", "balanced", "quality", "image"] as const;

/** Payload row -> price-book row. DeepSeek keeps its peak hours in code (Payload only sets the factor). */
export function toPrice(key: string, entry: PayloadPrice): Price {
	const provider = key.slice(0, key.indexOf(":"));
	return {
		input: entry.input,
		output: entry.output,
		cachedInput: entry.cachedInput ?? entry.input,
		// Anthropic bills cache writes (5-minute TTL) at 1.25x input; elsewhere writes cost the input rate
		cacheWrite: entry.cacheWrite ?? (provider === "anthropic" ? entry.input * 1.25 : entry.input),
		...(entry.longContext ? { longContext: entry.longContext } : {}),
		...(entry.offPeakFactor !== undefined && provider === "deepseek" ? { offPeakFactor: entry.offPeakFactor, isPeak: isDeepSeekPeak } : {}),
	};
}

/** Validates a response body into the parts the platform uses; `warn` hears every dropped entry. Throws on a malformed body. */
export function parseAiConfig(body: unknown, warn: (message: string) => void = () => undefined) {
	const parsed = BodySchema.parse(body);
	const prices: Record<string, Price> = {};
	for (const [key, value] of Object.entries(parsed.prices)) {
		const entry = PriceSchema.safeParse(value);
		if (MODEL_KEY.test(key) && entry.success) prices[key] = toPrice(key, entry.data);
		else warn(`ai-config price "${key}" ignored (invalid)`);
	}
	const images: Record<string, number> = {};
	for (const [key, value] of Object.entries(parsed.images)) {
		const usd = Rate.safeParse(value);
		if (MODEL_KEY.test(key) && usd.success) images[key] = usd.data;
		else warn(`ai-config picture price "${key}" ignored (invalid)`);
	}
	const models: ModelOverrides = {};
	for (const alias of ALIASES) {
		const ref = parsed.models[alias];
		if (ref === undefined || ref === null || ref === "") continue;
		const ok = ModelRefSchema.safeParse(ref);
		if (ok.success) models[alias] = ok.data.trim();
		else warn(`ai-config models.${alias} ignored (not provider:model[, provider:model…])`);
	}
	return { prices, images, config: { models, updatedAt: parsed.updatedAt ?? null } satisfies AiConfig };
}

@Injectable()
export class AiConfigService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(AiConfigService.name);
	private config: AiConfig = EMPTY;
	private lastAttempt = 0;
	private inflight: Promise<boolean> | null = null;
	private timer: NodeJS.Timeout | null = null;

	constructor(
		@Inject(ENV) private readonly env: Env,
		private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
		private readonly clock: () => number = Date.now,
	) {}

	get enabled(): boolean {
		return Boolean(this.env.PRIME_WEB_INTERNAL_URL);
	}

	onModuleInit(): void {
		if (!this.enabled) return;
		void this.refresh();
		this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}

	/** The last good config (empty until the first fetch lands); a stale copy starts a background refresh, never waits for it. */
	current(): AiConfig {
		if (this.enabled && !this.inflight && this.clock() - this.lastAttempt >= REFRESH_MS) void this.refresh();
		return this.config;
	}

	/** Model chain overrides from Payload, by alias (`image` too). */
	models(): ModelOverrides {
		return this.current().models;
	}

	/** One fetch; true when a valid body replaced the copy. Never throws. */
	refresh(): Promise<boolean> {
		if (!this.enabled) return Promise.resolve(false);
		this.inflight ??= this.load()
			.catch((error: unknown) => {
				this.logger.warn(`ai-config not refreshed (keeping ${this.config === EMPTY ? "built-in defaults" : "the last copy"}): ${error instanceof Error ? error.message : String(error)}`);
				return false;
			})
			.finally(() => {
				this.inflight = null;
			});
		return this.inflight;
	}

	private async load(): Promise<boolean> {
		this.lastAttempt = this.clock();
		const base = (this.env.PRIME_WEB_INTERNAL_URL as string).replace(/\/$/, "");
		const token = await new SignJWT({})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuer(AI_CONFIG_TOKEN_ISSUER)
			.setAudience(AI_CONFIG_TOKEN_AUDIENCE)
			.setSubject(AI_CONFIG_TOKEN_SUBJECT)
			.setIssuedAt()
			.setExpirationTime("2m")
			.sign(new TextEncoder().encode(this.env.AI_PLATFORM_CONTEXT_SECRET));
		const response = await this.fetchFn(`${base}/api/internal/ai-config`, {
			headers: { authorization: `Bearer ${token}`, accept: "application/json" },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(`prime-web answered ${response.status}`);
		const { prices, images, config } = parseAiConfig(await response.json(), (message) => this.logger.warn(message));
		setPriceOverrides({ prices, images });
		this.config = config;
		return true;
	}
}
