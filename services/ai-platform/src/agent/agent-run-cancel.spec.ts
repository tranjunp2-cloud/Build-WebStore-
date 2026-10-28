import { EventEmitter } from "node:events";
import type { AgentRun } from "@ech/agent-core";
import { MockLanguageModelV4 } from "ai/test";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import type { UsageLedger } from "../ledger/usage-ledger";
import type { ModelRegistry } from "../models/model-registry";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentController } from "./agent.controller";
import { AgentRunService } from "./agent-run.service";
import { AgentThreadService } from "./agent-thread.service";

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const usage = {
	inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: undefined },
	outputTokens: { total: 10, text: 10, reasoning: undefined },
};
const ledger: UsageLedger = { record: async () => undefined, countSince: async () => 0 };

/** A "process": its own AgentRunService (own in-memory `active` map) over the shared store, i.e. one DB. */
function instance(store: InMemoryAgentStore, model: MockLanguageModelV4) {
	const env = testEnv({ AI_RUN_CANCEL_POLL_MS: "100" });
	const models: ModelRegistry = { resolveChain: () => [{ model, provider: "openai", modelId: "gpt-4.1-mini" }] };
	return new AgentRunService(store, models, ledger, env, new AgentThreadService(store, env));
}

/** Answers only when its call is aborted — or after `answerAfterMs` when given. */
function slowModel(opts: { answerAfterMs?: number } = {}) {
	let started: () => void = () => undefined;
	const hasStarted = new Promise<void>((resolve) => {
		started = resolve;
	});
	const model = new MockLanguageModelV4({
		doGenerate: (options: CallOptions) =>
			new Promise((resolve, reject) => {
				started();
				options.abortSignal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
				if (opts.answerAfterMs !== undefined) {
					setTimeout(
						() =>
							resolve({
								content: [{ type: "text", text: "All done." }],
								finishReason: { unified: "stop", raw: undefined },
								usage,
								warnings: [],
							}),
						opts.answerAfterMs,
					);
				}
			}),
	});
	return { model, hasStarted };
}

function startOn(service: AgentRunService) {
	let runId = "";
	const running = service.start(ctx, { prompt: "Analyse my products" }, (frame) => {
		if (frame.type === "run.started") runId = frame.run.id;
	});
	return { running, runId: () => runId };
}

describe("Stop across instances", () => {
	it("[TC-AIREL-09] a Stop sent to another instance aborts the run that is driving", async () => {
		// Arrange: instance A drives the run, instance B (same database) receives the Stop
		const store = new InMemoryAgentStore();
		const { model, hasStarted } = slowModel();
		const driver = instance(store, model);
		const other = instance(store, slowModel().model);
		const { running, runId } = startOn(driver);
		await hasStarted;

		// Act
		const answer = await other.cancel(ctx, runId());
		const run = await running;

		// Assert: B closed the row, A saw it on its next poll, aborted the model call and finished as cancelled
		expect(answer.status).toBe("cancelled");
		expect(run.status).toBe("cancelled");
		expect(run.error).toBeUndefined();
		expect(await store.getRunStatus("org_1", run.id)).toBe("cancelled");
	});

	it("[TC-AIREL-10] a failing cancel poll never fails the run", async () => {
		// Arrange: the status read throws while the model is still working
		const store = new InMemoryAgentStore();
		const getStatus = vi.spyOn(store, "getRunStatus").mockRejectedValue(new Error("connection reset"));
		const { model } = slowModel({ answerAfterMs: 450 });
		const driver = instance(store, model);

		// Act
		const run = await startOn(driver).running;

		// Assert
		expect(getStatus).toHaveBeenCalled();
		expect(run.status).toBe("applied");
		expect(run.answer).toBe("All done.");
	});

	it("[TC-AIREL-10] polls only while the run is working", async () => {
		// Arrange
		const store = new InMemoryAgentStore();
		const getStatus = vi.spyOn(store, "getRunStatus");
		const driver = instance(store, slowModel({ answerAfterMs: 250 }).model);

		// Act
		await startOn(driver).running;
		const callsAtEnd = getStatus.mock.calls.length;
		await new Promise((resolve) => setTimeout(resolve, 350));

		// Assert
		expect(callsAtEnd).toBeGreaterThan(0);
		expect(getStatus).toHaveBeenCalledTimes(callsAtEnd);
	});
});

describe("SSE stream closing", () => {
	/** A reply whose raw socket the test can close; the work (a run) stays pending until `finish()`. */
	function openStream(abortOnDisconnect: boolean) {
		const raw = Object.assign(new EventEmitter(), {
			writableFinished: false,
			writableEnded: false,
			writeHead: vi.fn(),
			write: vi.fn(),
			end: vi.fn(),
		});
		const reply = { hijack: vi.fn(), raw } as unknown as FastifyReply;
		let finish: () => void = () => undefined;
		const runs = {
			reserve: vi.fn(async () => ({ runId: "run_1", queued: false, replay: false })),
			cancel: vi.fn(async () => ({}) as AgentRun),
			start: vi.fn(async (_ctx: unknown, _input: unknown, emit: (frame: unknown) => void) => {
				emit({ type: "run.started", run: { id: "run_1" } });
				await new Promise<void>((resolve) => {
					finish = resolve;
				});
				return {} as AgentRun;
			}),
		};
		const env = testEnv({ AI_ABORT_RUN_ON_DISCONNECT: String(abortOnDisconnect) });
		const controller = new AgentController(
			runs as never,
			{} as never,
			{} as never,
			{ open: vi.fn(async () => ({ id: "thr_1" })) } as never,
			{} as never,
			env,
			{} as never,
			{ nudge: vi.fn(() => null) } as never,
		);
		const request = { headers: { accept: "text/event-stream" } } as unknown as FastifyRequest;
		const started = controller.startRun(ctx, { prompt: "hello" }, request, reply);
		return { raw, runs, started, finish: () => finish() };
	}

	it("[TC-AIREL-11] cancels the run when the browser closes the stream and the flag is on", async () => {
		// Arrange
		const stream = openStream(true);
		await vi.waitFor(() => expect(stream.raw.write).toHaveBeenCalled());

		// Act
		stream.raw.emit("close");
		stream.finish();
		await stream.started;

		// Assert
		expect(stream.runs.cancel).toHaveBeenCalledWith(ctx, "run_1");
	});

	it("[TC-AIREL-11] leaves the run going when the stream closes and the flag is off (default)", async () => {
		// Arrange
		const stream = openStream(false);
		await vi.waitFor(() => expect(stream.raw.write).toHaveBeenCalled());

		// Act
		stream.raw.emit("close");
		stream.finish();
		await stream.started;

		// Assert
		expect(stream.runs.cancel).not.toHaveBeenCalled();
	});

	it("[TC-AIREL-11] does not cancel a run whose stream ended normally", async () => {
		// Arrange
		const stream = openStream(true);
		await vi.waitFor(() => expect(stream.raw.write).toHaveBeenCalled());

		// Act: the stream finishes, then the socket closes as it always does
		stream.finish();
		await stream.started;
		stream.raw.writableFinished = true;
		stream.raw.emit("close");

		// Assert
		expect(stream.runs.cancel).not.toHaveBeenCalled();
	});
});
