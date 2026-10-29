import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { Database } from "../database/database.module";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentThreadService } from "./agent-thread.service";
import { DrizzleAgentStore, RETENTION_BATCH } from "./drizzle-agent-store";
import { ThreadRetentionService } from "./thread-retention.service";

// TC-AIREL-295 — retention deletes in bounded batches (each its own transaction, ids under Postgres'
// 65 535 bind-parameter limit) until a short batch, and drops cached decisions past their TTL.

const dialect = new PgDialect();

/** A database that hands out idle threads / orphaned runs from pools, as Postgres would with LIMIT. */
function fakeDb(idleThreads: number, orphanRuns: number) {
	const threads = Array.from({ length: idleThreads }, (_, i) => `thr_${i}`);
	const orphans = Array.from({ length: orphanRuns }, (_, i) => `run_${i}`);
	const statements: { sql: string; params: unknown[]; tx: number }[] = [];
	let tx = 0;
	const execute = async (query: SQL) => {
		const { sql, params } = dialect.sqlToQuery(query);
		statements.push({ sql, params, tx });
		const limit = Number(params.at(-1));
		if (sql.startsWith("SELECT id FROM ai_threads")) return { rows: threads.splice(0, limit).map((id) => ({ id })), rowCount: null };
		if (sql.startsWith("SELECT r.id FROM ai_runs")) return { rows: orphans.splice(0, limit).map((id) => ({ id })), rowCount: null };
		// every deleted thread had two runs with one draft each
		if (sql.startsWith("DELETE FROM ai_runs WHERE thread_id")) return { rows: [], rowCount: params.length * 2 };
		if (sql.startsWith("DELETE FROM ai_change_sets WHERE run_id IN (SELECT")) return { rows: [], rowCount: params.length * 2 };
		return { rows: [], rowCount: params.length };
	};
	const db = {
		transaction: async <T>(work: (handle: unknown) => Promise<T>) => {
			tx += 1;
			return work({ execute });
		},
	};
	return { store: new DrizzleAgentStore(db as unknown as Database), statements, left: () => threads.length + orphans.length };
}

describe("retention in batches [TC-AIREL-295]", () => {
	it("TC-AIREL-295: deletes more idle threads than one batch holds, a batch per transaction", async () => {
		// Arrange
		const { store, statements, left } = fakeDb(2 * RETENTION_BATCH + 1, RETENTION_BATCH);

		// Act
		const counts = await store.purgeThreadsInactiveSince(new Date("2026-07-01T00:00:00Z"));

		// Assert
		expect(left()).toBe(0);
		expect(counts).toEqual({ threads: 1001, runs: 2002 + 500, changeSets: 2002 + 500 });
		// 3 thread batches (500, 500, 1) + 2 orphan batches (500, then an empty one)
		expect(new Set(statements.map((s) => s.tx)).size).toBe(5);
		expect(Math.max(...statements.map((s) => s.params.length))).toBeLessThanOrEqual(RETENTION_BATCH);
		const firstBatch = statements.filter((s) => s.tx === 1).map((s) => s.sql.split(" ").slice(0, 3).join(" "));
		expect(firstBatch).toEqual(["SELECT id FROM", "DELETE FROM ai_change_sets", "DELETE FROM ai_runs", "DELETE FROM ai_threads"]);
	});

	it("TC-AIREL-295: the sweep drops cached decisions older than AI_DECISION_CACHE_TTL_DAYS", async () => {
		// Arrange
		const now = new Date("2026-10-28T00:00:00Z");
		const store = new InMemoryAgentStore();
		const decision = { stage: "pick", provider: "typesafe", model: "jev", choice: "a", confidence: 0.9, probabilities: {} };
		await store.putDecision("org_1", "old", { ...decision, createdAt: new Date("2026-10-01T00:00:00Z") });
		await store.putDecision("org_1", "fresh", { ...decision, createdAt: new Date("2026-10-27T00:00:00Z") });
		const env = testEnv({ AI_DECISION_CACHE_TTL_DAYS: "7" });
		const retention = new ThreadRetentionService(store, new AgentThreadService(store, env), env);

		// Act
		await retention.sweep(now);

		// Assert
		expect([...store.decisions.keys()]).toEqual(["org_1:fresh"]);
	});
});
