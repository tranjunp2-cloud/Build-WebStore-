import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defaultSettingsMiddleware, type ImageModel, type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from "ai";

/** Builds a model for one provider; null = provider not configured in this environment. */
export type ProviderFactory = ((modelId: string) => LanguageModel) | null;

export interface ProviderEnv {
	gatewayBaseUrl?: string;
	gatewayToken?: string;
	/** Raw environment, for per-provider keys and `compat-<name>` endpoints. */
	vars: Record<string, string | undefined>;
}

/**
 * Cloudflare AI Gateway path per provider (`<gateway>/<path>` replaces the
 * provider's default base URL). Override with AI_GATEWAY_PATH_<PROVIDER>.
 * To verify in the Cloudflare spike before production.
 */
export const GATEWAY_PATHS: Record<string, string> = {
	openai: "openai",
	anthropic: "anthropic/v1",
	google: "google-ai-studio/v1beta",
	openrouter: "openrouter/v1",
	deepseek: "deepseek",
};

/**
 * DeepSeek V4 models think by default: reasoning is billed as output, ignores
 * temperature and adds latency. The task prompts were tuned for non-reasoning
 * models (and some run on tight deadlines), so DeepSeek runs in non-thinking mode.
 */
const DEEPSEEK_NON_THINKING = defaultSettingsMiddleware({
	settings: { providerOptions: { deepseek: { thinking: { type: "disabled" } } } },
});

/** OpenAI models that take `reasoning_effort` (o-series, gpt-5+ except chat); others reject the parameter. */
const OPENAI_REASONING_MODEL = /^(?:openai\/)?(?:o\d|gpt-(?:[5-9]|\d{2,}))(?![\w.-]*-chat)/;

/**
 * Whether a tier effort may be sent to this model. Anthropic, Google and DeepSeek map it for every
 * current model; OpenAI and OpenRouter only for reasoning models (a non-reasoning model answers 400 to
 * `reasoning_effort`); an OpenAI-compatible server only when AI_COMPAT_<NAME>_REASONING=true.
 */
export function acceptsReasoningEffort(provider: string, modelId: string, vars: Record<string, string | undefined>): boolean {
	if (provider === "anthropic" || provider === "google" || provider === "deepseek") return true;
	if (provider === "openai") return OPENAI_REASONING_MODEL.test(modelId);
	if (provider === "openrouter") return OPENAI_REASONING_MODEL.test(modelId) || /^(?:anthropic|google|deepseek)\//.test(modelId);
	if (provider.startsWith("compat-")) return vars[`AI_COMPAT_${envKey(provider.slice("compat-".length))}_REASONING`] === "true";
	return false;
}

/** Reasoning effort a tier asks for (AI SDK `reasoning`); each provider maps it to its own setting. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Default `reasoning` for every call on this model (a call's own value wins). The AI SDK maps it per
 * provider: Anthropic `output_config.effort`, OpenAI / OpenAI-compatible `reasoning_effort` (reasoning
 * models), Gemini 3 `thinkingLevel` / Gemini 2.5 `thinkingBudget`, DeepSeek thinking + effort.
 * DeepSeek runs non-thinking by default (DEEPSEEK_NON_THINKING); a tier effort turns thinking on there.
 */
export function withReasoningEffort(model: LanguageModel, provider: string, effort: ReasoningEffort): LanguageModel {
	if (typeof model === "string") return model;
	const middleware: LanguageModelMiddleware = {
		specificationVersion: "v4",
		transformParams: async ({ params }) => {
			const own = params.reasoning != null && params.reasoning !== "provider-default";
			if (own) return params;
			const deepseekThinking =
				provider === "deepseek" && effort !== "none"
					? { providerOptions: { ...params.providerOptions, deepseek: { ...params.providerOptions?.deepseek, thinking: { type: "enabled" } } } }
					: {};
			return { ...params, reasoning: effort, ...deepseekThinking };
		},
	};
	return wrapLanguageModel({ model, middleware });
}

const KEY_HEADERS = ["authorization", "x-api-key", "x-goog-api-key"];

export function envKey(provider: string): string {
	return provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/**
 * Resolves connection settings for a provider: direct, or through Cloudflare
 * AI Gateway. Without a provider key but with a gateway token, the gateway's
 * stored key (BYOK) is used and no key header is forwarded.
 */
function connection(env: ProviderEnv, provider: string, apiKey: string | undefined, directBaseUrl?: string) {
	// a direct base URL override (AI_BASE_URL_<PROVIDER>: env, or Prime Studio mapped onto the same name)
	directBaseUrl = env.vars[`AI_BASE_URL_${envKey(provider)}`] || directBaseUrl;
	const gateway = env.gatewayBaseUrl?.replace(/\/+$/, "");
	const path = env.vars[`AI_GATEWAY_PATH_${envKey(provider)}`] ?? GATEWAY_PATHS[provider];
	const viaGateway = Boolean(gateway && path);
	const keyManagedByGateway = !apiKey && viaGateway && Boolean(env.gatewayToken);
	if (!apiKey && !keyManagedByGateway) return null;
	const headers: Record<string, string> = {};
	if (viaGateway && env.gatewayToken) headers["cf-aig-authorization"] = `Bearer ${env.gatewayToken}`;
	return {
		apiKey: apiKey ?? "gateway-managed",
		baseURL: viaGateway ? `${gateway}/${path}` : directBaseUrl,
		headers,
		fetch: keyManagedByGateway
			? (input: RequestInfo | URL, init?: RequestInit) => {
					const stripped = new Headers(init?.headers);
					for (const header of KEY_HEADERS) stripped.delete(header);
					return fetch(input, { ...init, headers: stripped });
				}
			: undefined,
	};
}

export function createProviderFactory(provider: string, env: ProviderEnv): ProviderFactory {
	const v = env.vars;
	switch (provider) {
		case "openai": {
			const c = connection(env, provider, v.OPENAI_API_KEY);
			return c ? (id) => createOpenAI(c).chat(id) : null;
		}
		case "anthropic": {
			const c = connection(env, provider, v.ANTHROPIC_API_KEY);
			return c ? (id) => createAnthropic(c)(id) : null;
		}
		case "google": {
			const c = connection(env, provider, v.GOOGLE_GENERATIVE_AI_API_KEY);
			return c ? (id) => createGoogle(c)(id) : null;
		}
		case "deepseek": {
			// Native provider: maps usage.prompt_cache_hit_tokens → cacheReadTokens (openai-compatible
			// only reads prompt_tokens_details.cached_tokens) and handles V4 thinking/reasoning_content.
			const c = connection(env, provider, v.DEEPSEEK_API_KEY, "https://api.deepseek.com");
			return c ? (id) => wrapLanguageModel({ model: createDeepSeek(c)(id), middleware: DEEPSEEK_NON_THINKING }) : null;
		}
		case "openrouter": {
			const c = connection(env, provider, v.OPENROUTER_API_KEY, "https://openrouter.ai/api/v1");
			return c?.baseURL ? (id) => createOpenAICompatible({ name: provider, ...c, baseURL: c.baseURL as string }).chatModel(id) : null;
		}
		default: {
			// `compat-<name>:<model>` — any OpenAI-compatible endpoint: self-hosted vLLM/SGLang
			// (e.g. SEA-LION in-region), Workers AI, Azure-style proxies…
			if (!provider.startsWith("compat-")) return null;
			const name = envKey(provider.slice("compat-".length));
			const baseURL = v[`AI_COMPAT_${name}_BASE_URL`];
			if (!baseURL) return null;
			// json_schema by default: bare json_object mode is rejected by some upstreams
			// (OpenAI Responses-backed proxies want "json" in the prompt). Opt out per endpoint.
			const supportsStructuredOutputs = v[`AI_COMPAT_${name}_STRUCTURED_OUTPUTS`] !== "false";
			return (id) =>
				createOpenAICompatible({
					name: provider,
					baseURL,
					apiKey: v[`AI_COMPAT_${name}_API_KEY`],
					supportsStructuredOutputs,
				}).chatModel(id);
		}
	}
}

/** Builds a picture model for one provider; null = not configured (or no picture models there). */
export function createImageFactory(provider: string, env: ProviderEnv): ((modelId: string) => ImageModel) | null {
	const v = env.vars;
	if (provider === "openai") {
		const c = connection(env, provider, v.OPENAI_API_KEY);
		return c ? (id) => createOpenAI(c).image(id) : null;
	}
	if (provider === "google") {
		const c = connection(env, provider, v.GOOGLE_GENERATIVE_AI_API_KEY);
		return c ? (id) => createGoogle(c).image(id) : null;
	}
	if (!provider.startsWith("compat-")) return null;
	const name = envKey(provider.slice("compat-".length));
	const baseURL = v[`AI_COMPAT_${name}_BASE_URL`];
	if (!baseURL) return null;
	return (id) => createOpenAICompatible({ name: provider, baseURL, apiKey: v[`AI_COMPAT_${name}_API_KEY`] }).imageModel(id);
}
