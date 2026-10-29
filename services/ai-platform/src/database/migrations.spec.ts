import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { MIGRATION_LOCK_SQL, MIGRATION_UNLOCK_SQL, MIGRATIONS, runMigrations } from "./migrations";

// TC-AISEC-060..061 — indexes for the hot reads: open questions on every work read, stale-run sweeps.

const statementsOf = (name: string) =>
	(MIGRATIONS.find((m) => m.name === name)?.sql ?? "")
		.split(";")
		.map((s) => s.replace(/\s+/g, " ").trim())
		.filter(Boolean);

describe("migrations", () => {
	it("TC-AISEC-060: are numbered in order with unique names", () => {
		// Arrange
		const names = MIGRATIONS.map((m) => m.name);

		// Act
		const numbers = names.map((name) => Number(name.slice(0, 3)));

		// Assert
		expect(new Set(names).size).toBe(names.length);
		expect(numbers).toEqual(numbers.map((_, i) => i + 1));
	});

	it("TC-AISEC-060: indexes a user's paused runs for the open-questions read", () => {
		// Arrange / Act
		const statements = statementsOf("012_ai_runs_awaiting_input_idx");

		// Assert
		expect(statements).toEqual([
			"CREATE INDEX IF NOT EXISTS ai_runs_awaiting_input_idx ON ai_runs (organization_id, user_id) WHERE status = 'awaiting_input'",
		]);
	});

	it("TC-AISEC-061: keeps exactly one in-flight index for the stale-run sweep (migration 010)", () => {
		// Arrange
		const all = MIGRATIONS.flatMap((m) => statementsOf(m.name));

		// Act
		const inFlight = all.filter((s) => s.includes("ai_runs_in_flight_idx"));

		// Assert
		expect(inFlight).toEqual(["CREATE INDEX IF NOT EXISTS ai_runs_in_flight_idx ON ai_runs (updated_at) WHERE status IN ('planning', 'running')"]);
		expect(statementsOf("010_ai_run_starts")).toContain(inFlight[0]);
	});
});

// TC-AIREL-297 — migrations run on one connection under a session advisory lock (two builds take turns),
// re-read what was applied under the lock, and always unlock + release, also on failure.

/** One connection; everything but the last migration already applied; `failing` SQL throws. */
function fakePool(failing?: string) {
	const queries: string[] = [];
	let connects = 0;
	const released: unknown[] = [];
	const client = {
		query: async (text: string) => {
			queries.push(text.replace(/\s+/g, " ").trim());
			if (text === failing) throw new Error("boom");
			if (text.startsWith("SELECT name")) return { rows: MIGRATIONS.slice(0, -1).map((m) => ({ name: m.name })) };
			return { rows: [] };
		},
		release: (error?: unknown) => void released.push(error ?? false),
	};
	const pool = {
		connect: async () => {
			connects += 1;
			return client;
		},
	} as unknown as Pool;
	return { pool, queries, released, connects: () => connects };
}

describe("migration lock [TC-AIREL-297]", () => {
	const last = MIGRATIONS[MIGRATIONS.length - 1] as { name: string; sql: string };

	it("TC-AIREL-297: locks, reads what was applied, applies the rest, then unlocks and releases", async () => {
		// Arrange
		const { pool, queries, released, connects } = fakePool();

		// Act
		await runMigrations(pool);

		// Assert
		expect(connects()).toBe(1);
		expect(queries[0]).toBe(MIGRATION_LOCK_SQL);
		expect(queries[1]).toMatch(/^CREATE TABLE IF NOT EXISTS ai_platform_migrations/);
		expect(queries[2]).toBe("SELECT name FROM ai_platform_migrations");
		expect(queries.slice(3, 4)).toEqual(["BEGIN"]);
		expect(queries.at(-2)).toBe("COMMIT");
		expect(queries.at(-1)).toBe(MIGRATION_UNLOCK_SQL);
		expect(queries.filter((q) => q === "BEGIN")).toHaveLength(1);
		expect(released).toEqual([false]);
	});

	it("TC-AIREL-297: a failing migration rolls back, still unlocks and releases, and throws", async () => {
		// Arrange
		const { pool, queries, released } = fakePool(last.sql);

		// Act
		const running = runMigrations(pool);

		// Assert
		await expect(running).rejects.toThrow("boom");
		expect(queries[0]).toBe(MIGRATION_LOCK_SQL);
		expect(queries.slice(-2)).toEqual(["ROLLBACK", MIGRATION_UNLOCK_SQL]);
		expect(queries).not.toContain("COMMIT");
		expect(released).toEqual([false]);
	});
});
