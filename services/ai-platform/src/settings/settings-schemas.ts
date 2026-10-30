import { z } from "zod";
import { BUILTIN_PROVIDERS, ENDPOINT_NAME } from "./provider-catalog";
import { HISTORY_AREAS } from "./settings-types";

export interface FieldError {
	path: string[];
	message: string;
}

/** A 400/422 answer: `{ errors: [{ path, message }] }`. */
export class SettingsValidationError extends Error {
	constructor(readonly errors: FieldError[]) {
		super(errors.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
	}
}

/** The caller tested too often (10 per minute per provider). */
export class TestRateLimitedError extends Error {
	constructor() {
		super("Too many tests, try again in a minute.");
	}
}

export function fail(path: string[], message: string): never {
	throw new SettingsValidationError([{ path, message }]);
}

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
	const parsed = schema.safeParse(body ?? {});
	if (parsed.success) return parsed.data;
	throw new SettingsValidationError(parsed.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })));
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

const Url = z.string().trim().max(500).refine(isHttpUrl, "must be an http(s) address, e.g. https://api.example.com/v1");
/** API keys and tokens: printable ASCII without spaces. */
export const SecretValue = z.string().trim().min(8, "looks too short for a key").max(512).regex(/^[\x21-\x7e]+$/, "must not contain spaces or special characters");
const ModelRef = z.string().trim().regex(/^[a-z0-9-]+:[A-Za-z0-9._:/@-]+$/, "must be provider:model, e.g. anthropic:claude-haiku-5-5");
const Efforts = ["default", "none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const Options = z.object({ reasoning: z.boolean().optional(), structuredOutputs: z.boolean().optional() }).strict();

export const ProviderBody = z.object({ enabled: z.boolean().nullable().optional(), baseUrl: Url.nullable().optional(), options: Options.optional() }).strict();
export const KeyBody = z.object({ apiKey: SecretValue }).strict();
export const TestBody = z.object({ apiKey: SecretValue.optional(), model: z.string().trim().min(1).max(200).optional() }).strict();
export const EndpointBody = z
	.object({
		name: z.string().trim().regex(ENDPOINT_NAME, "use lowercase letters, numbers and dashes (max 31)"),
		baseUrl: Url,
		apiKey: SecretValue.optional(),
		reasoning: z.boolean().default(false),
		structuredOutputs: z.boolean().default(true),
	})
	.strict();

const chainOf = z.array(ModelRef).max(8);
const TierBody = z
	.object({ chain: chainOf, effort: z.enum(Efforts).nullable().optional(), timeoutMs: z.number().int().min(5_000).max(300_000).nullable().optional() })
	.strict();
const ImageBody = z
	.object({
		chain: chainOf,
		timeoutMs: z.number().int().min(10_000).max(300_000).nullable().optional(),
		format: z.enum(["png", "jpeg", "webp"]).nullable().optional(),
	})
	.strict();
export const RoutingBody = z
	.object({
		tiers: z.object({ fast: TierBody.nullable().optional(), balanced: TierBody.nullable().optional(), quality: TierBody.nullable().optional(), image: ImageBody.nullable().optional() }).strict(),
	})
	.strict();

export const GatewayBody = z
	.object({
		baseUrl: Url.nullable(),
		token: SecretValue.nullable().optional(),
		paths: z
			.record(z.string(), z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,99}$/, "must be a relative path such as anthropic/v1"))
			.refine((paths) => Object.keys(paths).every((id) => BUILTIN_PROVIDERS.some((provider) => provider.id === id && provider.chat)), "unknown provider")
			.optional(),
	})
	.strict();

export const TasksBody = z.object({ overrides: z.record(z.string(), z.enum(["fast", "balanced", "quality"]).nullable()) }).strict();
export const RuntimeBody = z.object({ values: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])) }).strict();
export const HistoryQuery = z.object({
	area: z.enum(HISTORY_AREAS as unknown as [string, ...string[]]).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
});
