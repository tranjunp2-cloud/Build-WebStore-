import {
	type AgentAttachment,
	type AgentDomain,
	type AgentRun,
	type AgentThread,
	type AnswerInput,
	type ChangeSet,
	type QuestionOption,
	type ReceiptMedia,
	type ReceiptRecord,
	type RunEvent,
	type RunSuggestion,
	reduceRunEvent,
	type StartRunInput,
} from "@ech/agent-core";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { generateText, hasToolCall, isStepCount, type ModelMessage, type ToolSet } from "ai";
import type { AiRequestContext } from "../auth/context-token";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env";
import { runMaxRunningMs } from "../config/limits";
import { ORG_BATTERY, type OrgBattery } from "../cost/org-battery";
import { SHOP_CAPS, type ShopCaps } from "../cost/shop-caps";
import { aiBudgetMicros, assertAiEnabled, planOf } from "../cost/shop-limits";
import { tokenUsageOf, UsageTally } from "../ledger/sdk-usage";
import { SPEND_GUARD, type SpendGuard } from "../cost/spend-guard";
import { USAGE_LEDGER, type UsageLedger } from "../ledger/usage-ledger";
import { runWithFallback } from "../models/fallback";
import { type ModelRegistry, ModelUnavailableError, type ResolvedModel } from "../models/model-registry";
import { MODEL_REGISTRY } from "../models/models.module";
import { ImageService } from "../images/image.service";
import { cacheableInstructions } from "../models/prompt-cache";
import { SHOP_TOOLS, type ShopTools } from "../shop/shop-tools";
import { AgentError } from "./agent-errors";
import { AGENT_STORE, type AgentStore, type AttachmentRecord, type ReservedStart, type RunStartWindows } from "./agent-store";
import { AgentThreadService } from "./agent-thread.service";
import { ASK_USER_TOOL, type AskUserInput, askUserInputSchemaFor } from "./ask/ask-tool";
import { type FlowLanguage, flowLanguage } from "./ask/flow-copy";
import { closeOpenToolCalls, openToolCalls } from "./open-tool-calls";
import { FlowError, type FlowOutcome, type FlowState, QuestionFlowService } from "./ask/question-flow";
import type { KnownImage, ProductKnowledge, SeenProduct } from "./change-set-builders";
import { type CampaignState, createCampaignRun } from "./campaign-group";
import { seesTeamDrafts, stampRequester } from "./change-set-access";
import { settledStatus } from "./change-set-decision.service";
import { newId } from "./ids";
import { type CapabilitySet, effectiveCapabilities } from "./merchant-capabilities";
import { merchantInstructions } from "./merchant-instructions";
import {
	askUserOptions,
	createMerchantTools,
	type FindImagesInput,
	type GenerateImageInput,
	merchantUserMessage,
} from "./merchant-tools";
import type { PreparedProductEdit, PreparedSiteChange } from "../shop/shop-tools";
import {
	parseSuggestions,
	type RunFacts,
	ruleSuggestions,
	looksDeclined,
	SUGGEST_NEXT_MAX_TOKENS,
	SUGGEST_NEXT_SYSTEM,
	SUGGEST_NEXT_TASK,
	SUGGEST_NEXT_TIMEOUT_MS,
	suggestMode,
	suggestUserTurn,
} from "./suggest-next";
import { messageLanguage, replyLanguageName, summaryInScriptOf, wrongReplyLanguage } from "./message-language";
import { REPLY_LANGUAGE_TASK, REPLY_LANGUAGE_TIMEOUT_MS, replyInLanguageOf } from "./reply-language";
import { picturesSkippedRefusal } from "./pictures-skipped";
import { intentAnswer, intentForPrompt, type RunIntentInput, resolveIntent } from "./run-intents";
import { createResultMemory, type ResultMemory, shapeToolResult } from "./tool-results";
import { groupPurposes, type RoutingState, routedModel, routeGroups, routingEnabled, ToolRouter, USE_TOOLS, useToolsTool } from "./tool-routing";
import { editingLanguageOf, prepareWithLanguage, readWithLanguage } from "./site-editing-language";
import { draftTitle, productTitle, threadPreview } from "./thread-memory";
import type { RuntimeEnv } from "../settings/runtime-keys";
import { SettingsService } from "../settings/settings.service";
import { stripInternalMarkers } from "./internal-markers";
import { itemRecord } from "./receipt-records";
import { type BudgetStop, budgetLine, RunBudget } from "./run-budget";
import {
	CLIENT_REQUEST_REPLAY_MS,
	maxQueueWaitMs,
	placeInQueue,
	type QueuePlace,
	queueAliveMs,
	queueBusyLine,
	queueCaps,
	queueView,
	stoppedByLine,
	stoppedTeammateRun,
	THREAD_BUSY,
} from "./run-queue";
import { documentTexts, fromOutsideText, OUTSIDE_TEXT_CUSTOMER_VIEWS, OUTSIDE_TEXT_REPORT_METRICS } from "./untrusted-input";

export { newId } from "./ids";

export const MERCHANT_COPILOT_TASK = "agent.merchant-copilot";

/** Model calls one run may make across all its pauses (start + resumes). */
// a product flow alone can take 4 (ask, answers, draft, reply); 5 left a Malay chat at "too many steps"
const MAX_MODEL_CALLS_PER_RUN = 8;
/** Changes to existing records one request may stage. */
const MAX_EDITS_PER_RUN = 10;
/** A reserved start whose run row is not written yet counts as running this long (thread open, history reads). */
const PENDING_START_MS = 60_000;

/** Statuses a Stop still changes: working, waiting for a slot, or paused on a question. */
const STOPPABLE: ReadonlySet<AgentRun["status"]> = new Set(["queued", "planning", "running", "applying", "awaiting_input"]);
/** Statuses that end a request: saved before they are streamed (see `drive`). */
const ENDED_STATUSES: ReadonlySet<AgentRun["status"]> = new Set(["applied", "awaiting_approval", "failed", "cancelled"]);
const ALREADY_ANSWERED = "This question was already answered.";
/** The run still waits, but a newer message was sent in its chat: the question was left. */
const QUESTION_LEFT = "This question is no longer open: a newer message was sent in this chat.";
/** What an owner / admin may stop of a teammate's: only what takes or waits for a slot. */
const TEAMMATE_STOPPABLE: ReadonlySet<AgentRun["status"]> = new Set(["queued", "planning", "running", "applying"]);

/** Waits `ms`, or less when `signal` aborts (a Stop wakes a queued run at once). */
function pause(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", done);
			resolve();
		};
		const timer = setTimeout(done, Math.max(0, ms));
		signal.addEventListener("abort", done, { once: true });
	});
}

/** Frames streamed to the client: the run snapshot first, then its events. */
export type RunFrame = { type: "run.started"; run: AgentRun } | RunEvent;

/** Phrase keys of the run's own steps (the UI translates them). */
const STEP_PHRASE: Record<string, string> = {
	Thinking: "step.thinking",
	"Drafting with your answers": "step.drafting",
	"Reading your catalog families": "step.families",
	"Preparing a question": "step.question",
};

/** What each customer-tool read looks like in the merchant's step list (label + the chat's translated phrase key). */
const CUSTOMER_READ: Record<"customers" | "customer" | "leads" | "lead" | "email_templates" | "email_template", { label: string; phrase: string }> = {
	customers: { label: "Checked your customers", phrase: "store.customers" },
	customer: { label: "Checked a customer", phrase: "store.customers" },
	leads: { label: "Checked your contact leads", phrase: "store.leads" },
	lead: { label: "Checked a contact lead", phrase: "store.leads" },
	email_templates: { label: "Checked your email templates", phrase: "store.email_templates" },
	email_template: { label: "Checked an email template", phrase: "store.email_templates" },
};

/** What each inventory read looks like in the merchant's step list. */
const INVENTORY_STEP: Record<string, string> = {
	overview: "Checked what needs attention",
	stock: "Checked stock levels",
	product: "Checked stock for a product",
	item: "Checked a product's stock, channels and history",
	warehouses: "Checked your warehouses",
	warehouse: "Checked a warehouse",
	transfers: "Checked transfers",
	transfer: "Checked a transfer",
	reservations: "Checked reserved stock",
	reservation: "Checked reserved stock",
	adjustments: "Checked stock changes",
	adjustment: "Checked a stock change",
	cycle_counts: "Checked stock counts",
	cycle_count: "Checked a stock count",
	holds: "Checked held stock",
	facility_locations: "Checked bins and zones",
	location_mappings: "Checked channel stock locations",
};

/** The highest img_N the chat has used so far. */
function maxImageNumber(images: readonly KnownImage[]): number {
	return images.reduce((n, image) => Math.max(n, Number(/^img_(\d+)$/.exec(image.id)?.[1] ?? 0)), 0);
}

/** img_N ids stay unique across the chat (earlier turns' pictures keep theirs). */
function nextImageId(state: RunState): string {
	return `img_${maxImageNumber(state.images) + 1}`;
}

/** A chosen picture as the message shows it (its thumbnail stays after a reload). */
function chosenMedia(image: KnownImage): ReceiptMedia {
	return {
		url: image.url,
		...(image.alt ? { alt: image.alt.slice(0, 300) } : {}),
		label: (image.credit ?? (image.origin === "generated" ? "Generated" : image.origin === "stock" ? "Stock" : "Your picture")).slice(0, 60),
		imageId: image.id,
		ref: image.ref,
	};
}

/** A file sent with this message as a picture the run may place: a library pick keeps its ref (no copy). */
export function attachedImage(file: AttachmentRecord): KnownImage {
	// library picks: `asset:` (Product Master DAM) or `media:` (prime-web's own media, e.g. the staging release)
	const asset = file.ref && /^(asset|media):/.test(file.ref) ? file.ref : undefined;
	return {
		id: file.id,
		ref: asset ?? `attachment:${file.id}`,
		url: attachmentUrl(file.id),
		origin: file.origin,
		alt: file.name,
		...(file.credit ? { credit: file.credit } : {}),
	};
}

/** Keeps the Product Master products a run has seen (newest wins, bounded). */
function remember(state: RunState, items: ReadonlyArray<{ id: string; title: string; status?: string; meta?: string }>) {
	const seen = new Map((state.products ?? []).map((p) => [p.id, p]));
	for (const item of items) seen.set(item.id, { id: item.id, title: item.title, ...(item.status ? { status: item.status } : {}), ...(item.meta ? { meta: item.meta } : {}) });
	state.products = [...seen.values()].slice(-60);
}

/** Private state of a run between model calls — stored with the run while it waits for the merchant. */
interface RunState {
	/** messages of this run so far (images as `attachment:<id>` placeholders) */
	messages: ModelMessage[];
	/** earlier turns of the thread, replayed unchanged on every call of this run */
	historyCount: number;
	flow: FlowState | null;
	images: KnownImage[];
	modelCalls: number;
	/** the merchant's own words in this run (prompt + typed answers), for "From you" tags */
	merchantText: string;
	/** Product Master products seen by search_items / read_item (ids the store tool may use) */
	products?: SeenProduct[];
	/** changes to existing records staged in this run (capped) */
	edits?: number;
	/** the record the chat was started on (its thread's link) */
	about?: { kind: string; id: string; label?: string };
	/** records earlier drafts of the chat became (approved): a new draft of one is refused */
	created?: Array<{ kind: string; id: string; label?: string }>;
	/** the promo campaign this run started (start_campaign): cards staged after it are linked */
	campaign?: CampaignState;
	/** question cards shown in this run: the merchant is asked once per message */
	asks?: number;
	/** the language of the merchant's message (from the first ask), for the run's error line */
	language?: FlowLanguage;
	/**
	 * the run read text written outside the shop team (a lead, an order, a customer, an attached
	 * document): every card staged from then on needs a click (Auto-approve never applies it)
	 */
	tainted?: boolean;
	/** input + output tokens of this run's model calls so far (AI_RUN_TOKEN_BUDGET) */
	tokens?: number;
	/** tool groups loaded for this run (AI_TOOL_ROUTING); absent = every tool is sent */
	routing?: RoutingState;
	/** the merchant skipped a pictures question in this run: no generated pictures unless they ask (pictures-skipped.ts) */
	picturesSkipped?: boolean;
}

/** Attachment bytes loaded once per request (every model call of the run reuses them). */
type AttachmentCache = Map<string, Promise<Buffer | null>>;

/** A history message's text (history turns are plain text). */
function messageText(message: ModelMessage): string {
	if (typeof message.content === "string") return message.content;
	return Array.isArray(message.content) ? message.content.map((part) => (part.type === "text" ? part.text : "")).join("\n") : "";
}

/** The record a thread was started on, for the context line and current_page. */
function threadAbout(thread: AgentThread): RunState["about"] {
	return thread.entity ? { kind: thread.entity.kind, id: thread.entity.id, ...(thread.entity.label ? { label: thread.entity.label } : {}) } : undefined;
}

/** current_page: where the merchant sent this message from (the run's page + pin). */
export function currentPage(run: Pick<AgentRun, "page" | "context">, state: Pick<RunState, "about">) {
	const pin = run.context;
	return {
		title: run.page?.title ?? (pin ? `the "${pin.module}" page` : "not shared"),
		address: run.page?.path ?? null,
		module: pin?.module ?? run.page?.module ?? null,
		pinned: Boolean(pin),
		record: pin?.entity ?? null,
		filters: pin?.filters ?? null,
		chatStartedOn: state.about ?? null,
		note: pin
			? "The page is pinned to this message: \"this\" / \"here\" mean it."
			: "The merchant removed the page from this message: it is where they are, not what they are asking about.",
	};
}

function domainFor(module: string | undefined): AgentDomain {
	return module === "blog" ? "cms" : module === "inventory" ? "inventory" : module === "editor" ? "webbuilder" : "products";
}

/** The failed run's line, in the language the merchant writes in. */
const FAILURE_LINES: Record<FlowLanguage, { steps: string; unavailable: string; timeout: string; failed: string }> = {
	en: {
		steps: "This request took too many steps. Try a simpler request.",
		unavailable: "The AI provider is not configured for this workspace.",
		timeout: "The AI took too long to answer. Please try again.",
		failed: "The AI could not complete this request. Please try again.",
	},
	ms: {
		steps: "Permintaan ini mengambil terlalu banyak langkah. Cuba permintaan yang lebih ringkas.",
		unavailable: "Penyedia AI belum dikonfigurasikan untuk ruang kerja ini.",
		timeout: "AI mengambil masa terlalu lama untuk menjawab. Sila cuba lagi.",
		failed: "AI tidak dapat menyelesaikan permintaan ini. Sila cuba lagi.",
	},
	vi: {
		steps: "Yêu cầu này cần quá nhiều bước. Hãy thử yêu cầu đơn giản hơn.",
		unavailable: "Nhà cung cấp AI chưa được cấu hình cho không gian làm việc này.",
		timeout: "AI trả lời quá lâu. Vui lòng thử lại.",
		failed: "AI chưa hoàn thành được yêu cầu này. Vui lòng thử lại.",
	},
};

function userFacingError(error: unknown, language: FlowLanguage = "en"): string {
	const lines = FAILURE_LINES[language];
	if (error instanceof ModelUnavailableError) return lines.unavailable;
	const name = error instanceof Error ? error.name : "";
	if (/timeout|abort/i.test(name)) return lines.timeout;
	return lines.failed;
}

/** Where the browser loads an attachment (BFF → this service, owner-scoped). */
export function attachmentUrl(id: string): string {
	return `/api/agent/attachments/${encodeURIComponent(id)}/content`;
}

export function toAgentAttachment(record: AttachmentRecord): AgentAttachment {
	return {
		id: record.id,
		kind: record.kind,
		origin: record.origin,
		name: record.name,
		mime: record.mime,
		size: record.size,
		...(record.kind === "image" ? { url: attachmentUrl(record.id) } : {}),
		...(record.credit ? { credit: record.credit } : {}),
	};
}

function isAskCall(call: { toolName: string }): boolean {
	return call.toolName === ASK_USER_TOOL;
}

@Injectable()
export class AgentRunService {
	private readonly logger = new Logger(AgentRunService.name);
	/** runs driving (or waiting in the queue) in this process — Stop aborts their model call / wait */
	private readonly active = new Map<string, AbortController>();
	/** starts reserved as queued in this process: their `start` waits for a slot first */
	private readonly queuedStarts = new Set<string>();
	/** "Stopped by …" lines for runs an owner / admin stopped here, until the run saves itself */
	private readonly stopNotes = new Map<string, string>();

	constructor(
		@Inject(AGENT_STORE) private readonly store: AgentStore,
		@Inject(MODEL_REGISTRY) private readonly models: ModelRegistry,
		@Inject(USAGE_LEDGER) private readonly ledger: UsageLedger,
		@Inject(ENV) private readonly env: Env,
		private readonly threads: AgentThreadService,
		@Optional() private readonly flows?: QuestionFlowService,
		@Optional() @Inject(SHOP_TOOLS) private readonly shop?: ShopTools,
		@Optional() private readonly pictures?: ImageService,
		@Optional() @Inject(SPEND_GUARD) private readonly spend?: SpendGuard,
		@Optional() @Inject(ORG_BATTERY) private readonly battery?: OrgBattery,
		@Optional() @Inject(SHOP_CAPS) private readonly shopCaps?: ShopCaps,
		// Prime Studio's runtime knobs and timeouts (Studio -> env -> default); absent = env only
		@Optional() @Inject(SettingsService) private readonly settings?: SettingsService,
	) {}

	/** The runtime knobs as Studio sets them, else env. */
	private get rt(): RuntimeEnv {
		return this.settings?.runtimeEnv() ?? this.env;
	}

	/** What each driving run already fed the model (repeated parts of reads become pointers). */
	private readonly memories = new Map<string, () => ResultMemory>();

	/** The moments the quota and the queue count from. */
	private windows(now: Date): RunStartWindows {
		const ago = (ms: number) => new Date(now.getTime() - ms);
		return {
			daySince: ago(24 * 60 * 60 * 1000),
			minuteSince: ago(60 * 1000),
			runningSince: ago(runMaxRunningMs(this.env)),
			pendingSince: ago(PENDING_START_MS),
			queueAliveSince: ago(queueAliveMs(this.env)),
			now,
		};
	}

	/**
	 * Quota, checked before any stream opens so refusals are plain HTTP 429s. The start is
	 * recorded in the same step (per-org lock), so parallel starts cannot all pass and deleting
	 * the chat gives nothing back. Returns the run id `start` must use.
	 */
	async reserveStart(ctx: AiRequestContext, now: Date = new Date()): Promise<string> {
		return (await this.reserve(ctx, {}, now)).runId;
	}

	/**
	 * The start's checks in one locked step: the same client request id again → that run (`replay`); a chat that
	 * is still working → 409; the daily / per-minute quota → 429; then a slot now, or a place in the queue
	 * (`queued`: `start` waits for a slot on its open stream). Nothing is reserved on a refusal.
	 */
	async reserve(
		ctx: AiRequestContext,
		request: { threadId?: string; clientRequestId?: string } = {},
		now: Date = new Date(),
	): Promise<ReservedStart> {
		// AI switched off for the shop's plan: 403 before anything else is looked at
		assertAiEnabled(ctx);
		// the platform's spend caps (daily / monthly; Free pauses first): 503 before anything is reserved
		await this.spend?.assertWithinBudget(planOf(ctx));
		// the shop's own AI battery (its plan's budget, else AI_DAILY_BUDGET_USD_PER_ORG): 429 with the time it is back
		await this.battery?.assertAvailable(ctx.organizationId, aiBudgetMicros(ctx, this.env));
		// the shop's calendar-month allowance: 429
		await this.shopCaps?.assertAvailable(ctx);
		const runId = newId("run");
		const caps = queueCaps(this.rt);
		const reserved = await this.store.reserveRunStart(
			ctx,
			runId,
			this.windows(now),
			(counts) => {
				// one active run per chat: a second message while it works would race the first one's history
				if (counts.threadActive > 0) throw new AgentError(THREAD_BUSY, 409);
				if (counts.orgDay >= this.rt.AI_DAILY_RUN_LIMIT_PER_ORG) {
					throw new AgentError("Your workspace reached today's AI request limit. Try again tomorrow.", 429);
				}
				if (counts.userMinute >= this.rt.AI_RUNS_PER_MINUTE_PER_USER) {
					throw new AgentError("Too many AI requests in a minute. Please wait a moment.", 429);
				}
				// too many working (the shop's or this person's): wait in the queue instead of a refusal
				return { queued: !placeInQueue(counts.slots, { runId, userId: ctx.userId }, caps).admitted };
			},
			{
				...(request.threadId ? { threadId: request.threadId } : {}),
				...(request.clientRequestId ? { clientRequestId: request.clientRequestId, replaySince: new Date(now.getTime() - CLIENT_REQUEST_REPLAY_MS) } : {}),
				...(ctx.name ? { userName: ctx.name } : {}),
			},
		);
		if (reserved.queued) this.queuedStarts.add(reserved.runId);
		return reserved;
	}

	/**
	 * `thread` is the already-opened thread (the controller opens it before
	 * streaming so a foreign threadId is a plain 404); otherwise it is opened here.
	 * `runId` is the id `reserveStart` recorded the start under.
	 */
	async start(
		ctx: AiRequestContext,
		input: StartRunInput,
		emit: (frame: RunFrame) => void,
		thread?: AgentThread,
		runId?: string,
	): Promise<AgentRun> {
		const startedAt = new Date();
		const opened = thread ?? (await this.threads.open(ctx, input));
		const threadId = opened.id;
		const files = await this.store.getAttachments(
			{ organizationId: ctx.organizationId, userId: ctx.userId },
			input.attachmentIds ?? [],
		);
		// One read of the chat's runs + change sets, before this run exists:
		// - earlier turns first (append-only, byte-stable)
		// - pictures of earlier turns keep their ids, and the model is told which there are
		//   (even without history: a chat whose turns all ended on a question still has their pictures)
		// - what became of the chat's earlier drafts (the history only says they were staged)
		const memory = await this.threads.runMemory(ctx.organizationId, threadId);
		const history = memory.history;
		const earlier = memory.images;
		const decided = history.length > 0 ? memory.changeSets : [];
		// Static system prompt + tools (cacheable prefix); page/locale/date + files ride on the user turn.
		const about = threadAbout(opened);
		const created = decided.flatMap((changeSet) =>
			changeSet.status === "applied"
				? (changeSet.result?.entities ?? []).filter((e) => e.kind === "blog_post" || e.kind === "product").map((e) => ({ kind: e.kind, id: e.id, ...(e.label ? { label: e.label } : {}) }))
				: [],
		);
		// pictures of the chat the merchant chose with "Use this" (unknown ids are dropped)
		const known = [...earlier, ...files.filter((f) => f.kind === "image").map(attachedImage)];
		const chosen = [...new Set(input.pictureIds ?? [])].flatMap((id) => known.filter((image) => image.id === id).slice(0, 1)).slice(0, 12);
		const userMessage = merchantUserMessage(
			{
				...(input.context ? { module: input.context.module } : {}),
				...(input.page ? { page: input.page } : {}),
				...(about ? { about } : {}),
				locale: ctx.locale,
				today: startedAt.toISOString().slice(0, 10),
				...(input.context?.entity ? { entity: input.context.entity } : {}),
				...(input.context?.filters ? { filters: input.context.filters } : {}),
				...(input.context?.elements?.length ? { elements: input.context.elements } : {}),
			},
			input.prompt,
			files.map((f) => ({ id: f.id, kind: f.kind, name: f.name })),
			earlier,
			chosen,
			decided,
		);
		type UserPart = { type: "text"; text: string } | { type: "image"; image: string; mediaType: string };
		// documents: facts to read, fenced as untrusted, capped per file and per turn (a cut says so)
		const documents = files.filter((file) => file.kind !== "image");
		const documentText = documentTexts(documents, this.env.AI_TURN_DOCUMENT_CHARS);
		const parts: UserPart[] = [{ type: "text", text: userMessage }];
		for (const file of files) {
			if (file.kind === "image") parts.push({ type: "image", image: `attachment:${file.id}`, mediaType: file.mime });
			else parts.push({ type: "text", text: documentText[documents.indexOf(file)] as string });
		}
		const userTurn: ModelMessage = { role: "user", content: parts };
		// reserved beyond the working caps: the run exists at once (the chat shows it) and waits for a slot
		const queued = runId !== undefined && this.queuedStarts.delete(runId);
		let run: AgentRun = {
			id: runId ?? newId("run"),
			role: "merchant",
			domain: input.domain ?? domainFor(input.context?.module ?? input.page?.module),
			prompt: input.prompt,
			context: input.context,
			...(input.page ? { page: input.page } : {}),
			...(chosen.length > 0 ? { pictures: chosen.map(chosenMedia) } : {}),
			status: queued ? "queued" : "planning",
			steps: [],
			receipts: [],
			changeSetIds: [],
			threadId,
			...(files.length > 0 ? { attachments: files.map(toAgentAttachment) } : {}),
			startedAt: startedAt.toISOString(),
		};
		await this.store.createRun(ctx, run, userMessage);
		await this.store.assignAttachments({ organizationId: ctx.organizationId, userId: ctx.userId }, files.map((f) => f.id), threadId);
		await this.store.touchThread(ctx.organizationId, threadId, { preview: threadPreview(input.prompt), at: startedAt });
		emit({ type: "run.started", run });
		// the run's model budget starts when it leaves the queue (the wait is capped to fit the request)
		let budgetFrom = startedAt.getTime();
		if (queued) {
			const waited = await this.waitForSlot(ctx, run, emit, startedAt.getTime());
			if (!waited.admitted) return waited.run;
			run = { ...run, status: "planning", startedAt: waited.at.toISOString() };
			emit({ type: "run.status", runId: run.id, status: "planning" });
			budgetFrom = waited.at.getTime();
		}
		const state: RunState = {
			messages: [...history, userTurn],
			historyCount: history.length,
			flow: null,
			images: [...earlier, ...files.filter((f) => f.kind === "image").map(attachedImage)],
			modelCalls: 0,
			merchantText: input.prompt.toLowerCase(),
			...(about ? { about } : {}),
			...(created.length > 0 ? { created: created.slice(-20) } : {}),
			// a document's text was written by someone else (a supplier, a customer): its cards need a click
			...(documents.length > 0 ? { tainted: true } : {}),
			// only the tool groups this message needs are sent (page, record, words of the message and the last turn)
			...(routingEnabled(this.rt.AI_TOOL_ROUTING)
				? {
						routing: {
							groups: routeGroups({
								turns: [...history.filter((message) => message.role === "user").map(messageText), userMessage],
								replies: history.filter((message) => message.role === "assistant").map(messageText),
								taskKey: opened.taskKey ?? input.task?.key ?? null,
							}),
						},
					}
				: {}),
		};
		// a read the platform can answer without the model: a chip it wrote, or the client's intent (files mean a real request)
		const intent = files.length === 0 && chosen.length === 0 ? (input.intent ?? intentForPrompt(input.prompt)) : undefined;
		return this.drive(ctx, run, state, emit, this.budget(budgetFrom), intent);
	}

	/**
	 * A queued run waits on its open stream: every AI_QUEUE_POLL_MS it checks (under the org lock) whether a slot
	 * is free for it in FIFO order, and sends `run.queued` when its place or the working list changes. It ends
	 * admitted (now `planning`), stopped (Stop here or on another instance; the chat deleted), or failed after the
	 * longest wait. Stop here wakes it at once.
	 */
	private async waitForSlot(
		ctx: AiRequestContext,
		run: AgentRun,
		emit: (frame: RunFrame) => void,
		since: number,
	): Promise<{ admitted: true; at: Date } | { admitted: false; run: AgentRun }> {
		const deadline = since + maxQueueWaitMs(this.rt);
		const caps = queueCaps(this.rt);
		const abort = new AbortController();
		this.active.set(run.id, abort);
		const end = async (event: Extract<RunEvent, { type: "run.status" }>, save: boolean) => {
			const ended = reduceRunEvent(run, event);
			emit(event);
			return { admitted: false as const, run: save ? await this.finish(ctx, ended) : ended };
		};
		let sent = "";
		try {
			while (true) {
				let place: QueuePlace | null = null;
				const check = await this.store.checkQueuedRun(ctx.organizationId, run.id, this.windows(new Date()), (slots) => {
					place = placeInQueue(slots, { runId: run.id, userId: ctx.userId }, caps);
					return place.admitted;
				});
				const stoppedHere = abort.signal.aborted;
				if (check.admitted && !stoppedHere) return { admitted: true, at: new Date() };
				if (stoppedHere) {
					// Stop pressed on this instance (cancel() left the saving to us): out of the queue, row written here
					const note = this.stopNotes.get(run.id);
					return end({ type: "run.status", runId: run.id, status: "cancelled", ...(note ? { error: note } : {}) }, true);
				}
				if (check.status !== "queued") {
					// the chat was deleted (no row), or Stop on another instance wrote the row: it already says how it ended
					const stored = check.status === null ? null : await this.store.getRun(ctx.organizationId, run.id);
					const status = stored?.status ?? "cancelled";
					return end({ type: "run.status", runId: run.id, status, ...(stored?.error ? { error: stored.error } : {}) }, false);
				}
				const view = queueView(ctx, check.slots, place ?? { admitted: false, position: 1, ahead: 0 });
				const key = JSON.stringify(view);
				if (key !== sent) {
					sent = key;
					emit({ type: "run.queued", runId: run.id, ...view });
				}
				const left = deadline - Date.now();
				if (left <= 0) {
					this.logger.warn(`run ${run.id} gave up waiting for a slot (${view.ahead} ahead, ${check.slots.working.length} working)`);
					return end({ type: "run.status", runId: run.id, status: "failed", error: queueBusyLine(messageLanguage(run.prompt, ctx.locale)) }, true);
				}
				await pause(Math.min(this.env.AI_QUEUE_POLL_MS, left), abort.signal);
			}
		} finally {
			this.active.delete(run.id);
			this.stopNotes.delete(run.id);
		}
	}

	/** This request's model budget: the deadline counts from the request's start. */
	private budget(startedAt: number): RunBudget {
		return new RunBudget(startedAt, this.rt.AI_RUN_BUDGET_MS, this.env.AI_RUN_TOKEN_BUDGET);
	}

	/** The platform's daily spend cap (AI_DAILY_BUDGET_USD): 503 before anything calls a model. */
	private async assertCanSpend(ctx: AiRequestContext): Promise<void> {
		assertAiEnabled(ctx);
		await this.spend?.assertWithinBudget(planOf(ctx));
	}

	/**
	 * The merchant answered the open question: the flow either asks the next
	 * one (no model call) or returns the `ask_user` result and the run continues.
	 * The run is claimed first (`awaiting_input` → `running` in one conditional write): a second answer
	 * (double click, two tabs, a retry) gets 409 and no model call; while it works the chat is busy
	 * and the stale-run sweep closes it if the process is killed.
	 */
	async answer(ctx: AiRequestContext, runId: string, input: AnswerInput, emit: (frame: RunFrame) => void): Promise<AgentRun> {
		const budget = this.budget(Date.now());
		await this.assertCanSpend(ctx);
		const stored = await this.store.claimAwaitingInput(ctx.organizationId, runId, ctx.userId, new Date());
		if (!stored) {
			const current = await this.store.getRun(ctx.organizationId, runId, ctx.userId);
			if (!current) throw new AgentError("Run not found.", 404);
			throw new AgentError(current.status === "awaiting_input" ? QUESTION_LEFT : ALREADY_ANSWERED, 409);
		}
		// the claim undone: the question waits again, as it was (unless a Stop closed it meanwhile)
		const reopen = () => this.store.saveRunIfStatus(ctx.organizationId, { ...stored.run, status: "awaiting_input" }, ["running"]);
		const state = stored.state as RunState | null;
		if (!state?.flow || !this.flows) {
			await reopen();
			throw new AgentError(ALREADY_ANSWERED, 409);
		}
		let run: AgentRun = stored.run;
		emit({ type: "run.started", run });
		if (input.text) state.merchantText += `\n${input.text.toLowerCase()}`;
		const push = (event: RunEvent) => {
			run = reduceRunEvent(run, event);
			emit(event);
		};
		let outcome: FlowOutcome;
		try {
			outcome = await this.flows.answer(ctx, run.id, state.flow, input);
		} catch (error) {
			if (error instanceof FlowError) {
				await reopen();
				throw new AgentError(error.message, 409);
			}
			// anything else ends the run: it must not stay claimed as `running` until the sweep finds it
			this.logger.warn(`run ${run.id} answer failed: ${error instanceof Error ? error.message : String(error)}`);
			// saved first, streamed after: a client that sees the run end may send the next message at once, and the chat
			// stays busy (409 THREAD_BUSY) until the row says otherwise — same rule as `drive`'s held end
			const failed: RunEvent = { type: "run.status", runId: run.id, status: "failed", error: userFacingError(error, state.language ?? flowLanguage(null, ctx.locale)) };
			run = reduceRunEvent(run, failed);
			let saved = run;
			try {
				saved = await this.finish(ctx, run);
			} catch (saveError) {
				this.logger.warn(`run ${run.id} could not be saved before its failure was sent: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
			}
			emit(failed);
			return saved;
		}
		return this.afterFlow(ctx, () => run, state, outcome, emit, push, budget);
	}

	/** Every option of the open question matching `query` (the card's search box). */
	async searchOptions(ctx: AiRequestContext, runId: string, questionId: string, query: string): Promise<QuestionOption[]> {
		const stored = await this.store.getRunWithState(ctx.organizationId, runId, ctx.userId);
		const state = stored?.state as RunState | null;
		if (!stored || stored.run.status !== "awaiting_input" || !state?.flow || !this.flows || !query.trim()) return [];
		const options = await this.flows.searchOptions(ctx, state.flow, questionId, query.slice(0, 80));
		// picture searches are remembered so the answer can name what was found — only while the question is
		// still open: an answer claimed meanwhile owns the state (this read is older than its run)
		if (options.some((o) => o.imageUrl)) await this.store.saveRunState(ctx.organizationId, runId, state, "awaiting_input");
		return options;
	}

	// ── the loop ─────────────────────────────────────────────────────────

	private async afterFlow(
		ctx: AiRequestContext,
		current: () => AgentRun,
		state: RunState,
		outcome: FlowOutcome,
		emit: (frame: RunFrame) => void,
		push: (event: RunEvent) => void,
		budget: RunBudget,
	): Promise<AgentRun> {
		const run = current();
		if (outcome.status === "ask") {
			push({ type: "run.ask", runId: run.id, ask: outcome.ask, answers: outcome.answers });
			push({ type: "run.status", runId: run.id, status: "awaiting_input" });
			const paused = current();
			await this.store.saveRun(ctx.organizationId, paused);
			await this.store.saveRunState(ctx.organizationId, run.id, state);
			return paused;
		}
		this.closeFlow(run.id, state, outcome, push);
		return this.drive(ctx, current(), state, emit, budget);
	}

	/** The flow is over: answers fixed, a receipt, and the ask_user tool result for the model. */
	private closeFlow(
		runId: string,
		state: RunState,
		outcome: Extract<FlowOutcome, { status: "done" }>,
		push: (event: RunEvent) => void,
	): void {
		const flow = state.flow as FlowState;
		// pictures picked or uploaded in a card become usable image ids for the drafts
		for (const image of flow.picked) if (!state.images.some((i) => i.id === image.id)) state.images.push(image);
		if (outcome.answers.some((a) => a.kind === "images" && a.source === "skipped")) state.picturesSkipped = true;
		push({ type: "run.ask", runId, ask: null, answers: outcome.answers });
		push({
			type: "run.receipt",
			runId,
			receipt: {
				id: newId("rcpt"),
				tool: "catalog.ask_user",
				summary: [
					flow.family ? `Family: ${flow.family.label}` : null,
					`${flow.stats.asked} asked`,
					flow.stats.auto > 0 ? `${flow.stats.auto} picked from your catalog` : null,
				]
					.filter(Boolean)
					.join(" · "),
				durationMs: 0,
				status: "ok",
				entityIds: flow.family ? [flow.family.id] : [],
				phrase: {
					key: "ask.done",
					values: { asked: flow.stats.asked, auto: flow.stats.auto, ...(flow.family ? { family: flow.family.label } : {}) },
				},
				// the photos picked in the card: shown, and usable by id in later messages of the chat
				...(flow.picked.length > 0
					? {
							media: flow.picked.slice(0, 12).map((image) => ({
								url: image.url,
								...(image.alt ? { alt: image.alt.slice(0, 300) } : {}),
								label: (image.credit ?? "Picked").slice(0, 60),
								imageId: image.id,
								ref: image.ref,
							})),
						}
					: {}),
			},
		});
		state.messages.push({
			role: "tool",
			content: [
				{
					type: "tool-result",
					toolCallId: flow.toolCallId,
					toolName: ASK_USER_TOOL,
					output: { type: "json", value: JSON.parse(JSON.stringify(outcome.result)) },
				},
			],
		});
	}

	/** Calls the model until it stages, answers, or asks the merchant (pause). */
	private async drive(
		ctx: AiRequestContext,
		initial: AgentRun,
		state: RunState,
		emit: (frame: RunFrame) => void,
		budget: RunBudget,
		rawIntent?: RunIntentInput,
	): Promise<AgentRun> {
		let run = initial;
		// The run's end is streamed only after it is saved: a client that sees it end may send the next message at
		// once, and the chat is busy until the row says otherwise (409 THREAD_BUSY). Suggestions come after it.
		let heldEnd: RunEvent | null = null;
		let holdEnd = true;
		const push = (event: RunEvent) => {
			run = reduceRunEvent(run, event);
			if (holdEnd && event.type === "run.status" && ENDED_STATUSES.has(event.status)) {
				heldEnd = event;
				return;
			}
			emit(event);
		};
		/** Saves the ended run, then streams its end (a failed save is logged; `finish` saves again). */
		const releaseEnd = async () => {
			holdEnd = false;
			const end = heldEnd;
			heldEnd = null;
			if (!end) return;
			try {
				await this.store.saveRun(ctx.organizationId, run);
			} catch (error) {
				this.logger.warn(`run ${run.id} could not be saved before its end was sent: ${error instanceof Error ? error.message : String(error)}`);
			}
			emit(end);
		};
		const step = (status: "running" | "done" | "failed", label = "Drafting your request") =>
			push({
				type: "run.step",
				runId: run.id,
				step: { id: `model_${state.modelCalls}`, label, status, phrase: { key: STEP_PHRASE[label] ?? "step.thinking" } },
			});

		const staged: ChangeSet[] = [];
		// attachment bytes are read once per request, not on every model call
		const attachments: AttachmentCache = new Map();
		// set when this request is over: a tool still running from a timed-out call stages nothing more
		let closed = false;
		// what this deployment (and this request's signed token) lets the copilot do
		const capabilities = effectiveCapabilities(this.env.AI_AGENT_CAPABILITIES, ctx.capabilities);
		// tool routing: the groups this run loaded; a run that has them all is sent exactly as unrouted
		const router = routingEnabled(this.rt.AI_TOOL_ROUTING) && state.routing ? new ToolRouter(capabilities, state.routing) : null;
		const routed = router !== null && !router.complete;
		const instructionsNow = () => (router && routed ? merchantInstructions(router.capabilities, capabilities) : merchantInstructions(capabilities));
		// reads of this run, for the rule-made suggestions
		const reads: Array<RunFacts["reads"][number]> = [];
		// repeated parts of reads: the model already has them (committed = successful calls; a fallback attempt starts from there)
		let committedMemory: ResultMemory = createResultMemory();
		let attemptMemory: ResultMemory = committedMemory;
		this.memories.set(run.id, () => attemptMemory);
		const merchantTools: ToolSet = createMerchantTools({
			runId: run.id,
			newChangeSetId: () => newId("cs"),
			now: () => new Date(),
			campaign: createCampaignRun(run.id, state),
			stage: async (drafted) => {
				const t0 = Date.now();
				if (closed) throw new AgentError("This request already ended, so nothing more is drafted.", 409);
				// after reading someone else's words (a lead, an order, a file) a card is approved only by a click
				// who asked (from the signed context, never the model): owners / admins see it as "Asked by …"
				// the one-line summary is the model's: in another script than the merchant's message it is replaced
				const changeSet = stampRequester(
					state.tainted ? fromOutsideText(drafted) : { ...drafted, summary: summaryInScriptOf(drafted.summary, drafted.title, run.prompt) },
					ctx,
				);
				// the chat was deleted (Start over, history delete) or the run stopped elsewhere: nothing more is staged
				const status = await this.store.getRunStatus(ctx.organizationId, run.id);
				if (status === null || status === "cancelled") {
					abort.abort();
					throw new AgentError("This chat was cleared, so nothing more is drafted.", 409);
				}
				await this.store.insertChangeSet(ctx.organizationId, changeSet);
				staged.push(changeSet);
				// the chat is now named after what it made — names the model already wrote, no extra call
				await this.retitle(ctx, run.threadId, changeSet.drafts ? draftTitle(changeSet.drafts, ctx.locale) : null);
				push({ type: "changeset.staged", runId: run.id, changeSet });
				push({
					type: "run.receipt",
					runId: run.id,
					receipt: {
						id: newId("rcpt"),
						tool: changeSet.action?.kind ?? "stage",
						summary: changeSet.title,
						phrase: { key: "stage", values: { subject: changeSet.title.slice(0, 200) } },
						durationMs: Date.now() - t0,
						status: "ok",
						entityIds: [],
					},
				});
			},
			productKnowledge: () => this.knowledge(ctx, state, run.context?.module, capabilities),
			createdInChat: () => state.created ?? [],
			currentPage: () =>
				this.readTool(run.id, push, "page.current", "Checked the page you're on", async () => currentPage(run, state), "page.current"),
			images: () => state.images,
			findImages: (input) => this.findImages(ctx, run.id, state, input, push),
			generateImages: (input) => this.generateImages(ctx, run.id, state, input, push),
			seenProducts: () => state.products ?? [],
			inventoryRead: (input) =>
				this.readTool(run.id, push, "inventory.read", INVENTORY_STEP[input.view] ?? "Checked your stock", async () => {
					if (!this.shop?.inventoryRead) throw new Error("unavailable");
					return (await this.shop.inventoryRead(ctx, input)) as Record<string, unknown>;
				}, `inventory.${input.view}`),
			inventoryPrepare: async (input) => {
				if (!this.shop?.inventoryPrepare) return { error: { code: "unavailable", message: "Inventory is not connected." } };
				try {
					return await this.shop.inventoryPrepare(ctx, input);
				} catch (error) {
					this.logger.warn(`inventory.prepare failed: ${String(error)}`);
					return { error: { code: "unavailable", message: "The inventory could not be read right now." } };
				}
			},
			productPrepare: async (input) => {
				const read = await this.readTool(run.id, push, "content.check", "Checked the latest product", async () => {
					if (!this.shop?.productPrepare) throw new Error("unavailable");
					// the pictures this run may place travel with the request (prime-web resolves them on confirm)
					const images = state.images.map((i) => ({ id: i.id, ref: i.ref, url: i.url, ...(i.alt ? { alt: i.alt.slice(0, 300) } : {}) }));
					return { prepared: await this.shop.productPrepare(ctx, { input, images: images.slice(-40) }) };
				}, "content.check.product");
				return "prepared" in read ? (read.prepared as PreparedProductEdit | { error: unknown }) : (read as { error: unknown });
			},
			productPreparePublish: async (input) => {
				const read = await this.readTool(run.id, push, "content.check", "Checked the latest product", async () => {
					if (!this.shop?.productPreparePublish) throw new Error("unavailable");
					return { prepared: await this.shop.productPreparePublish(ctx, input) };
				}, "content.check.product");
				return "prepared" in read ? (read.prepared as PreparedProductEdit | { error: unknown }) : (read as { error: unknown });
			},
			allowEdit: () => {
				if ((state.edits ?? 0) >= MAX_EDITS_PER_RUN) return false;
				state.edits = (state.edits ?? 0) + 1;
				return true;
			},
			snapshot: (input) =>
				this.readTool(run.id, push, "content.check", `Checked the latest ${input.kind === "product" ? "product" : "post"}`, async () => {
					if (!this.shop?.snapshotItem) throw new Error("unavailable");
					return this.shop.snapshotItem(ctx, input);
				}, `content.check.${input.kind === "product" ? "product" : "post"}`),
			readItem: (input) =>
				this.readTool(run.id, push, "content.read", `Read the ${input.kind === "product" ? "product" : "post"}`, async () => {
					if (!this.shop?.readItem) throw new Error("unavailable");
					const item = await this.shop.readItem(ctx, { kind: input.kind, id: input.id });
					if (item.kind === "product") remember(state, [item]);
					// the chat shows the record as one card (its main photo as the thumbnail), not its photos
					const { media, ...read } = item;
					return { ...read, records: [itemRecord(item, media?.[0]?.url)] };
				}, `content.read.${input.kind === "product" ? "product" : "post"}`),
			searchItems: (input) =>
				this.readTool(run.id, push, "content.search", `Looked through your ${input.kind === "product" ? "products" : "posts"}`, async () => {
					if (!this.shop?.searchItems) throw new Error("unavailable");
					const list = await this.shop.searchItems(ctx, {
						kind: input.kind,
						...(input.query ? { query: input.query } : {}),
						status: input.status,
						limit: input.limit,
					});
					if (input.kind === "product") remember(state, list.items);
					// record cards in the chat (three show, the rest behind "Show N more"); each can be picked with Use
					return { ...list, records: list.items.slice(0, 10).map((item) => itemRecord(item)) };
				}, `content.search.${input.kind === "product" ? "product" : "post"}`),
			siteRead: (input) =>
				this.readTool(run.id, push, "site.read", input.view === "products" ? "Looked through your store's products" : "Read your website", async () => {
					if (!this.shop?.siteRead) throw new Error("unavailable");
					const { pageId, blockId, query, ...rest } = input;
					return (await this.shop.siteRead(ctx, readWithLanguage({
						...rest,
						...(pageId ? { pageId } : {}),
						...(blockId ? { blockId } : {}),
						...(query ? { query } : {}),
					}, editingLanguageOf(run.context)))) as Record<string, unknown>;
				}, `site.read.${input.view}`),
			storeCategories: (input) =>
				this.readTool(run.id, push, "store.categories", "Checked your categories", async () => {
					if (!this.shop?.storeCategories) throw new Error("unavailable");
					return (await this.shop.storeCategories(ctx, input.query ? { query: input.query } : {})) as Record<string, unknown>;
				}, "store.categories"),
			storeDiscounts: (input) =>
				this.readTool(run.id, push, "store.discounts", "Checked your discounts", async () => {
					if (!this.shop?.storeDiscounts) throw new Error("unavailable");
					return (await this.shop.storeDiscounts(ctx, {
						...(input.id ? { id: input.id } : {}),
						...(input.code ? { code: input.code } : {}),
						...(input.query ? { query: input.query } : {}),
						filter: input.filter,
						limit: input.limit,
					})) as Record<string, unknown>;
				}, "store.discounts"),
			storeOrders: (input) =>
				this.readTool(run.id, push, "store.orders", "Checked your orders", async () => {
					if (!this.shop?.storeOrders) throw new Error("unavailable");
					// buyers' names, addresses and notes come back in every view
					const read = (await this.shop.storeOrders(ctx, {
						view: input.view,
						...(input.id ? { id: input.id } : {}),
						...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
						...(input.query ? { query: input.query } : {}),
						status: input.status,
						...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
						...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
						...(input.from ? { from: input.from } : {}),
						...(input.to ? { to: input.to } : {}),
						limit: input.limit,
					})) as Record<string, unknown>;
					state.tainted = true;
					reads.push({ tool: "store_orders", input: { view: input.view } });
					return read;
				}, "store.orders"),
			storeReports: (input) =>
				this.readTool(run.id, push, "store.reports", "Looked at your numbers", async () => {
					if (!this.shop?.storeReports) throw new Error("unavailable");
					const read = (await this.shop.storeReports(ctx, {
						metric: input.metric,
						...(input.period ? { period: input.period } : {}),
						...(input.from ? { from: input.from } : {}),
						...(input.to ? { to: input.to } : {}),
						...(input.compare !== null ? { compare: input.compare } : {}),
						...(input.rankBy ? { rankBy: input.rankBy } : {}),
						...(input.limit ? { limit: input.limit } : {}),
					})) as Record<string, unknown>;
					// traffic lists referrers and visited addresses: visitors choose those words
					if (OUTSIDE_TEXT_REPORT_METRICS.has(input.metric)) state.tainted = true;
					reads.push({ tool: "store_reports", input: { metric: input.metric, period: input.period } });
					return read;
				}, "store.reports"),
			storeTodos: (input) =>
				this.readTool(run.id, push, "store.todos", "Checked what needs you", async () => {
					if (!this.shop?.storeTodos) throw new Error("unavailable");
					const read = (await this.shop.storeTodos(ctx, input.limit ? { limit: input.limit } : {})) as Record<string, unknown>;
					reads.push({ tool: "store_todos", value: read });
					return read;
				}, "store.todos"),
			storeCustomers: (input) =>
				this.readTool(run.id, push, "store.customers", CUSTOMER_READ[input.view].label, async () => {
					if (!this.shop?.storeCustomers) throw new Error("unavailable");
					const read = (await this.shop.storeCustomers(ctx, {
						view: input.view,
						...(input.id ? { id: input.id } : {}),
						...(input.query ? { query: input.query } : {}),
						rank: input.rank,
						sort: input.sort,
						leadStatus: input.leadStatus,
						...(input.olderThanDays ? { olderThanDays: input.olderThanDays } : {}),
						...(input.templateType ? { templateType: input.templateType } : {}),
						limit: input.limit,
					})) as Record<string, unknown>;
					// customers' names and notes, visitors' messages (the shop's own email templates are not)
					if (OUTSIDE_TEXT_CUSTOMER_VIEWS.has(input.view)) state.tainted = true;
					return read;
				}, CUSTOMER_READ[input.view].phrase),
			pendingChanges: async () =>
				run.threadId ? (await this.store.listThreadChangeSets(ctx.organizationId, run.threadId)).map((stored) => stored.changeSet) : [],
			siteText: () => ({ request: run.prompt, editingLanguage: editingLanguageOf(run.context) }),
			sitePrepare: async (kind, input) => {
				const read = await this.readTool(run.id, push, "site.check", "Checked the latest page", async () => {
					if (!this.shop?.sitePrepare) throw new Error("unavailable");
					return { prepared: await this.shop.sitePrepare(ctx, kind, prepareWithLanguage(kind, input, editingLanguageOf(run.context))) };
				}, "site.check");
				return "prepared" in read ? (read.prepared as PreparedSiteChange | { error: unknown }) : (read as { error: unknown });
			},
		}, capabilities);
		const tools: ToolSet = routed && router ? { ...merchantTools, [USE_TOOLS]: useToolsTool(capabilities, (groups) => router.load(groups)) } : merchantTools;
		const toolNames = Object.keys(tools);

		const ledgerBase = {
			organizationId: ctx.organizationId,
			userId: ctx.userId,
			surface: "merchant" as const,
			task: MERCHANT_COPILOT_TASK,
			runId: run.id,
		};
		let lastModel: ResolvedModel | undefined;
		// the last call read its prefix from the provider's cache: only then may a suggestion call follow (never more calls than before)
		let warm = false;
		const abort = new AbortController();
		this.active.set(run.id, abort);
		const stopWatching = this.watchForCancel(ctx.organizationId, run.id, abort);
		// set when the model used its steps on tools and never replied: one last call, no tools, to answer
		let wrapUp = false;
		const language = () => state.language ?? flowLanguage(null, ctx.locale);
		/** Out of time or tokens: keep what was staged and say why the run stopped. */
		const stopForBudget = (reason: BudgetStop) =>
			push(
				staged.length > 0
					? { type: "run.status", runId: run.id, status: "awaiting_approval", answer: budgetLine(reason, true, language()) }
					: { type: "run.status", runId: run.id, status: "failed", error: budgetLine(reason, false, language()) },
			);
		try {
			// a read-only shortcut: the tool runs, a template answers from its numbers, no model call
			const intent = state.modelCalls === 0 ? resolveIntent(rawIntent, capabilities) : null;
			let answered = false;
			if (intent) {
				const read = tools[intent.tool] as { execute?: (input: unknown, options: unknown) => Promise<unknown> } | undefined;
				const value = await read?.execute?.(intent.args, { toolCallId: newId("call"), messages: [], abortSignal: abort.signal });
				const answer = intentAnswer(intent, value, messageLanguage(run.prompt, ctx.locale));
				if (answer) {
					state.messages.push({ role: "assistant", content: answer });
					push({ type: "run.status", runId: run.id, status: "applied", answer });
					answered = true;
				}
			}
			while (!answered) {
				abort.signal.throwIfAborted(); // Stop (here or on another instance) between steps
				if (state.modelCalls >= MAX_MODEL_CALLS_PER_RUN) throw new AgentError(FAILURE_LINES[language()].steps, 400);
				// never start a call that cannot finish inside the function, or past the run's tokens
				const stop = budget.stop(state.tokens ?? 0);
				if (stop) {
					this.logger.warn(`run ${run.id} stopped: out of ${stop === "time" ? "time" : "tokens"} after ${state.modelCalls} model calls`);
					stopForBudget(stop);
					break;
				}
				state.modelCalls += 1;
				step("running", state.flow ? "Drafting with your answers" : "Thinking");
				// every tool call needs a result before the next model call (else AI_MissingToolResultsError)
				closeOpenToolCalls(state.messages, (call) =>
					call.toolName === ASK_USER_TOOL
						? "Not asked: the merchant gets one question card per message. Use the answers you already have; draft now and say in one line what you assumed."
						: "No result for this call. Continue without it.",
				);
				const messages = await this.hydrate(ctx, state.messages, attachments);
				const chain = this.models.resolveChain("balanced");
				let attemptUsage = new UsageTally();
				const { value: result, model, latencyMs } = await runWithFallback(
					chain,
					(candidate) => {
						lastModel = candidate;
						// a fallback attempt only has the reads of earlier, successful calls in its messages
						attemptMemory = new Map(committedMemory);
						const tally = new UsageTally();
						attemptUsage = tally;
						return generateText({
							// routed: the provider gets only the loaded groups' tools (every tool still runs if called)
							model: routed && router ? routedModel(candidate.model, () => router.sentTools(toolNames)) : candidate.model,
							instructions: cacheableInstructions(instructionsNow(), candidate.provider),
							...(routed && router
								? {
										// use_tools (or a call to a tool that was not sent) loads groups: the next step has their instructions
										prepareStep: ({ steps }: { steps: ReadonlyArray<{ toolCalls: ReadonlyArray<{ toolName: string }> }> }) => {
											for (const call of steps.at(-1)?.toolCalls ?? []) router.loadForTool(call.toolName);
											return { instructions: cacheableInstructions(instructionsNow(), candidate.provider) };
										},
									}
								: {}),
							// Same messages on every fallback candidate / retry.
							messages,
							tools,
							...(wrapUp ? { toolChoice: "none" as const } : {}),
							// ask_user has no execute: its call ends the turn (the run pauses for the merchant)
							stopWhen: wrapUp ? [isStepCount(1)] : [isStepCount(6), hasToolCall(ASK_USER_TOOL)],
							maxOutputTokens: this.env.AI_MAX_OUTPUT_TOKENS,
							// each attempt (a fallback too) gets its own limit, cut to what is left of the run's time. The limit
							// covers up to 6 tool steps (and a picture), so it stays model + picture time even without pictures.
							timeout: { totalMs: budget.callTimeoutMs((this.settings?.tierTimeoutMs("balanced") ?? this.env.AI_MODEL_TIMEOUT_MS) + (this.settings?.imageTimeoutMs() ?? this.env.AI_IMAGE_TIMEOUT_MS)) },
							maxRetries: 1,
							abortSignal: abort.signal,
							// steps finished before a failure were billed: the error row carries them
							onStepFinish: (step) => tally.add(step.usage),
						});
					},
					{
						// Switching provider after a draft was staged would stage it twice; never with too little time left.
						canFallback: () => staged.length === 0 && !abort.signal.aborted && budget.stop(state.tokens ?? 0) === null,
						onFailure: (candidate, error, ms) =>
							this.ledger.record({
								...ledgerBase,
								provider: candidate.provider,
								model: candidate.modelId,
								...attemptUsage.forFailure(error),
								latencyMs: ms,
								outcome: "error",
								errorCode: error instanceof Error ? error.name : "unknown",
							}),
					},
				);
				const ask = result.toolCalls.find(isAskCall);
				await this.ledger.record({
					...ledgerBase,
					provider: model.provider,
					model: model.modelId,
					...tokenUsageOf(result.totalUsage),
					latencyMs,
					outcome: staged.length > 0 || ask ? "ok" : "refused",
				});
				state.tokens = (state.tokens ?? 0) + (result.totalUsage.inputTokens ?? 0) + (result.totalUsage.outputTokens ?? 0);
				committedMemory = attemptMemory;
				warm = (result.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0) > 0;
				state.messages.push(...(result.response.messages as ModelMessage[]));
				step("done", state.flow ? "Drafting with your answers" : "Thinking");

				if (ask && staged.length === 0 && this.flows && (state.asks ?? 0) >= 1) {
					// already asked in this message: the same questions again was the "asks over and over" loop
					state.messages.push(
						this.toolError(ask.toolCallId, "You already asked the merchant in this message; their answers are in the earlier ask_user result. Do not ask again: draft now with them and say in one line what you assumed."),
					);
					continue;
				}
				if (ask && staged.length === 0 && this.flows) {
					const parsed = askUserInputSchemaFor(askUserOptions(capabilities)).safeParse(ask.input);
					if (!parsed.success) {
						// malformed call: tell the model and let it try once more (the SDK may already have answered it
						// with its own validation error — a second result for the same call is refused by providers)
						if (openToolCalls(state.messages).some((call) => call.toolCallId === ask.toolCallId)) {
							state.messages.push(
								this.toolError(
									ask.toolCallId,
									askUserOptions(capabilities).productDetails
										? "Invalid ask_user input: purpose product_details needs product."
										: 'Invalid ask_user input: only purpose "custom" is available here (products cannot be drafted). Ask with it, or answer without asking.',
								),
							);
						}
						continue;
					}
					const lead = stripInternalMarkers(result.text);
					if (lead) push({ type: "run.status", runId: run.id, status: "running", answer: lead });
					// the catalog families are read only to ask about a product's details; any other question just gets prepared
					const askLabel = parsed.data.purpose === "product_details" ? "Reading your catalog families" : "Preparing a question";
					step("running", askLabel);
					const { state: flow, outcome } = await this.flows.start(
						ctx,
						run.id,
						ask.toolCallId,
						parsed.data as AskUserInput,
						// photos sent with this message (earlier turns' pictures are for what they were sent for)
						(run.attachments ?? []).some((file) => file.kind === "image"),
						maxImageNumber(state.images),
						// pictures the chat found or made (Pixabay, generated): offered for the product's photos
						state.images,
					);
					state.flow = flow;
					state.asks = (state.asks ?? 0) + 1;
					state.language ??= flow.language;
					step("done", askLabel);
					if (flow.product) await this.retitle(ctx, run.threadId, productTitle(flow.product.name, ctx.locale));
					if (outcome.status === "ask") return this.afterFlow(ctx, () => run, state, outcome, emit, push, budget);
					// everything answered from the catalog — straight back to the model
					this.closeFlow(run.id, state, outcome, push);
					continue;
				}
				if (ask && staged.length === 0) {
					state.messages.push(this.toolError(ask.toolCallId, "Questions are not available here; draft with what you know."));
					continue;
				}
				// internal history records the model imitated (staged-draft lines, ids) never reach the merchant
				const replyText = stripInternalMarkers(result.text);
				if (!replyText && !wrapUp && state.modelCalls < MAX_MODEL_CALLS_PER_RUN) {
					// it read (or staged) but ran out of steps before saying anything — let it answer from what it has
					wrapUp = true;
					continue;
				}
				const answer =
					(replyText && (await this.inLanguageOfPrompt(run, replyText, abort.signal, budget, ledgerBase))) ||
					(staged.length > 0 ? "Drafts are ready for your approval below." : "I couldn't draft anything from that.");
				push({ type: "run.status", runId: run.id, status: staged.length > 0 ? "awaiting_approval" : "applied", answer });
				break;
			}
		} catch (error) {
			if (abort.signal.aborted) {
				// the merchant pressed Stop: not a failure; anything staged stays reviewable
				step("done");
				// an owner / admin stopped it for another request: the line they left stays on it
				const note = this.stopNotes.get(run.id) ?? (await this.stopNoteOf(ctx.organizationId, run.id));
				push({ type: "run.status", runId: run.id, status: staged.length > 0 ? "awaiting_approval" : "cancelled", ...(note ? { error: note } : {}) });
				await releaseEnd();
				return this.finish(ctx, run);
			}
			this.logger.warn(
				`run ${run.id} failed on ${lastModel?.provider ?? "-"}: ${error instanceof Error ? error.message : String(error)}`,
			);
			if (error instanceof ModelUnavailableError) {
				await this.ledger.record({ ...ledgerBase, latencyMs: 0, outcome: "error", errorCode: "ModelUnavailable" });
			}
			step("failed");
			if (!(error instanceof AgentError) && budget.stop(state.tokens ?? 0) === "time") {
				// the call ran into the run's deadline (its timeout was cut to the time left)
				stopForBudget("time");
			} else {
				// Anything staged before the failure stays reviewable.
				push({
					type: "run.status",
					runId: run.id,
					status: staged.length > 0 ? "awaiting_approval" : "failed",
					error: error instanceof AgentError ? error.message : userFacingError(error, language()),
				});
			}
		} finally {
			closed = true;
			stopWatching();
			this.active.delete(run.id);
			this.stopNotes.delete(run.id);
			this.memories.delete(run.id);
		}
		await releaseEnd();
		// suggestions only while the request still has the time for them
		const mode = suggestMode(this.rt.AI_SUGGEST_MODE);
		const roomForSuggestions = budget.remainingMs() > SUGGEST_NEXT_TIMEOUT_MS && budget.stop(state.tokens ?? 0) === null;
		if (mode !== "off" && roomForSuggestions && !abort.signal.aborted && (run.status === "applied" || run.status === "awaiting_approval")) {
			const facts: RunFacts = {
				staged: staged.map((changeSet) => changeSet.action?.kind ?? ""),
				reads,
				prompt: run.prompt,
				language: messageLanguage(run.prompt, ctx.locale),
				capabilities,
			};
			const fromRules = mode === "rules" ? ruleSuggestions(facts) : [];
			// a reply that declined (nothing staged) gets rule chips or none: the model offered the very thing declined
			const declined = staged.length === 0 && looksDeclined(run.answer);
			const suggestions = fromRules.length > 0 ? fromRules : warm && !declined ? await this.suggestNext(ctx, run, staged, capabilities, ledgerBase) : [];
			if (suggestions.length > 0) push({ type: "run.status", runId: run.id, status: run.status, suggestions });
		}
		return this.finish(ctx, run);
	}

	/**
	 * Stop pressed on another instance can't reach this process's AbortController, so
	 * cancel() there writes `cancelled` on the run row; this watches that row while the
	 * run is working and aborts the model call when it appears. Returns the stop function.
	 */
	private watchForCancel(organizationId: string, runId: string, abort: AbortController): () => void {
		let checking = false;
		const timer = setInterval(() => {
			if (checking || abort.signal.aborted) return;
			checking = true;
			this.store
				.getRunStatus(organizationId, runId)
				.then((status) => {
					// no row = the chat (and its runs) was deleted: nobody is waiting for this reply
					if (status === "cancelled" || status === null) abort.abort();
				})
				.catch((error: unknown) => {
					// a failed poll must never fail the run: the next tick tries again
					this.logger.debug(`cancel check for ${runId} failed: ${error instanceof Error ? error.message : String(error)}`);
				})
				.finally(() => {
					checking = false;
				});
		}, this.env.AI_RUN_CANCEL_POLL_MS);
		timer.unref();
		return () => clearInterval(timer);
	}

	private async finish(ctx: AiRequestContext, run: AgentRun): Promise<AgentRun> {
		await this.store.saveRun(ctx.organizationId, run);
		// the run is over: its private state is no longer needed
		await this.store.saveRunState(ctx.organizationId, run.id, null);
		if (run.status !== "awaiting_approval") return run;
		// its cards may all have been decided while it worked (a decision leaves a working run alone): settle now.
		// Read after the write above, so a decision landing in between settles it itself.
		const status = settledStatus(await this.store.listRunChangeSets(ctx.organizationId, run.id));
		if (!status) return run;
		const finishedAt = run.finishedAt ?? new Date().toISOString();
		const settled = await this.store.settleRunStatus(ctx.organizationId, run.id, status, finishedAt, ["awaiting_approval"]);
		return settled ? { ...run, status, finishedAt } : run;
	}

	/**
	 * The final reply in the language of the merchant's message. The prompt pins that language, but a long chat in
	 * another language can still win; when the reply is clearly in another language than a clear message, the fast
	 * model rewrites it once (no tools). Any failure keeps the model's own reply.
	 */
	private async inLanguageOfPrompt(
		run: AgentRun,
		reply: string,
		signal: AbortSignal,
		budget: { remainingMs(): number },
		ledgerBase: { organizationId: string; userId: string; surface: "merchant"; task: string; runId: string },
	): Promise<string> {
		if (wrongReplyLanguage(run.prompt, reply) === null || budget.remainingMs() <= REPLY_LANGUAGE_TIMEOUT_MS) return reply;
		const [model] = this.models.resolveChain("fast");
		if (!model) return reply;
		const t0 = Date.now();
		try {
			const fixed = await replyInLanguageOf({ prompt: run.prompt, reply, model: model.model, abortSignal: signal });
			await this.ledger.record({
				...ledgerBase,
				task: REPLY_LANGUAGE_TASK,
				provider: model.provider,
				model: model.modelId,
				inputTokens: fixed?.inputTokens,
				outputTokens: fixed?.outputTokens,
				latencyMs: Date.now() - t0,
				outcome: fixed ? "ok" : "refused",
			});
			if (fixed) this.logger.log(`run ${run.id}: reply rewritten into the language of the message`);
			return fixed?.text ?? reply;
		} catch (error) {
			this.logger.debug(`reply language fix skipped: ${error instanceof Error ? error.message : String(error)}`);
			return reply;
		}
	}

	/**
	 * 2–3 next messages from one tiny call on the FAST model: no tools, no copilot instructions, only the
	 * merchant's message, the reply and what the assistant can do (a few hundred tokens instead of the
	 * run's whole prefix). Any failure means no suggestions.
	 */
	private async suggestNext(
		ctx: AiRequestContext,
		run: AgentRun,
		staged: readonly ChangeSet[],
		capabilities: CapabilitySet,
		ledgerBase: { organizationId: string; userId: string; surface: "merchant"; task: string; runId: string },
	): Promise<RunSuggestion[]> {
		const t0 = Date.now();
		const [model] = this.models.resolveChain("fast");
		if (!model) return [];
		try {
			const result = await generateText({
				model: model.model,
				instructions: SUGGEST_NEXT_SYSTEM,
				messages: [
					{
						role: "user",
						content: suggestUserTurn({
							prompt: run.prompt,
							answer: run.answer ?? "",
							language: replyLanguageName(run.prompt),
							staged: staged.map((changeSet) => changeSet.title),
							abilities: groupPurposes(capabilities),
						}),
					},
				],
				maxOutputTokens: SUGGEST_NEXT_MAX_TOKENS,
				timeout: { totalMs: SUGGEST_NEXT_TIMEOUT_MS },
				maxRetries: 0,
			});
			await this.ledger.record({
				...ledgerBase,
				task: SUGGEST_NEXT_TASK,
				provider: model.provider,
				model: model.modelId,
				...tokenUsageOf(result.totalUsage),
				latencyMs: Date.now() - t0,
				outcome: "ok",
			});
			return parseSuggestions(result.text, run.prompt.toLowerCase());
		} catch (error) {
			this.logger.debug(`suggestions skipped: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	/**
	 * Deletes a chat (Start over, history delete). Runs still working in it are stopped:
	 * here at once, on another instance when its cancel poll finds the run row gone.
	 */
	async removeThread(ctx: AiRequestContext, threadId: string): Promise<void> {
		const records = await this.store.listThreadRuns(ctx.organizationId, threadId);
		const driving = records.map((record) => record.run.id).filter((id) => this.active.has(id));
		await this.threads.remove(ctx, threadId); // checks the chat is the caller's; 404 / 409 stop here
		for (const id of driving) this.active.get(id)?.abort();
	}

	/** The "Stopped by …" line Stop on another instance wrote on the run row, if any. */
	private async stopNoteOf(organizationId: string, runId: string): Promise<string | undefined> {
		const stored = await this.store.getRun(organizationId, runId).catch(() => null);
		return stored?.status === "cancelled" ? stored.error : undefined;
	}

	/**
	 * Stop: a run driving (or queued) here has its model call / wait aborted (it saves itself as
	 * cancelled); a run left waiting — on a question, or by a process that went
	 * away — is closed directly. A finished run comes back unchanged. A run driving
	 * on another instance is closed directly too: the `cancelled` row is what that
	 * instance's watchForCancel poll (or queue check) sees, and it then aborts and saves its own result.
	 * Owners / admins may also stop a teammate's working or queued run ("Stop … and run mine"): it ends with
	 * "Stopped by <name> to run another request." and they get its title back, never the private chat.
	 */
	async cancel(ctx: AiRequestContext, runId: string): Promise<AgentRun> {
		const own = await this.store.getRun(ctx.organizationId, runId, ctx.userId);
		// a teammate's run of another shop sharing the organization is not theirs to see (404)
		const teammate = own ? null : seesTeamDrafts(ctx) ? await this.store.getRun(ctx.organizationId, runId, undefined, ctx.tenantId) : null;
		const run = own ?? teammate;
		// someone else's run, finished or not the caller's to stop: the same answer as a missing one
		if (!run || (teammate && !TEAMMATE_STOPPABLE.has(run.status))) throw new AgentError("Run not found.", 404);
		const note = teammate ? stoppedByLine(ctx.name, messageLanguage(run.prompt)) : undefined;
		const stopped = reduceRunEvent(run, { type: "run.status", runId, status: "cancelled", ...(note ? { error: note } : {}) });
		const shown = (result: AgentRun) => (teammate ? stoppedTeammateRun(result) : result);
		const live = this.active.get(runId);
		if (live) {
			if (note) this.stopNotes.set(runId, note);
			live.abort();
			return shown(stopped);
		}
		if (!STOPPABLE.has(run.status)) return run;
		// only while it is still stoppable: a run that finished (or was answered and finished) since the read keeps its end
		if (!(await this.store.saveRunIfStatus(ctx.organizationId, stopped, [...STOPPABLE]))) {
			return shown((await this.store.getRun(ctx.organizationId, runId)) ?? run);
		}
		await this.store.saveRunState(ctx.organizationId, runId, null);
		return shown(stopped);
	}

	/**
	 * A read tool call: its result (or a structured error the model can act on)
	 * goes back to the model; a receipt shows in "Used N tools".
	 */
	private async readTool<T>(
		runId: string,
		push: (event: RunEvent) => void,
		tool: string,
		label: string,
		read: () => Promise<T>,
		phraseKey?: string,
	) {
		const t0 = Date.now();
		try {
			const { media, records, ...value } = ((await read()) ?? {}) as T & { media?: ReceiptMedia[]; records?: ReceiptRecord[]; title?: string; total?: number };
			push({
				type: "run.receipt",
				runId,
				receipt: {
					id: newId("rcpt"),
					tool,
					summary: value.title ? `${label}: ${value.title}` : typeof value.total === "number" ? `${label} (${value.total} found)` : label,
					...(phraseKey
						? {
								phrase: {
									key: phraseKey,
									values: {
										...(value.title ? { subject: String(value.title).slice(0, 200) } : {}),
										...(typeof value.total === "number" ? { n: value.total } : {}),
									},
								},
							}
						: {}),
					durationMs: Date.now() - t0,
					status: "ok",
					entityIds: [],
					// pictures are for the merchant's eyes: the model gets their count and alt text via facts
					...(media && media.length > 0 ? { media: media.slice(0, 12) } : {}),
					...(records && records.length > 0 ? { records: records.slice(0, 5) } : {}),
				},
			});
			// the model's view: repeats of earlier reads become pointers, a long result is shortened
			return shapeToolResult(tool, value, this.memories.get(runId)?.() ?? createResultMemory()) as typeof value;
		} catch (error) {
			const status = (error as { status?: number }).status;
			push({
				type: "run.receipt",
				runId,
				receipt: {
					id: newId("rcpt"),
					tool,
					summary: label,
					durationMs: Date.now() - t0,
					status: "error",
					entityIds: [],
					...(phraseKey ? { phrase: { key: phraseKey } } : {}),
				},
			});
			return {
				error: {
					code: status === 404 ? "not_found" : status === 403 ? "forbidden" : "unavailable",
					message:
						status === 404
							? "No such item in this shop."
							: status === 403
								? "The merchant cannot read this item."
								: "The shop's data could not be read right now.",
					retryable: status !== 404 && status !== 403,
				},
			};
		}
	}

	/** Best effort: a title is never worth failing a run for. */
	private async retitle(ctx: AiRequestContext, threadId: string | undefined, title: string | null): Promise<void> {
		if (!threadId || !title) return;
		await this.store.retitleThread(ctx.organizationId, threadId, title).catch((error: unknown) => {
			this.logger.warn(`retitle failed: ${String(error)}`);
		});
	}

	private toolError(toolCallId: string, message: string): ModelMessage {
		return {
			role: "tool",
			content: [{ type: "tool-result", toolCallId, toolName: ASK_USER_TOOL, output: { type: "error-text", value: message } }],
		};
	}

	/**
	 * Swaps `attachment:<id>` image placeholders for the bytes (never stored in run state).
	 * `cache` lives for the request, so each file is read from the database once, not per model call.
	 */
	private async hydrate(ctx: AiRequestContext, messages: ModelMessage[], cache: AttachmentCache): Promise<ModelMessage[]> {
		const load = (id: string): Promise<Buffer | null> => {
			let bytes = cache.get(id);
			if (!bytes) {
				bytes = this.store.getAttachmentContent(ctx.organizationId, id).then((found) => found?.content ?? null);
				// a failed read is not remembered: the next call tries again
				bytes.catch(() => cache.delete(id));
				cache.set(id, bytes);
			}
			return bytes;
		};
		return Promise.all(
			messages.map(async (message) => {
				if (message.role !== "user" || typeof message.content === "string") return message;
				const content = await Promise.all(
					message.content.map(async (part) => {
						if (part.type !== "image" || typeof part.image !== "string" || !part.image.startsWith("attachment:")) return part;
						const bytes = await load(part.image.slice("attachment:".length));
						return bytes ? { ...part, image: bytes } : { type: "text" as const, text: "(image no longer available)" };
					}),
				);
				return { ...message, content } as ModelMessage;
			}),
		);
	}

	/** Family, schema and answers the flow resolved, plus attached images — for "From you / AI / Missing" tags. */
	private async knowledge(ctx: AiRequestContext, state: RunState, module: string | undefined, capabilities: CapabilitySet): Promise<ProductKnowledge> {
		const flow = state.flow;
		const knowledge: ProductKnowledge = {
			merchantText: state.merchantText,
			images: state.images,
			defaultImageIds: flow?.picked.map((i) => i.id),
			// "also add to store" is a Product Master → Product Store rule: only where the deployment has the store
			...(module === "store" && capabilities.has("store_products") ? { addToStore: true } : {}),
		};
		if (!flow?.family || !this.shop) return knowledge;
		knowledge.family = { id: flow.family.id, code: flow.family.code, label: flow.family.label };
		knowledge.resolved = flow.attributes.map((a) => ({ code: a.code, value: a.value, display: a.display, source: a.source }));
		try {
			const schema = await this.shop.familySchema(ctx, flow.family.id);
			knowledge.fields = schema.fields
				.filter((f) => !["item_name", "description", "name", "title"].includes(f.code))
				.map((f) => ({
					attributeId: f.attributeId,
					code: f.code,
					label: f.label,
					required: f.required,
					collection: f.collection,
					localizable: f.localizable,
					dataType: f.dataType,
					options: f.options,
				}));
		} catch (error) {
			this.logger.warn(`family schema unavailable while drafting: ${String(error)}`);
		}
		return knowledge;
	}

	private async findImages(
		ctx: AiRequestContext,
		runId: string,
		state: RunState,
		input: FindImagesInput,
		push: (event: RunEvent) => void,
	) {
		if (!this.shop) return [];
		const t0 = Date.now();
		try {
			const items = await this.shop.searchMedia(ctx, {
				source: input.source === "library" ? "media" : "stock",
				query: input.query,
				limit: input.count,
			});
			const found = items.slice(0, input.count).map((item) => {
				const image: KnownImage = {
					id: nextImageId(state),
					ref: item.ref,
					url: item.url,
					origin: input.source === "library" ? "media" : "stock",
					alt: item.name,
					...(item.credit ? { credit: item.credit } : {}),
				};
				state.images.push(image);
				return image;
			});
			push({
				type: "run.receipt",
				runId,
				receipt: {
					id: newId("rcpt"),
					tool: input.source === "library" ? "media.search_library" : "media.search_stock",
					summary: `${found.length} photos for “${input.query}”`,
					phrase: { key: input.source === "library" ? "media.library" : "media.stock", values: { n: found.length, subject: input.query } },
					durationMs: Date.now() - t0,
					status: "ok",
					entityIds: [],
					// the merchant sees what was found and can pick one without typing ids
					...(found.length > 0
						? {
								media: found.map((image) => ({
									url: image.url,
									...(image.alt ? { alt: image.alt.slice(0, 300) } : {}),
									label: (image.credit ?? (input.source === "library" ? "Your library" : "Stock")).slice(0, 60),
									imageId: image.id,
									ref: image.ref,
								})),
							}
						: {}),
				},
			});
			return found.map((image) => ({ id: image.id, description: image.alt ?? "", ...(image.credit ? { credit: image.credit } : {}) }));
		} catch (error) {
			this.logger.warn(`find_images failed: ${String(error)}`);
			if (input.source === "stock" && (error as { status?: number }).status === 503) {
				return {
					error: {
						code: "stock_unavailable",
						message: "Stock photos are not set up for this shop. Use the shop's library, or offer generate_image.",
					},
				};
			}
			return [];
		}
	}

	/**
	 * generate_image: draws with the platform's picture model, keeps each picture
	 * in the shop's DAM (reusable anywhere), and makes it a usable image id for
	 * drafts. The pictures show in the chat; failures go back to the model.
	 */
	private async generateImages(
		ctx: AiRequestContext,
		runId: string,
		state: RunState,
		input: GenerateImageInput,
		push: (event: RunEvent) => void,
	) {
		const t0 = Date.now();
		const receipt = (status: "ok" | "error", summary: string, media?: ReceiptMedia[], phrase?: { key: string; values?: Record<string, string | number> }) =>
			push({
				type: "run.receipt",
				runId,
				receipt: {
					id: newId("rcpt"),
					tool: "media.generate_image",
					summary,
					durationMs: Date.now() - t0,
					status,
					entityIds: [],
					...(media && media.length > 0 ? { media } : {}),
					...(phrase ? { phrase } : {}),
				},
			});
		const stepId = newId("pic");
		const step = (status: "running" | "done" | "failed") =>
			push({
				type: "run.step",
				runId,
				step: {
					id: stepId,
					label: input.count > 1 ? "Generating pictures (about a minute)" : "Generating a picture (about a minute)",
					status,
					phrase: { key: input.count > 1 ? "step.pictures" : "step.picture" },
				},
			});
		const skipped = picturesSkippedRefusal(state.picturesSkipped, state.merchantText);
		if (skipped) return skipped;
		if (!this.pictures?.available || !this.shop?.saveGeneratedPicture) {
			receipt("error", "picture generation unavailable");
			return { images: [], error: { code: "unavailable", message: "Picture generation is not set up for this shop. Use find_images or ask for an upload." } };
		}
		step("running");
		try {
			const drawn = await this.pictures.generate(ctx, input, { runId });
			const saved = await Promise.all(
				drawn.map((picture) => this.shop?.saveGeneratedPicture?.(ctx, { prompt: input.prompt, picture })),
			);
			const images = saved.flatMap((item) => {
				if (!item) return [];
				const image: KnownImage = {
					id: nextImageId(state),
					ref: item.ref,
					url: item.url,
					origin: "generated",
					alt: item.name,
				};
				state.images.push(image);
				return [image];
			});
			step("done");
			receipt(
				"ok",
				`${images.length} generated picture${images.length === 1 ? "" : "s"}: ${input.prompt.slice(0, 60)}`,
				images.map((image) => ({ url: image.url, alt: image.alt, label: "Generated", imageId: image.id, ref: image.ref })),
				{ key: "media.generated", values: { n: images.length } },
			);
			return {
				images: images.map((image) => ({ id: image.id, description: image.alt ?? "" })),
				note: "Saved in the shop's media library.",
			};
		} catch (error) {
			const message = error instanceof AgentError ? error.message : "The picture could not be generated.";
			this.logger.warn(`generate_image failed: ${String(error)}`);
			step("failed");
			receipt("error", message);
			return { images: [], error: { code: error instanceof AgentError && error.status === 429 ? "limit" : "failed", message } };
		}
	}
}
