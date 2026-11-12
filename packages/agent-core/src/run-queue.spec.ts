import { describe, expect, it } from "vitest";
import { AgentEventSchema, RunEventSchema, StartRunInputSchema } from "./events";
import { reduceRunEvent } from "./run-engine";
import { type AgentRun, AgentRunSchema, RunSuggestionSchema } from "./schemas";

// TC-AISEC-133 — the queue in the wire contract: a `queued` status, the `run.queued` frame (its place and what is
// working) folded into the run, a client request id on starts, and rule-made suggestions.

const run: AgentRun = {
	id: "run_1",
	role: "merchant",
	domain: "products",
	prompt: "write a post",
	status: "queued",
	steps: [],
	receipts: [],
	changeSetIds: [],
	startedAt: "2026-10-22T00:00:00Z",
};

const frame = {
	type: "run.queued" as const,
	runId: "run_1",
	position: 2,
	ahead: 1,
	running: [{ runId: "run_0", title: "Batik care", requestedBy: { name: null }, startedAt: "2026-10-22T00:00:00Z", mine: true, canStop: true }],
};

describe("queue contract [TC-AISEC-133]", () => {
	it("TC-AISEC-133: parses run.queued as a run event and an agent event", () => {
		// Act
		const asRun = RunEventSchema.safeParse(frame);
		const asAgent = AgentEventSchema.safeParse(frame);
		const bad = RunEventSchema.safeParse({ ...frame, position: 0 });

		// Assert
		expect(asRun.success).toBe(true);
		expect(asAgent.success).toBe(true);
		expect(bad.success).toBe(false);
	});

	it("TC-AISEC-133: folds the place into the run while queued and drops it once the run moves on", () => {
		// Act
		const waiting = reduceRunEvent({ ...run, status: "planning" }, frame);
		const started = reduceRunEvent(waiting, { type: "run.status", runId: "run_1", status: "planning" });
		const stopped = reduceRunEvent(waiting, { type: "run.status", runId: "run_1", status: "cancelled" });

		// Assert
		expect(waiting).toMatchObject({ status: "queued", queue: { position: 2, ahead: 1, running: frame.running } });
		expect(AgentRunSchema.parse(waiting).queue?.ahead).toBe(1);
		expect(started.status).toBe("planning");
		expect("queue" in started).toBe(false);
		expect(stopped).toMatchObject({ status: "cancelled" });
		expect(stopped.finishedAt).toBeDefined();
	});

	it("TC-AISEC-133: accepts a client request id up to 64 characters on a start", () => {
		expect(StartRunInputSchema.safeParse({ prompt: "hi", clientRequestId: "a".repeat(64) }).success).toBe(true);
		expect(StartRunInputSchema.safeParse({ prompt: "hi", clientRequestId: "a".repeat(65) }).success).toBe(false);
	});

	it("TC-AISEC-133: suggestions may say they were made by rules", () => {
		expect(RunSuggestionSchema.parse({ prompt: "Show my sales today", source: "rules" }).source).toBe("rules");
		expect(RunSuggestionSchema.parse({ prompt: "Show my sales today" }).source).toBe("model");
	});
});
