import { z } from "zod";
import { ThreadStatusSchema } from "./work";

/**
 * ECH Agent — shared wire contracts.
 * Everything a run produces is grounded: entity ids must come from tool receipts
 * (provenance gate), and every write is a staged ChangeSet a human can review.
 */

export const AgentRoleSchema = z.enum(["merchant", "customer"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentDomainSchema = z.enum([
	"products",
	"listings",
	"inventory",
	"orders",
	"pricing",
	"integrations",
	"support",
	"campaigns",
	"crm",
	"cms",
	"webbuilder",
]);
export type AgentDomain = z.infer<typeof AgentDomainSchema>;

export const AutonomyLevelSchema = z.enum(["observe", "recommend", "stage", "auto"]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const RiskTierSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const InsightKindSchema = z.enum(["blocking", "risk", "opportunity", "hygiene"]);
export type InsightKind = z.infer<typeof InsightKindSchema>;

export const RunStatusSchema = z.enum([
	/** waiting for a free AI slot of the shop (too many requests working at once); Stop takes it out of the queue */
	"queued",
	"planning",
	"running",
	/** paused on a clarifying question (the ask_user tool call) — the merchant's answer resumes it */
	"awaiting_input",
	"awaiting_approval",
	"applying",
	"applied",
	"rejected",
	"failed",
	"cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const ChangeSetStatusSchema = z.enum(["pending", "applied", "rejected", "expired", "superseded", "reverted"]);
export type ChangeSetStatus = z.infer<typeof ChangeSetStatusSchema>;

export const StepStatusSchema = z.enum(["pending", "running", "done", "failed", "skipped"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const ChannelKindSchema = z.enum(["storefront", "shopee", "tiktok", "amazon", "rakuten", "email", "internal"]);
export type ChannelKind = z.infer<typeof ChannelKindSchema>;

/** A typed entity reference — the only way an agent names real records. */
export const EntityRefSchema = z.object({
	kind: z.string().min(1),
	id: z.string().min(1),
	label: z.string().optional(),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

/** What a thing on the page is, as the merchant picked it ("Ask AI" on a button, a picture, the SEO title). */
/** Things on the page (text … page), and records picked in the chat from a reply's cards (product, post). */
export const ContextElementKindSchema = z.enum(["text", "button", "image", "section", "seo", "menu", "footer", "page", "product", "post"]);
export type ContextElementKind = z.infer<typeof ContextElementKindSchema>;

/**
 * One thing on the page the merchant attached to a message: the section it is in,
 * the field inside it ("ctaButtons.0.label", "images", "seoTitle") and what it
 * says now — the assistant edits exactly that, and the chat shows it as a chip.
 */
export const ContextElementSchema = z.object({
	kind: ContextElementKindSchema,
	/** chip text: "Mua ngay", "Hero", "Meta title" */
	label: z.string().trim().min(1).max(80),
	pageId: z.string().min(1).max(60).optional(),
	/** the section (site-blocks `blockIdOf`) */
	blockId: z.string().min(1).max(80).optional(),
	/** dot path in the section, or the page field for SEO */
	path: z.string().min(1).max(160).optional(),
	/** the current value, trimmed */
	value: z.string().max(300).optional(),
	/** a picked record (kind product / post): its id, for read_item and the propose tools */
	recordId: z.string().min(1).max(80).optional(),
});
export type ContextElement = z.infer<typeof ContextElementSchema>;

/** At most this many things on the page per message. */
export const MAX_CONTEXT_ELEMENTS = 3;

/** One thing on the page = its section + field (or its kind when it has no field). */
export function contextElementKey(element: ContextElement): string {
	if (element.recordId) return `${element.kind}:${element.recordId}`;
	return `${element.pageId ?? ""}:${element.blockId ?? ""}:${element.path ?? element.kind}`;
}

/** Page/domain context the run is pinned to (the "agent sees what you see" pin). */
export const ContextPinSchema = z.object({
	module: z.string().min(1),
	entity: EntityRefSchema.optional(),
	filters: z.record(z.string(), z.string()).optional(),
	/** things on the page attached to this message (Ask AI on an element) */
	elements: z.array(ContextElementSchema).max(MAX_CONTEXT_ELEMENTS).optional(),
});
export type ContextPin = z.infer<typeof ContextPinSchema>;

/**
 * Where the merchant is when they send a message, sent even when they removed
 * the page chip (then the request is not about the page, but "which page am I
 * on" still has an answer).
 */
export const PageLocationSchema = z.object({
	/** what the screen is called, as the merchant sees it: "Catalog › Products (Product Master)" */
	title: z.string().trim().min(1).max(120),
	/** the address in the browser */
	path: z.string().min(1).max(300),
	/** the page's module ("store", "products", "blog", "editor") */
	module: z.string().min(1).max(40).optional(),
});
export type PageLocation = z.infer<typeof PageLocationSchema>;

/** A picture a tool read or made (a post's cover, a product photo, a generated picture) — shown in the chat. */
export const ReceiptMediaSchema = z.object({
	url: z.string().min(1).max(2_000),
	alt: z.string().max(300).optional(),
	/** "Cover", "Main photo", "Generated", "Pixabay · name" */
	label: z.string().max(60).optional(),
	/** an image id the run can use (find_images / generate_image) — the chat offers "Use this" */
	imageId: z.string().max(40).optional(),
	/** what the picture resolves to (pixabay:<id>, asset:<id>) — later turns of the chat can still use it */
	ref: z.string().max(200).optional(),
});
export type ReceiptMedia = z.infer<typeof ReceiptMediaSchema>;

/**
 * A step or receipt in words the UI can translate: a phrase key plus values
 * ("inventory.overview", "content.read.post" { subject }). The English text
 * (label / summary) stays alongside for UIs without that phrase.
 */
export const PhraseSchema = z.object({
	key: z.string().min(1).max(60),
	values: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional(),
});
export type Phrase = z.infer<typeof PhraseSchema>;

/** A record a tool read or found (a product, a blog post): the chat shows it as one small card. */
export const ReceiptRecordSchema = z.object({
	kind: z.enum(["product", "post"]),
	id: z.string().min(1).max(80),
	title: z.string().max(200),
	status: z.string().max(40).optional(),
	/** one short line: price, SKU, category… */
	meta: z.string().max(120).optional(),
	/** where it opens in the app (same-origin path) */
	href: z.string().max(500).optional(),
	/** its main picture */
	thumb: z.string().max(2_000).optional(),
});
export type ReceiptRecord = z.infer<typeof ReceiptRecordSchema>;

/** Receipt of a grounded tool call — provenance for everything the run claims. */
export const ToolReceiptSchema = z.object({
	id: z.string().min(1),
	tool: z.string().min(1),
	summary: z.string(),
	durationMs: z.number().nonnegative(),
	status: z.enum(["ok", "error"]),
	entityIds: z.array(z.string()).default([]),
	media: z.array(ReceiptMediaSchema).max(12).optional(),
	/** records it read or found — cards in the chat, instead of their pictures */
	records: z.array(ReceiptRecordSchema).max(10).optional(),
	phrase: PhraseSchema.optional(),
});
export type ToolReceipt = z.infer<typeof ToolReceiptSchema>;

export const PlanStepSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	detail: z.string().optional(),
	status: StepStatusSchema,
	phrase: PhraseSchema.optional(),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const DiffProvenanceSchema = z.enum(["generated", "tool_output", "user_input", "inferred"]);
export type DiffProvenance = z.infer<typeof DiffProvenanceSchema>;

export const FieldDiffSchema = z.object({
	entity: EntityRefSchema,
	field: z.string().min(1),
	/**
	 * Where the change is inside the entity, for "Show": a dot path in a section
	 * ("ctaButtons.0.label", "images"), the page field ("seoTitle") or the menu
	 * item ("navigation.3"). `field` is the words the card shows.
	 */
	path: z.string().min(1).max(160).optional(),
	locale: z.string().optional(),
	before: z.string().nullable(),
	after: z.string(),
	provenance: DiffProvenanceSchema,
});
export type FieldDiff = z.infer<typeof FieldDiffSchema>;

export const BlastRadiusSchema = z.object({
	kind: z.string().min(1),
	count: z.number().int().nonnegative(),
	label: z.string(),
});
export type BlastRadius = z.infer<typeof BlastRadiusSchema>;

export const GuardrailResultSchema = z.object({
	rule: z.string().min(1),
	ok: z.boolean(),
	detail: z.string().optional(),
});
export type GuardrailResult = z.infer<typeof GuardrailResultSchema>;

/**
 * What the domain owner executes when a change set is approved. The agent
 * never commits — the host (prime-web BFF / platform-api) reads `kind`,
 * validates `payload` against its own contract, and applies it with the
 * approving user's permissions.
 */
export const ChangeSetActionSchema = z.object({
	kind: z.string().min(1),
	payload: z.record(z.string(), z.unknown()),
});
export type ChangeSetAction = z.infer<typeof ChangeSetActionSchema>;

export const ChangeSetResultLinkSchema = z.object({
	label: z.string().min(1),
	href: z.string().min(1),
});
export type ChangeSetResultLink = z.infer<typeof ChangeSetResultLinkSchema>;

/** Outcome recorded once the domain owner applied the change set. */
export const ChangeSetResultSchema = z.object({
	entities: z.array(EntityRefSchema).default([]),
	links: z.array(ChangeSetResultLinkSchema).default([]),
	/**
	 * How to put the record back as it was (the pre-image the domain owner saved
	 * before writing). Undo applies it only while the record is unchanged since.
	 */
	undo: z
		.object({
			kind: z.string().min(1),
			payload: z.record(z.string(), z.unknown()),
			/** undo is offered until then */
			until: z.string().min(1),
		})
		.optional(),
	/** set when the change was undone */
	revertedAt: z.string().optional(),
	revertedBy: z.string().optional(),
});
export type ChangeSetResult = z.infer<typeof ChangeSetResultSchema>;

/**
 * What a staged draft will create, shaped for review: every field carries
 * where its value came from so the merchant knows what to check.
 * `you` = the merchant said it, `ai` = the assistant wrote it, `auto` = the
 * decision model picked it from the shop's options, `family` = the family's
 * default, `missing` = still empty.
 */
export const FieldSourceSchema = z.enum(["you", "ai", "auto", "family", "missing"]);
export type FieldSource = z.infer<typeof FieldSourceSchema>;

export const DraftFieldSchema = z.object({
	key: z.string().min(1).max(120),
	label: z.string().min(1).max(120),
	value: z.string().max(4000),
	source: FieldSourceSchema,
	group: z.enum(["product", "required", "optional", "seo"]),
});
export type DraftField = z.infer<typeof DraftFieldSchema>;

export const DraftImageSchema = z.object({
	url: z.string().min(1).max(2000),
	origin: z.enum(["upload", "media", "product", "stock", "generated"]),
	/** attachment, media or stock id the applier resolves */
	ref: z.string().max(200).optional(),
	alt: z.string().max(300).optional(),
	credit: z.string().max(200).optional(),
	role: z.enum(["main", "cover", "inline", "gallery"]).default("gallery"),
});
export type DraftImage = z.infer<typeof DraftImageSchema>;

export const DraftVariantSchema = z.object({
	label: z.string().min(1).max(200),
	sku: z.string().min(1).max(120),
	/** axis code → option value */
	values: z.array(z.object({ axis: z.string().min(1).max(120), value: z.string().min(1).max(200) })).max(4),
	price: z.string().max(40).optional(),
	stock: z.number().int().nonnegative().optional(),
});
export type DraftVariant = z.infer<typeof DraftVariantSchema>;

export const ProductDraftDocSchema = z.object({
	type: z.literal("product"),
	/** whose catalog: Product Master (default) or the shop's own products (no family, no attributes) */
	catalog: z.enum(["master", "shop"]).optional(),
	name: z.string().min(1).max(200),
	sku: z.string().min(1).max(120),
	price: z.string().max(40).optional(),
	family: z.object({ code: z.string().min(1).max(120), label: z.string().min(1).max(200) }).optional(),
	fields: z.array(DraftFieldSchema).max(120),
	variants: z
		.object({
			axes: z.array(z.object({ code: z.string().min(1).max(120), label: z.string().min(1).max(120) })).max(4),
			rows: z.array(DraftVariantSchema).max(100),
		})
		.optional(),
	images: z.array(DraftImageSchema).max(20).default([]),
});
export type ProductDraftDoc = z.infer<typeof ProductDraftDocSchema>;

export const BlogDraftDocSchema = z.object({
	type: z.literal("blog"),
	title: z.string().min(1).max(200),
	/** sanitized article HTML (h2, h3, p, ul, ol, li, strong, em, figure, img, figcaption) */
	html: z.string().max(60_000),
	words: z.number().int().nonnegative(),
	sections: z.number().int().nonnegative(),
	cover: DraftImageSchema.optional(),
	images: z.array(DraftImageSchema).max(12).default([]),
	seo: z.object({ title: z.string().max(200), description: z.string().max(400) }).optional(),
});
export type BlogDraftDoc = z.infer<typeof BlogDraftDocSchema>;

/** How "Open to edit" prefills the inventory screen's own sheet for a proposal. */
export const InventoryPrefillSchema = z.object({
	kind: z.enum(["adjust", "hold", "transfer"]),
	/** the adjust sheet titled as receiving */
	receiving: z.boolean().optional(),
	warehouseId: z.string().max(80).optional(),
	destinationWarehouseId: z.string().max(80).optional(),
	receiveNow: z.boolean().optional(),
	/** adjust reason key (received, found, damaged, lost, other) or hold kind */
	reason: z.string().max(40).optional(),
	lines: z
		.array(z.object({ productId: z.string().max(80), inventoryItemId: z.string().max(80), quantity: z.number() }))
		.max(200),
});
export type InventoryPrefill = z.infer<typeof InventoryPrefillSchema>;

/**
 * An inventory change the assistant drafted, as the seller reviews it: the
 * action, the lines with before → after, the effect, a "why" grounded in real
 * stock data, and the rule that applies (posts now / waits for review).
 */
export const InventoryDraftDocSchema = z.object({
	type: z.literal("inventory"),
	capability: z.string().min(1).max(60),
	/** "Transfer · PrimeCommerce → Hà Nội" */
	action: z.string().min(1).max(160),
	lines: z
		.array(
			z.object({
				name: z.string().min(1).max(200),
				sku: z.string().max(120).optional(),
				imageUrl: z.string().max(2000).optional(),
				/** "On hand 205 → 201 · Available 197 → 193" */
				detail: z.string().max(240).optional(),
				/** "× 20", "−4" */
				quantity: z.string().max(24).optional(),
			}),
		)
		.max(50),
	/** lines not shown */
	more: z.number().int().nonnegative().optional(),
	effect: z.string().max(240).optional(),
	why: z.string().max(300).optional(),
	rule: z.string().max(300).optional(),
	workflow: z.enum(["immediate", "review"]).optional(),
	prefill: InventoryPrefillSchema.optional(),
});
export type InventoryDraftDoc = z.infer<typeof InventoryDraftDocSchema>;

/** A photo in a product edit review (thumbnail URLs are same-origin DAM paths). */
export const EditPhotoSchema = z.object({
	url: z.string().max(2000),
	alt: z.string().max(300).optional(),
	cover: z.boolean().optional(),
	/** added by this change */
	added: z.boolean().optional(),
	/** taken off the product by this change (stays in the library) */
	removed: z.boolean().optional(),
});
export type EditPhoto = z.infer<typeof EditPhotoSchema>;

/**
 * An edit of one existing Product Master product, as the seller reviews it:
 * before → after per editor section, the photos before and after, a table of
 * the variants that change, and what Undo can and cannot put back.
 */
export const ProductEditDocSchema = z.object({
	type: z.literal("product_edit"),
	name: z.string().min(1).max(200),
	sku: z.string().max(180).optional(),
	imageUrl: z.string().max(2000).optional(),
	sections: z
		.array(
			z.object({
				/** basics | attributes | price | shipping | seo | codes */
				key: z.string().min(1).max(40),
				rows: z.array(z.object({ label: z.string().min(1).max(160), before: z.string().max(600).nullable(), after: z.string().max(600).nullable() })).max(80),
			}),
		)
		.max(8),
	/** the photos after the change, in order, then the ones it takes off (`removed`) */
	photos: z.object({ before: z.number().int().nonnegative(), items: z.array(EditPhotoSchema).max(60) }).optional(),
	variants: z
		.object({
			rows: z
				.array(
					z.object({
						label: z.string().min(1).max(200),
						change: z.enum(["added", "changed", "archived"]),
						/** "SKU", "Price", "Barcode", "Status", "Photo" */
						cells: z.array(z.object({ field: z.string().min(1).max(40), before: z.string().max(200).nullable(), after: z.string().max(200).nullable() })).max(6),
					}),
				)
				.max(60),
			more: z.number().int().nonnegative().optional(),
		})
		.optional(),
	/** what Undo can't put back exactly: new variants it archives (labels), alt text shared with the library */
	undo: z
		.object({
			archivesVariants: z.array(z.string().max(200)).max(60).optional(),
			sharedAlt: z.boolean().optional(),
			/** other things Undo can't put back exactly, one plain line each */
			notes: z.array(z.string().max(300)).max(6).optional(),
		})
		.optional(),
});
export type ProductEditDoc = z.infer<typeof ProductEditDocSchema>;

export const DraftDocSchema = z.discriminatedUnion("type", [ProductDraftDocSchema, BlogDraftDocSchema, InventoryDraftDocSchema, ProductEditDocSchema]);
export type DraftDoc = z.infer<typeof DraftDocSchema>;

/**
 * Cards that belong together (a promo campaign: its discount code, homepage banner and announcement
 * post). Same `id` = one group; `label` is what the merchant sees ("11.11"); `step` is the order the
 * cards are approved in (the first staged goes first).
 */
export const ChangeSetGroupSchema = z.object({
	id: z.string().min(1).max(120),
	label: z.string().min(1).max(60),
	step: z.number().int().positive().optional(),
	/** `campaign` (default): a promotion's linked cards; `set`: several drafts of one request (e.g. 3 blog posts) */
	kind: z.enum(["campaign", "set"]).optional(),
});
export type ChangeSetGroup = z.infer<typeof ChangeSetGroupSchema>;

/** The teammate whose request staged the change (set by the platform from the signed context, never by the model). */
export const ChangeSetRequesterSchema = z.object({
	id: z.string().min(1),
	/** display name when known (first + last name, or the email's local part); null on older drafts */
	name: z.string().max(80).nullable().optional(),
});
export type ChangeSetRequester = z.infer<typeof ChangeSetRequesterSchema>;

/**
 * Why the caller cannot approve / reject / undo a draft: `needs_owner_or_admin` (a viewer's own draft) or
 * `not_yours` (a teammate's draft, for anyone who is not an owner or admin). Clients map a code they do not
 * know to the plain `not_yours` sentence.
 */
export const ChangeSetAccessReasonSchema = z.string().min(1).max(60);

/** What the caller may do with the draft, computed per request by the platform (never stored). */
export const ChangeSetAccessSchema = z.object({
	canDecide: z.boolean(),
	reason: ChangeSetAccessReasonSchema.optional(),
});
export type ChangeSetAccess = z.infer<typeof ChangeSetAccessSchema>;

export const ChangeSetSchema = z.object({
	id: z.string().min(1),
	runId: z.string().min(1),
	domain: AgentDomainSchema,
	title: z.string().min(1),
	summary: z.string(),
	risk: RiskTierSchema,
	blastRadius: BlastRadiusSchema,
	diffs: z.array(FieldDiffSchema).min(1),
	guardrails: z.array(GuardrailResultSchema).default([]),
	status: ChangeSetStatusSchema,
	stagedBy: z.string().min(1),
	stagedAt: z.string().min(1),
	expiresAt: z.string().min(1),
	decidedBy: z.string().optional(),
	decidedAt: z.string().optional(),
	note: z.string().optional(),
	action: ChangeSetActionSchema.optional(),
	/**
	 * Destructive changes (archive, move to trash): the approver types this
	 * (the record's name) to approve; the domain owner checks it again.
	 */
	confirmText: z.string().min(1).max(200).optional(),
	/**
	 * Money, buyer-email and other irreversible changes (order payment / confirm / complete, live discount
	 * codes, template wording): never approved by Auto-approve, always by a click on the card. Absent = as before.
	 */
	requiresClick: z.boolean().optional(),
	/** review shape of what approval creates (product master / blog post / up to 20 shop products) */
	drafts: z.array(DraftDocSchema).max(20).optional(),
	/** set when the card is one step of a linked set (a campaign); absent on every other card */
	group: ChangeSetGroupSchema.optional(),
	result: ChangeSetResultSchema.optional(),
	/** who asked for it (absent on drafts staged before this field; the platform fills it from the run) */
	requestedBy: ChangeSetRequesterSchema.optional(),
	/** per caller, never stored: whether this caller may approve / reject / undo it, and why not */
	access: ChangeSetAccessSchema.optional(),
	/** per caller, never stored: the caller asked for it (false: a teammate's draft, shown "Asked by …") */
	mine: z.boolean().optional(),
});
export type ChangeSet = z.infer<typeof ChangeSetSchema>;

/**
 * Where an applied web builder change stands against the page as it is now (read-only, from the fingerprints the
 * change left): `applied` (still in), `reverted` (taken back — by Undo or by hand), `diverged` (edited since, so
 * neither), `unknown` (nothing to compare: no undo data, or a kind without a comparison).
 */
export const ChangeSetVerdictSchema = z.enum(["applied", "reverted", "diverged", "unknown"]);
export type ChangeSetVerdict = z.infer<typeof ChangeSetVerdictSchema>;

/** The change set after the check (its status follows the verdict) and the verdict. */
export const ReconcileResultSchema = z.object({ changeSet: ChangeSetSchema, verdict: ChangeSetVerdictSchema });
export type ReconcileResult = z.infer<typeof ReconcileResultSchema>;

/**
 * Clarifying questions are a tool call: the model calls `ask_user`, the run
 * pauses (`awaiting_input`) with the call's questions, and the merchant's
 * answers go back as the tool result so the same run continues. Options come
 * from the shop's own data (families, attribute values, media); a decision
 * model ranks them and may answer a question itself when it is confident —
 * those answers stay visible (`source: "auto"`) and can be changed.
 */
export const QuestionOptionSchema = z.object({
	value: z.string().min(1).max(200),
	label: z.string().min(1).max(200),
	/** one line under the label, e.g. "14 attributes · 6 required" */
	meta: z.string().max(200).optional(),
	/** decision-model probability, when the options were ranked */
	confidence: z.number().min(0).max(1).optional(),
	/** picture options (kind "images") show as tiles */
	imageUrl: z.string().max(2000).optional(),
	/** credit line under a stock picture */
	credit: z.string().max(200).optional(),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

/** Most rows one quantities question holds (and one answer may carry). */
export const MAX_QUESTION_ROWS = 20;
/** Largest number one quantities row accepts (the product stock limit). */
export const MAX_QUESTION_NUMBER = 1_000_000;

/** A quantity as typed: not negative, at most two decimals (sen). Whether decimals are allowed at all is the question's (`decimals`). */
export const QuantitySchema = z
	.number()
	.min(0)
	.max(MAX_QUESTION_NUMBER)
	.refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: "At most two decimals." });

/** One line of a quantities question: the item to give a number for. */
export const QuestionRowSchema = z.object({
	id: z.string().min(1).max(60),
	label: z.string().min(1).max(160),
	suggested: z.number().min(0).max(MAX_QUESTION_NUMBER).optional(),
});
export type QuestionRow = z.infer<typeof QuestionRowSchema>;

export const QuestionKindSchema = z.enum(["family", "attribute", "variants", "images", "choice", "quantities"]);
export type QuestionKind = z.infer<typeof QuestionKindSchema>;

/**
 * The kind as a READER takes it (an older client or service meeting a question kind added later, or a stored run
 * written by a newer deploy): an unknown kind becomes "choice" instead of failing the whole run / thread, so the
 * card still renders (a choice, or a text box when it has no options) and a deploy order never breaks a chat.
 */
const ReadQuestionKindSchema = QuestionKindSchema.catch("choice");

export const AgentQuestionSchema = z.object({
	id: z.string().min(1).max(80),
	kind: ReadQuestionKindSchema,
	/** short field name for the answered row, e.g. "Family", "Fit" */
	label: z.string().min(1).max(80),
	title: z.string().min(1).max(200),
	/** why the answer matters, one line */
	why: z.string().max(300).optional(),
	options: z.array(QuestionOptionSchema).max(60),
	multiple: z.boolean().default(false),
	/** value the shop data / decision model suggests */
	suggested: z.string().optional(),
	/** options that exist beyond the shown ones (searchable) */
	total: z.number().int().nonnegative().optional(),
	/** free-text answer allowed (e.g. a value that is not in the list) */
	allowText: z.boolean().default(false),
	allowSkip: z.boolean().default(true),
	/** picture questions: the merchant may upload files straight into the answer */
	allowUpload: z.boolean().optional(),
	/** quantities questions: one whole-number input per row (`suggested` = a number from the shop's own data, never invented) */
	rows: z.array(QuestionRowSchema).max(MAX_QUESTION_ROWS).optional(),
	/** quantities questions: what is counted, e.g. "pcs" or "RM" (shown next to every input) */
	unit: z.string().max(20).optional(),
	/** quantities questions: true = amounts with up to two decimals (prices); absent / false = whole numbers (stock) */
	decimals: z.boolean().optional(),
});
export type AgentQuestion = z.infer<typeof AgentQuestionSchema>;

export const AnswerSourceSchema = z.enum(["you", "auto", "skipped"]);
export type AnswerSource = z.infer<typeof AnswerSourceSchema>;

export const AnsweredQuestionSchema = z.object({
	questionId: z.string().min(1).max(80),
	kind: ReadQuestionKindSchema,
	label: z.string().min(1).max(80),
	values: z.array(z.string().max(200)).max(60).default([]),
	/** display text of the answer */
	display: z.string().max(400),
	/** quantities questions: the numbers given, keyed by row id (a row left empty is absent) */
	rows: z.record(z.string(), QuantitySchema).optional(),
	source: AnswerSourceSchema,
	confidence: z.number().min(0).max(1).optional(),
});
export type AnsweredQuestion = z.infer<typeof AnsweredQuestionSchema>;

/** The open `ask_user` call: one question at a time, later ones may depend on earlier answers. */
export const AgentAskSchema = z.object({
	toolCallId: z.string().min(1).max(120),
	question: AgentQuestionSchema,
	/** 0-based position and length of this ask's question sequence */
	index: z.number().int().nonnegative(),
	total: z.number().int().min(1).max(6),
	/** labels of the questions still to come, e.g. "fit, material" */
	next: z.string().max(200).optional(),
});
export type AgentAsk = z.infer<typeof AgentAskSchema>;

export const AnswerInputSchema = z
	.object({
		toolCallId: z.string().min(1).max(120),
		questionId: z.string().min(1).max(80),
		values: z.array(z.string().min(1).max(200)).max(60).optional(),
		text: z.string().trim().min(1).max(500).optional(),
		/** quantities questions: numbers (0 or more) keyed by row id; a row left empty is left out */
		rows: z
			.record(z.string().min(1).max(60), QuantitySchema)
			.refine((rows) => Object.keys(rows).length <= MAX_QUESTION_ROWS, { message: `At most ${MAX_QUESTION_ROWS} rows.` })
			.optional(),
		skip: z.boolean().optional(),
	})
	.refine((a) => a.skip || (a.values?.length ?? 0) > 0 || a.text || Object.keys(a.rows ?? {}).length > 0, {
		message: "Pick an option, type an answer, fill in the numbers or skip.",
	});
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

/**
 * A file or picture the merchant gave the assistant. Images (JPG/PNG/WebP)
 * can go into drafts; documents (PDF/CSV/XLSX) are only read for facts.
 * `origin` says where it came from: an upload, the media library, an
 * existing product's photos or stock photos (Pixabay).
 */
export const AttachmentKindSchema = z.enum(["image", "document"]);
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;

export const AttachmentOriginSchema = z.enum(["upload", "media", "product", "stock"]);
export type AttachmentOrigin = z.infer<typeof AttachmentOriginSchema>;

export const AgentAttachmentSchema = z.object({
	id: z.string().min(1).max(80),
	kind: AttachmentKindSchema,
	origin: AttachmentOriginSchema,
	name: z.string().min(1).max(200),
	mime: z.string().min(1).max(100),
	size: z.number().int().nonnegative(),
	/** image the browser can show (thumbnail or full) */
	url: z.string().max(2000).optional(),
	/** credit line for stock photos, e.g. "Pixabay · user" */
	credit: z.string().max(200).optional(),
});
export type AgentAttachment = z.infer<typeof AgentAttachmentSchema>;

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENTS_PER_MESSAGE = 8;
export const ATTACHMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_DOCUMENT_TYPES = [
	"application/pdf",
	"text/csv",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** A next message the merchant might send, offered after a finished reply. */
export const RunSuggestionSchema = z.object({
	prompt: z.string().min(1).max(160),
	/** "model": written by the assistant from the conversation (only when its prompt cache was warm); "rules": picked from what the run did */
	source: z.enum(["model", "rules"]).default("model"),
});
export type RunSuggestion = z.infer<typeof RunSuggestionSchema>;

/**
 * The part of a run before it first paused on a question: what it said and
 * did up to then. The chat shows it as its own finished reply, and what comes
 * after the answers as the next one.
 */
export const RunIntroSchema = z.object({
	/** the reply text shown with the question (later replaced by the final answer) */
	answer: z.string().optional(),
	/** steps / receipts that belong to the intro (the first N of each) */
	steps: z.number().int().nonnegative(),
	receipts: z.number().int().nonnegative(),
	/** how long it worked before asking */
	thoughtMs: z.number().nonnegative(),
	/** when the answers were in and it went back to work */
	resumedAt: z.string().optional(),
});
export type RunIntro = z.infer<typeof RunIntroSchema>;

/** A request working in the shop while another waits for a slot ("Stop … and run mine"). */
export const QueueRunningItemSchema = z.object({
	runId: z.string().min(1),
	threadId: z.string().optional(),
	/** the chat's title, or the first words of its message */
	title: z.string().max(120),
	/** who asked (owners / admins see teammates' requests; name null when unknown) */
	requestedBy: z.object({ name: z.string().max(80).nullable() }),
	startedAt: z.string(),
	/** the caller's own request */
	mine: z.boolean(),
	/** the caller may stop it: their own, or anyone's for an owner / admin */
	canStop: z.boolean(),
});
export type QueueRunningItem = z.infer<typeof QueueRunningItemSchema>;

/** Where a queued run stands: its place in the shop's queue and what is working now. */
export const RunQueueSchema = z.object({
	/** 1 = next to start */
	position: z.number().int().min(1),
	/** requests waiting before it */
	ahead: z.number().int().min(0),
	running: z.array(QueueRunningItemSchema).max(20),
});
export type RunQueue = z.infer<typeof RunQueueSchema>;

export const AgentRunSchema = z.object({
	id: z.string().min(1),
	role: AgentRoleSchema,
	domain: AgentDomainSchema,
	prompt: z.string().min(1),
	context: ContextPinSchema.optional(),
	/** the page the message was sent from (title + address), pinned or not */
	page: PageLocationSchema.optional(),
	/** pictures of the chat the merchant chose for this message ("Use this"), in order */
	pictures: z.array(ReceiptMediaSchema).max(12).optional(),
	status: RunStatusSchema,
	steps: z.array(PlanStepSchema).default([]),
	receipts: z.array(ToolReceiptSchema).default([]),
	changeSetIds: z.array(z.string()).default([]),
	/** Chat thread this run belongs to (assigned by the platform when the client sends none). */
	threadId: z.string().optional(),
	answer: z.string().optional(),
	error: z.string().optional(),
	/** open clarifying question while `awaiting_input` */
	ask: AgentAskSchema.optional(),
	/** files and pictures sent with the prompt */
	attachments: z.array(AgentAttachmentSchema).max(8).optional(),
	/** clarifying answers given in this run (yours, auto-picked, skipped) */
	answers: z.array(AnsweredQuestionSchema).optional(),
	intro: RunIntroSchema.optional(),
	/** next messages to offer under the finished reply (0–3) */
	suggestions: z.array(RunSuggestionSchema).max(3).optional(),
	/** live view only (from `run.queued` frames, never stored): the queue while `queued` */
	queue: RunQueueSchema.optional(),
	startedAt: z.string().min(1),
	finishedAt: z.string().optional(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

/**
 * A merchant's chat with the assistant: private to the user who started it,
 * one thread continues across pages, kept 90 days after its last activity.
 */
export const AgentThreadSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(120),
	/** Last prompt, trimmed — list preview only. */
	preview: z.string().max(160).optional(),
	runCount: z.number().int().nonnegative(),
	/** what the chat is about, for the list meta ("Product", "Blog") */
	domain: AgentDomainSchema.optional(),
	/** page the latest message was sent from (its context module, e.g. "store") — the list meta prefers it */
	module: z.string().max(40).optional(),
	/**
	 * The record the chat was started on (a product, a blog post): set by the
	 * first message sent from its page, never changed. Returning to the record
	 * offers this chat, and the assistant keeps the record as the chat's subject.
	 */
	entity: EntityRefSchema.optional(),
	/** drafts in this chat still waiting for approval */
	pendingDrafts: z.number().int().nonnegative().optional(),
	/** drafts from this chat that were approved and created */
	appliedDrafts: z.number().int().nonnegative().optional(),
	/** the to-do item this chat handles ("shop:orders_to_confirm"); set when the chat is started from it, never changed */
	taskKey: z.string().min(1).max(120).optional(),
	/** the chat as a job: waits on you (drafts / a question), working, done, or failed */
	status: ThreadStatusSchema.optional(),
	createdAt: z.string().min(1),
	/** Last activity; retention counts from here. */
	updatedAt: z.string().min(1),
});
export type AgentThread = z.infer<typeof AgentThreadSchema>;

/** A thread with its runs (oldest first) and the current state of their change sets. */
export const AgentThreadDetailSchema = z.object({
	thread: AgentThreadSchema,
	runs: z.array(AgentRunSchema),
	changeSets: z.array(ChangeSetSchema),
});
export type AgentThreadDetail = z.infer<typeof AgentThreadDetailSchema>;

export const RenameThreadInputSchema = z.object({ title: z.string().trim().min(1).max(120) });
export type RenameThreadInput = z.infer<typeof RenameThreadInputSchema>;

export const InsightSchema = z.object({
	id: z.string().min(1),
	kind: InsightKindSchema,
	domain: AgentDomainSchema,
	title: z.string().min(1),
	evidence: z.string(),
	confidence: z.number().min(0).max(1),
	impact: z.string().optional(),
	suggestedPrompt: z.string().optional(),
	entities: z.array(EntityRefSchema).default([]),
	createdAt: z.string().min(1),
});
export type Insight = z.infer<typeof InsightSchema>;

export const PolicyCheckSchema = z.object({
	status: z.enum(["ok", "hold", "blocked"]),
	note: z.string().optional(),
});
export type PolicyCheck = z.infer<typeof PolicyCheckSchema>;

export const MessageAuthorSchema = z.enum(["customer", "agent", "human", "system"]);
export type MessageAuthor = z.infer<typeof MessageAuthorSchema>;

export const ConversationMessageSchema = z.object({
	id: z.string().min(1),
	author: MessageAuthorSchema,
	body: z.string(),
	draft: z.boolean().default(false),
	confidence: z.number().min(0).max(1).optional(),
	sources: z.array(z.string()).default([]),
	policy: PolicyCheckSchema.optional(),
	createdAt: z.string().min(1),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationStatusSchema = z.enum(["needs_review", "auto_replied", "escalated", "resolved", "open"]);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const ConversationSchema = z.object({
	id: z.string().min(1),
	channel: ChannelKindSchema,
	customer: z.object({
		name: z.string().min(1),
		segment: z.string().optional(),
		sentiment: z.string().optional(),
		orderCount: z.number().int().nonnegative().optional(),
		lifetimeValue: z.string().optional(),
	}),
	linkedEntities: z.array(EntityRefSchema).default([]),
	status: ConversationStatusSchema,
	messages: z.array(ConversationMessageSchema).default([]),
	lastMessageAt: z.string().min(1),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const DomainAutonomySchema = z.object({
	level: AutonomyLevelSchema,
	cap: z.string().optional(),
});
export type DomainAutonomy = z.infer<typeof DomainAutonomySchema>;

export const AutonomyPolicySchema = z.object({
	domains: z.record(z.string(), DomainAutonomySchema),
	protectedFields: z.array(z.string()).default([]),
	autoSendMaxConfidence: z.number().min(0).max(1).default(0.8),
});
export type AutonomyPolicy = z.infer<typeof AutonomyPolicySchema>;
