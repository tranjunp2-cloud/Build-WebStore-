import { describe, expect, it, vi } from "vitest";
import { AiClientError, createAiClient } from "./client";

describe("createAiClient [TC-AICP-15]", () => {
	it("posts typed input with the context token and validates the output against the contract", async () => {
		const fetcher = vi.fn(async () =>
			Response.json({
				taskId: "content.translate",
				promptVersion: "translate@1",
				requestId: "r1",
				output: { fields: { name: "Selendang batik" } },
				usage: { provider: "openai", model: "gpt-4.1-nano", costUsdMicros: 12, latencyMs: 300 },
			}),
		);
		const ai = createAiClient({ baseUrl: "http://ai:8300/", token: () => "tok", fetcher: fetcher as unknown as typeof fetch });
		const result = await ai.runTask("content.translate", { targetLocale: "ms-MY", fields: { name: "Batik scarf" } });
		expect(result.output.fields.name).toBe("Selendang batik");
		expect(result.usage.fallbacks).toEqual([]);
		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("http://ai:8300/v1/tasks/content.translate/run");
		expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
	});

	it("rejects outputs that break the contract and surfaces problem details", async () => {
		const bad = vi.fn(async () =>
			Response.json({ taskId: "content.seo-meta", promptVersion: "v", requestId: "r", output: { metaTitle: "" }, usage: { provider: "p", model: "m", costUsdMicros: null, latencyMs: 1 } }),
		);
		const ai = createAiClient({ baseUrl: "http://ai", token: () => "t", fetcher: bad as unknown as typeof fetch });
		await expect(ai.runTask("content.seo-meta", { locale: "en-US", title: "x" })).rejects.toThrow();

		const refused = vi.fn(async () => Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 }));
		const limited = createAiClient({ baseUrl: "http://ai", token: () => "t", fetcher: refused as unknown as typeof fetch });
		await expect(limited.runTask("content.seo-meta", { locale: "en-US", title: "x" })).rejects.toMatchObject({
			status: 429,
			message: "Your workspace reached today's AI limit.",
		});
		expect(AiClientError).toBeDefined();
	});

	it("[TC-AIRATE-06] carries the platform's problem code and Retry-After on the error", async () => {
		const busy = vi.fn(
			async () =>
				new Response(JSON.stringify({ detail: "The AI is busy right now. Try again in a minute.", code: "provider_rate_limited" }), {
					status: 429,
					headers: { "content-type": "application/json", "retry-after": "2" },
				}),
		);
		const ai = createAiClient({ baseUrl: "http://ai", token: () => "t", fetcher: busy as unknown as typeof fetch });

		const error = await ai.runTask("content.seo-meta", { locale: "en-US", title: "x" }).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(AiClientError);
		expect(error).toMatchObject({ status: 429, code: "provider_rate_limited", retryAfterMs: 2_000 });

		const plain = createAiClient({
			baseUrl: "http://ai",
			token: () => "t",
			fetcher: (async () => Response.json({ detail: "Your workspace reached today's AI limit." }, { status: 429 })) as unknown as typeof fetch,
		});
		const quota = (await plain.runTask("content.seo-meta", { locale: "en-US", title: "x" }).catch((e: unknown) => e)) as AiClientError;
		expect(quota.code).toBeUndefined();
		expect(quota.retryAfterMs).toBeUndefined();
	});
});
