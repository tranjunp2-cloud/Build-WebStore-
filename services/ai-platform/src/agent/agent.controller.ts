import {
	AnswerInputSchema,
	type AutonomyPolicy,
	ChangeSetResultSchema,
	ChangeSetStatusSchema,
	RenameThreadInputSchema,
	StartRunInputSchema,
	WorkStateInputSchema,
} from "@ech/agent-core";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpException,
	Inject,
	Logger,
	NotFoundException,
	NotImplementedException,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AiContext, ContextGuard } from "../auth/context.guard";
import { keepInvocationFor } from "../pending-work";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { AgentError } from "./agent-errors";
import { AgentRunService, type RunFrame } from "./agent-run.service";
import { AGENT_STORE, type AgentStore } from "./agent-store";
import { AgentThreadService } from "./agent-thread.service";
import { AgentWorkService, WORK_KEY_MAX } from "./agent-work.service";
import { AttachmentService, AttachmentUploadSchema } from "./attachment.service";
import { forCaller, seesTeamDrafts } from "./change-set-access";
import { ChangeSetDecisionService } from "./change-set-decision.service";
import { keepStreamAlive } from "./sse-keepalive";
import { THREAD_BUSY } from "./run-queue";
import { StaleRunSweeper } from "./stale-run-sweeper";

const MAX_PROMPT_CHARS = 4000;
/** A repeated start waits this long (×tries) for the first one's run row. */
const REPLAY_WAIT_MS = 300;
const REPLAY_TRIES = 10;
// Wire schemas come from @ech/agent-core (its own zod copy); never nest them
// inside this package's zod objects — parse each with its own schema instead.
const DecisionBodySchema = z.object({
	decision: z.enum(["approve", "reject"]),
	note: z.string().max(1000).optional(),
	result: z.unknown().optional(),
	// `actor` from the browser is ignored — the decider comes from the context token.
	actor: z.string().optional(),
});
/** The `run.error` line for a failure that is not one of ours (its detail goes to the log, never the browser). */
const STREAM_FAILED = "The run could not continue.";
const LimitSchema = z.coerce.number().int().min(1).max(100).catch(20);
/** "product:123" → { kind, id }; anything else lists every chat. */
export function threadEntityQuery(value: unknown): { kind: string; id: string } | undefined {
	if (typeof value !== "string") return undefined;
	const match = /^([a-z][a-z_]{0,39}):(.{1,120})$/.exec(value);
	return match ? { kind: match[1] as string, id: match[2] as string } : undefined;
}

/** `task=<key>`: the chats of that to-do item; absent or blank lists every chat. */
export function threadTaskQuery(value: unknown): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	if (value.length > WORK_KEY_MAX) throw problem(400, `task must be at most ${WORK_KEY_MAX} characters.`);
	return value;
}

const ThreadLimitSchema = z.coerce
	.number()
	.int()
	.min(1)
	.catch(20)
	.transform((n) => Math.min(n, 50));

/** Nothing autonomous yet: every write is staged for approval. */
const DEFAULT_AUTONOMY: AutonomyPolicy = {
	domains: { products: { level: "stage" }, cms: { level: "stage" } },
	protectedFields: [],
	autoSendMaxConfidence: 0.8,
};

const PROBLEM_TITLES: Record<number, string> = { 403: "Forbidden", 413: "Payload Too Large", 429: "Too Many Requests" };

function problem(status: number, detail: string): HttpException {
	return new HttpException({ title: PROBLEM_TITLES[status] ?? "Request failed", status, detail }, status);
}

/** Structural so schemas from workspace packages (their own zod copy) fit too. */
interface SafeParser<T> {
	safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
}

function parse<T>(schema: SafeParser<T>, value: unknown): T {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw problem(400, parsed.error.issues.map((i) => i.message).join("; "));
	return parsed.data;
}

async function mapErrors<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof AgentError) throw problem(error.status, error.message);
		throw error;
	}
}

@Controller("agent")
@UseGuards(ContextGuard)
export class AgentController {
	private readonly logger = new Logger(AgentController.name);

	constructor(
		private readonly runs: AgentRunService,
		private readonly decisions: ChangeSetDecisionService,
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		private readonly threads: AgentThreadService,
		private readonly attachments: AttachmentService,
		@Inject(ENV) private readonly env: Env,
		private readonly work: AgentWorkService,
		private readonly staleRuns: StaleRunSweeper,
	) {}

	/**
	 * Streams a run's frames as SSE (hijacked reply); errors become a `run.error` frame.
	 * Closing the stream does not stop the run (the chat restores it after a reload) unless
	 * AI_ABORT_RUN_ON_DISCONNECT is on; then the run is cancelled like the Stop button would.
	 */
	private async stream(
		ctx: AiRequestContext,
		reply: FastifyReply,
		work: (emit: (frame: RunFrame | { type: "run.error"; message: string }) => void) => Promise<unknown>,
		knownRunId?: string,
	): Promise<void> {
		reply.hijack();
		const raw = reply.raw;
		let runId = knownRunId;
		if (this.env.AI_ABORT_RUN_ON_DISCONNECT) {
			raw.once("close", () => {
				if (raw.writableFinished || !runId) return;
				this.runs.cancel(ctx, runId).catch(() => undefined); // already finished or gone: nothing to stop
			});
		}
		raw.writeHead(200, {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
			"x-accel-buffering": "no",
		});
		const emit = (frame: RunFrame | { type: "run.error"; message: string }) => {
			if (frame.type === "run.started") runId = frame.run.id;
			// a draft staged in the caller's own run: theirs, with what they may do with it (a viewer's waits for an owner / admin)
			const sent = frame.type === "changeset.staged" ? { ...frame, changeSet: forCaller(ctx, frame.changeSet, ctx.userId) } : frame;
			if (!raw.writableEnded) raw.write(`data: ${JSON.stringify(sent)}\n\n`);
		};
		const stopPing = keepStreamAlive(raw);
		const running = work(emit);
		keepInvocationFor(raw, running);
		try {
			await running;
		} catch (error) {
			// our own refusals are written for the merchant; anything else (a database error…) stays in the log
			if (!(error instanceof AgentError)) {
				this.logger.warn(`run ${runId ?? "-"} stream failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
			}
			emit({ type: "run.error", message: error instanceof AgentError ? error.message : STREAM_FAILED });
		} finally {
			stopPing();
			raw.end();
		}
	}

	@Get("insights")
	insights() {
		return [];
	}

	@Get("conversations")
	conversations() {
		return [];
	}

	@Get("autonomy")
	autonomy(): AutonomyPolicy {
		return DEFAULT_AUTONOMY;
	}

	@Put("autonomy/:domain")
	setAutonomy() {
		throw new NotImplementedException({ title: "Not implemented", detail: "Autonomy levels are fixed to 'stage'." });
	}

	@Get("runs")
	listRuns(@AiContext() ctx: AiRequestContext, @Query("limit") limit?: string) {
		return this.store.listRuns(ctx.organizationId, LimitSchema.parse(limit), ctx.userId);
	}

	@Get("runs/:id")
	getRun(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		return this.store.getRun(ctx.organizationId, id, ctx.userId);
	}

	@Post("runs")
	async startRun(
		@AiContext() ctx: AiRequestContext,
		@Body() body: unknown,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const input = parse(StartRunInputSchema, body);
		input.prompt = input.prompt.trim();
		if (!input.prompt || input.prompt.length > MAX_PROMPT_CHARS) {
			throw problem(400, `Message must be 1–${MAX_PROMPT_CHARS} characters.`);
		}
		void this.staleRuns.nudge();
		// Before anything is reserved: another user's / expired threadId is a plain 404 (a new chat is made after the checks).
		const continued = input.threadId ? await mapErrors(() => this.threads.open(ctx, input)) : undefined;
		// 409 (chat still working) / 429 (quota) before any stream opens; beyond the working caps the run is queued
		const reserved = await mapErrors(() => this.runs.reserve(ctx, { threadId: input.threadId, clientRequestId: input.clientRequestId }));
		const wantsStream = String(request.headers.accept ?? "").includes("text/event-stream");
		if (reserved.replay) return this.replayStart(ctx, reserved.runId, wantsStream, reply);
		const thread = continued ?? (await mapErrors(() => this.threads.open(ctx, input)));
		const runId = reserved.runId;
		if (!wantsStream) {
			// a queued run waits here too (bounded like the stream)
			const run = await this.runs.start(ctx, input, () => undefined, thread, runId);
			await reply.code(201).send(run);
			return;
		}
		await this.stream(ctx, reply, (emit) => this.runs.start(ctx, input, emit, thread, runId));
	}

	/**
	 * The same prompt sent again (same clientRequestId within 10 min): the run the first request made, not a
	 * second one. The first request streams it; this one hands over its state and ends (the chat follows a
	 * run still working by polling, as after a cut stream).
	 */
	private async replayStart(ctx: AiRequestContext, runId: string, wantsStream: boolean, reply: FastifyReply): Promise<void> {
		let run = await this.store.getRun(ctx.organizationId, runId, ctx.userId);
		// the first request may still be writing its run row (it reserved a moment ago)
		for (let tries = 0; !run && tries < REPLAY_TRIES; tries += 1) {
			await new Promise((resolve) => setTimeout(resolve, REPLAY_WAIT_MS));
			run = await this.store.getRun(ctx.organizationId, runId, ctx.userId);
		}
		if (!run) throw problem(409, THREAD_BUSY);
		const found = run;
		if (!wantsStream) {
			await reply.code(200).send(found);
			return;
		}
		await this.stream(ctx, reply, async (emit) => emit({ type: "run.started", run: found }), runId);
	}

	/**
	 * Stop: the run ends as `cancelled` (drafts it already staged stay reviewable); a queued run leaves the queue.
	 * Owners / admins may stop a teammate's working run too ("Stop … and run mine"); others get 404 for it.
	 */
	@Post("runs/:id/cancel")
	@HttpCode(200)
	cancelRun(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		return mapErrors(() => this.runs.cancel(ctx, id));
	}

	/** The merchant answered the open question: next question, or the run continues (SSE). */
	@Post("runs/:id/answers")
	async answerRun(
		@AiContext() ctx: AiRequestContext,
		@Param("id") id: string,
		@Body() body: unknown,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const input = parse(AnswerInputSchema, body);
		// refusals (gone, already answered) stay plain HTTP before any stream opens
		const run = await this.store.getRun(ctx.organizationId, id, ctx.userId);
		if (!run) throw problem(404, "Run not found.");
		if (run.status !== "awaiting_input") throw problem(409, "This question was already answered.");
		if (!String(request.headers.accept ?? "").includes("text/event-stream")) {
			const answered = await mapErrors(() => this.runs.answer(ctx, id, input, () => undefined));
			await reply.code(200).send(answered);
			return;
		}
		await this.stream(ctx, reply, (emit) => this.runs.answer(ctx, id, input, emit), id);
	}

	@Get("runs/:id/questions/:questionId/options")
	searchOptions(
		@AiContext() ctx: AiRequestContext,
		@Param("id") id: string,
		@Param("questionId") questionId: string,
		@Query("q") q?: string,
	) {
		return mapErrors(() => this.runs.searchOptions(ctx, id, questionId, String(q ?? "")));
	}

	@Post("attachments")
	uploadAttachment(@AiContext() ctx: AiRequestContext, @Body() body: unknown) {
		return mapErrors(() => this.attachments.upload(ctx, parse(AttachmentUploadSchema, body)));
	}

	@Get("attachments/:id/content")
	async attachmentContent(@AiContext() ctx: AiRequestContext, @Param("id") id: string, @Res() reply: FastifyReply) {
		const file = await mapErrors(() => this.attachments.content(ctx, id));
		await reply
			.header("content-type", file.mime)
			.header("cache-control", "private, max-age=3600")
			.header("x-content-type-options", "nosniff")
			.send(file.content);
	}

	/** For the BFF applier: a file the approved draft uses (the person who asked, or an owner / admin, approves it). */
	@Get("change-sets/:id/attachments/:attachmentId")
	async changeSetAttachment(
		@AiContext() ctx: AiRequestContext,
		@Param("id") id: string,
		@Param("attachmentId") attachmentId: string,
		@Res() reply: FastifyReply,
	) {
		const changeSet = await mapErrors(() => this.decisions.get(ctx, id));
		const file = await mapErrors(() => this.attachments.forChangeSet(ctx.organizationId, changeSet, attachmentId));
		await reply.header("content-type", file.mime).header("cache-control", "private, no-store").send(file.content);
	}

	/** `entity=<kind>:<id>`: only the chats started on that record; `task=<key>`: only that to-do item's chats (newest first). */
	@Get("threads")
	listThreads(
		@AiContext() ctx: AiRequestContext,
		@Query("limit") limit?: string,
		@Query("entity") entity?: string,
		@Query("task") task?: string,
	) {
		const entityRef = threadEntityQuery(entity);
		const taskKey = threadTaskQuery(task);
		void this.staleRuns.nudge();
		return this.threads.list(ctx, ThreadLimitSchema.parse(limit), { ...(entityRef ? { entity: entityRef } : {}), ...(taskKey ? { taskKey } : {}) });
	}

	/** The caller's own work for the queue: drafts waiting, open questions, task chats, item states (no model call). */
	@Get("work")
	getWork(@AiContext() ctx: AiRequestContext) {
		void this.staleRuns.nudge();
		return mapErrors(() => this.work.work(ctx));
	}

	/** Later / Don't remind me / raised: `key` is URL-encoded (it contains ':'); null clears a field. */
	@Put("work/state/:key")
	setWorkState(@AiContext() ctx: AiRequestContext, @Param("key") key: string, @Body() body: unknown) {
		const input = parse(WorkStateInputSchema, body ?? {});
		return mapErrors(() => this.work.setState(ctx, key, input));
	}

	@Get("threads/:id")
	async getThread(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		void this.staleRuns.nudge();
		const detail = await mapErrors(() => this.threads.detail(ctx, id));
		// a chat is private: every draft in it was asked by the caller
		return { ...detail, changeSets: detail.changeSets.map((changeSet) => forCaller(ctx, changeSet, ctx.userId)) };
	}

	@Patch("threads/:id")
	renameThread(@AiContext() ctx: AiRequestContext, @Param("id") id: string, @Body() body: unknown) {
		const { title } = parse(RenameThreadInputSchema, body);
		return mapErrors(() => this.threads.rename(ctx, id, title));
	}

	@Delete("threads/:id")
	@HttpCode(204)
	async deleteThread(@AiContext() ctx: AiRequestContext, @Param("id") id: string): Promise<void> {
		await mapErrors(() => this.runs.removeThread(ctx, id));
	}

	@Get("change-sets")
	async listChangeSets(
		@AiContext() ctx: AiRequestContext,
		@Query("status") status?: string,
		@Query("limit") limit?: string,
	) {
		const parsedStatus = status ? parse(ChangeSetStatusSchema, status) : undefined;
		// owners / admins: the whole workspace's drafts; everyone else: only the ones they asked for
		const changeSets = await this.store.listChangeSets(ctx.organizationId, {
			status: parsedStatus,
			limit: LimitSchema.parse(limit),
			...(seesTeamDrafts(ctx) ? {} : { requestedBy: ctx.userId }),
			// shops sharing one organization never list each other's drafts
			...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
		});
		return changeSets.map((changeSet) => forCaller(ctx, changeSet));
	}

	@Get("change-sets/:id")
	async getChangeSet(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		return forCaller(ctx, await mapErrors(() => this.decisions.get(ctx, id)));
	}

	@Post("change-sets/:id/claim")
	async claim(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		return forCaller(ctx, await mapErrors(() => this.decisions.claim(ctx, id)));
	}

	@Post("change-sets/:id/release")
	async release(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		await mapErrors(() => this.decisions.release(ctx, id));
		return { released: true };
	}

	/** BFF-internal (the browser's /undo goes through prime-web, which applies the pre-image first). */
	@Post("change-sets/:id/revert")
	async revert(@AiContext() ctx: AiRequestContext, @Param("id") id: string, @Body() body: unknown) {
		const { result, keepUndo } = (body ?? {}) as { result?: unknown; keepUndo?: unknown };
		const parsedResult = result === undefined ? undefined : parse(ChangeSetResultSchema, result);
		return forCaller(ctx, await mapErrors(() => this.decisions.revert(ctx, id, parsedResult, { keepUndo: keepUndo === true })));
	}

	/** BFF-internal: the site editor's Redo put an undone change back. */
	@Post("change-sets/:id/reinstate")
	async reinstate(@AiContext() ctx: AiRequestContext, @Param("id") id: string) {
		return forCaller(ctx, await mapErrors(() => this.decisions.reinstate(ctx, id)));
	}

	@Post("change-sets/:id/decision")
	async decide(@AiContext() ctx: AiRequestContext, @Param("id") id: string, @Body() body: unknown) {
		const { decision, note, result } = parse(DecisionBodySchema, body);
		const parsedResult = result === undefined ? undefined : parse(ChangeSetResultSchema, result);
		return forCaller(ctx, await mapErrors(() => this.decisions.decide(ctx, id, { decision, note, result: parsedResult })));
	}

	@Post("conversations/:id/replies")
	reply() {
		throw new NotFoundException({ title: "Not found", detail: "Conversations are not available yet." });
	}
}
