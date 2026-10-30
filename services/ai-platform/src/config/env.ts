import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { type Capability, parseCapabilityList } from "./capabilities";

/** One ref (`provider:model`) or a comma-separated fallback chain of refs. */
const ModelRefSchema = z
	.string()
	.regex(
		/^\s*[a-z0-9-]+:[A-Za-z0-9._:/@-]+\s*(,\s*[a-z0-9-]+:[A-Za-z0-9._:/@-]+\s*)*$/,
		"model refs are provider:model[, provider:model…], e.g. openai:gpt-4.1-mini, anthropic:claude-haiku-4-5",
	);

/** Reasoning effort (AI SDK `reasoning`); each provider maps it, and lowers levels a model lacks. `default` = send none. */
const EffortSchema = z.enum(["default", "none", "minimal", "low", "medium", "high", "xhigh", "max"]);

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	PORT: z.coerce.number().int().min(1).max(65_535).default(8300),
	AI_PLATFORM_DATABASE_URL: z.string().min(1),
	/** Unset = 5 locally, 3 on Vercel (see `dbPoolMax`): every warm instance holds its own pool. */
	AI_PLATFORM_DB_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
	/** Set by Vercel on every build and function; selects the serverless defaults below. */
	VERCEL: z.string().optional(),
	/** Bearer secret Vercel Cron sends to /internal/cron/*; unset = the cron endpoints refuse every call. */
	CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
	/** Body limit of the attachment upload route. Unset = 16 MiB locally, 4.4 MB on Vercel (platform cap 4.5 MB). */
	AI_ATTACHMENT_BODY_LIMIT_BYTES: z.coerce.number().int().min(64 * 1024).max(64 * 1024 * 1024).optional(),
	/** Largest attachment file (decoded). Unset = 10 MB locally, 3 MB on Vercel (base64 grows it by a third). */
	AI_ATTACHMENT_MAX_BYTES: z.coerce.number().int().min(1024).optional(),
	/** How often a running run checks whether another instance asked it to stop. */
	AI_RUN_CANCEL_POLL_MS: z.coerce.number().int().min(100).max(30_000).default(1_500),
	/**
	 * Stop a run when the browser's SSE stream closes. Off by default: the chat
	 * restores a run that outlived a reload (it polls the thread), so closing
	 * the tab must not kill it. Stop in the UI always works via /runs/:id/cancel.
	 */
	AI_ABORT_RUN_ON_DISCONNECT: z
		.enum(["true", "false", "1", "0"])
		.default("false")
		.transform((value) => value === "true" || value === "1"),
	/**
	 * Run still `running` in the database after this long was killed by the platform (Vercel
	 * maxDuration is 300 s) and never finished: the stale-run sweeps mark it failed. Keep it
	 * above the longest legitimate run. Unset = 10 min locally, 330 s on Vercel (see `runMaxRunningMs`).
	 */
	AI_RUN_MAX_RUNNING_MS: z.coerce.number().int().min(60_000).max(86_400_000).optional(),
	/**
	 * At most one stale-run sweep per this long per process, started by chat requests (thread
	 * list / open, work queue, run start) in the background. 0 = only the retention sweep.
	 */
	AI_STALE_SWEEP_EVERY_MS: z.coerce.number().int().min(0).max(86_400_000).default(60_000),
	/**
	 * What the copilot may do here: comma list of site, blog, stock_photos, media_library,
	 * image_generation, product_master, inventory, store_products, shop_products. Unset = all but
	 * shop_products (opt-in; cannot be combined with product_master / store_products).
	 */
	AI_AGENT_CAPABILITIES: z
		.string()
		.optional()
		.transform((raw, ctx): Capability[] | undefined => {
			if (raw === undefined) return undefined;
			const parsed = parseCapabilityList(raw);
			if ("error" in parsed) {
				ctx.issues.push({ code: "custom", message: parsed.error, input: raw });
				return z.NEVER;
			}
			return parsed.capabilities;
		}),
	AI_PLATFORM_CONTEXT_SECRET: z.string().min(32, "AI_PLATFORM_CONTEXT_SECRET must be at least 32 characters"),
	OPENAI_API_KEY: z.string().optional(),
	OPENROUTER_API_KEY: z.string().optional(),
	ANTHROPIC_API_KEY: z.string().optional(),
	GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
	DEEPSEEK_API_KEY: z.string().optional(),
	AI_GATEWAY_BASE_URL: z.url().optional(),
	AI_GATEWAY_TOKEN: z.string().optional(),
	AI_MODEL_FAST: ModelRefSchema.default("anthropic:claude-haiku-5-5, openai:gpt-5.4-nano"),
	AI_MODEL_BALANCED: ModelRefSchema.default("anthropic:claude-haiku-5-5, openai:gpt-5.4-mini"),
	/** Site generation (prime-web builder, PW1 migration): long composed prompts → whole-page JSON. */
	AI_MODEL_QUALITY: ModelRefSchema.default("anthropic:claude-haiku-5-5, openai:gpt-5.4-mini"),
	/** Picture generation (DAM "Generate", the copilot's generate_image): openai:gpt-image-1 or compat-<name>:<model>. */
	AI_MODEL_IMAGE: ModelRefSchema.default("openai:gpt-image-1"),
	/**
	 * Reasoning effort per tier, for every provider of that tier's chain (AI SDK `reasoning`: Anthropic
	 * effort, OpenAI/compat reasoning_effort, Gemini thinking level/budget, DeepSeek thinking). Lets one
	 * cheap model serve every tier. Unset = fast none (thinking off), balanced medium, quality high (the default chains run
	 * claude-haiku-5-5 on all three); DeepSeek stays non-thinking unless the tier effort is set explicitly.
	 * `default` = send no effort, each model uses its own.
	 */
	AI_EFFORT_FAST: EffortSchema.optional(),
	AI_EFFORT_BALANCED: EffortSchema.optional(),
	AI_EFFORT_QUALITY: EffortSchema.optional(),
	AI_IMAGE_TIMEOUT_MS: z.coerce.number().int().min(10_000).max(300_000).default(150_000),
	/** Generated picture format (OpenAI image models). Unset = png locally, webp on Vercel (response and upload bodies stay under 4.5 MB). */
	AI_IMAGE_OUTPUT_FORMAT: z.enum(["png", "jpeg", "webp"]).optional(),
	/** Generated pictures per organization per day (each picture counts). */
	AI_DAILY_IMAGE_LIMIT_PER_ORG: z.coerce.number().int().min(0).default(20),
	AI_MODEL_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(60_000),
	AI_DAILY_RUN_LIMIT_PER_ORG: z.coerce.number().int().min(0).default(200),
	AI_RUNS_PER_MINUTE_PER_USER: z.coerce.number().int().min(0).default(6),
	/** Copilot runs one person may have working (planning / running / applying) at once; more wait in the queue. 0 = no cap. */
	AI_MAX_RUNNING_RUNS_PER_USER: z.coerce.number().int().min(0).default(3),
	/** Copilot runs one shop workspace may have working at once; more wait in the queue (FIFO). 0 = no cap. */
	AI_MAX_RUNNING_RUNS_PER_ORG: z.coerce.number().int().min(0).default(3),
	/** How often a queued run checks for a free slot (and keeps its place alive). */
	AI_QUEUE_POLL_MS: z.coerce.number().int().min(100).max(30_000).default(1_500),
	/** Longest a run waits in the queue; also capped so the wait plus AI_RUN_BUDGET_MS stays within 290 s. */
	AI_QUEUE_MAX_WAIT_MS: z.coerce.number().int().min(0).max(600_000).default(90_000),
	AI_DAILY_TASK_LIMIT_PER_ORG: z.coerce.number().int().min(0).default(1_000),
	/** Copilot threads (+ their runs and change sets) are deleted this long after their last activity. */
	AI_THREAD_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
	/**
	 * TypeSafe System One (JEV) — decision model behind the copilot's clarifying
	 * questions (same backend platform-api's mapping uses). Unset = lexical
	 * ranking only: options are ordered, nothing is auto-answered.
	 */
	TYPESAFE_API_KEY: z.string().optional(),
	TYPESAFE_API_URL: z.url().optional(),
	TYPESAFE_MODEL: z.string().min(1).default("jev-latest"),
	TYPESAFE_TIMEOUT_MS: z.coerce.number().int().min(500).max(120_000).default(15_000),
	/** A decision at or above this confidence answers the question for the merchant (shown, changeable). */
	AI_DECISION_AUTO_CONFIDENCE: z.coerce.number().min(0.5).max(1).default(0.85),
	AI_DECISION_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
	/**
	 * prime-web origin for the agent tool facade (/api/agent-tools/*): the shop's
	 * families, attribute schemas and media, read with the merchant's own access.
	 */
	PRIME_WEB_INTERNAL_URL: z.url().optional(),
	/** Request log lines: `all` (default) = every request; `default` = only failures (status >= 400) and requests over 2 s. */
	AI_LOG_REQUESTS: z.enum(["default", "all"]).default("all"),
	/** One request's model time (copilot run, from the request's start): stays inside Vercel's 300 s maxDuration. */
	AI_RUN_BUDGET_MS: z.coerce.number().int().min(30_000).max(3_600_000).default(200_000),
	/** Input + output tokens one copilot run may use across its model calls (and pauses); above it no new call starts. */
	AI_RUN_TOKEN_BUDGET: z.coerce.number().int().min(1_000).default(600_000),
	/** Output tokens per copilot model call (each tool step). */
	AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(65_536).default(8_192),
	/** Document text (PDF/CSV/XLSX) put on one user turn across all its files; the rest is cut and the turn says so. */
	AI_TURN_DOCUMENT_CHARS: z.coerce.number().int().min(1_000).max(1_000_000).default(60_000),
	/** Copilot tool routing: `on` sends only the tool groups a message needs (+ use_tools); `off` sends every tool, as before. */
	AI_TOOL_ROUTING: z.enum(["on", "off"]).default("on"),
	/** Next-message suggestions: `rules` = from what the run did, a tiny FAST-model call only when no rule fits; `model` = always that call; `off`. */
	AI_SUGGEST_MODE: z.enum(["rules", "model", "off"]).default("rules"),
	/** Global daily AI spend cap in USD (every org, Malaysia day, from the ledger's cost); unset = 20, 0 = off. Above it runs and tasks get 503. */
	AI_DAILY_BUDGET_USD: z.coerce
		.number()
		.min(0)
		.default(20)
		.transform((usd) => (usd === 0 ? undefined : usd)),
});

export type Env = z.infer<typeof EnvSchema>;

/** Empty strings in .env files mean "unset" — treat them so before parsing. */
function blankToUndefined(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
	return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]));
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
	const parsed = EnvSchema.safeParse(blankToUndefined(source));
	if (!parsed.success) {
		const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
		throw new Error(`Invalid ai-platform environment — ${issues}`);
	}
	return parsed.data;
}

/** Local dev convenience: .env.local then .env next to package.json (never in production). */
export function loadLocalEnvFiles(cwd: string = process.cwd()): void {
	if (process.env.NODE_ENV === "production") return;
	for (const file of [".env.local", ".env"]) {
		const path = resolve(cwd, file);
		if (existsSync(path)) loadDotenv({ path, quiet: true });
	}
}
