import { z } from "zod";
import {
	AgentAskSchema,
	AgentRunSchema,
	AnsweredQuestionSchema,
	ChangeSetSchema,
	ConversationMessageSchema,
	PlanStepSchema,
	RunQueueSchema,
	RunStatusSchema,
	RunSuggestionSchema,
	ToolReceiptSchema,
} from "./schemas";

/**
 * Streaming event contract — what an AgentGateway emits over WS/SSE (or what
 * FixtureGateway replays). Every event is scoped to a run or an entity update.
 */

export const RunStepEventSchema = z.object({
	type: z.literal("run.step"),
	runId: z.string().min(1),
	step: PlanStepSchema,
});

export const RunReceiptEventSchema = z.object({
	type: z.literal("run.receipt"),
	runId: z.string().min(1),
	receipt: ToolReceiptSchema,
});

export const RunStatusEventSchema = z.object({
	type: z.literal("run.status"),
	runId: z.string().min(1),
	status: RunStatusSchema,
	answer: z.string().optional(),
	error: z.string().optional(),
	suggestions: z.array(RunSuggestionSchema).max(3).optional(),
});

/**
 * The run waits for a free AI slot of the shop: its place and what is working now. Sent when the run is
 * queued and again whenever its place or the working list changes; `run.status` (planning…) ends the wait.
 */
export const RunQueuedEventSchema = RunQueueSchema.extend({
	type: z.literal("run.queued"),
	runId: z.string().min(1),
});

/** The run paused on a question (`ask`), or moved past one (`ask` null); `answers` is the run's full list. */
export const RunAskEventSchema = z.object({
	type: z.literal("run.ask"),
	runId: z.string().min(1),
	ask: AgentAskSchema.nullable(),
	answers: z.array(AnsweredQuestionSchema),
});

export const ChangeSetStagedEventSchema = z.object({
	type: z.literal("changeset.staged"),
	runId: z.string().min(1),
	changeSet: ChangeSetSchema,
});

export const ChangeSetDecidedEventSchema = z.object({
	type: z.literal("changeset.decided"),
	changeSet: ChangeSetSchema,
});

/** A chat was deleted, with its runs and their change sets (drafts waiting for review included). */
export const ThreadDeletedEventSchema = z.object({
	type: z.literal("thread.deleted"),
	threadId: z.string().min(1),
});

export const ConversationMessageEventSchema = z.object({
	type: z.literal("conversation.message"),
	conversationId: z.string().min(1),
	message: ConversationMessageSchema,
});

export const RunEventSchema = z.discriminatedUnion("type", [
	RunStepEventSchema,
	RunReceiptEventSchema,
	RunStatusEventSchema,
	RunQueuedEventSchema,
	RunAskEventSchema,
	ChangeSetStagedEventSchema,
]);

/** Every event the gateway can push to subscribers. */
export const AgentEventSchema = z.discriminatedUnion("type", [
	RunStepEventSchema,
	RunReceiptEventSchema,
	RunStatusEventSchema,
	RunQueuedEventSchema,
	RunAskEventSchema,
	ChangeSetStagedEventSchema,
	ChangeSetDecidedEventSchema,
	ThreadDeletedEventSchema,
	ConversationMessageEventSchema,
]);

export type RunStepEvent = z.infer<typeof RunStepEventSchema>;
export type RunReceiptEvent = z.infer<typeof RunReceiptEventSchema>;
export type RunStatusEvent = z.infer<typeof RunStatusEventSchema>;
export type RunQueuedEvent = z.infer<typeof RunQueuedEventSchema>;
export type RunAskEvent = z.infer<typeof RunAskEventSchema>;
export type ChangeSetStagedEvent = z.infer<typeof ChangeSetStagedEventSchema>;
export type ChangeSetDecidedEvent = z.infer<typeof ChangeSetDecidedEventSchema>;
export type ThreadDeletedEvent = z.infer<typeof ThreadDeletedEventSchema>;
export type ConversationMessageEvent = z.infer<typeof ConversationMessageEventSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;

/** Input accepted by startRun(). */
export const StartRunInputSchema = z.object({
	prompt: z.string().min(1),
	context: AgentRunSchema.shape.context,
	page: AgentRunSchema.shape.page,
	role: AgentRunSchema.shape.role.optional(),
	domain: AgentRunSchema.shape.domain.optional(),
	/** Continue this thread; omitted → the platform starts a new one. */
	threadId: z.string().min(1).max(64).optional(),
	/** pictures already in the chat (img_N / att_…) the merchant chose for this prompt, in order */
	pictureIds: z.array(z.string().min(1).max(60)).max(12).optional(),
	/** ids of attachments uploaded (or picked) for this prompt */
	attachmentIds: z.array(z.string().min(1).max(80)).max(8).optional(),
	/** a new thread started from a to-do item: it is that task's chat (key + title); ignored when continuing a thread */
	task: z.object({ key: z.string().min(1).max(120), title: z.string().trim().min(1).max(120) }).optional(),
	/** a read-only request the platform can answer without the model (e.g. a chip's `{ tool: "store_reports", args }`); anything else is ignored */
	intent: z.object({ tool: z.string().min(1).max(60), args: z.record(z.string(), z.unknown()).optional() }).optional(),
	/** fresh per prompt: the same start sent twice (a retried request) attaches to the run it already made */
	clientRequestId: z.string().min(1).max(64).optional(),
});
export type StartRunInput = z.infer<typeof StartRunInputSchema>;
