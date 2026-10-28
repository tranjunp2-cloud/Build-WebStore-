import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "./migrations";

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
