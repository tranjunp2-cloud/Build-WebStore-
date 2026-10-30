import { APICallError, generateText, RetryError } from "ai";
import { isProviderBillingError } from "../models/fallback";
import { createProviderFactory } from "../models/providers";
import { builtinProvider, compatEnvName } from "./provider-catalog";
import type { SettingsService } from "./settings.service";
import type { TestResult } from "./settings-types";

export const TEST_TIMEOUT_MS = 15_000;
/** Most model ids kept from one endpoint's /models answer. */
const MAX_LISTED_MODELS = 100;
const TEST_PROMPT = "Reply with the single word OK.";
/** A tiny reply is enough to prove the key, the account and the model work. */
const TEST_MAX_OUTPUT_TOKENS = 16;

export interface TesterDeps {
	generate?: typeof generateText;
	createFactory?: typeof createProviderFactory;
	fetchFn?: typeof fetch;
	clock?: () => number;
}

/** Provider keys and tokens never appear in a test message, whatever the provider echoes back. */
export function redact(message: string, secrets: Array<string | null | undefined>): string {
	let out = message;
	for (const secret of secrets) if (secret && secret.length >= 6) out = out.split(secret).join("***");
	return out.replace(/\b(?:sk|pk|rk|key|tok)[-_][A-Za-z0-9_-]{8,}/g, "***").replace(/\bBearer\s+\S+/gi, "Bearer ***").slice(0, 300);
}

function statusCode(error: unknown): number | undefined {
	if (RetryError.isInstance(error)) return statusCode(error.lastError);
	return APICallError.isInstance(error) ? error.statusCode : undefined;
}

export function classifyFailure(error: unknown): { code: TestResult["code"]; message: string } {
	const cause = RetryError.isInstance(error) ? error.lastError : error;
	const text = cause instanceof Error ? cause.message : String(cause);
	if (cause instanceof Error && /timeout|abort/i.test(cause.name)) return { code: "timeout", message: "No answer within 15 seconds." };
	if (isProviderBillingError(cause)) return { code: "quota", message: text };
	const status = statusCode(cause);
	if (status === 401 || status === 403) return { code: "invalid-key", message: text };
	if (status === 402 || status === 429) return { code: "quota", message: text };
	if (status === 404) return { code: "not-found", message: text };
	if (/timed? ?out|aborted/i.test(text)) return { code: "timeout", message: "No answer within 15 seconds." };
	return { code: "error", message: text };
}

/** HTTP status of a plain probe -> result code (probes: the model list, System One). */
function classifyStatus(status: number, acceptedAsReachable: number[] = []): TestResult["code"] {
	if (status >= 200 && status < 300) return "ok";
	if (acceptedAsReachable.includes(status)) return "ok";
	if (status === 401 || status === 403) return "invalid-key";
	if (status === 402 || status === 429) return "quota";
	if (status === 404) return "not-found";
	return "error";
}

/**
 * The connection test of a provider: one tiny real model call (or the endpoint's model list / a System One
 * question where there is no chat model to call), 15 s at most. With `apiKey` it tests a key that is not saved;
 * without, the saved Studio key, else the env key. The key is never part of the result.
 */
export class ProviderTester {
	private readonly generate: typeof generateText;
	private readonly createFactory: typeof createProviderFactory;
	private readonly fetchFn: typeof fetch;
	private readonly clock: () => number;

	constructor(
		private readonly settings: SettingsService,
		deps: TesterDeps = {},
	) {
		this.generate = deps.generate ?? generateText;
		this.createFactory = deps.createFactory ?? createProviderFactory;
		this.fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
		this.clock = deps.clock ?? Date.now;
	}

	/** The model a test calls: the asked one (bare or `provider:model`), else the provider's cheap test model, else a chain member. */
	pickModel(id: string, asked: string | undefined): string | null {
		const wanted = asked?.trim().replace(new RegExp(`^${id}:`), "");
		if (wanted) return wanted;
		const builtin = builtinProvider(id);
		if (builtin) return builtin.testModel;
		for (const key of ["fast", "balanced", "quality", "image"] as const) {
			for (const { chain } of this.settings.chainCandidates(key)) {
				const ref = chain.split(",").map((part) => part.trim()).find((part) => part.startsWith(`${id}:`));
				if (ref) return ref.slice(id.length + 1);
			}
		}
		return null;
	}

	async run(id: string, input: { apiKey?: string; model?: string }): Promise<TestResult> {
		const started = this.clock();
		const vars = { ...this.settings.overlayVars() };
		const builtin = builtinProvider(id);
		const keyName = builtin ? builtin.keyEnv : compatEnvName(id, "API_KEY");
		if (input.apiKey) vars[keyName] = input.apiKey;
		const apiKey = vars[keyName] ?? null;
		const model = this.pickModel(id, input.model);
		const done = (code: TestResult["code"], message: string, label: string): TestResult => ({
			ok: code === "ok",
			at: new Date(this.clock()).toISOString(),
			ms: this.clock() - started,
			model: label,
			code,
			message: code === "ok" ? "Connected." : redact(message, [apiKey, vars.AI_GATEWAY_TOKEN]),
		});
		try {
			if (id === "typesafe") return await this.probeSystemOne(vars, apiKey, model ?? "jev-latest", done);
			if (!model) return await this.probeModelList(vars, id, apiKey, done);
			const factory = this.createFactory(id, this.settings.providerEnv(vars));
			if (!factory) return done("invalid-key", builtin ? "No API key to test." : "This endpoint has no base URL.", model);
			await this.generate({
				model: factory(model),
				prompt: TEST_PROMPT,
				maxOutputTokens: TEST_MAX_OUTPUT_TOKENS,
				maxRetries: 0,
				abortSignal: AbortSignal.timeout(TEST_TIMEOUT_MS),
			});
			return done("ok", "", model);
		} catch (error) {
			const failure = classifyFailure(error);
			return done(failure.code, failure.message, model ?? "models list");
		}
	}

	private async probeModelList(vars: Record<string, string | undefined>, id: string, apiKey: string | null, done: (code: TestResult["code"], message: string, label: string) => TestResult) {
		const baseUrl = vars[compatEnvName(id, "BASE_URL")]?.replace(/\/+$/, "");
		if (!baseUrl) return done("error", "This endpoint has no base URL.", "models list");
		const response = await this.fetchFn(`${baseUrl}/models`, {
			headers: { accept: "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
			signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
		});
		const code = classifyStatus(response.status);
		const result = done(code, `The endpoint answered ${response.status} to its model list.`, "models list");
		if (code !== "ok") return result;
		// remember what the endpoint serves: self-hosted model ids are not in any price book
		const body = (await response.json().catch(() => null)) as { data?: Array<{ id?: unknown }> } | null;
		const models = (body?.data ?? []).map((entry) => entry?.id).filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 200);
		return models.length > 0 ? { ...result, models: [...new Set(models)].slice(0, MAX_LISTED_MODELS) } : result;
	}

	private async probeSystemOne(vars: Record<string, string | undefined>, apiKey: string | null, model: string, done: (code: TestResult["code"], message: string, label: string) => TestResult) {
		if (!apiKey) return done("invalid-key", "No API key to test.", model);
		const endpoint = vars.TYPESAFE_API_URL || "https://api.typesafe.ai/v1/systemone";
		const response = await this.fetchFn(endpoint, {
			method: "POST",
			headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
			body: JSON.stringify({ model, state: { task: "connection test" }, questions: { test: { type: "choice", instructions: "Pick a.", criteria: { a: "A", b: "B" } } } }),
			signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
		});
		// a 400 / 422 means the key was accepted and only the tiny question was refused
		return done(classifyStatus(response.status, [400, 422]), `System One answered ${response.status}.`, model);
	}
}
