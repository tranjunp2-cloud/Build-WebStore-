import { Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { CONTEXT_TOKEN_AUDIENCE, CONTEXT_TOKEN_ISSUER, USAGE_SYNC_TOKEN_AUDIENCE, USAGE_SYNC_TOKEN_SUBJECT } from "../auth/context-token";
import { ENV } from "../config/config.module";
import { DB } from "../database/database.module";
import { startTestApp, testEnv } from "../testing/test-app";
import { UsageEventsController } from "./usage-events.controller";

// TC-AIUSE-03..05 — GET /internal/usage-events: sync-token auth (401 problem JSON otherwise), id paging, run context + battery cost.

const env = testEnv();

type Row = ReturnType<typeof baseRow>;
const row = (id: number, overrides: Partial<Row> = {}): Row => ({ ...baseRow(id), ...overrides });
const baseRow = (id: number) => ({
	id,
	organizationId: "org_1",
	userId: id % 2 ? "usr_1" : null,
	surface: "merchant",
	task: "agent.step",
	runId: null as string | null,
	provider: "openai",
	model: "gpt-4.1-mini",
	inputTokens: 10,
	outputTokens: 5,
	cachedInputTokens: null as number | null,
	costUsdMicros: 42 as number | null,
	latencyMs: 300,
	outcome: "ok",
	errorCode: null as string | null,
	errorDetail: null as string | null,
	createdAt: new Date(Date.UTC(2026, 9, 26, 8, 0, id)),
});

/** The run joined to a row (only rows with a runId have one). */
const RUN = { runDomain: "webbuilder", threadId: "thr_1", pagePath: "/editor/1", pageTitle: 'Online Store › Editor › page "Home"', pageModule: "editor" };
const NO_RUN = { runDomain: null, threadId: null, pagePath: null, pageTitle: null, pageModule: null };

function numericParam(node: unknown): number | undefined {
	if (typeof node !== "object" || node === null) return undefined;
	if ("value" in node && typeof (node as { value: unknown }).value === "number") return (node as { value: number }).value;
	const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
	for (const chunk of chunks ?? []) {
		const found = numericParam(chunk);
		if (found !== undefined) return found;
	}
	return undefined;
}

function sqlText(node: unknown, depth = 0): string {
	if (depth > 8 || typeof node !== "object" || node === null) return "";
	const value = (node as { value?: unknown }).value;
	if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join("");
	const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
	return (chunks ?? []).map((chunk) => sqlText(chunk, depth + 1)).join(" ");
}

/** A fake of the one query the controller makes: id > after, ordered by id, limited; remembers the limit it got. */
function fakeDb(total: number, rowsFor: (id: number) => Row = (id) => row(id)) {
	const seen: { limit: number; queries: number; where?: unknown } = { limit: 0, queries: 0 };
	let after = 0;
	const db = {
		select: () => ({
			from: () => ({
				leftJoin: () => ({
				where: (condition: { queryChunks: unknown[] }) => {
					// the bound `after` value is the numeric param of `id > $1` (nested inside and(...))
					seen.where = condition;
					after = numericParam(condition) ?? 0;
					return {
						orderBy: () => ({
							limit: async (n: number) => {
								seen.limit = n;
								seen.queries++;
								return Array.from({ length: total }, (_, i) => rowsFor(i + 1))
									.filter((r) => r.id > after)
									.slice(0, n)
									.map((r) => ({ event: r, ...(r.runId && r.runId !== "run_gone" ? RUN : NO_RUN) }));
							},
						}),
					};
				},
				}),
			}),
		}),
	};
	return { db, seen };
}

let app: NestFastifyApplication | undefined;
afterEach(async () => {
	await app?.close();
	app = undefined;
});

async function start(total: number, rowsFor?: (id: number) => Row) {
	const { db, seen } = fakeDb(total, rowsFor);
	@Module({ controllers: [UsageEventsController], providers: [{ provide: ENV, useValue: env }, { provide: DB, useValue: db }] })
	class UsageModule {}
	app = await startTestApp(UsageModule, env);
	return seen;
}

const sign = (options: { aud?: string; sub?: string } = {}) =>
	new SignJWT({})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(CONTEXT_TOKEN_ISSUER)
		.setAudience(options.aud ?? USAGE_SYNC_TOKEN_AUDIENCE)
		.setSubject(options.sub ?? USAGE_SYNC_TOKEN_SUBJECT)
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(new TextEncoder().encode(env.AI_PLATFORM_CONTEXT_SECRET));

const get = async (query = "", authorization?: string) =>
	app?.getHttpAdapter().getInstance().inject({ method: "GET", url: `/internal/usage-events${query}`, ...(authorization ? { headers: { authorization } } : {}) });

describe("usage events auth [TC-AIUSE-03]", () => {
	it("refuses a missing, malformed, wrong-audience or wrong-subject token without querying", async () => {
		// Arrange
		const seen = await start(3);
		const contextToken = await sign({ aud: CONTEXT_TOKEN_AUDIENCE });
		const otherSubject = await sign({ sub: "usr_1" });

		// Act
		const responses = [await get(), await get("", "Bearer nope"), await get("", `Bearer ${contextToken}`), await get("", `Bearer ${otherSubject}`), await get("", `Basic ${await sign()}`)];

		// Assert
		expect(responses.map((r) => r?.statusCode)).toEqual([401, 401, 401, 401, 401]);
		expect(responses[0]?.json()).toMatchObject({ title: "Unauthorized", status: 401 });
		expect(seen.queries).toBe(0);
	});
});

describe("usage events paging [TC-AIUSE-04]", () => {
	it("returns rows after the id in order with nextAfter = last id, and resumes from it", async () => {
		// Arrange
		await start(5);
		const auth = `Bearer ${await sign()}`;

		// Act
		const first = (await get("?after=0&limit=2", auth))?.json();
		const second = (await get(`?after=${first.nextAfter}&limit=2`, auth))?.json();
		const rest = (await get("?after=4", auth))?.json();
		const none = (await get("?after=5", auth))?.json();

		// Assert
		expect(first.events.map((e: { id: number }) => e.id)).toEqual([1, 2]);
		expect(first.nextAfter).toBe(2);
		expect(first.events[0]).toEqual({ ...row(1), batteryUsdMicros: 42, run: null, createdAt: "2026-10-26T08:00:01.000Z" });
		expect(second.events.map((e: { id: number }) => e.id)).toEqual([3, 4]);
		expect(rest).toMatchObject({ nextAfter: 5 });
		expect(none).toEqual({ events: [], nextAfter: 5 });
	});

	it("holds back rows younger than 2 minutes so an out-of-order commit is never skipped", async () => {
		// Arrange
		const seen = await start(2);
		// Act
		await get("?after=0", `Bearer ${await sign()}`);
		// Assert
		expect(sqlText(seen.where)).toContain("now() - interval '2 minutes'");
	});

	it("defaults after to 0 and limit to 500, caps the limit at 1000 and rejects bad numbers", async () => {
		// Arrange
		const seen = await start(2);
		const auth = `Bearer ${await sign()}`;

		// Act + Assert
		expect((await get("", auth))?.json().events).toHaveLength(2);
		expect(seen.limit).toBe(500);
		expect((await get("?limit=5000", auth))?.statusCode).toBe(400);
		expect((await get("?limit=1000", auth))?.statusCode).toBe(200);
		expect(seen.limit).toBe(1000);
		expect((await get("?after=-1", auth))?.statusCode).toBe(400);
		expect((await get("?after=abc", auth))?.statusCode).toBe(400);
	});
});

describe("usage events detail [TC-AIUSE-05]", () => {
	it("carries why a call failed: error code and detail [TC-AICP-366]", async () => {
		// Arrange
		const failed = row(1, { outcome: "error", errorCode: "AI_APICallError", errorDetail: "AI_APICallError 400: This model does not support assistant message prefill." });
		await start(1, () => failed);

		// Act
		const { events } = (await get("", `Bearer ${await sign()}`))?.json();

		// Assert
		expect(events[0]).toMatchObject({ outcome: "error", errorCode: "AI_APICallError", errorDetail: "AI_APICallError 400: This model does not support assistant message prefill." });
	});

	it("adds the run's context (never its prompt) and the battery cost: price, else fallback tokens; pictures 0", async () => {
		// Arrange
		const rows: Record<number, Row> = {
			1: row(1, { runId: "run_1", task: "agent.merchant-copilot" }),
			2: row(2, { costUsdMicros: null, inputTokens: 85_000, cachedInputTokens: 78_000, outputTokens: 500 }),
			3: row(3, { task: "media.generate-image", costUsdMicros: 42_000 }),
			4: row(4, { runId: "run_gone" }),
		};
		await start(4, (id) => rows[id] as Row);

		// Act
		const { events } = (await get("", `Bearer ${await sign()}`))?.json();

		// Assert
		expect(events[0].run).toEqual({ domain: "webbuilder", threadId: "thr_1", pagePath: "/editor/1", pageTitle: 'Online Store › Editor › page "Home"', pageModule: "editor" });
		expect(JSON.stringify(events)).not.toContain("prompt");
		expect(events[0].batteryUsdMicros).toBe(42);
		// 7 000 fresh × 0.3 + 78 000 cached × 0.006 + 500 out × 1.2
		expect(events[1].batteryUsdMicros).toBe(2_100 + 468 + 600);
		expect(events[2].batteryUsdMicros).toBe(0);
		// a run that is gone (chat deleted) gives no context rather than an empty one
		expect(events[3].run).toBeNull();
	});
});
