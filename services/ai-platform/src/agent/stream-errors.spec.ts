import type { AgentRun } from "@ech/agent-core";
import { Logger } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiRequestContext } from "../auth/context-token";
import { InMemoryAgentStore } from "../testing/in-memory-agent-store";
import { testEnv } from "../testing/test-app";
import { AgentError } from "./agent-errors";
import { AgentController } from "./agent.controller";

// TC-AIREL-296 — a failure that is not one of ours (a database error…) reaches the browser as a plain
// sentence over SSE; its detail goes to the log only. Our own refusals keep their message.

const ctx: AiRequestContext = { organizationId: "org_1", tenantId: "7", userId: "usr_1", email: "owner@shop.my" };
const paused: AgentRun = {
	id: "run_1",
	role: "merchant",
	domain: "cms",
	prompt: "write a note",
	status: "awaiting_input",
	steps: [],
	receipts: [],
	changeSetIds: [],
	startedAt: new Date().toISOString(),
};

async function answerOverSse(failure: Error): Promise<string[]> {
	const store = new InMemoryAgentStore();
	await store.createRun(ctx, paused, "write a note");
	const runs = {
		answer: async () => {
			throw failure;
		},
	};
	const controller = Reflect.construct(AgentController, [runs, {}, store, {}, {}, testEnv(), {}, {}]) as AgentController;
	const written: string[] = [];
	const raw = {
		writableEnded: false,
		writableFinished: false,
		once: () => undefined,
		writeHead: () => undefined,
		write: (chunk: string) => void written.push(chunk),
		end() {
			this.writableEnded = true;
		},
	};
	const reply = { hijack: () => undefined, raw } as unknown as FastifyReply;
	const request = { headers: { accept: "text/event-stream" } } as unknown as FastifyRequest;
	await controller.answerRun(ctx, "run_1", { toolCallId: "call_1", questionId: "tone", values: ["friendly"] }, request, reply);
	return written.map((chunk) => chunk.replace(/^data: /, "").trim());
}

describe("stream errors [TC-AIREL-296]", () => {
	afterEach(() => vi.restoreAllMocks());

	it("TC-AIREL-296: a database error is sent as a generic line and logged with its detail", async () => {
		// Arrange
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

		// Act
		const frames = await answerOverSse(new Error('relation "ai_runs" does not exist'));

		// Assert
		expect(frames.map((f) => JSON.parse(f))).toEqual([{ type: "run.error", message: "The run could not continue." }]);
		expect(frames.join("")).not.toContain("ai_runs");
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('relation "ai_runs" does not exist'));
	});

	it("TC-AIREL-296: our own refusal keeps its message", async () => {
		// Act
		const frames = await answerOverSse(new AgentError("This question was already answered.", 409));

		// Assert
		expect(frames.map((f) => JSON.parse(f))).toEqual([{ type: "run.error", message: "This question was already answered." }]);
	});
});
