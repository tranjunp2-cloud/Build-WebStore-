import { Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTEXT_TOKEN_ISSUER, USAGE_SYNC_TOKEN_AUDIENCE } from "../auth/context-token";
import { ENV } from "../config/config.module";
import { startTestApp, testEnv } from "../testing/test-app";
import { SettingsAdminService } from "./settings-admin.service";
import { SettingsController } from "./settings.controller";
import { ACTOR, makeSettings } from "./settings.spec-helper";

// TC-AIPROV-10..16 — /internal/settings: auth, every route (happy + 422), no secret in any answer, test endpoint, history + restore.

const env = testEnv();
const SECRET = env.AI_PLATFORM_CONTEXT_SECRET;
const KEY = "sk-studio-key-ABCDEFGH1234";

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	await app?.close();
	app = undefined;
	vi.restoreAllMocks();
});

async function start(options: Parameters<typeof makeSettings>[0] = {}) {
	const kit = await makeSettings(options);
	@Module({ controllers: [SettingsController], providers: [{ provide: ENV, useValue: env }, { provide: SettingsAdminService, useValue: kit.admin }] })
	class SettingsTestModule {}
	app = await startTestApp(SettingsTestModule, env);
	return kit;
}

async function token(claims: { actor?: unknown; sub?: string; aud?: string; iss?: string; iat?: number; secret?: string } = {}) {
	const jwt = new SignJWT({ actor: "actor" in claims ? claims.actor : ACTOR })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(claims.iss ?? CONTEXT_TOKEN_ISSUER)
		.setAudience(claims.aud ?? USAGE_SYNC_TOKEN_AUDIENCE)
		.setSubject(claims.sub ?? "settings-admin")
		.setIssuedAt(claims.iat)
		.setExpirationTime("10m");
	return jwt.sign(new TextEncoder().encode(claims.secret ?? SECRET));
}

async function call(method: string, url: string, body?: unknown, auth?: string | null) {
	const bearer = auth === undefined ? await token() : auth;
	const response = await app!.inject({
		method: method as "GET",
		url,
		headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
		...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
	});
	return { status: response.statusCode, body: response.json() as any, text: response.body };
}

describe("auth [TC-AIPROV-10]", () => {
	it("TC-AIPROV-10: no token, a bad signature, a wrong subject or audience, an old token and a missing actor are all 401", async () => {
		await start();
		const old = await token({ iat: Math.floor(Date.now() / 1000) - 3 * 60 });
		const cases: Array<string | null> = [
			null,
			await token({ secret: "another-secret-another-secret-another-1" }),
			await token({ sub: "usage-sync" }),
			await token({ aud: "ai-platform" }),
			await token({ iss: "someone" }),
			old,
			await token({ actor: undefined }),
			await token({ actor: { id: "u" } }),
		];
		for (const bearer of cases) {
			const { status } = await call("GET", "/internal/settings", undefined, bearer);
			expect(status).toBe(401);
		}
	});

	it("TC-AIPROV-10: a valid token with an actor is accepted on every method", async () => {
		await start();
		expect((await call("GET", "/internal/settings")).status).toBe(200);
		expect((await call("GET", "/internal/settings/history")).status).toBe(200);
		expect((await call("PUT", "/internal/settings/runtime", { values: {} })).status).toBe(200);
	});

	it("TC-AIPROV-10: a write without a token changes nothing", async () => {
		const { store } = await start();
		const { status } = await call("PUT", "/internal/settings/providers/openai/key", { apiKey: KEY }, null);
		expect(status).toBe(401);
		expect(store.data.providers).toEqual([]);
	});
});

describe("routes [TC-AIPROV-11]", () => {
	it("TC-AIPROV-11: GET /internal/settings answers the whole view", async () => {
		await start({ vars: { OPENAI_API_KEY: "o" } });
		const { status, body } = await call("GET", "/internal/settings");
		expect(status).toBe(200);
		expect(Object.keys(body).sort()).toEqual(["gateway", "health", "providers", "routing", "runtime", "tasks", "updatedAt"]);
		expect(body.providers.map((p: { id: string }) => p.id)).toEqual(["openai", "anthropic", "google", "deepseek", "openrouter", "typesafe"]);
		expect(Object.keys(body.routing.tiers).sort()).toEqual(["balanced", "fast", "image", "quality"]);
		expect(Object.keys(body.health).sort()).toEqual(["balanced", "fast", "image", "quality"]);
	});

	it("TC-AIPROV-11: provider, key, endpoint, gateway, routing, tasks and runtime writes answer the new view", async () => {
		await start();
		let r = await call("PUT", "/internal/settings/providers/openai", { enabled: false, baseUrl: "https://proxy.example.com/v1" });
		expect(r.body.providers.find((p: { id: string }) => p.id === "openai")).toMatchObject({ enabled: false, baseUrl: "https://proxy.example.com/v1" });
		r = await call("PUT", "/internal/settings/providers/openai/key", { apiKey: KEY });
		expect(r.body.providers.find((p: { id: string }) => p.id === "openai").key).toMatchObject({ state: "set", last4: "1234" });
		r = await call("DELETE", "/internal/settings/providers/openai/key");
		expect(r.body.providers.find((p: { id: string }) => p.id === "openai").key.state).toBe("none");
		r = await call("POST", "/internal/settings/endpoints", { name: "sealion", baseUrl: "http://vllm:8000/v1", apiKey: KEY, reasoning: true, structuredOutputs: false });
		expect(r.body.providers.find((p: { id: string }) => p.id === "compat-sealion")).toMatchObject({ kind: "compat", options: { reasoning: true, structuredOutputs: false } });
		r = await call("PUT", "/internal/settings/providers/compat-sealion", { options: { reasoning: false, structuredOutputs: true } });
		expect(r.body.providers.find((p: { id: string }) => p.id === "compat-sealion").options).toEqual({ reasoning: false, structuredOutputs: true });
		r = await call("DELETE", "/internal/settings/endpoints/sealion");
		expect(r.body.providers.find((p: { id: string }) => p.id === "compat-sealion")).toBeUndefined();
		r = await call("PUT", "/internal/settings/gateway", { baseUrl: "https://gateway.example.com/v1/a/b", token: "gateway-token-123456", paths: { anthropic: "anthropic/v2" } });
		expect(r.body.gateway).toMatchObject({ baseUrl: "https://gateway.example.com/v1/a/b", tokenSet: true, source: "studio" });
		expect(r.body.gateway.paths.anthropic).toBe("anthropic/v2");
		r = await call("PUT", "/internal/settings/gateway", { baseUrl: null, token: null, paths: {} });
		expect(r.body.gateway).toMatchObject({ baseUrl: null, tokenSet: false });
		r = await call("PUT", "/internal/settings/routing", { tiers: { quality: { chain: ["anthropic:claude-sonnet-5-5"], effort: "high", timeoutMs: 90_000 }, image: { chain: ["openai:gpt-image-1"], timeoutMs: 100_000, format: "webp" } } });
		expect(r.body.routing.tiers.quality).toMatchObject({ chain: ["anthropic:claude-sonnet-5-5"], effort: "high", timeoutMs: 90_000 });
		expect(r.body.routing.tiers.image).toMatchObject({ format: "webp", timeoutMs: 100_000 });
		r = await call("PUT", "/internal/settings/tasks", { overrides: { "content.translate": "quality" } });
		expect(r.body.tasks.find((t: { id: string }) => t.id === "content.translate").override).toBe("quality");
		r = await call("PUT", "/internal/settings/runtime", { values: { runsPerDayPerShop: 10 } });
		expect(r.body.runtime.find((x: { key: string }) => x.key === "runsPerDayPerShop")).toMatchObject({ value: 10, source: "studio" });
	});

	it("TC-AIPROV-11: invalid input is 422 with { errors: [{ path, message }] } and changes nothing", async () => {
		const { store } = await start();
		const bad: Array<[string, string, unknown, string[]]> = [
			["PUT", "/internal/settings/providers/nope", { enabled: true }, ["id"]],
			["PUT", "/internal/settings/providers/openai", { baseUrl: "ftp://x" }, ["baseUrl"]],
			["PUT", "/internal/settings/providers/openai", { options: { reasoning: true } }, ["options"]],
			["PUT", "/internal/settings/providers/openai/key", { apiKey: "short" }, ["apiKey"]],
			["PUT", "/internal/settings/providers/openai/key", { apiKey: "has spaces in the key" }, ["apiKey"]],
			["DELETE", "/internal/settings/providers/openai/key", undefined, ["id"]],
			["POST", "/internal/settings/endpoints", { name: "Bad Name", baseUrl: "http://x" }, ["name"]],
			["POST", "/internal/settings/endpoints", { name: "ok", baseUrl: "not a url" }, ["baseUrl"]],
			["DELETE", "/internal/settings/endpoints/ghost", undefined, ["name"]],
			["PUT", "/internal/settings/gateway", { baseUrl: "nope", paths: {} }, ["baseUrl"]],
			["PUT", "/internal/settings/gateway", { baseUrl: null, paths: { mystery: "x" } }, ["paths"]],
			["PUT", "/internal/settings/routing", { tiers: { fast: { chain: ["notamodelref"], effort: "high", timeoutMs: 60_000 } } }, ["tiers", "fast", "chain", "0"]],
			["PUT", "/internal/settings/routing", { tiers: { fast: { chain: [], effort: "loud", timeoutMs: 60_000 } } }, ["tiers", "fast", "effort"]],
			["PUT", "/internal/settings/routing", { tiers: { fast: { chain: [], effort: null, timeoutMs: 10 } } }, ["tiers", "fast", "timeoutMs"]],
			["PUT", "/internal/settings/routing", { tiers: { huge: null } }, ["tiers"]],
			["PUT", "/internal/settings/tasks", { overrides: { "content.translate": "turbo" } }, ["overrides", "content.translate"]],
			["PUT", "/internal/settings/tasks", { overrides: { "no.such": "fast" } }, ["overrides", "no.such"]],
			["PUT", "/internal/settings/runtime", { values: { queueMaxWaitMs: 280_000 } }, ["values", "queueMaxWaitMs"]],
			["GET", "/internal/settings/history?limit=0", undefined, ["limit"]],
			["POST", "/internal/settings/history/unknown/restore", undefined, ["id"]],
		];
		for (const [method, url, body, path] of bad) {
			const { status, body: answer } = await call(method, url, body);
			expect([method, url, status]).toEqual([method, url, 422]);
			expect(answer.errors[0].path).toEqual(path);
			expect(typeof answer.errors[0].message).toBe("string");
		}
		const arrayBody = await call("PUT", "/internal/settings/runtime", ["x"]);
		expect(arrayBody.status).toBe(422);
		expect(store.data.providers).toEqual([]);
		expect(store.history).toEqual([]);
	});

	it("TC-AIPROV-11: routing — a null tier resets it, omitted tiers stay, effort null is stored as 'send none'", async () => {
		await start();
		await call("PUT", "/internal/settings/routing", { tiers: { fast: { chain: ["openai:gpt-4.1-nano"], effort: null, timeoutMs: 20_000 }, balanced: { chain: ["openai:gpt-4.1-mini"], effort: "low", timeoutMs: 30_000 } } });
		const r = await call("PUT", "/internal/settings/routing", { tiers: { balanced: null } });
		expect(r.body.routing.tiers.fast).toMatchObject({ chainSource: "studio", effort: null, effortSource: "studio" });
		expect(r.body.routing.tiers.balanced.chainSource).toBe("default");
	});

	it("TC-AIPROV-11: tasks and runtime — null deletes the Studio value, absent keys stay", async () => {
		await start();
		await call("PUT", "/internal/settings/tasks", { overrides: { "content.translate": "quality", "content.seo-meta": "fast" } });
		await call("PUT", "/internal/settings/runtime", { values: { runsPerDayPerShop: 10, runsPerMinutePerUser: 2 } });
		const tasks = await call("PUT", "/internal/settings/tasks", { overrides: { "content.translate": null } });
		const runtime = await call("PUT", "/internal/settings/runtime", { values: { runsPerDayPerShop: null } });
		expect(tasks.body.tasks.find((t: { id: string }) => t.id === "content.translate").override).toBeNull();
		expect(tasks.body.tasks.find((t: { id: string }) => t.id === "content.seo-meta").override).toBe("fast");
		expect(runtime.body.runtime.find((x: { key: string }) => x.key === "runsPerDayPerShop").source).toBe("default");
		expect(runtime.body.runtime.find((x: { key: string }) => x.key === "runsPerMinutePerUser")).toMatchObject({ value: 2, source: "studio" });
	});
});

describe("secrets never leave [TC-AIPROV-12]", () => {
	it("TC-AIPROV-12: no response, history entry, snapshot, request log line or server log holds a key or token", async () => {
		// Arrange
		const lines: string[] = [];
		for (const method of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, method).mockImplementation((...args) => void lines.push(args.map(String).join(" ")));
		vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (lines.push(String(chunk)), true));
		const kit = await start();
		const token2 = "gateway-token-SECRET-9876";
		const answers: string[] = [];

		// Act
		for (const [method, url, body] of [
			["PUT", "/internal/settings/providers/anthropic/key", { apiKey: KEY }],
			["POST", "/internal/settings/endpoints", { name: "sealion", baseUrl: "http://vllm:8000/v1", apiKey: `${KEY}-endpoint` }],
			["PUT", "/internal/settings/gateway", { baseUrl: "https://gateway.example.com/v1/a/b", token: token2, paths: {} }],
			["PUT", "/internal/settings/providers/anthropic/key", { apiKey: `${KEY}-replaced` }],
			["GET", "/internal/settings", undefined],
			["GET", "/internal/settings/history?limit=200", undefined],
			["PUT", "/internal/settings/providers/anthropic/key", { apiKey: "short" }],
		] as const) {
			answers.push((await call(method, url, body)).text);
		}

		// Assert
		const everything = JSON.stringify({ answers, history: kit.store.history.map((h) => ({ ...h, at: 0 })), lines });
		for (const secret of [KEY, `${KEY}-endpoint`, `${KEY}-replaced`, token2]) expect(everything).not.toContain(secret);
		expect(kit.store.history.length).toBeGreaterThanOrEqual(4);
		// the key is sealed at rest
		expect(JSON.stringify(kit.store.data)).not.toContain(KEY);
		expect(kit.store.data.providers.find((p) => p.id === "anthropic")?.secret?.last4).toBe("aced");
	});
});

describe("connection test [TC-AIPROV-13]", () => {
	function failing(statusCode: number, message: string) {
		return new MockLanguageModelV4({
			doGenerate: async () => {
				throw new APICallError({ message, url: "https://x", requestBodyValues: {}, statusCode, responseBody: message });
			},
		});
	}
	const okModel = () =>
		new MockLanguageModelV4({
			doGenerate: async () => ({
				content: [{ type: "text", text: "OK" }],
				finishReason: { unified: "stop", raw: undefined },
				usage: { inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
				warnings: [],
			}),
		});

	it("TC-AIPROV-13: a working key is ok and remembered; the result carries the model and a time", async () => {
		const model = okModel();
		const kit = await start({ vars: { OPENAI_API_KEY: "o" }, tester: { createFactory: () => () => model } });
		const { status, body } = await call("POST", "/internal/settings/providers/openai/test", {});
		expect(status).toBe(200);
		expect(body).toMatchObject({ ok: true, code: "ok", model: "gpt-5.4-nano", ms: expect.any(Number), message: "Connected." });
		expect(model.doGenerateCalls[0]?.maxOutputTokens).toBeLessThanOrEqual(16);
		expect(kit.store.data.providers.find((p) => p.id === "openai")?.lastTest).toMatchObject({ ok: true });
	});

	it("TC-AIPROV-13: failures are classified invalid-key / quota / not-found / timeout / error", async () => {
		const outcomes: Array<[unknown, string]> = [
			[failing(401, "Incorrect API key provided"), "invalid-key"],
			[failing(429, "You exceeded your current quota, please check your plan"), "quota"],
			[failing(402, "Insufficient Balance"), "quota"],
			[failing(404, "model not found"), "not-found"],
			[failing(500, "upstream exploded"), "error"],
			[Object.assign(new Error("The operation timed out"), { name: "TimeoutError" }), "timeout"],
		];
		let next = 0;
		await start({
			vars: { OPENAI_API_KEY: "o" },
			tester: {
				createFactory: () => () => {
					const [model] = outcomes[next++]!;
					return model instanceof Error
						? new MockLanguageModelV4({ doGenerate: async () => { throw model; } })
						: (model as MockLanguageModelV4);
				},
			},
		});
		for (const [, code] of outcomes) {
			const { body } = await call("POST", "/internal/settings/providers/openai/test", { model: "gpt-5.4-mini" });
			expect([body.ok, body.code]).toEqual([false, code]);
			expect(body.model).toBe("gpt-5.4-mini");
		}
	});

	it("TC-AIPROV-13: an unsaved key is tested but never saved or remembered, and the provider's echo of it is hidden", async () => {
		const unsaved = "sk-unsaved-key-ZZZZ9999";
		let usedKey: string | undefined;
		const kit = await start({
			tester: {
				createFactory: (_id, providerEnv) => {
					usedKey = providerEnv.vars.OPENAI_API_KEY;
					return () => failing(401, `Incorrect API key provided: ${unsaved}`);
				},
			},
		});
		const { body, text } = await call("POST", "/internal/settings/providers/openai/test", { apiKey: unsaved });
		expect(usedKey).toBe(unsaved);
		expect(body.code).toBe("invalid-key");
		expect(text).not.toContain(unsaved);
		expect(kit.store.data.providers).toEqual([]);
		expect(kit.store.history).toEqual([]);
	});

	it("TC-AIPROV-13: without a key the stored Studio key is the one tested, else the env key", async () => {
		const used: Array<string | undefined> = [];
		await start({ vars: { OPENAI_API_KEY: "sk-env-key-00000000" }, tester: { createFactory: (_id, providerEnv) => ((used.push(providerEnv.vars.OPENAI_API_KEY), () => okModel())) } });
		await call("POST", "/internal/settings/providers/openai/test", {});
		await call("PUT", "/internal/settings/providers/openai/key", { apiKey: KEY });
		await call("POST", "/internal/settings/providers/openai/test", {});
		expect(used).toEqual(["sk-env-key-00000000", KEY]);
	});

	it("TC-AIPROV-13: an endpoint with no chat model is tested through its model list; System One through a tiny question", async () => {
		const urls: string[] = [];
		const fetchFn = vi.fn(async (input: RequestInfo | URL) => (urls.push(String(input)), new Response("{}", { status: String(input).includes("systemone") ? 422 : 401 })));
		await start({ vars: { AI_COMPAT_LOCAL_BASE_URL: "http://vllm:8000/v1", TYPESAFE_API_KEY: "ts-key-12345678" }, tester: { fetchFn: fetchFn as unknown as typeof fetch } });
		const models = await call("POST", "/internal/settings/providers/compat-local/test", {});
		const systemOne = await call("POST", "/internal/settings/providers/typesafe/test", {});
		expect(urls).toEqual(["http://vllm:8000/v1/models", "https://api.typesafe.ai/v1/systemone"]);
		expect(models.body).toMatchObject({ ok: false, code: "invalid-key", model: "models list" });
		expect(systemOne.body).toMatchObject({ ok: true, code: "ok" });
	});

	it("TC-AIPROV-13: a passing model-list test remembers the endpoint's model ids so Routing can offer them", async () => {
		// Arrange
		const listing = { data: [{ id: "my-llama-70b" }, { id: "my-llama-70b" }, { id: "qwen-local" }, { id: 7 }] };
		const fetchFn = vi.fn(async () => new Response(JSON.stringify(listing), { status: 200 }));
		await start({ vars: { AI_COMPAT_VLLM_BASE_URL: "http://vllm:8000/v1" }, tester: { fetchFn: fetchFn as unknown as typeof fetch } });
		// Act
		const tested = await call("POST", "/internal/settings/providers/compat-vllm/test", {});
		const view = await call("GET", "/internal/settings");
		// Assert
		expect(tested.body).toMatchObject({ ok: true, code: "ok", models: ["my-llama-70b", "qwen-local"] });
		const endpoint = view.body.providers.find((p: { id: string }) => p.id === "compat-vllm");
		expect(endpoint.models).toEqual(expect.arrayContaining(["my-llama-70b", "qwen-local"]));
	});

	it("TC-AIPROV-13: more than 10 tests a minute per provider is 429, other providers are unaffected", async () => {
		const kit = await start({ vars: { OPENAI_API_KEY: "o", ANTHROPIC_API_KEY: "a" }, tester: { createFactory: () => () => okModel() } });
		for (let i = 0; i < 10; i++) expect((await call("POST", "/internal/settings/providers/openai/test", {})).status).toBe(200);
		const limited = await call("POST", "/internal/settings/providers/openai/test", {});
		expect(limited.status).toBe(429);
		expect(limited.body).toEqual({ errors: [{ path: [], message: "Too many tests, try again in a minute." }] });
		expect((await call("POST", "/internal/settings/providers/anthropic/test", {})).status).toBe(200);
		kit.clock.now += 61_000;
		expect((await call("POST", "/internal/settings/providers/openai/test", {})).status).toBe(200);
	});

	it("TC-AIPROV-13: testing an unknown provider is 422", async () => {
		await start();
		expect((await call("POST", "/internal/settings/providers/ghost/test", {})).status).toBe(422);
	});
});

describe("history and restore [TC-AIPROV-14]", () => {
	it("TC-AIPROV-14: every write records a plain-English entry with the actor; keys are not restorable", async () => {
		await start({ vars: { AI_MODEL_QUALITY: "anthropic:claude-haiku-5-5" } });
		await call("PUT", "/internal/settings/providers/anthropic/key", { apiKey: KEY });
		await call("PUT", "/internal/settings/providers/anthropic/key", { apiKey: `${KEY}2` });
		await call("PUT", "/internal/settings/routing", { tiers: { quality: { chain: ["anthropic:claude-haiku-5-5", "anthropic:claude-sonnet-5-5"], effort: "high", timeoutMs: 90_000 } } });
		await call("PUT", "/internal/settings/providers/anthropic", { enabled: false });
		await call("DELETE", "/internal/settings/providers/anthropic/key");
		const { body } = await call("GET", "/internal/settings/history");
		expect(body.entries.map((e: { summary: string; area: string; restorable: boolean }) => [e.area, e.summary, e.restorable])).toEqual([
			["keys", "Anthropic key removed", false],
			["providers", "Anthropic turned off", true],
			// only what changed against what ran before (effort stayed high), with full provider:model refs
			["routing", "Quality models: anthropic:claude-haiku-5-5 → anthropic:claude-sonnet-5-5 (was anthropic:claude-haiku-5-5); Quality timeout: 90s (was 60s)", true],
			["keys", "Anthropic key replaced", false],
			["keys", "Anthropic key added", false],
		]);
		expect(body.entries[0].actor).toEqual(ACTOR);
		expect(Object.keys(body.entries[0]).sort()).toEqual(["actor", "area", "at", "id", "restorable", "summary"]);
		const filtered = await call("GET", "/internal/settings/history?area=routing&limit=1");
		expect(filtered.body.entries).toHaveLength(1);
	});

	it("TC-AIPROV-14: restoring a version brings back the non-secret settings and leaves keys alone", async () => {
		// Arrange
		const kit = await start();
		await call("PUT", "/internal/settings/routing", { tiers: { fast: { chain: ["openai:gpt-4.1-nano"], effort: "low", timeoutMs: 20_000 } } });
		await call("PUT", "/internal/settings/runtime", { values: { runsPerDayPerShop: 10 } });
		const target = (await call("GET", "/internal/settings/history")).body.entries[0].id as string; // state after the runtime change
		await call("PUT", "/internal/settings/providers/openai/key", { apiKey: KEY });
		await call("PUT", "/internal/settings/providers/openai", { enabled: false });
		await call("PUT", "/internal/settings/routing", { tiers: { fast: null, quality: { chain: ["openai:gpt-4.1-mini"], effort: "high", timeoutMs: 80_000 } } });
		await call("PUT", "/internal/settings/runtime", { values: { runsPerDayPerShop: 99 } });
		await call("PUT", "/internal/settings/tasks", { overrides: { "content.translate": "quality" } });
		const sealedBefore = JSON.stringify(kit.store.data.providers.find((p) => p.id === "openai")?.secret);

		// Act
		const { status, body } = await call("POST", `/internal/settings/history/${target}/restore`);

		// Assert
		expect(status).toBe(200);
		expect(body.routing.tiers.fast).toMatchObject({ chain: ["openai:gpt-4.1-nano"], chainSource: "studio", timeoutMs: 20_000 });
		expect(body.routing.tiers.quality.chainSource).toBe("default");
		expect(body.runtime.find((x: { key: string }) => x.key === "runsPerDayPerShop").value).toBe(10);
		expect(body.tasks.find((t: { id: string }) => t.id === "content.translate").override).toBeNull();
		const openai = body.providers.find((p: { id: string }) => p.id === "openai");
		expect(openai).toMatchObject({ enabled: true, key: { state: "set", last4: "1234" } });
		expect(JSON.stringify(kit.store.data.providers.find((p) => p.id === "openai")?.secret)).toBe(sealedBefore);
		const latest = (await call("GET", "/internal/settings/history?limit=1")).body.entries[0];
		expect(latest.area).toBe("restore");
		expect(latest.summary).toMatch(/^Restored the settings as of /);
	});

	it("TC-AIPROV-14: a keys entry cannot be restored", async () => {
		await start();
		await call("PUT", "/internal/settings/providers/openai/key", { apiKey: KEY });
		const id = (await call("GET", "/internal/settings/history")).body.entries[0].id as string;
		const { status, body } = await call("POST", `/internal/settings/history/${id}/restore`);
		expect(status).toBe(422);
		expect(body.errors[0].path).toEqual(["id"]);
	});

	it("TC-AIPROV-14: restoring leaves a custom endpoint created later, with its key", async () => {
		const kit = await start();
		await call("PUT", "/internal/settings/runtime", { values: { runsPerDayPerShop: 10 } });
		const id = (await call("GET", "/internal/settings/history")).body.entries[0].id as string;
		await call("POST", "/internal/settings/endpoints", { name: "later", baseUrl: "http://x:1/v1", apiKey: KEY });
		await call("POST", `/internal/settings/history/${id}/restore`);
		expect(kit.store.data.providers.find((p) => p.id === "compat-later")?.secret).not.toBeNull();
	});
});
