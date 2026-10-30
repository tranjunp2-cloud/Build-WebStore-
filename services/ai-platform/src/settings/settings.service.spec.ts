import { generateText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../config/env";
import { createModelRegistry, ModelUnavailableError, DEFAULT_TIER_EFFORT } from "../models/model-registry";
import { ACTOR, makeSettings } from "./settings.spec-helper";
import { SettingsService } from "./settings.service";

const KEY = "sk-studio-key-ABCDEFGH1234";

afterEach(() => vi.restoreAllMocks());

describe("provider keys [TC-AIPROV-04]", () => {
	it("TC-AIPROV-04: a Studio key wins over the env key and shows only its last 4", async () => {
		// Arrange
		const { admin, settings } = await makeSettings({ vars: { ANTHROPIC_API_KEY: "sk-env-key-00000000" } });

		// Act
		const view = await admin.setKey("anthropic", { apiKey: KEY }, ACTOR);

		// Assert
		const anthropic = view.providers.find((p) => p.id === "anthropic");
		expect(anthropic?.key).toMatchObject({ state: "set", last4: "1234", setBy: ACTOR.email });
		expect(settings.overlayVars().ANTHROPIC_API_KEY).toBe(KEY);
		expect(JSON.stringify(view)).not.toContain(KEY);
	});

	it("TC-AIPROV-04: without a Studio key the env key is in use (state env, no last4)", async () => {
		const { admin } = await makeSettings({ vars: { OPENAI_API_KEY: "sk-env-key-00000000" } });
		const openai = (await admin.view()).providers.find((p) => p.id === "openai");
		expect(openai?.key).toEqual({ state: "env", last4: null, setBy: null, setAt: null });
		expect((await admin.view()).providers.find((p) => p.id === "google")?.key.state).toBe("none");
	});

	it("TC-AIPROV-04: a key sealed under another secret is needs-reentry and the env key keeps serving", async () => {
		// Arrange: saved under the first secret, then the service runs with a rotated one
		const first = await makeSettings({ vars: { DEEPSEEK_API_KEY: "sk-env-deepseek-0000" } });
		await first.admin.setKey("deepseek", { apiKey: KEY }, ACTOR);
		const rotated = { ...first.vars, AI_PROVIDER_SECRETS_KEY: "rotated-secret-rotated-secret-123456" };
		const settings = new SettingsService(parseEnv(rotated), first.store, undefined, rotated);
		await settings.reload();

		// Act
		const info = settings.keyInfo("deepseek");

		// Assert
		expect(info.state).toBe("needs-reentry");
		expect(settings.overlayVars().DEEPSEEK_API_KEY).toBe("sk-env-deepseek-0000");
	});

	it("TC-AIPROV-04: removing a Studio key falls back to env", async () => {
		const { admin, settings } = await makeSettings({ vars: { OPENAI_API_KEY: "sk-env-key-00000000" } });
		await admin.setKey("openai", { apiKey: KEY }, ACTOR);
		const view = await admin.deleteKey("openai", ACTOR);
		expect(view.providers.find((p) => p.id === "openai")?.key.state).toBe("env");
		expect(settings.overlayVars().OPENAI_API_KEY).toBe("sk-env-key-00000000");
	});
});

describe("registry on Studio settings [TC-AIPROV-05]", () => {
	it("TC-AIPROV-05: Studio's chain beats Payload's, which beats env; a Studio chain naming nothing usable falls through", async () => {
		// Arrange
		const { admin, settings, env, vars } = await makeSettings({
			vars: { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "o", AI_MODEL_QUALITY: "anthropic:claude-haiku-5-5" },
			models: { quality: "openai:gpt-4.1-mini" },
		});
		const registry = createModelRegistry(env, vars, { models: () => ({ quality: "openai:gpt-4.1-mini" }) }, settings);
		const ids = () => registry.resolveChain("quality").map((m) => `${m.provider}:${m.modelId}`);
		expect(ids()).toEqual(["openai:gpt-4.1-mini"]);

		// Act
		await admin.setRouting({ tiers: { quality: { chain: ["anthropic:claude-sonnet-5-5", "openai:gpt-5.4-mini"], effort: "high", timeoutMs: 90_000 } } }, ACTOR);

		// Assert: Studio first
		expect(ids()).toEqual(["anthropic:claude-sonnet-5-5", "openai:gpt-5.4-mini"]);
		// resetting the tier hands it back to Payload
		await admin.setRouting({ tiers: { quality: null } }, ACTOR);
		expect(ids()).toEqual(["openai:gpt-4.1-mini"]);
	});

	it("TC-AIPROV-05: a Studio key makes a provider usable that env lacks, and the registry rebuilds on the change", async () => {
		const { admin, settings, env, vars } = await makeSettings({ vars: { AI_MODEL_FAST: "anthropic:claude-haiku-5-5" } });
		const registry = createModelRegistry(env, vars, undefined, settings);
		expect(() => registry.resolveChain("fast")).toThrow(ModelUnavailableError);

		await admin.setKey("anthropic", { apiKey: KEY }, ACTOR);

		expect(registry.resolveChain("fast").map((m) => m.provider)).toEqual(["anthropic"]);
	});

	it("TC-AIPROV-05: a disabled provider is skipped (chain and pictures) and enabling brings it back", async () => {
		const { admin, settings, env, vars } = await makeSettings({
			vars: { OPENAI_API_KEY: "o", ANTHROPIC_API_KEY: "a", AI_MODEL_FAST: "anthropic:claude-haiku-5-5, openai:gpt-4.1-nano", AI_MODEL_IMAGE: "openai:gpt-image-1" },
		});
		const registry = createModelRegistry(env, vars, undefined, settings);
		expect(registry.resolveChain("fast")).toHaveLength(2);
		expect(registry.resolveImageChain?.()).toHaveLength(1);

		await admin.setProvider("anthropic", { enabled: false }, ACTOR);
		await admin.setProvider("openai", { enabled: false }, ACTOR);
		expect(() => registry.resolveChain("fast")).toThrow(ModelUnavailableError);
		expect(registry.resolveImageChain?.()).toEqual([]);

		await admin.setProvider("openai", { enabled: true }, ACTOR);
		expect(registry.resolveChain("fast").map((m) => m.provider)).toEqual(["openai"]);
		expect(registry.resolveImageChain?.()).toHaveLength(1);
	});

	it("TC-AIPROV-05: a custom endpoint made in Studio is usable, with its key sent and its address used", async () => {
		// Arrange
		const { admin, settings, env, vars } = await makeSettings({ vars: { AI_MODEL_FAST: "compat-sealion:sea-lion-v4" } });
		const seen: Array<{ url: string; auth: string | null }> = [];
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			seen.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") });
			return Response.json({ id: "c", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "OK" } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
		});
		await admin.createEndpoint({ name: "sealion", baseUrl: "https://vllm.example.com/v1", apiKey: KEY, reasoning: false, structuredOutputs: true }, ACTOR);

		// Act
		const [model] = createModelRegistry(env, vars, undefined, settings).resolveChain("fast");
		await generateText({ model: model!.model, prompt: "hi" });

		// Assert
		expect(seen[0]).toEqual({ url: "https://vllm.example.com/v1/chat/completions", auth: `Bearer ${KEY}` });
	});

	it("TC-AIPROV-05: endpoint options reach the registry's reasoning switch", async () => {
		const { admin, settings } = await makeSettings();
		await admin.createEndpoint({ name: "local", baseUrl: "http://localhost:8000/v1", reasoning: true, structuredOutputs: false }, ACTOR);
		const vars = settings.overlayVars();
		expect(vars.AI_COMPAT_LOCAL_REASONING).toBe("true");
		expect(vars.AI_COMPAT_LOCAL_STRUCTURED_OUTPUTS).toBe("false");
		expect(vars.AI_COMPAT_LOCAL_BASE_URL).toBe("http://localhost:8000/v1");
	});

	it("TC-AIPROV-05: gateway address, token and paths from Studio replace env", async () => {
		const { admin, settings } = await makeSettings({ vars: { AI_GATEWAY_BASE_URL: "https://gateway.ai.cloudflare.com/v1/env/env" } });
		await admin.setGateway({ baseUrl: "https://gateway.ai.cloudflare.com/v1/studio/studio", token: "gateway-token-123456", paths: { anthropic: "anthropic/v2", openai: "openai" } }, ACTOR);
		const providerEnv = settings.providerEnv();
		expect(providerEnv.gatewayBaseUrl).toBe("https://gateway.ai.cloudflare.com/v1/studio/studio");
		expect(providerEnv.gatewayToken).toBe("gateway-token-123456");
		expect(providerEnv.vars.AI_GATEWAY_PATH_ANTHROPIC).toBe("anthropic/v2");
		// the default path is not pinned
		expect(settings.data().gateway?.paths).toEqual({ anthropic: "anthropic/v2" });
	});
});

describe("effective values and sources [TC-AIPROV-06]", () => {
	it("TC-AIPROV-06: chain, effort and timeout report studio, env or default per field", async () => {
		const { admin } = await makeSettings({ vars: { AI_MODEL_BALANCED: "openai:gpt-4.1-mini", AI_EFFORT_BALANCED: "low", AI_MODEL_TIMEOUT_MS: "45000" } });
		const before = (await admin.view()).routing.tiers;
		expect(before.fast).toMatchObject({ chainSource: "default", effort: DEFAULT_TIER_EFFORT.fast, effortSource: "default", timeoutMs: 45_000, timeoutSource: "env" });
		expect(before.balanced).toMatchObject({ chain: ["openai:gpt-4.1-mini"], chainSource: "env", effort: "low", effortSource: "env" });

		const after = (await admin.setRouting({ tiers: { balanced: { chain: ["openai:gpt-4.1-nano"], effort: null, timeoutMs: 20_000 } } }, ACTOR)).routing.tiers;

		expect(after.balanced).toMatchObject({ chain: ["openai:gpt-4.1-nano"], chainSource: "studio", effort: null, effortSource: "studio", timeoutMs: 20_000, timeoutSource: "studio" });
		expect(after.fast.chainSource).toBe("default");
	});

	it("TC-AIPROV-06: Payload's models show between Studio and env, picture format and timeout likewise", async () => {
		const { admin } = await makeSettings({ models: { fast: "openai:gpt-4.1-nano" }, vars: { AI_IMAGE_OUTPUT_FORMAT: "png" } });
		const view = await admin.view();
		expect(view.routing.tiers.fast.chain).toEqual(["openai:gpt-4.1-nano"]);
		expect(view.routing.tiers.image).toMatchObject({ format: "png", formatSource: "env", timeoutMs: 150_000, timeoutSource: "default" });
		const studio = (await admin.setRouting({ tiers: { image: { chain: ["openai:gpt-image-1-mini"], timeoutMs: 60_000, format: "webp" } } }, ACTOR)).routing.tiers.image;
		expect(studio).toMatchObject({ chain: ["openai:gpt-image-1-mini"], chainSource: "studio", format: "webp", formatSource: "studio", timeoutMs: 60_000 });
	});

	it("TC-AIPROV-06: providers report base URL and enabled sources; known models include the price book and the chains", async () => {
		const { admin } = await makeSettings({ vars: { AI_BASE_URL_OPENAI: "https://openai-proxy.example.com/v1", AI_MODEL_FAST: "openai:my-custom-model" } });
		const view = await admin.setProvider("anthropic", { baseUrl: "https://claude-proxy.example.com", enabled: false }, ACTOR);
		const get = (id: string) => view.providers.find((p) => p.id === id);
		expect(get("openai")).toMatchObject({ baseUrl: "https://openai-proxy.example.com/v1", baseUrlSource: "env", enabled: true, enabledSource: "default" });
		expect(get("anthropic")).toMatchObject({ baseUrl: "https://claude-proxy.example.com", baseUrlSource: "studio", enabled: false, enabledSource: "studio" });
		expect(get("deepseek")).toMatchObject({ baseUrl: "https://api.deepseek.com", baseUrlSource: "default" });
		expect(get("openai")?.models).toEqual(expect.arrayContaining(["gpt-5.4-mini", "my-custom-model"]));
		expect(get("anthropic")?.models).toContain("claude-haiku-5-5");
	});

	it("TC-AIPROV-06: env-defined custom endpoints are listed with their env values", async () => {
		const { admin } = await makeSettings({ vars: { AI_COMPAT_SEALION_BASE_URL: "http://vllm:8000/v1", AI_COMPAT_SEALION_REASONING: "true" } });
		const sealion = (await admin.view()).providers.find((p) => p.id === "compat-sealion");
		expect(sealion).toMatchObject({ kind: "compat", baseUrl: "http://vllm:8000/v1", baseUrlSource: "env", options: { reasoning: true, structuredOutputs: true } });
	});
});

describe("health [TC-AIPROV-07]", () => {
	it("TC-AIPROV-07: the first usable model serves; skipped ones say why", async () => {
		// Arrange
		const { admin, settings, store } = await makeSettings({
			vars: { OPENAI_API_KEY: "o", GOOGLE_GENERATIVE_AI_API_KEY: "g", DEEPSEEK_API_KEY: "d", AI_MODEL_FAST: "anthropic:claude-haiku-5-5, typesafe:jev-latest, compat-ghost:m, google:gemini-2.5-flash, deepseek:deepseek-flash, openai:gpt-4.1-nano" },
		});
		await admin.setProvider("google", { enabled: false }, ACTOR);
		const row = settings.row("deepseek");
		await store.apply({ providers: { upsert: [{ id: "deepseek", kind: "builtin", enabled: null, baseUrl: null, options: {}, secret: null, lastTest: { ok: false, at: "2026-10-30T10:00:00.000Z", ms: 5, model: "deepseek-flash", code: "invalid-key", message: "bad" }, updatedBy: null, updatedAt: new Date(), ...row }] } });
		await settings.reload();
		// a key sealed under another secret
		const other = await makeSettings({ vars: { ANTHROPIC_API_KEY: "" } });
		await other.admin.setKey("anthropic", { apiKey: KEY }, ACTOR);

		// Act
		const fast = (await admin.view()).health.fast;
		const rotated = { ...other.vars, AI_PROVIDER_SECRETS_KEY: "rotated-secret-rotated-secret-123456" };
		const reentry = new SettingsService(parseEnv(rotated), other.store, undefined, rotated);
		await reentry.reload();

		// Assert
		expect(fast.serving).toBe("openai:gpt-4.1-nano");
		expect(fast.state).toBe("fallback");
		expect(fast.skipped).toEqual([
			{ model: "anthropic:claude-haiku-5-5", reason: "no-key" },
			{ model: "typesafe:jev-latest", reason: "unknown-provider" },
			{ model: "compat-ghost:m", reason: "unknown-provider" },
			{ model: "google:gemini-2.5-flash", reason: "disabled" },
			{ model: "deepseek:deepseek-flash", reason: "last-test-failed" },
		]);
		const { skipReason } = await import("./settings-view");
		expect(skipReason(reentry, "anthropic", "claude-haiku-5-5", false)).toBe("needs-reentry");
	});

	it("TC-AIPROV-07: first choice when the head of the chain works; down when nothing does", async () => {
		const { admin } = await makeSettings({ vars: { ANTHROPIC_API_KEY: "a" } });
		const view = await admin.view();
		expect(view.health.fast).toMatchObject({ serving: "anthropic:claude-haiku-5-5", state: "first-choice" });
		expect(view.health.image).toMatchObject({ serving: null, state: "down" });
		expect(view.health.image.skipped).toEqual([{ model: "openai:gpt-image-1", reason: "no-key" }]);
	});

	it("TC-AIPROV-07: a gateway with a token makes keyless providers usable", async () => {
		const { admin } = await makeSettings({ vars: { AI_GATEWAY_BASE_URL: "https://gateway.ai.cloudflare.com/v1/a/b", AI_GATEWAY_TOKEN: "gateway-token-123456" } });
		expect((await admin.view()).health.fast.serving).toBe("anthropic:claude-haiku-5-5");
	});
});

describe("task overrides and runtime knobs [TC-AIPROV-08]", () => {
	it("TC-AIPROV-08: a task runs on its catalog tier until Studio moves it", async () => {
		const { admin, settings } = await makeSettings();
		const task = (await admin.view()).tasks.find((t) => t.id === "content.translate");
		expect(task).toMatchObject({ group: "Content", defaultTier: expect.any(String), override: null });
		expect(settings.taskTier("content.translate", "fast")).toBe("fast");

		const view = await admin.setTasks({ overrides: { "content.translate": "quality" } }, ACTOR);

		expect(view.tasks.find((t) => t.id === "content.translate")?.override).toBe("quality");
		expect(settings.taskTier("content.translate", "fast")).toBe("quality");
		await admin.setTasks({ overrides: { "content.translate": null } }, ACTOR);
		expect(settings.taskTier("content.translate", "fast")).toBe("fast");
	});

	it("TC-AIPROV-08: runtime knobs fall back studio -> env -> default, and null goes back", async () => {
		// Arrange
		const { admin, settings } = await makeSettings({ vars: { AI_DAILY_RUN_LIMIT_PER_ORG: "500" } });
		const row = async (key: string) => (await admin.view()).runtime.find((r) => r.key === key);
		expect(await row("runsPerDayPerShop")).toMatchObject({ value: 500, source: "env", default: 200, envName: "AI_DAILY_RUN_LIMIT_PER_ORG" });
		expect(await row("tasksPerDayPerShop")).toMatchObject({ value: 1000, source: "default" });
		expect(await row("toolRouting")).toMatchObject({ value: true, source: "default", type: "bool" });

		// Act
		await admin.setRuntime({ values: { runsPerDayPerShop: 50, toolRouting: false, suggestMode: "off", logRequests: "default" } }, ACTOR);

		// Assert
		expect(settings.runtimeEnv()).toMatchObject({ AI_DAILY_RUN_LIMIT_PER_ORG: 50, AI_TOOL_ROUTING: "off", AI_SUGGEST_MODE: "off", AI_LOG_REQUESTS: "default" });
		expect(await row("runsPerDayPerShop")).toMatchObject({ value: 50, source: "studio" });
		await admin.setRuntime({ values: { runsPerDayPerShop: null } }, ACTOR);
		expect(settings.runtimeEnv().AI_DAILY_RUN_LIMIT_PER_ORG).toBe(500);
	});

	it("TC-AIPROV-08: the model timeout knob is every tier's timeout unless the tier has its own", async () => {
		const { admin, settings } = await makeSettings();
		expect(settings.tierTimeoutMs("fast")).toBe(60_000);
		await admin.setRuntime({ values: { modelTimeoutMs: 30_000 } }, ACTOR);
		expect(settings.tierTimeoutMs("fast")).toBe(30_000);
		await admin.setRouting({ tiers: { quality: { chain: [], effort: "high", timeoutMs: 120_000 } } }, ACTOR);
		expect(settings.tierTimeoutMs("quality")).toBe(120_000);
		expect(settings.tierTimeoutMs("balanced")).toBe(30_000);
	});

	it("TC-AIPROV-08: queue wait plus run budget above 290 000 ms is refused, against the values in effect", async () => {
		const { admin } = await makeSettings();
		await expect(admin.setRuntime({ values: { queueMaxWaitMs: 100_000 } }, ACTOR)).rejects.toMatchObject({ errors: [{ path: ["values", "queueMaxWaitMs"] }] });
		await expect(admin.setRuntime({ values: { runBudgetMs: 250_000 } }, ACTOR)).rejects.toMatchObject({ errors: [{ path: ["values", "runBudgetMs"] }] });
		await admin.setRuntime({ values: { queueMaxWaitMs: 40_000, runBudgetMs: 250_000 } }, ACTOR);
	});

	it("TC-AIPROV-08: out-of-range and unknown values name the field", async () => {
		const { admin } = await makeSettings();
		await expect(admin.setRuntime({ values: { modelTimeoutMs: 10 } }, ACTOR)).rejects.toMatchObject({ errors: [{ path: ["values", "modelTimeoutMs"] }] });
		await expect(admin.setRuntime({ values: { suggestMode: "sometimes" } }, ACTOR)).rejects.toMatchObject({ errors: [{ path: ["values", "suggestMode"] }] });
		await expect(admin.setRuntime({ values: { nope: 1 } }, ACTOR)).rejects.toMatchObject({ errors: [{ path: ["values", "nope"] }] });
	});

	it("TC-AIPROV-08: an unreachable database keeps the last copy and never throws", async () => {
		const { settings, store, clock } = await makeSettings({ vars: { AI_RUNS_PER_MINUTE_PER_USER: "9" } });
		vi.spyOn(store, "load").mockRejectedValue(new Error("db down"));
		clock.now += 120_000;
		await expect(settings.reload()).resolves.toBeUndefined();
		expect(settings.runtimeEnv().AI_RUNS_PER_MINUTE_PER_USER).toBe(9);
	});
});

describe("defaults without any Studio data [TC-AIPROV-09]", () => {
	it("TC-AIPROV-09: behaviour is identical to env: the registry, runtime and timeouts read the same values", async () => {
		const { settings, env, vars } = await makeSettings({ vars: { OPENAI_API_KEY: "o", AI_MODEL_FAST: "openai:gpt-4.1-nano", AI_MODEL_TIMEOUT_MS: "33000" } });
		const withSettings = createModelRegistry(env, vars, undefined, settings).resolveChain("fast").map((m) => `${m.provider}:${m.modelId}`);
		const plain = createModelRegistry(env, vars).resolveChain("fast").map((m) => `${m.provider}:${m.modelId}`);
		expect(withSettings).toEqual(plain);
		expect(settings.tierTimeoutMs("fast")).toBe(33_000);
		expect(settings.imageTimeoutMs()).toBe(env.AI_IMAGE_TIMEOUT_MS);
		expect(settings.runtimeEnv()).toMatchObject({ AI_QUEUE_MAX_WAIT_MS: 90_000, AI_RUN_BUDGET_MS: 200_000, AI_THREAD_RETENTION_DAYS: 90 });
	});
});
