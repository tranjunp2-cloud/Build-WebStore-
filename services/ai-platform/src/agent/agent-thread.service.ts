import type { KnownImage } from "./change-set-builders";
import { type AgentThread, type AgentThreadDetail, AgentDomainSchema, type ChangeSet, type EntityRef, type StartRunInput } from "@ech/agent-core";
import { Inject, Injectable } from "@nestjs/common";
import type { ModelMessage } from "ai";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { AgentError } from "./agent-errors";
import { AGENT_STORE, type AgentStore, type ThreadOwner, type ThreadRunRecord } from "./agent-store";
import { newId } from "./ids";
import { CLAIM_STALE_AFTER_MS } from "./change-set-decision.service";
import { stagedById, historyMessages, threadTitle } from "./thread-memory";
import { threadStatus } from "./thread-status";

const DAY_MS = 24 * 60 * 60 * 1000;

function owner(ctx: AiRequestContext): ThreadOwner {
	return { organizationId: ctx.organizationId, userId: ctx.userId };
}

/** The record a new chat is linked to: a pinned entity, bounded. */
function threadEntity(entity: EntityRef | undefined): EntityRef | undefined {
	if (!entity) return undefined;
	const label = entity.label?.replace(/\s+/g, " ").trim().slice(0, 120);
	return { kind: entity.kind.slice(0, 40), id: entity.id.slice(0, 120), ...(label ? { label } : {}) };
}

/** Pending change sets past their expiry read as expired (same view ChangeSetDecisionService gives). */
function currentState(changeSet: ChangeSet, now: Date): ChangeSet {
	return changeSet.status === "pending" && new Date(changeSet.expiresAt).getTime() <= now.getTime()
		? { ...changeSet, status: "expired" }
		: changeSet;
}

/** The pictures of a chat's runs, newest 40, keyed by their chat-wide ids (attachments, then receipt media). */
function chatImages(records: readonly ThreadRunRecord[]): KnownImage[] {
	const seen = new Map<string, KnownImage>();
	for (const { run } of records) {
		for (const file of run.attachments ?? []) {
			if (file.kind !== "image" || seen.has(file.id)) continue;
			seen.set(file.id, {
				id: file.id,
				ref: `attachment:${file.id}`,
				url: file.url ?? `/api/agent/attachments/${encodeURIComponent(file.id)}/content`,
				origin: file.origin,
				alt: file.name,
				...(file.credit ? { credit: file.credit } : {}),
			});
		}
		for (const receipt of run.receipts ?? []) {
			for (const media of receipt.media ?? []) {
				if (!media.imageId || !media.ref || seen.has(media.imageId)) continue;
				seen.set(media.imageId, {
					id: media.imageId,
					ref: media.ref,
					url: media.url,
					origin: receipt.tool === "media.generate_image" ? "generated" : media.ref.startsWith("pixabay:") ? "stock" : "media",
					...(media.alt ? { alt: media.alt } : {}),
					...(media.ref.startsWith("pixabay:") && media.label ? { credit: media.label } : {}),
				});
			}
		}
	}
	return [...seen.values()].slice(-40);
}

/**
 * Copilot chat threads: private to the user who started them (org + user from
 * the context token), one thread follows the user across pages, kept
 * AI_THREAD_RETENTION_DAYS after last activity. Another user's or an expired
 * thread is indistinguishable from a missing one (404).
 */
@Injectable()
export class AgentThreadService {
	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		@Inject(ENV) private readonly env: Env,
	) {}

	/** Threads last active before this are expired (hidden now, deleted by the sweep). */
	activeSince(now: Date = new Date()): Date {
		return new Date(now.getTime() - this.env.AI_THREAD_RETENTION_DAYS * DAY_MS);
	}

	/**
	 * The thread a new run goes into: the caller's own live thread, or a new one
	 * titled from the prompt — linked to the record open on the page it was sent
	 * from (a product, a blog post), so returning there offers this chat. Started
	 * from a to-do item (`task`), it is that task's chat, titled with the item
	 * (never retitled); `task` is ignored when continuing a thread.
	 */
	async open(ctx: AiRequestContext, input: Pick<StartRunInput, "prompt" | "threadId" | "context" | "task">): Promise<AgentThread> {
		if (input.threadId) return this.require(ctx, input.threadId);
		const now = new Date().toISOString();
		const entity = threadEntity(input.context?.entity);
		const task = input.task;
		const thread: AgentThread = {
			id: newId("thr"),
			title: task ? task.title.trim().slice(0, 120) : threadTitle(input.prompt),
			runCount: 0,
			...(entity ? { entity } : {}),
			...(task ? { taskKey: task.key } : {}),
			createdAt: now,
			updatedAt: now,
		};
		await this.store.createThread(ctx, thread);
		return thread;
	}

	/** Earlier turns of the thread as model messages (bounded, byte-stable). */
	async history(organizationId: string, threadId: string): Promise<ModelMessage[]> {
		const [records, changeSets] = await Promise.all([
			this.store.listThreadRuns(organizationId, threadId),
			this.store.listThreadChangeSets(organizationId, threadId),
		]);
		return historyMessages(records, stagedById(changeSets.map((stored) => stored.changeSet)));
	}

	/**
	 * Every picture earlier turns of the chat had, with the same ids — attached
	 * files, and what was found, generated or picked in a card (their receipts) —
	 * so "Use img_3" or a photo attached two messages ago works in a later message.
	 */
	async knownImages(organizationId: string, threadId: string): Promise<KnownImage[]> {
		return chatImages(await this.store.listThreadRuns(organizationId, threadId));
	}

	/** The thread's change sets as they stand now (oldest first; a pending one past its expiry reads expired). */
	async changeSets(organizationId: string, threadId: string): Promise<ChangeSet[]> {
		const now = new Date();
		return (await this.store.listThreadChangeSets(organizationId, threadId)).map((stored) => currentState(stored.changeSet, now));
	}

	/**
	 * What a new run needs from its chat — `history`, `knownImages` and `changeSets` — from one
	 * read of the thread's runs and change sets (run start used to read each list twice).
	 */
	async runMemory(organizationId: string, threadId: string): Promise<{ history: ModelMessage[]; images: KnownImage[]; changeSets: ChangeSet[] }> {
		const [records, stored] = await Promise.all([
			this.store.listThreadRuns(organizationId, threadId),
			this.store.listThreadChangeSets(organizationId, threadId),
		]);
		const now = new Date();
		return {
			history: historyMessages(records, stagedById(stored.map((entry) => entry.changeSet))),
			images: chatImages(records),
			changeSets: stored.map((entry) => currentState(entry.changeSet, now)),
		};
	}

	/**
	 * Newest first, each with what it is about, how many drafts wait / were applied
	 * and its status as a job. `entity`: the chats started on that record; `taskKey`: the chats of that to-do item.
	 */
	async list(ctx: AiRequestContext, limit: number, filter: { entity?: { kind: string; id: string }; taskKey?: string } = {}): Promise<AgentThread[]> {
		const threads = await this.store.listThreads(owner(ctx), { limit, activeSince: this.activeSince(), ...filter });
		const stats = await this.store.threadStats(
			ctx.organizationId,
			threads.map((t) => t.id),
		);
		return threads.map((thread) => {
			const meta = stats.get(thread.id);
			if (!meta) return { ...thread, status: threadStatus(0, undefined) };
			const domain = AgentDomainSchema.safeParse(meta.domain);
			return {
				...thread,
				...(domain.success ? { domain: domain.data } : {}),
				...(meta.module ? { module: meta.module.slice(0, 40) } : {}),
				pendingDrafts: meta.pending,
				appliedDrafts: meta.applied,
				status: threadStatus(meta.pending, meta.latestRun),
			};
		});
	}

	async detail(ctx: AiRequestContext, id: string): Promise<AgentThreadDetail> {
		const thread = await this.require(ctx, id);
		const [records, changeSets] = await Promise.all([
			this.store.listThreadRuns(ctx.organizationId, id),
			this.store.listThreadChangeSets(ctx.organizationId, id),
		]);
		const now = new Date();
		const current = changeSets.map((stored) => currentState(stored.changeSet, now));
		const pending = current.filter((changeSet) => changeSet.status === "pending").length;
		return {
			thread: { ...thread, status: threadStatus(pending, records[records.length - 1]?.run.status) },
			runs: records.map((record) => record.run),
			changeSets: current,
		};
	}

	async rename(ctx: AiRequestContext, id: string, title: string): Promise<AgentThread> {
		const renamed = await this.store.renameThread(owner(ctx), id, title, this.activeSince());
		if (!renamed) throw new AgentError("Thread not found.", 404);
		return renamed;
	}

	/** Deletes the thread, its runs and their change sets (ledger rows stay). */
	async remove(ctx: AiRequestContext, id: string): Promise<void> {
		await this.require(ctx, id);
		const outcome = await this.store.deleteThread(owner(ctx), id, new Date(Date.now() - CLAIM_STALE_AFTER_MS));
		if (outcome === "not_found") throw new AgentError("Thread not found.", 404);
		if (outcome === "claimed") {
			throw new AgentError("A change from this chat is being applied right now. Try again in a moment.", 409);
		}
	}

	private async require(ctx: AiRequestContext, id: string): Promise<AgentThread> {
		const thread = await this.store.getThread(owner(ctx), id, this.activeSince());
		if (!thread) throw new AgentError("Thread not found.", 404);
		return thread;
	}
}
