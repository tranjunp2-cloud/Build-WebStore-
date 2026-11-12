import { envKey } from "../models/providers";

export interface BuiltinProvider {
	id: string;
	label: string;
	/** env var holding the API key */
	keyEnv: string;
	/** env var holding a direct base URL override */
	baseUrlEnv: string;
	defaultBaseUrl: string | null;
	/** a cheap model for the connection test */
	testModel: string;
	/** a few well-known models offered next to the price book's (bare model ids) */
	catalog: string[];
	/** can serve a tier chain (typesafe is the decision model, not a chat provider) */
	chat: boolean;
}

export const BUILTIN_PROVIDERS: readonly BuiltinProvider[] = [
	{
		id: "openai",
		label: "OpenAI",
		keyEnv: "OPENAI_API_KEY",
		baseUrlEnv: "AI_BASE_URL_OPENAI",
		defaultBaseUrl: "https://api.openai.com/v1",
		testModel: "gpt-5.4-nano",
		catalog: ["gpt-5.4-nano", "gpt-5.4-mini", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-image-1"],
		chat: true,
	},
	{
		id: "anthropic",
		label: "Anthropic",
		keyEnv: "ANTHROPIC_API_KEY",
		baseUrlEnv: "AI_BASE_URL_ANTHROPIC",
		defaultBaseUrl: "https://api.anthropic.com/v1",
		testModel: "claude-haiku-5-5",
		catalog: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
		chat: true,
	},
	{
		id: "google",
		label: "Google",
		keyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
		baseUrlEnv: "AI_BASE_URL_GOOGLE",
		defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
		testModel: "gemini-2.5-flash-lite",
		catalog: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
		chat: true,
	},
	{
		id: "deepseek",
		label: "DeepSeek",
		keyEnv: "DEEPSEEK_API_KEY",
		baseUrlEnv: "AI_BASE_URL_DEEPSEEK",
		defaultBaseUrl: "https://api.deepseek.com",
		testModel: "deepseek-flash",
		catalog: ["deepseek-flash", "deepseek-v4-pro"],
		chat: true,
	},
	{
		id: "openrouter",
		label: "OpenRouter",
		keyEnv: "OPENROUTER_API_KEY",
		baseUrlEnv: "AI_BASE_URL_OPENROUTER",
		defaultBaseUrl: "https://openrouter.ai/api/v1",
		testModel: "openai/gpt-4o-mini",
		catalog: ["openai/gpt-4o-mini", "anthropic/claude-haiku-4.5"],
		chat: true,
	},
	{
		id: "typesafe",
		label: "TypeSafe System One",
		keyEnv: "TYPESAFE_API_KEY",
		baseUrlEnv: "TYPESAFE_API_URL",
		defaultBaseUrl: "https://api.typesafe.ai/v1/systemone",
		testModel: "jev-latest",
		catalog: ["jev-latest"],
		chat: false,
	},
];

export const COMPAT_PREFIX = "compat-";
/** Endpoint names are the part after `compat-`: the registry's model refs allow `[a-z0-9-]` only. */
export const ENDPOINT_NAME = /^[a-z0-9][a-z0-9-]{0,30}$/;

export function builtinProvider(id: string): BuiltinProvider | undefined {
	return BUILTIN_PROVIDERS.find((provider) => provider.id === id);
}

export function isCompatId(id: string): boolean {
	return id.startsWith(COMPAT_PREFIX) && ENDPOINT_NAME.test(id.slice(COMPAT_PREFIX.length));
}

/** `AI_COMPAT_<NAME>_<suffix>` for a `compat-<name>` provider id. */
export function compatEnvName(providerId: string, suffix: "BASE_URL" | "API_KEY" | "REASONING" | "STRUCTURED_OUTPUTS"): string {
	return `AI_COMPAT_${envKey(providerId.slice(COMPAT_PREFIX.length))}_${suffix}`;
}

/** Compat endpoints defined in the environment (AI_COMPAT_<NAME>_BASE_URL), as provider ids. */
export function envCompatIds(vars: Record<string, string | undefined>): string[] {
	const ids: string[] = [];
	for (const [name, value] of Object.entries(vars)) {
		const match = /^AI_COMPAT_([A-Z0-9_]+)_BASE_URL$/.exec(name);
		if (match?.[1] && value) ids.push(`${COMPAT_PREFIX}${match[1].toLowerCase().replace(/_/g, "-")}`);
	}
	return ids;
}

export function providerLabel(id: string): string {
	return builtinProvider(id)?.label ?? (id.startsWith(COMPAT_PREFIX) ? id.slice(COMPAT_PREFIX.length) : id);
}
