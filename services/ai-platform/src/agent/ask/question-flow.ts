import type { AgentAsk, AgentQuestion, AnsweredQuestion, AnswerInput, QuestionOption } from "@ech/agent-core";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { AiRequestContext } from "../../auth/context-token";
import { DecisionService } from "../../decide/decision.service";
import type { Decision } from "../../decide/decision-types";
import { lexicalScores } from "../../decide/lexical-decider";
import { type FamilyField, SHOP_TOOLS, type ShopFamily, type ShopTools } from "../../shop/shop-tools";
import { AGENT_STORE, type AgentStore } from "../agent-store";
import type { KnownImage } from "../change-set-builders";
import { type AskUserInput, MAX_SHOWN_QUESTIONS } from "./ask-tool";
import { type FlowLanguage, flowCopy, flowLanguage } from "./flow-copy";

/** Browser URL of an uploaded picture (same as the run service's). */
function attachmentPictureUrl(id: string): string {
	return `/api/agent/attachments/${encodeURIComponent(id)}/content`;
}

/** Options shown on a card before "Search all…". */
const SHOWN_OPTIONS = 4;
const SHOWN_ATTRIBUTE_OPTIONS = 6;
const FAMILY_LIST_LIMIT = 300;
/**
 * Families sent to the decision model: a word-overlap shortlist (path names
 * included) when the shop has more — keeps every call small and under the
 * backend's option cap; the merchant can still search all of them.
 */
const FAMILY_SHORTLIST = 60;
/** Below auto-apply but likely — used to fill required values the merchant had no turn left to answer. */
const FILL_CONFIDENCE = 0.5;
const SYSTEM_FIELDS = new Set(["item_name", "description", "name", "title"]);

const FAMILY_INSTRUCTIONS =
	"Which of the shop's product families does the product in the state belong to? Judge by what the product is " +
	"(its type and use), not by its material or colour. Pick none_of_these when no family reasonably fits.";

function attributeInstructions(field: FamilyField): string {
	return (
		`Which value of the attribute "${field.label}" fits the product in the state? Use only what the state says ` +
		"or clearly implies. Pick none_of_these when the state does not tell."
	);
}

export interface ResolvedAttribute {
	code: string;
	label: string;
	/** option code (enum) or the merchant's own words */
	value: string;
	display: string;
	source: "you" | "auto";
	confidence?: number;
}

type FlowStep =
	| { id: "family"; kind: "family" }
	| { id: string; kind: "images"; question: AgentQuestion; search: { query: string; source: "stock" | "library" | "both"; forProduct?: boolean } }
	| { id: string; kind: "attribute"; code: string }
	| { id: "variants"; kind: "variants" }
	| { id: string; kind: "choice"; question: AgentQuestion };

/** Serializable flow of one `ask_user` call — stored with the paused run. */
export interface FlowState {
	toolCallId: string;
	purpose: AskUserInput["purpose"];
	product: NonNullable<AskUserInput["product"]> | null;
	hasImages: boolean;
	/** pictures the merchant picked or uploaded in a card — usable image ids for the drafts */
	picked: KnownImage[];
	/** the chat's highest img_N when the flow began: picks continue from it (ids stay unique across the chat) */
	imageBase?: number;
	/** the language of the merchant's message: the card's own words (older paused flows: English) */
	language?: FlowLanguage;
	/** pictures this chat already has (found, generated, picked) — offered first for a product's photos */
	chatPictures?: Array<{ ref: string; url: string; alt?: string; credit?: string }>;
	steps: FlowStep[];
	index: number;
	/** questions shown to the merchant in this call */
	shown: number;
	answers: AnsweredQuestion[];
	family: (ShopFamily & { label: string }) | null;
	familiesTotal: number;
	attributes: ResolvedAttribute[];
	variants: { mode: "none" | "unknown" | "listed" | "described"; axes: NonNullable<AskUserInput["product"]>["variantAxes"]; text?: string };
	/** decision-model calls avoided / made, for the run receipt */
	stats: { auto: number; asked: number; decided: number; cached: number };
	/** per-question ranked options, kept for the card and for search */
	ranked: Record<string, QuestionOption[]>;
	suggested: Record<string, string | undefined>;
	/** decisions for the family the merchant is looking at (precomputed plan) */
	plan: { familyId: string; decisions: Record<string, PlainDecision> } | null;
}

interface PlainDecision {
	choice: string | null;
	confidence: number;
	probabilities: Record<string, number>;
	source: Decision["source"];
}

export type FlowOutcome =
	| { status: "ask"; ask: AgentAsk; answers: AnsweredQuestion[] }
	| { status: "done"; answers: AnsweredQuestion[]; result: ProductFlowResult | CustomFlowResult };

export interface ProductFlowResult {
	family: { code: string; name: string; path: string } | null;
	attributes: Array<{ code: string; label: string; value: string; display: string; source: "merchant" | "auto" }>;
	/** required attributes still without a value — fill text ones from facts, otherwise leave for the merchant */
	stillMissing: Array<{ code: string; label: string; type: string }>;
	/** text/number attributes you may fill from the facts (never guess) */
	fillable: Array<{ code: string; label: string; required: boolean }>;
	variants: "none" | "unknown" | { axes: NonNullable<AskUserInput["product"]>["variantAxes"] } | { describedByMerchant: string };
	images: string;
	note: string;
}

export interface CustomFlowResult {
	answers: Array<{ id: string; question: string; answer: string }>;
}

function plain(decision: Decision | undefined): PlainDecision | undefined {
	return decision
		? {
				choice: decision.choice,
				confidence: decision.confidence,
				probabilities: decision.probabilities,
				source: decision.source,
			}
		: undefined;
}

function familyLabel(family: ShopFamily): string {
	const path = family.path?.trim();
	return path && path !== family.name ? path.replace(/\s*[>/]\s*/g, " › ") : family.name;
}

function describeProduct(product: FlowState["product"], variants: FlowState["variants"]): Record<string, unknown> {
	if (!product) return {};
	return {
		product: product.name,
		facts: product.facts.map((f) => `${f.name}: ${f.value}`).join("; "),
		variants:
			variants.mode === "listed"
				? variants.axes.map((a) => `${a.label}: ${a.values.join(", ")}`).join("; ")
				: variants.mode === "described"
					? (variants.text ?? "")
					: variants.mode,
	};
}

function rankByDecision<T extends { value: string }>(options: T[], decision: PlainDecision | undefined): T[] {
	if (!decision) return options;
	const p = decision.probabilities;
	return [...options].sort((a, b) => (p[b.value] ?? 0) - (p[a.value] ?? 0));
}

/** "listed" without any axis is as good as unknown. */
function variantMode(product: AskUserInput["product"]): FlowState["variants"]["mode"] {
	if (!product) return "none";
	if (product.variants === "listed") return product.variantAxes.length > 0 ? "listed" : "unknown";
	return product.variants;
}

function joinLabels(labels: string[]): string {
	return labels.map((l) => l.toLowerCase()).join(", ");
}

/**
 * Drives one `ask_user` call: builds each question from the shop's data,
 * lets the decision model answer what it is sure about, shows the rest one
 * at a time (at most 3), and returns the tool result once nothing is left.
 * The chat model is not called in between — only before and after.
 */
@Injectable()
export class QuestionFlowService {
	private readonly logger = new Logger(QuestionFlowService.name);

	constructor(
		@Inject(SHOP_TOOLS) private readonly shop: ShopTools,
		private readonly decisions: DecisionService,
		@Optional() @Inject(AGENT_STORE) private readonly store?: AgentStore,
	) {}

	async start(
		ctx: AiRequestContext,
		runId: string,
		toolCallId: string,
		input: AskUserInput,
		hasImages: boolean,
		imageBase = 0,
		chatPictures: readonly KnownImage[] = [],
	): Promise<{ state: FlowState; outcome: FlowOutcome }> {
		const product = input.purpose === "product_details" ? input.product : null;
		const state: FlowState = {
			toolCallId,
			purpose: product ? "product_details" : "custom",
			product,
			hasImages,
			picked: [],
			imageBase,
			language: flowLanguage(input.language, ctx.locale),
			// the chat's own pictures (Pixabay finds, generated ones) — never unrelated library photos
			chatPictures: chatPictures
				.filter((image) => image.origin !== "upload" && image.url)
				.slice(-12)
				.map((image) => ({ ref: image.ref, url: image.url, ...(image.alt ? { alt: image.alt } : {}), ...(image.credit ? { credit: image.credit } : {}) })),
			steps: [],
			index: 0,
			shown: 0,
			answers: [],
			family: null,
			familiesTotal: 0,
			attributes: [],
			variants: { mode: variantMode(product), axes: product?.variantAxes ?? [] },
			stats: { auto: 0, asked: 0, decided: 0, cached: 0 },
			ranked: {},
			suggested: {},
			plan: null,
		};
		if (product) {
			state.steps.push({ id: "family", kind: "family" });
			if (state.variants.mode === "unknown") state.steps.push({ id: "variants", kind: "variants" });
			// products publish with photos: no photo attached → the chat's pictures, then the shop's own matching the name
			if (!hasImages) state.steps.push(this.imagesStep(state, "images", product.name, "library", true));
		} else {
			for (const question of input.questions.slice(0, MAX_SHOWN_QUESTIONS)) {
				if (question.pictures) {
					const step = this.imagesStep(state, `q_${question.id}`, question.pictures.query, question.pictures.source, false);
					step.question.title = question.title;
					step.question.why = question.why ?? step.question.why;
					state.steps.push(step);
					continue;
				}
				state.steps.push({
					id: `q_${question.id}`,
					kind: "choice",
					question: {
						id: `q_${question.id}`,
						kind: "choice",
						label: question.title.length > 40 ? `${question.title.slice(0, 39)}…` : question.title,
						title: question.title,
						why: question.why ?? undefined,
						options: question.options,
						multiple: question.multiple,
						allowText: true,
						allowSkip: true,
					},
				});
			}
		}
		return { state, outcome: await this.advance(ctx, runId, state) };
	}

	/** Records the merchant's answer to the open question and moves on. */
	async answer(ctx: AiRequestContext, runId: string, state: FlowState, input: AnswerInput): Promise<FlowOutcome> {
		const step = state.steps[state.index];
		if (!step || step.id !== input.questionId || input.toolCallId !== state.toolCallId) {
			throw new FlowError("This question was already answered.");
		}
		const options = state.ranked[step.id] ?? [];
		const values = input.skip ? [] : (input.values ?? []);
		const pickedLabels = values.map((v) => options.find((o) => o.value === v)?.label ?? v);
		const text = input.skip ? undefined : input.text?.trim();

		if (step.kind === "family") {
			if (input.skip || values.length === 0) {
				state.answers.push(this.answered(step.id, "family", flowCopy(state.language).family.label, [], "", "skipped"));
				state.plan = null;
			} else {
				const family = await this.findFamily(ctx, values[0] as string, options);
				state.family = family;
				state.answers.push(this.answered(step.id, "family", flowCopy(state.language).family.label, [family.id], family.label, "you"));
				await this.expandAttributes(ctx, runId, state, family);
			}
		} else if (step.kind === "attribute") {
			const label = this.fieldLabel(state, step.code);
			if (input.skip) {
				state.answers.push(this.answered(step.id, "attribute", label, [], "", "skipped"));
			} else {
				const display = text ?? pickedLabels.join(", ");
				const value = text ? this.matchOption(options, text) ?? text : values.join(",");
				state.attributes = state.attributes.filter((a) => a.code !== step.code);
				state.attributes.push({ code: step.code, label, value, display, source: "you" });
				state.answers.push(this.answered(step.id, "attribute", label, text ? [value] : values, display, "you"));
			}
		} else if (step.kind === "variants") {
			if (input.skip || values.includes("none")) {
				state.variants = { mode: input.skip ? "unknown" : "none", axes: [] };
			} else {
				state.variants = { mode: "described", axes: [], text: text ?? pickedLabels.join(", ") };
			}
			state.answers.push(
				this.answered(step.id, "variants", flowCopy(state.language).variants.label, values, input.skip ? "" : (text ?? pickedLabels.join(", ")), input.skip ? "skipped" : "you"),
			);
		} else if (step.kind === "images") {
			if (text && values.length === 0) {
				// words typed at a photo question are a search: same question, new photos, no model call
				step.search = { ...step.search, query: text.slice(0, 80) };
				step.question.options = await this.pictureOptions(ctx, step.search.query, step.search.source, step.search.forProduct);
				const known = state.ranked[step.id] ?? [];
				state.ranked[step.id] = [...known, ...step.question.options.filter((o) => !known.some((k) => k.value === o.value))].slice(-120);
				state.shown -= 1;
				return this.pause(state, step.question);
			}
			const images = input.skip ? [] : await this.resolvePictures(ctx, state, step.id, values);
			state.picked.push(...images);
			const display = flowCopy(state.language).photos.count(images.length);
			state.answers.push(
				this.answered(step.id, "images", step.question.label, images.map((i) => i.id), images.length ? display : "", images.length ? "you" : "skipped"),
			);
		} else {
			state.answers.push(
				this.answered(step.id, "choice", step.question.label, values, text ?? pickedLabels.join(", "), input.skip ? "skipped" : "you"),
			);
		}
		state.index += 1;
		return this.advance(ctx, runId, state);
	}

	/** Every option of the open question that matches — the card's "Search all…" box. */
	async searchOptions(ctx: AiRequestContext, state: FlowState, questionId: string, query: string): Promise<QuestionOption[]> {
		const step = state.steps[state.index];
		if (!step || step.id !== questionId) return [];
		const q = query.trim().toLowerCase();
		if (step.kind === "family") {
			const { items } = await this.shop.listFamilies(ctx, { query, limit: 20 });
			return items.map((f) => ({ value: f.id, label: familyLabel(f) }));
		}
		if (step.kind === "attribute" && state.family) {
			const schema = await this.shop.familySchema(ctx, state.family.id);
			const field = schema.fields.find((f) => f.code === step.code);
			return (field?.options ?? [])
				.filter((o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q))
				.slice(0, 20)
				.map((o) => ({ value: o.code, label: o.label }));
		}
		if (step.kind === "images") {
			const found = await this.pictureOptions(ctx, query, step.search.source, step.search.forProduct);
			// remembered so an answer can name a searched picture (the run state is saved after this)
			const known = state.ranked[step.id] ?? [];
			state.ranked[step.id] = [...known, ...found.filter((f) => !known.some((k) => k.value === f.value))].slice(-120);
			return found;
		}
		return (state.ranked[step.id] ?? []).filter((o) => o.label.toLowerCase().includes(q));
	}

	// ── pictures ─────────────────────────────────────────────────────────

	private imagesStep(state: FlowState, id: string, query: string, source: "stock" | "library" | "both", forProduct: boolean) {
		const copy = flowCopy(state.language).photos;
		return {
			id,
			kind: "images" as const,
			search: { query, source, ...(forProduct ? { forProduct: true } : {}) },
			question: {
				id,
				kind: "images" as const,
				label: copy.label,
				title: forProduct ? copy.productTitle : copy.postTitle,
				why: forProduct ? copy.productWhy : copy.postWhy,
				options: [] as QuestionOption[],
				multiple: true,
				allowText: false,
				allowSkip: true,
				allowUpload: true,
			},
		};
	}

	/** Library (DAM) and/or stock photos for a query, as picture options. */
	private async pictureOptions(ctx: AiRequestContext, query: string, source: "stock" | "library" | "both", forProduct = false): Promise<QuestionOption[]> {
		const sources: Array<"media" | "stock"> = source === "both" ? ["media", "stock"] : [source === "library" ? "media" : "stock"];
		const found = await Promise.all(
			sources.map(async (s) => {
				const hits = await this.shop.searchMedia(ctx, { source: s, query, limit: 8 }).catch(() => []);
				// a post's photos: no match → the newest library photos. A product's photos never: the
				// newest pictures are other products' (a coffee photo offered for a T-shirt) — upload instead
				if (hits.length === 0 && s === "media" && query && !forProduct) {
					return this.shop.searchMedia(ctx, { source: s, query: "", limit: 8 }).catch(() => []);
				}
				return hits;
			}),
		);
		return found.flat().map((item) => ({
			value: item.ref,
			label: item.name.slice(0, 200) || "Photo",
			imageUrl: item.url,
			...(item.credit ? { credit: item.credit, meta: item.credit } : {}),
		}));
	}

	/** Picked values → usable images: uploads must be the merchant's own files; others must have been offered. */
	private async resolvePictures(ctx: AiRequestContext, state: FlowState, stepId: string, values: string[]): Promise<KnownImage[]> {
		const offered = new Map((state.ranked[stepId] ?? []).map((o) => [o.value, o]));
		const uploads = values.filter((v) => v.startsWith("att_"));
		const owned = this.store && uploads.length > 0 ? await this.store.getAttachments({ organizationId: ctx.organizationId, userId: ctx.userId }, uploads) : [];
		const images: KnownImage[] = [];
		for (const value of values.slice(0, 12)) {
			const upload = owned.find((a) => a.id === value);
			if (upload && upload.kind === "image") {
				images.push({ id: upload.id, ref: `attachment:${upload.id}`, url: attachmentPictureUrl(upload.id), origin: "upload", alt: upload.name });
				continue;
			}
			const option = offered.get(value);
			if (!option?.imageUrl) continue;
			images.push({
				// same id space as find_images / generate_image: "Use img_N" works for a pick in any later message
				id: `img_${(state.imageBase ?? 0) + state.picked.filter((i) => i.id.startsWith("img_")).length + images.filter((i) => i.id.startsWith("img_")).length + 1}`,
				ref: option.value,
				url: option.imageUrl,
				origin: option.value.startsWith("pixabay:") ? "stock" : "media",
				alt: option.label,
				...(option.credit ? { credit: option.credit } : {}),
			});
		}
		return images;
	}

	// ── internals ────────────────────────────────────────────────────────

	private answered(
		questionId: string,
		kind: AnsweredQuestion["kind"],
		label: string,
		values: string[],
		display: string,
		source: AnsweredQuestion["source"],
		confidence?: number,
	): AnsweredQuestion {
		return { questionId, kind, label, values, display, source, ...(confidence !== undefined ? { confidence } : {}) };
	}

	private fieldLabel(state: FlowState, code: string): string {
		return state.suggested[`label:${code}`] ?? code;
	}

	private matchOption(options: QuestionOption[], text: string): string | undefined {
		const t = text.trim().toLowerCase();
		return options.find((o) => o.label.toLowerCase() === t || o.value.toLowerCase() === t)?.value;
	}

	private async findFamily(ctx: AiRequestContext, id: string, shown: QuestionOption[]): Promise<ShopFamily & { label: string }> {
		const fromShown = shown.find((o) => o.value === id);
		const schema = await this.shop.familySchema(ctx, id);
		return { ...schema.family, label: fromShown?.label ?? familyLabel(schema.family) };
	}

	/** Advances through auto-answerable steps; stops at the first one the merchant must answer. */
	private async advance(ctx: AiRequestContext, runId: string, state: FlowState): Promise<FlowOutcome> {
		while (state.index < state.steps.length) {
			const step = state.steps[state.index] as FlowStep;
			// a pending photo question keeps one of the 3 turns for itself
			const reserved = state.steps.slice(state.index + 1).some((s) => s.kind === "images") ? 1 : 0;
			const slotsLeft = state.shown < MAX_SHOWN_QUESTIONS - (step.kind === "images" ? 0 : reserved);
			if (step.kind === "images") {
				if (state.shown >= MAX_SHOWN_QUESTIONS) {
					state.index += 1;
					continue;
				}
				step.question.options = [
					// a product's photos: what this chat already found or made for it first
					...(step.search.forProduct ? chatPictureOptions(state) : []),
					...(await this.pictureOptions(ctx, step.search.query, step.search.source, step.search.forProduct)),
				].filter((option, i, all) => all.findIndex((o) => o.value === option.value) === i);
				state.ranked[step.id] = step.question.options;
				return this.pause(state, step.question);
			}
			if (step.kind === "family") {
				const question = await this.familyQuestion(ctx, runId, state);
				if (!question) {
					state.index += 1;
					continue;
				}
				return this.pause(state, question);
			}
			if (step.kind === "attribute") {
				const decision = state.plan?.decisions[step.code];
				if (!slotsLeft) {
					this.fillQuietly(state, step.code, decision);
					state.index += 1;
					continue;
				}
				return this.pause(state, this.attributeQuestion(state, step.code, step.id));
			}
			if (step.kind === "variants") {
				if (!slotsLeft) {
					state.index += 1;
					continue;
				}
				return this.pause(state, this.variantsQuestion(state));
			}
			if (!slotsLeft) {
				state.index += 1;
				continue;
			}
			state.ranked[step.id] = step.question.options;
			return this.pause(state, step.question);
		}
		return { status: "done", answers: state.answers, result: this.result(state) };
	}

	private pause(state: FlowState, question: AgentQuestion): FlowOutcome {
		state.shown += 1;
		state.stats.asked += 1;
		const upcoming = this.upcomingLabels(state);
		const total = Math.min(MAX_SHOWN_QUESTIONS, state.shown + upcoming.length);
		return {
			status: "ask",
			answers: state.answers,
			ask: {
				toolCallId: state.toolCallId,
				question,
				index: state.shown - 1,
				total: Math.max(total, state.shown),
				...(upcoming.length > 0 && state.shown < MAX_SHOWN_QUESTIONS
					? { next: joinLabels(upcoming.slice(0, MAX_SHOWN_QUESTIONS - state.shown)) }
					: {}),
			},
		};
	}

	/** Labels of the questions still to come in this call (for "Next: fit, material"). */
	private upcomingLabels(state: FlowState): string[] {
		const labels: string[] = [];
		const current = state.steps[state.index];
		if (current?.kind === "family" && state.plan) {
			// the suggested family's open questions, so the card can say what comes next
			for (const [code, decision] of Object.entries(state.plan.decisions)) {
				if (!state.suggested[`required:${code}`]) continue;
				if (decision.confidence < this.decisions.autoConfidence || decision.choice === null) {
					labels.push(state.suggested[`label:${code}`] ?? code);
				}
			}
		}
		for (const step of state.steps.slice(state.index + 1)) {
			if (step.kind === "attribute") labels.push(state.suggested[`label:${step.code}`] ?? step.code);
			else if (step.kind === "variants") labels.push("variants");
			else if (step.kind === "images") labels.push("photos");
			else if (step.kind === "choice") labels.push(step.question.label);
		}
		return labels;
	}

	private async familyQuestion(ctx: AiRequestContext, runId: string, state: FlowState): Promise<AgentQuestion | null> {
		let families: ShopFamily[];
		try {
			const list = await this.shop.listFamilies(ctx, { limit: FAMILY_LIST_LIMIT });
			families = list.items;
			state.familiesTotal = list.total;
		} catch (error) {
			this.logger.warn(`family list unavailable: ${String(error)}`);
			return null;
		}
		if (families.length === 0) return null;
		const productState = describeProduct(state.product, state.variants);
		const candidates = families.map((f) => ({ code: f.id, description: `${f.name} (${f.path || f.name})` }));
		const shortlist =
			candidates.length <= FAMILY_SHORTLIST
				? candidates
				: lexicalScores(productState, candidates)
						.map((s, i) => ({ ...s, i }))
						.sort((a, b) => b.score - a.score || a.i - b.i)
						.slice(0, FAMILY_SHORTLIST)
						.map((s) => candidates[s.i] as (typeof candidates)[number]);
		const decisions = await this.decisions.decide({
			organizationId: ctx.organizationId,
			userId: ctx.userId,
			runId,
			stage: "family",
			state: productState,
			questions: [{ key: "family", instructions: FAMILY_INSTRUCTIONS, candidates: shortlist }],
		});
		const decision = plain(decisions.get("family"));
		this.count(state, decision);
		const byId = new Map(families.map((f) => [f.id, f]));
		const auto = decision?.choice && decision.confidence >= this.decisions.autoConfidence ? byId.get(decision.choice) : undefined;
		if (auto) {
			// confident: no question — the answered row says it was picked and can be changed
			const family = { ...auto, label: familyLabel(auto) };
			state.family = family;
			state.stats.auto += 1;
			state.answers.push(this.answered("family", "family", flowCopy(state.language).family.label, [family.id], family.label, "auto", decision?.confidence));
			await this.expandAttributes(ctx, runId, state, family);
			return null;
		}
		const listed = new Set(shortlist.map((c) => c.code));
		const ranked = [
			...rankByDecision(
				shortlist.map((c) => ({ value: c.code, label: familyLabel(byId.get(c.code) as ShopFamily) })),
				decision,
			),
			...families.filter((f) => !listed.has(f.id)).map((f) => ({ value: f.id, label: familyLabel(f) })),
		];
		const top = ranked.slice(0, SHOWN_OPTIONS);
		const suggested = decision?.choice ?? undefined;
		// option meta ("14 attributes · 6 required") + the suggested family's plan for "Next:"
		const schemas = await Promise.all(
			top.map((option) => this.shop.familySchema(ctx, option.value).catch(() => null)),
		);
		const options: QuestionOption[] = top.map((option, i) => {
			const schema = schemas[i];
			const fields = schema?.fields.filter((f) => !SYSTEM_FIELDS.has(f.code)) ?? [];
			const required = fields.filter((f) => f.required).length;
			const p = decision?.probabilities[option.value];
			return {
				...option,
				...(schema ? { meta: `${fields.length} attributes · ${required} required` } : {}),
				...(p !== undefined ? { confidence: p } : {}),
			};
		});
		if (suggested && byId.has(suggested)) {
			const family = byId.get(suggested) as ShopFamily;
			await this.planFamily(ctx, runId, state, { ...family, label: familyLabel(family) }).catch(() => undefined);
		}
		state.ranked.family = ranked.slice(0, 40);
		state.suggested.family = suggested;
		return {
			id: "family",
			kind: "family",
			label: flowCopy(state.language).family.label,
			title: flowCopy(state.language).family.title,
			why: flowCopy(state.language).family.why,
			options,
			multiple: false,
			...(suggested ? { suggested } : {}),
			total: state.familiesTotal,
			allowText: false,
			allowSkip: true,
		};
	}

	/** Schema + one decision batch for every enum attribute of the family. */
	private async planFamily(
		ctx: AiRequestContext,
		runId: string,
		state: FlowState,
		family: ShopFamily & { label: string },
	): Promise<{ fields: FamilyField[] }> {
		const schema = await this.shop.familySchema(ctx, family.id);
		const fields = schema.fields.filter((f) => !SYSTEM_FIELDS.has(f.code));
		for (const field of fields) {
			state.suggested[`label:${field.code}`] = field.label;
			if (field.required) state.suggested[`required:${field.code}`] = "1";
		}
		if (state.plan?.familyId === family.id) return { fields };
		const enums = fields.filter((f) => f.options.length > 0);
		const decisions = await this.decisions.decide({
			organizationId: ctx.organizationId,
			userId: ctx.userId,
			runId,
			stage: "attribute",
			state: describeProduct(state.product, state.variants),
			questions: enums.slice(0, 40).map((field) => ({
				key: field.code,
				instructions: attributeInstructions(field),
				candidates: field.options.map((o) => ({ code: o.code, description: o.label })),
			})),
		});
		const plan: Record<string, PlainDecision> = {};
		for (const field of enums) {
			const decision = plain(decisions.get(field.code));
			if (decision) {
				plan[field.code] = decision;
				this.count(state, decision);
			}
		}
		state.plan = { familyId: family.id, decisions: plan };
		return { fields };
	}

	/**
	 * Family chosen: confident attribute values are applied (required ones are
	 * shown as answered rows), the required ones left become questions.
	 */
	private async expandAttributes(
		ctx: AiRequestContext,
		runId: string,
		state: FlowState,
		family: ShopFamily & { label: string },
	): Promise<void> {
		let fields: FamilyField[];
		try {
			({ fields } = await this.planFamily(ctx, runId, state, family));
		} catch (error) {
			this.logger.warn(`family schema unavailable: ${String(error)}`);
			return;
		}
		const decisions = state.plan?.decisions ?? {};
		const known = new Set(state.attributes.map((a) => a.code));
		const toAsk: FlowStep[] = [];
		for (const field of fields) {
			if (known.has(field.code) || field.options.length === 0) continue;
			const decision = decisions[field.code];
			const option = decision?.choice ? field.options.find((o) => o.code === decision.choice) : undefined;
			if (option && decision && decision.confidence >= this.decisions.autoConfidence) {
				state.attributes.push({
					code: field.code,
					label: field.label,
					value: option.code,
					display: option.label,
					source: "auto",
					confidence: decision.confidence,
				});
				state.stats.auto += 1;
				if (field.required) {
					state.answers.push(
						this.answered(`attr_${field.code}`, "attribute", field.label, [option.code], option.label, "auto", decision.confidence),
					);
				}
				continue;
			}
			if (field.required) toAsk.push({ id: `attr_${field.code}`, kind: "attribute", code: field.code });
		}
		// questions right after the family, before variants
		state.steps.splice(state.index + 1, 0, ...toAsk);
		// remember the schema's options for the cards
		for (const field of fields) {
			if (field.options.length === 0) continue;
			const ranked = rankByDecision(
				field.options.map((o) => ({ value: o.code, label: o.label })),
				decisions[field.code],
			);
			state.ranked[`attr_${field.code}`] = ranked.slice(0, 40);
			state.suggested[`opts:${field.code}`] = String(field.optionsTotal);
			if (field.collection) state.suggested[`multi:${field.code}`] = "1";
		}
	}

	private attributeQuestion(state: FlowState, code: string, id: string): AgentQuestion {
		const label = state.suggested[`label:${code}`] ?? code;
		const decision = state.plan?.decisions[code];
		const ranked = state.ranked[id] ?? [];
		const total = Number(state.suggested[`opts:${code}`] ?? ranked.length);
		const suggested = decision?.choice && decision.confidence >= 0.2 ? decision.choice : undefined;
		return {
			id,
			kind: "attribute",
			label,
			title: `${label}?`,
			why: `${state.family?.label ?? "This family"} needs it to publish.`,
			options: ranked.slice(0, SHOWN_ATTRIBUTE_OPTIONS).map((o) => ({
				...o,
				...(decision?.probabilities[o.value] !== undefined ? { confidence: decision.probabilities[o.value] } : {}),
			})),
			multiple: state.suggested[`multi:${code}`] === "1",
			...(suggested ? { suggested } : {}),
			total,
			allowText: true,
			allowSkip: true,
		};
	}

	private variantsQuestion(state: FlowState): AgentQuestion {
		const copy = flowCopy(state.language).variants;
		const options: QuestionOption[] = [
			{ value: "none", label: copy.none },
			{ value: "color", label: copy.color },
			{ value: "size", label: copy.size },
			{ value: "color_size", label: copy.colorSize },
		];
		state.ranked.variants = options;
		return {
			id: "variants",
			kind: "variants",
			label: copy.label,
			title: copy.title,
			why: copy.why,
			options,
			multiple: false,
			allowText: true,
			allowSkip: true,
		};
	}

	/** No turn left to ask: a likely value is applied (shown as picked for you), else it stays missing. */
	private fillQuietly(state: FlowState, code: string, decision: PlainDecision | undefined): void {
		const option = decision?.choice ? (state.ranked[`attr_${code}`] ?? []).find((o) => o.value === decision.choice) : undefined;
		if (!option || !decision || decision.confidence < FILL_CONFIDENCE) return;
		const label = state.suggested[`label:${code}`] ?? code;
		state.attributes.push({ code, label, value: option.value, display: option.label, source: "auto", confidence: decision.confidence });
		state.answers.push(this.answered(`attr_${code}`, "attribute", label, [option.value], option.label, "auto", decision.confidence));
		state.stats.auto += 1;
	}

	private count(state: FlowState, decision: PlainDecision | undefined): void {
		if (!decision) return;
		if (decision.source === "cache") state.stats.cached += 1;
		else state.stats.decided += 1;
	}

	private result(state: FlowState): ProductFlowResult | CustomFlowResult {
		if (state.purpose === "custom") {
			return {
				answers: state.answers.map((a) => ({
					id: a.questionId.replace(/^q_/, ""),
					question: a.label,
					answer:
						a.source === "skipped"
							? "(skipped — decide yourself)"
							: a.kind === "images"
								? `photos picked, use these image ids in order (first = cover): ${JSON.stringify(a.values)}`
								: a.display,
				})),
			};
		}
		const resolved = new Set(state.attributes.map((a) => a.code));
		const labels = Object.entries(state.suggested).filter(([k]) => k.startsWith("label:"));
		const stillMissing: ProductFlowResult["stillMissing"] = [];
		const fillable: ProductFlowResult["fillable"] = [];
		for (const [key, label] of labels) {
			const code = key.slice("label:".length);
			if (resolved.has(code) || !label) continue;
			const required = state.suggested[`required:${code}`] === "1";
			const isEnum = (state.ranked[`attr_${code}`]?.length ?? 0) > 0;
			if (required) stillMissing.push({ code, label, type: isEnum ? "option" : "text" });
			if (!isEnum) fillable.push({ code, label, required });
		}
		const variants: ProductFlowResult["variants"] =
			state.variants.mode === "listed"
				? { axes: state.variants.axes }
				: state.variants.mode === "described"
					? { describedByMerchant: state.variants.text ?? "" }
					: state.variants.mode;
		return {
			family: state.family ? { code: state.family.code, name: state.family.name, path: state.family.label } : null,
			attributes: state.attributes.map((a) => ({
				code: a.code,
				label: a.label,
				value: a.value,
				display: a.display,
				source: a.source === "you" ? "merchant" : "auto",
			})),
			stillMissing,
			fillable: fillable.slice(0, 20),
			variants,
			images: state.hasImages
				? "use the attached images"
				: state.picked.length > 0
					? `use imageIds ${JSON.stringify(state.picked.map((i) => i.id))}`
					: "none — say the draft has no photos yet",
			note:
				"Now call propose_product_drafts with this family and these attribute values unchanged. Write name, description and SEO yourself. Fill fillable attributes only from the merchant's facts; never guess option values.",
		};
	}
}

export class FlowError extends Error {}

/** This chat's pictures (Pixabay finds, generated ones, earlier picks) as options of a product's photo question. */
function chatPictureOptions(state: FlowState): QuestionOption[] {
	return [...(state.chatPictures ?? [])].reverse().map((picture) => ({
		value: picture.ref,
		label: (picture.alt ?? picture.credit ?? "Photo").slice(0, 200),
		imageUrl: picture.url,
		...(picture.credit ? { credit: picture.credit, meta: picture.credit } : {}),
	}));
}
