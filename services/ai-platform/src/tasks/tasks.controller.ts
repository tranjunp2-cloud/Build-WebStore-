import { AI_TASK_IDS } from "@ech/ai-contracts";
import { Body, Controller, Get, Headers, HttpException, Param, Post, UseGuards } from "@nestjs/common";
import { AgentError } from "../agent/agent-errors";
import { AiContext, ContextGuard } from "../auth/context.guard";
import type { AiRequestContext } from "../auth/context-token";
import { TASK_DEFINITIONS } from "./catalog";
import { TaskEngine } from "./task-engine.service";

@Controller("v1/tasks")
@UseGuards(ContextGuard)
export class TasksController {
	constructor(private readonly engine: TaskEngine) {}

	@Get()
	list() {
		return AI_TASK_IDS.map((id) => {
			const definition = TASK_DEFINITIONS[id];
			return { id, alias: definition.alias, promptVersion: definition.promptVersion };
		});
	}

	@Post(":taskId/run")
	async run(
		@AiContext() ctx: AiRequestContext,
		@Param("taskId") taskId: string,
		@Body() body: { input?: unknown } | undefined,
		@Headers("idempotency-key") requestId?: string,
	) {
		try {
			return await this.engine.run(ctx, taskId, body?.input, requestId);
		} catch (error) {
			if (error instanceof AgentError) {
				throw new HttpException(
					{ title: "Task failed", status: error.status, detail: error.message, ...(error.code ? { code: error.code } : {}) },
					error.status,
				);
			}
			throw error;
		}
	}
}
