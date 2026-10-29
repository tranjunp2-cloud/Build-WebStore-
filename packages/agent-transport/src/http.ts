import {
	type AgentAttachment,
	AgentAttachmentSchema,
	type AgentEvent,
	AgentEventSchema,
	type AgentRun,
	AgentRunSchema,
	type AgentThread,
	type AgentThreadDetail,
	type AnswerInput,
	AgentThreadDetailSchema,
	AgentThreadSchema,
	type AutonomyLevel,
	type AutonomyPolicy,
	AutonomyPolicySchema,
	type ChangeSet,
	ChangeSetSchema,
	type ReconcileResult,
	ReconcileResultSchema,
	type Conversation,
	type ConversationMessage,
	ConversationMessageSchema,
	ConversationSchema,
	type Insight,
	InsightSchema,
	type QuestionOption,
	QuestionOptionSchema,
	type RenameThreadInput,
	reduceRunEvent,
	type RunEvent,
	type RunStatus,
	type StartRunInput,
	type WorkList,
	WorkListSchema,
	type WorkState,
	type WorkStateInput,
	WorkStateSchema,
} from "@ech/agent-core";
import { z } from "zod";
import { TtlCache } from "./cache";
import type {
	AgentGateway,
	ChangeSetDecision,
	ChangeSetQuery,
	ConversationQuery,
	DecideOptions,
	InsightQuery,
	MediaQuery,
	RunStreamLost,
	SendReplyInput,
	ThreadFilter,
	UploadOptions,
} from "./gateway";
import { type PoolOptions, RequestPool } from "./pool";
import { AgentGatewayError, gatewayErrorFrom, readSseStream } from "./sse";
import { StreamChannel, type StreamChannelOptions } from "./stream";

/**
 * HttpGateway — REST + push-stream implementation of AgentGateway.
 *
 * Reads go through RequestPool (concurrency cap + GET coalescing) and a small
 * TTL cache. Run events arrive either on the streamed `POST /agent/runs`
 * response (SSE) or on StreamChannel (WS preferred, SSE fallback); gateway
 * events invalidate matching cache keys so the next read is fresh.
 */

export interface HttpGatewayOptions {
	baseUrl: string;
	/** auth/tenant headers — caller supplies org + token bindings */
	headers?: () => Record<string, string> | Promise<Record<string, string>>;
	pool?: PoolOptions;
	/** ws(s):// or http(s):// endpoint for /events; omitted = per-run streams only */
	stream?: StreamChannelOptions;
	fetcher?: typeof fetch;
}

/**
 * First frame of a streamed `POST /agent/runs` response. The run's own events
 * follow on the same response; `run.error` reports a refusal before the run
 * exists (quota, auth, validation).
 */
const RunStartedFrameSchema = z.object({ type: z.literal("run.started"), run: AgentRunSchema });
const RunErrorFrameSchema = z.object({ type: z.literal("run.error"), message: z.string() });
/** A run in one of these is still writing on its stream (waiting for a slot included); any other status ends the stream normally. */
const STREAM_OPEN: ReadonlySet<RunStatus> = new Set(["queued", "planning", "running", "applying"]);

/** A fresh id per prompt: the platform attaches a start sent twice (a retried request) to the run it already made. */
export function newClientRequestId(): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	return uuid ?? `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function qs(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) search.set(key, String(value));
	}
	const s = search.toString();
	return s ? `?${s}` : "";
}

export class HttpGateway implements AgentGateway {
	private readonly baseUrl: string;
	private readonly pool: RequestPool;
	private readonly cache = new TtlCache();
	private readonly fetcher: typeof fetch;
	private readonly channel: StreamChannel | null;
	private readonly listeners = new Set<(event: AgentEvent) => void>();
	private readonly lostListeners = new Set<(lost: RunStreamLost) => void>();

	constructor(private readonly options: HttpGatewayOptions) {
		this.baseUrl = options.baseUrl.replace(/\/$/, "");
		this.pool = new RequestPool(options.pool);
		this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
		this.channel = options.stream ? new StreamChannel(options.stream) : null;
		this.channel?.subscribe((event) => this.onEvent(event));
	}

	private onEvent(event: AgentEvent): void {
		// "thread" clears both the list ("threads:") and details ("thread:<id>"):
		// a run's answer, a staged set or a decision all change what a thread shows.
		if (event.type === "changeset.staged" || event.type === "changeset.decided") {
			this.cache.invalidate("changesets");
			this.cache.invalidate("thread");
		}
		if (event.type === "conversation.message") this.cache.invalidate("conversations");
		if (event.type === "run.status" || event.type === "run.ask") {
			this.cache.invalidate("runs");
			this.cache.invalidate("thread");
		}
		for (const listener of this.listeners) listener(event);
	}

	private async request<T>(
		method: string,
		path: string,
		schema: z.ZodType<T>,
		body?: unknown,
		signal?: AbortSignal,
	): Promise<T> {
		const response = await this.fetcher(`${this.baseUrl}${path}`, {
			method,
			headers: {
				"content-type": "application/json",
				...(await this.options.headers?.()),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal,
		});
		if (!response.ok) throw await gatewayErrorFrom(response, `${method} ${path}`);
		// 204 / empty bodies (DELETE) parse as undefined
		const text = response.status === 204 ? "" : await response.text();
		return schema.parse(text ? JSON.parse(text) : undefined);
	}

	/**
	 * Starts a run. A streaming backend (`text/event-stream`) resolves as soon
	 * as the `run.started` frame lands and keeps dispatching the run's events to
	 * subscribers; a plain JSON backend returns the run directly.
	 */
	private async requestRun(path: string, input: unknown, signal: AbortSignal): Promise<AgentRun> {
		const response = await this.fetcher(`${this.baseUrl}${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "text/event-stream, application/json",
				...(await this.options.headers?.()),
			},
			body: JSON.stringify(input),
			signal,
		});
		if (!response.ok) throw await gatewayErrorFrom(response, `POST ${path}`);
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/event-stream") || !response.body) {
			return AgentRunSchema.parse(await response.json());
		}
		const body = response.body;
		return new Promise<AgentRun>((resolve, reject) => {
			let started = false;
			/** the started run as its own frames move it — tells a cut stream from a finished one */
			let current: AgentRun | undefined;
			let failure: string | undefined;
			const onFrame = (raw: string) => {
				let frame: unknown;
				try {
					frame = JSON.parse(raw);
				} catch {
					return;
				}
				if (!started) {
					const run = RunStartedFrameSchema.safeParse(frame);
					if (run.success) {
						started = true;
						current = run.data.run;
						resolve(run.data.run);
						return;
					}
					const refused = RunErrorFrameSchema.safeParse(frame);
					if (refused.success) {
						started = true;
						reject(new Error(refused.data.message));
						return;
					}
				} else {
					// the run broke after it started: the stream ends without the run's final status
					const broke = RunErrorFrameSchema.safeParse(frame);
					if (broke.success) failure = broke.data.message;
				}
				const event = AgentEventSchema.safeParse(frame);
				if (!event.success) return;
				if (current && "runId" in event.data && event.data.runId === current.id) current = reduceRunEvent(current, event.data as RunEvent);
				this.onEvent(event.data);
			};
			const ended = (reason: RunStreamLost["reason"], error?: string) => {
				if (!current || !STREAM_OPEN.has(current.status)) return;
				this.emitLost({ runId: current.id, reason, ...(error ? { error } : {}) });
			};
			readSseStream(body, onFrame)
				.then(() => {
					if (!started) reject(new Error("The agent stream ended before the run started."));
					else ended("ended", failure);
				})
				.catch((error: unknown) => {
					if (!started) reject(error instanceof Error ? error : new Error(String(error)));
					else ended("error", failure ?? (error instanceof Error ? error.message : String(error)));
				});
		});
	}

	/** A run's stream is gone while it still works: its cached reads are stale, and subscribers poll it instead. */
	private emitLost(lost: RunStreamLost): void {
		this.cache.invalidate("runs");
		this.cache.invalidate("thread");
		for (const listener of this.lostListeners) listener(lost);
	}

	private cached<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Promise<T> {
		const hit = this.cache.get<T>(key);
		if (hit !== undefined) return Promise.resolve(hit);
		return this.pool.get(key, async (signal) => {
			const value = await load(signal);
			this.cache.set(key, value);
			return value;
		});
	}

	listInsights(query: InsightQuery = {}): Promise<Insight[]> {
		const path = `/agent/insights${qs({ kind: query.kind, limit: query.limit })}`;
		return this.cached(`insights:${path}`, (signal) =>
			this.request("GET", path, z.array(InsightSchema), undefined, signal),
		);
	}

	listRuns(limit = 20): Promise<AgentRun[]> {
		const path = `/agent/runs${qs({ limit })}`;
		return this.cached(`runs:${path}`, (signal) =>
			this.request("GET", path, z.array(AgentRunSchema), undefined, signal),
		);
	}

	/**
	 * Not TTL-cached: it is the cheap status read a chat polls while a run works
	 * without a stream (concurrent reads still coalesce). A run that has ended
	 * changed its thread: thread reads after it are fresh.
	 */
	async getRun(id: string): Promise<AgentRun | null> {
		const run = await this.pool.get(`run:${id}`, (signal) =>
			this.request("GET", `/agent/runs/${encodeURIComponent(id)}`, AgentRunSchema.nullable(), undefined, signal),
		);
		if (run && !STREAM_OPEN.has(run.status)) {
			this.cache.invalidate("runs");
			this.cache.invalidate("thread");
		}
		return run;
	}

	listChangeSets(query: ChangeSetQuery = {}): Promise<ChangeSet[]> {
		const path = `/agent/change-sets${qs({ status: query.status, limit: query.limit })}`;
		return this.cached(`changesets:${path}`, (signal) =>
			this.request("GET", path, z.array(ChangeSetSchema), undefined, signal),
		);
	}

	listConversations(query: ConversationQuery = {}): Promise<Conversation[]> {
		const path = `/agent/conversations${qs({ status: query.status, limit: query.limit })}`;
		return this.cached(`conversations:${path}`, (signal) =>
			this.request("GET", path, z.array(ConversationSchema), undefined, signal),
		);
	}

	getAutonomyPolicy(): Promise<AutonomyPolicy> {
		return this.cached("autonomy", (signal) =>
			this.request("GET", "/agent/autonomy", AutonomyPolicySchema, undefined, signal),
		);
	}

	listThreads(limit = 20, filter?: ThreadFilter): Promise<AgentThread[]> {
		const entity = filter?.entity ? `${filter.entity.kind}:${filter.entity.id}` : undefined;
		const path = `/agent/threads${qs({ limit, entity, task: filter?.task })}`;
		return this.cached(`threads:${path}`, (signal) =>
			this.request("GET", path, z.array(AgentThreadSchema), undefined, signal),
		);
	}

	getThread(id: string): Promise<AgentThreadDetail | null> {
		return this.cached(`thread:${id}`, async (signal) => {
			try {
				return await this.request(
					"GET",
					`/agent/threads/${encodeURIComponent(id)}`,
					AgentThreadDetailSchema,
					undefined,
					signal,
				);
			} catch (error) {
				// deleted, expired or another user's — the caller falls back
				if (error instanceof AgentGatewayError && error.status === 404) return null;
				throw error;
			}
		});
	}

	async startRun(input: StartRunInput): Promise<AgentRun> {
		const body: StartRunInput = { ...input, clientRequestId: input.clientRequestId ?? newClientRequestId() };
		const run = await this.pool.mutate((signal) => this.requestRun("/agent/runs", body, signal));
		// a new run creates or bumps a thread
		this.cache.invalidate("thread");
		return run;
	}

	async decideChangeSet(
		id: string,
		decision: ChangeSetDecision,
		actor: string,
		note?: string,
		options?: DecideOptions,
	): Promise<ChangeSet> {
		this.cache.invalidate("changesets");
		// No pool signal: approving applies a domain write that can outlast the
		// read timeout, and aborting the browser side would not stop the server.
		let decided: ChangeSet;
		try {
			decided = await this.pool.mutate(() =>
				this.request("POST", `/agent/change-sets/${encodeURIComponent(id)}/decision`, ChangeSetSchema, {
					decision,
					actor,
					note,
					...(options?.confirm !== undefined ? { confirm: options.confirm } : {}),
					...(options?.manual === true ? { manual: true } : {}),
				}),
			);
		} catch (error) {
			// refused because the set moved on (a stale draft the server closed, decided in another tab): show the card as it
			// now stands, so it stops offering Approve and a second press can't answer "already rejected"
			if (error instanceof AgentGatewayError && (error.status === 409 || error.status === 422)) await this.announceCurrent(id);
			throw error;
		}
		this.onEvent({ type: "changeset.decided", changeSet: decided });
		return decided;
	}

	/** Reads a change set again and announces it when it is no longer pending; a failed read changes nothing. */
	private async announceCurrent(id: string): Promise<void> {
		const current = await this.request("GET", `/agent/change-sets/${encodeURIComponent(id)}`, ChangeSetSchema).catch(() => null);
		if (current && current.status !== "pending") this.onEvent({ type: "changeset.decided", changeSet: current });
	}

	async undoChangeSet(id: string): Promise<ChangeSet> {
		this.cache.invalidate("changesets");
		const reverted = await this.pool.mutate(() =>
			this.request("POST", `/agent/change-sets/${encodeURIComponent(id)}/undo`, ChangeSetSchema, {}),
		);
		this.onEvent({ type: "changeset.decided", changeSet: reverted });
		return reverted;
	}

	async reconcileChangeSet(id: string): Promise<ReconcileResult> {
		const result = await this.pool.mutate(() =>
			this.request("POST", `/agent/change-sets/${encodeURIComponent(id)}/reconcile`, ReconcileResultSchema, {}),
		);
		// the card and the chat's open thread follow the status the server settled on
		this.cache.invalidate("changesets");
		this.onEvent({ type: "changeset.decided", changeSet: result.changeSet });
		return result;
	}

	sendReply(input: SendReplyInput): Promise<ConversationMessage> {
		this.cache.invalidate("conversations");
		return this.pool.mutate(() =>
			this.request(
				"POST",
				`/agent/conversations/${encodeURIComponent(input.conversationId)}/replies`,
				ConversationMessageSchema,
				{ body: input.body, fromDraftId: input.fromDraftId },
			),
		);
	}

	setDomainAutonomy(domain: string, level: AutonomyLevel): Promise<AutonomyPolicy> {
		this.cache.invalidate("autonomy");
		return this.pool.mutate(() =>
			this.request("PUT", `/agent/autonomy/${encodeURIComponent(domain)}`, AutonomyPolicySchema, { level }),
		);
	}

	async renameThread(id: string, input: RenameThreadInput): Promise<AgentThread> {
		const renamed = await this.pool.mutate(() =>
			this.request("PATCH", `/agent/threads/${encodeURIComponent(id)}`, AgentThreadSchema, input),
		);
		this.cache.invalidate("thread");
		return renamed;
	}

	async deleteThread(id: string): Promise<void> {
		await this.pool.mutate(() => this.request("DELETE", `/agent/threads/${encodeURIComponent(id)}`, z.unknown()));
		this.cache.invalidate("thread");
		// the chat's drafts waiting for review went with it: lists of change sets reload
		this.cache.invalidate("changesets");
		this.onEvent({ type: "thread.deleted", threadId: id });
	}

	// not queued behind the run's own stream: stop has to reach the server while it is still open
	async cancelRun(runId: string): Promise<AgentRun> {
		const run = await this.request("POST", `/agent/runs/${encodeURIComponent(runId)}/cancel`, AgentRunSchema, {});
		this.cache.invalidate("thread");
		this.cache.invalidate(`run:${runId}`);
		return run;
	}

	async answerRun(runId: string, input: AnswerInput): Promise<AgentRun> {
		const run = await this.pool.mutate((signal) =>
			this.requestRun(`/agent/runs/${encodeURIComponent(runId)}/answers`, input, signal),
		);
		this.cache.invalidate("thread");
		this.cache.invalidate(`run:${runId}`);
		return run;
	}

	searchQuestionOptions(runId: string, questionId: string, query: string): Promise<QuestionOption[]> {
		const path = `/agent/runs/${encodeURIComponent(runId)}/questions/${encodeURIComponent(questionId)}/options${qs({ q: query })}`;
		return this.pool.get(`options:${path}`, (signal) =>
			this.request("GET", path, z.array(QuestionOptionSchema), undefined, signal),
		);
	}

	/**
	 * Multipart upload. XHR when available so the tray can show progress
	 * (fetch has no upload progress); fetch elsewhere (tests, workers).
	 */
	async uploadAttachment(file: File, options: UploadOptions = {}): Promise<AgentAttachment> {
		const url = `${this.baseUrl}/agent/attachments`;
		const headers = { ...(await this.options.headers?.()) };
		const form = new FormData();
		form.append("file", file, file.name);
		if (typeof XMLHttpRequest === "undefined" || this.options.fetcher) {
			const response = await this.fetcher(url, { method: "POST", headers, body: form, signal: options.signal });
			if (!response.ok) throw await gatewayErrorFrom(response, "POST /agent/attachments");
			options.onProgress?.(1);
			return AgentAttachmentSchema.parse(await response.json());
		}
		return new Promise<AgentAttachment>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open("POST", url);
			for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) options.onProgress?.(e.loaded / e.total);
			};
			xhr.onload = () => {
				const response = new Response(xhr.responseText, {
					status: xhr.status,
					headers: { "content-type": xhr.getResponseHeader("content-type") ?? "application/json" },
				});
				if (!response.ok) {
					void gatewayErrorFrom(response, "POST /agent/attachments").then(reject, reject);
					return;
				}
				try {
					resolve(AgentAttachmentSchema.parse(JSON.parse(xhr.responseText)));
				} catch (error) {
					reject(error);
				}
			};
			xhr.onerror = () => reject(new AgentGatewayError("The upload failed. Check your connection.", 0));
			xhr.onabort = () => reject(new AgentGatewayError("Upload cancelled.", 0));
			options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
			xhr.send(form);
		});
	}

	listMedia(query: MediaQuery): Promise<AgentAttachment[]> {
		const path = `/agent/media${qs({ source: query.source, q: query.query, limit: query.limit })}`;
		return this.cached(`media:${path}`, (signal) =>
			this.request("GET", path, z.array(AgentAttachmentSchema), undefined, signal),
		);
	}

	pickMedia(item: AgentAttachment): Promise<AgentAttachment> {
		return this.pool.mutate(() =>
			this.request("POST", "/agent/attachments/pick", AgentAttachmentSchema, {
				origin: item.origin,
				ref: item.id,
				url: item.url,
				name: item.name,
				credit: item.credit,
			}),
		);
	}

	/**
	 * Not TTL-cached: the queue changes under the merchant's hands (an order confirmed in
	 * another tab) and the hook already throttles; concurrent reads still coalesce.
	 */
	listWork(): Promise<WorkList> {
		return this.pool.get("work", (signal) => this.request("GET", "/agent/work", WorkListSchema, undefined, signal));
	}

	setWorkState(key: string, input: WorkStateInput): Promise<WorkState> {
		return this.pool.mutate(() =>
			this.request("PUT", `/agent/work/state/${encodeURIComponent(key)}`, WorkStateSchema, input),
		);
	}

	subscribe(listener: (event: AgentEvent) => void): () => void {
		this.listeners.add(listener);
		if (this.channel && this.channel.status !== "open") this.channel.connect();
		return () => {
			this.listeners.delete(listener);
		};
	}

	onRunStreamLost(listener: (lost: RunStreamLost) => void): () => void {
		this.lostListeners.add(listener);
		return () => {
			this.lostListeners.delete(listener);
		};
	}

	close(): void {
		this.channel?.close();
		this.pool.close();
	}
}
