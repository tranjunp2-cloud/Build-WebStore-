import type { BlogDraftDoc, ChangeSet, DraftImage, FieldDiff, InventoryDraftDoc, ProductDraftDoc } from "@ech/agent-core";
import { useEffect, useRef, useState } from "react";
import { askedByLine, canDecideDraft, decideBlockedLine } from "./draft-access";
import { fill } from "./fill";
import { Icon } from "./icons";
import { ProductEditBody, type ProductEditLabels } from "./product-edit-body";
import { type SiteChangeLabels, SiteChangeRows } from "./site-change-rows";

export interface DraftLabels extends SiteChangeLabels {
	productDraft: string;
	blogDraft: string;
	draft: string;
	/** a change that brings Product Master products into Product Store */
	storeAdd: string;
	status: Record<ChangeSet["status"], string>;
	family: string;
	required: string;
	optional: string;
	/** "{done} of {all}" */
	ofAll: string;
	/** "{done} of {all} filled" */
	filled: string;
	variants: string;
	images: string;
	none: string;
	/** "{n} SKUs" */
	skus: string;
	moreProducts: string;
	approve: string;
	review: string;
	preview: string;
	openEditor: string;
	/** "{words} words · {sections} sections" */
	blogStats: string;
	seoReady: string;
	origin: Record<DraftImage["origin"] | "mixed", string>;
	cover: string;
	yours: string;
	approving: string;
	/** kicker of an edit of an existing record */
	edit: string;
	/** kicker of archive / trash / publish / restore */
	statusChange: string;
	/** applied label for edits ("Saved") instead of "Created" */
	saved: string;
	/** asked before a change that can't be taken back is applied: "Go ahead with “{name}”?" */
	confirmAsk: string;
	confirmYes: string;
	confirmNo: string;
	undo: string;
	undoing: string;
	empty: string;
	/** "+{n} more changes" */
	moreChanges: string;
	/** a site change's section, menu or page → that place on the editor canvas */
	locate: string;
	/** the short button on each line ("Show") */
	locateShort: string;
	fields: Record<string, string>;
	/** inventory proposals */
	inventory: string;
	send: string;
	save: string;
	openToEdit: string;
	dismiss: string;
	/** a waiting change turned down from its card */
	discard: string;
	discardHint: string;
	why: string;
	moreLines: string;
	/** under every inventory proposal */
	logged: string;
	/** Product Master edit card */
	productEdit: ProductEditLabels;
	/** after an edit is saved, next to Undo: "{n} days left" */
	daysLeft: string;
	/** an undone Product Master edit */
	revertedNote: string;
	/** link to an edited product once saved */
	openProduct: string;
	/** a teammate's draft (owners / admins see them): "Asked by {name}" */
	askedBy: string;
	/** a teammate's draft whose asker has no name on record */
	askedByTeammate: string;
	/** instead of Approve / Discard / Undo on a viewer's own draft */
	needsOwnerOrAdmin: string;
	/** instead of Approve / Discard / Undo on a draft that is not the caller's to decide */
	notYours: string;
}

export const DEFAULT_DRAFT_LABELS: DraftLabels = {
	productDraft: "Product draft",
	blogDraft: "Blog draft",
	draft: "Draft",
	storeAdd: "Product Store",
	status: {
		pending: "Needs you",
		applied: "Created",
		rejected: "Discarded",
		expired: "Expired",
		superseded: "Replaced",
		reverted: "Undone",
	},
	family: "Family",
	required: "Required attributes",
	optional: "Optional attributes",
	ofAll: "{done} of {all}",
	filled: "{done} of {all} filled",
	variants: "Variants",
	images: "Images",
	none: "None",
	skus: "{n} SKUs",
	moreProducts: "and {n} more",
	approve: "Approve",
	review: "Review all fields",
	preview: "Preview",
	openEditor: "Open in editor",
	blogStats: "{words} words · {sections} sections",
	seoReady: "SEO title and description ready",
	origin: {
		upload: "from your upload",
		media: "from your library",
		product: "from your products",
		stock: "stock photos",
		generated: "generated",
		mixed: "mixed sources",
	},
	cover: "Cover",
	yours: "Yours",
	approving: "Creating…",
	edit: "Edit",
	statusChange: "Change",
	saved: "Saved",
	confirmAsk: "Go ahead with “{name}”?",
	confirmYes: "Yes",
	confirmNo: "No",
	undo: "Undo",
	undoing: "Undoing…",
	empty: "empty",
	moreChanges: "+{n} more changes",
	siteSummaryOne: "1 change in {places}",
	siteSummaryMany: "{n} changes in {places}",
	morePlaces: "+{n}",
	showChanges: "Show changes",
	hideChanges: "Hide",
	showAllChanges: "Show all {n} changes",
	locate: "Show on page",
	locateShort: "Show",
	fields: {
		name: "Name",
		description: "Description",
		title: "Title",
		article: "Article",
		"seo.title": "SEO title",
		"seo.description": "SEO description",
		cover: "Cover",
		status: "Status",
		store: "Product Store",
	},
	inventory: "Inventory",
	send: "Send",
	save: "Save",
	openToEdit: "Open to edit",
	dismiss: "Dismiss",
	discard: "Discard",
	discardHint: "Drop this change — nothing is applied",
	why: "Why",
	moreLines: "+{n} more lines",
	logged: "Everything the assistant does is logged in stock history with who confirmed it.",
	productEdit: {
		summary: {
			changed: "Changes {n}",
			filled: "fills {n} empty field{s}",
			photosAdded: "{n} new photo{s}",
			photosRemoved: "takes off {n} photo{s}",
			variantsAdded: "{n} new variant{s}",
			variantsChanged: "changes {n} variant{s}",
			variantsArchived: "archives {n} variant{s}",
		},
		changedTitle: "Changes to current values",
		changedRemovedTitle: "Changes and removals",
		filledTitle: "Fills empty fields",
		sections: {
			basics: "Basics",
			attributes: "Attributes",
			price: "Price",
			shipping: "Shipping",
			seo: "SEO",
			photos: "Photos",
			codes: "Barcodes",
			categories: "Categories",
			associations: "Related products",
			store: "Web store",
			channels: "Channels",
			publish: "Publish",
		},
		photosTitle: "Photos",
		variantsTitle: "Variants",
		variantColumn: "Variant",
		priceColumn: "Price",
		photoTag: { main: "Main", added: "New", removed: "Off" },
		variantChange: { added: "New", changed: "Changed", archived: "Archived", paused: "Paused" },
		removedPhoto: "Photo {n}",
		removedPhotoNote: "Taken off the product, stays in your library",
		archivedVariant: "Variant {name}",
		archivedVariantNote: "Archived — stops selling, not deleted",
		cleared: "Cleared",
		cells: { SKU: "SKU", Barcode: "Barcode", Photo: "New photo", Status: "Status" },
		draftNote: "Goes into the product's draft; sales channels change only when you publish.",
		undoArchives: "Undo archives {names} — variants can't be deleted.",
		sharedAlt: "Alt text is saved on the picture in your library, so it shows wherever that picture is used.",
		undoneArchived: "{names} archived.",
		moreFilled: "+{n} more field{s}",
		showAll: "Show all",
		showLess: "Show less",
	},
	daysLeft: "{n} day{s} left",
	revertedNote: "The product is back to how it was before this edit.",
	openProduct: "Open product",
	askedBy: "Asked by {name}",
	askedByTeammate: "Asked by a teammate",
	needsOwnerOrAdmin: "An owner or admin needs to approve this.",
	notYours: "Only the person who asked, or an owner or admin, can decide this.",
};

/** What a host overrides: any label, and any of the product edit card's. */
export type DraftLabelOverrides = Partial<Omit<DraftLabels, "productEdit">> & { productEdit?: Partial<DraftLabels["productEdit"]> };

export { fill };

/** Required / optional attribute counts — a field counts once it has a value. */
export function attributeCounts(doc: ProductDraftDoc) {
	const of = (group: "required" | "optional") => {
		const fields = doc.fields.filter((f) => f.group === group);
		return { done: fields.filter((f) => f.source !== "missing").length, all: fields.length };
	};
	return { required: of("required"), optional: of("optional") };
}

function plural(label: string, n: number): string {
	const word = label.toLowerCase();
	return n === 1 || word.endsWith("s") ? word : `${word}s`;
}

/** "2 colours × 4 sizes · 8 SKUs" */
export function variantSummary(doc: ProductDraftDoc, labels: DraftLabels): string | null {
	const variants = doc.variants;
	if (!variants || variants.rows.length === 0) return null;
	const axes = variants.axes.map((axis) => {
		const values = new Set(variants.rows.flatMap((row) => row.values.filter((v) => v.axis === axis.code).map((v) => v.value)));
		return `${values.size} ${plural(axis.label, values.size)}`;
	});
	const skus = fill(labels.skus, { n: variants.rows.length });
	return axes.length > 0 ? `${axes.join(" × ")} · ${skus}` : skus;
}

export function originSummary(images: readonly DraftImage[], labels: DraftLabels): string {
	const origins = new Set(images.map((i) => i.origin));
	const [only] = origins;
	return origins.size === 1 && only ? labels.origin[only] : labels.origin.mixed;
}

function bg(url: string | undefined) {
	return url ? { backgroundImage: `url("${url.replace(/"/g, "%22")}")` } : undefined;
}

/**
 * What the host knows about an applied change's Undo: why it would be refused right now (the button is
 * disabled and says so), another word for it ("Restore previous version"), a short line beside it.
 */
export interface CardUndoState {
	blocked?: string;
	label?: string;
	note?: string;
}

/** a note Auto-approve leaves on a card it could not apply (yet) */
export interface AutoApproveNotice {
	text: string;
	/** a failure (shown as an error) rather than "waiting" */
	error: boolean;
}

export interface DraftCardProps {
	changeSet: ChangeSet;
	/** this draft is open in the wide review on the right */
	open?: boolean;
	/** `confirm`: echoes `changeSet.confirmText` once the approver said Yes to a destructive change */
	onApprove?: (confirm?: string) => Promise<unknown> | void;
	/** applied change with undo data → put the record back */
	onUndo?: () => Promise<unknown> | void;
	/** the host's word on that Undo: blocked (with the reason), relabelled, annotated */
	undoState?: CardUndoState;
	/** inventory proposal → the inventory screen's own sheet, prefilled (nothing is approved) */
	onEditInSheet?: () => void;
	/** turn the proposal down */
	onDismiss?: () => Promise<unknown> | void;
	onReview?: () => void;
	/** approved draft → its editor; pending draft → approve, then open */
	onOpenEditor?: () => Promise<unknown> | void;
	/**
	 * Site changes, inside the site editor: a section / menu / page of the change
	 * → that place on the canvas. Replaces "Open in editor" there (you are in it).
	 */
	onLocate?: (diff: FieldDiff) => void;
	/**
	 * Auto-approve is on: a site change is applied as it lands, so its lines start
	 * folded. Off, a waiting change opens in full to be approved by hand.
	 */
	autoApprove?: boolean;
	/** a line under the card: Auto-approve is waiting for the merchant to finish editing, or could not apply it */
	notice?: AutoApproveNotice;
	labels?: DraftLabelOverrides;
}

function ProductBody({ doc, more, labels }: { doc: ProductDraftDoc; more: number; labels: DraftLabels }) {
	const counts = attributeCounts(doc);
	const main = doc.images.find((i) => i.role === "main") ?? doc.images[0];
	const variants = variantSummary(doc, labels);
	const requiredOk = counts.required.done === counts.required.all;
	const sub = [doc.price, doc.family?.label].filter(Boolean).join(" · ");
	return {
		thumb: main?.url,
		title: doc.name,
		sub: more > 0 ? `${sub}${sub ? " · " : ""}${fill(labels.moreProducts, { n: more })}` : sub,
		facts: (
			<dl className="ech-ag-facts">
				{doc.catalog !== "shop" && (
					<div>
						<dt>{labels.family}</dt>
						<dd className={doc.family ? undefined : "ech-ag-warn"}>{doc.family?.label ?? labels.none}</dd>
					</div>
				)}
				{counts.required.all > 0 && (
					<div>
						<dt>{labels.required}</dt>
						<dd className={requiredOk ? "ech-ag-ok" : "ech-ag-warn"}>
							{requiredOk && <Icon name="check" size={14} />}
							{fill(labels.ofAll, counts.required)}
						</dd>
					</div>
				)}
				{counts.optional.all > 0 && (
					<div>
						<dt>{labels.optional}</dt>
						<dd className={counts.optional.done < counts.optional.all ? "ech-ag-warn" : undefined}>
							{fill(labels.filled, counts.optional)}
						</dd>
					</div>
				)}
				<div>
					<dt>{labels.variants}</dt>
					<dd>{variants ?? labels.none}</dd>
				</div>
				<div>
					<dt>{labels.images}</dt>
					<dd className={doc.images.length === 0 ? "ech-ag-warn" : undefined}>
						{doc.images.length > 0 ? `${doc.images.length} · ${originSummary(doc.images, labels)}` : labels.none}
					</dd>
				</div>
			</dl>
		),
	};
}

function BlogBody({ doc, labels }: { doc: BlogDraftDoc; labels: DraftLabels }) {
	const images = [...(doc.cover ? [doc.cover] : []), ...doc.images].slice(0, 4);
	const stats = fill(labels.blogStats, { words: doc.words.toLocaleString("en"), sections: doc.sections });
	return {
		cover: doc.cover?.url,
		title: doc.title,
		sub: doc.seo ? `${stats} · ${labels.seoReady}` : stats,
		thumbs:
			images.length > 0 ? (
				<div className="ech-ag-thumbs">
					{images.map((image, i) => (
						<span key={`${image.url}-${i}`} style={bg(image.url)} title={image.credit ?? image.alt}>
							{i === 0 && doc.cover ? <em>{labels.cover}</em> : image.origin === "upload" ? <em>{labels.yours}</em> : null}
						</span>
					))}
				</div>
			) : null,
	};
}

/**
 * A staged draft in the chat: what approving creates (product master or
 * blog post) and the decision. When the wide review is open on the right,
 * the card shrinks to a reference.
 */
/** An inventory proposal: lines with before → after, the effect, a why grounded in real stock, the rule that applies. */
function InventoryBody({ doc, labels }: { doc: InventoryDraftDoc; labels: DraftLabels }) {
	return (
		<div className="ech-ag-inv">
			{doc.lines.map((line, index) => (
				<div key={`${line.sku ?? line.name}:${index}`} className="ech-ag-inv-line">
					<span className="ech-ag-inv-th" style={bg(line.imageUrl)}>
						{!line.imageUrl && <Icon name="package" size={16} />}
					</span>
					<span className="ech-ag-inv-text">
						<b>{line.name}</b>
						{line.detail && <span>{line.detail}</span>}
					</span>
					{line.quantity && (
						<em className="ech-ag-inv-qty" data-sign={line.quantity.startsWith("−") ? "neg" : line.quantity.startsWith("+") ? "pos" : undefined}>
							{line.quantity}
						</em>
					)}
				</div>
			))}
			{doc.more ? <div className="ech-ag-change-more">{fill(labels.moreLines, { n: doc.more })}</div> : null}
			{doc.effect && <p className="ech-ag-inv-effect">{doc.effect}</p>}
			{doc.why && (
				<p className="ech-ag-inv-why">
					<b>{labels.why}:</b> {doc.why}
				</p>
			)}
			{doc.rule && <p className="ech-ag-inv-rule">{doc.rule}</p>}
			<p className="ech-ag-inv-rule">{labels.logged}</p>
		</div>
	);
}

const NOTE_RULES = new Set(["reversible", "live", "working_draft", "pictures_kept", "undo"]);

/** Product Store / Discounts / Orders changes the copilot stages: grouped lines like a site change, with nothing to open in the editor. */
const STORE_PATCHES = new Set(["store.categories_patch", "store.discounts_patch", "store.customers_patch", "store.orders_patch"]);

function fieldLabel(field: string, labels: DraftLabels): string {
	if (field.startsWith("attribute.")) return field.slice("attribute.".length);
	return labels.fields[field] ?? field;
}

/** Before → after of an edit / status change, and the safety notes that apply. */
function ChangeRows({ changeSet, labels }: { changeSet: ChangeSet; labels: DraftLabels }) {
	const rows = changeSet.diffs.slice(0, 4);
	const more = changeSet.diffs.length - rows.length;
	const notes = changeSet.guardrails.filter((g) => (g.ok && NOTE_RULES.has(g.rule)) || !g.ok);
	return (
		<div className="ech-ag-changes">
			{rows.map((diff) => (
				<div key={`${diff.entity.id}:${diff.field}`} className="ech-ag-change">
					<span className="ech-ag-change-k">{fieldLabel(diff.field, labels)}</span>
					<span className="ech-ag-change-v">
						{changeSet.action?.kind !== "store.add_products" && (
							<>
								<s data-empty={diff.before ? undefined : ""}>{diff.before || labels.empty}</s>
							</>
						)}
						<b>
							{changeSet.action?.kind !== "store.add_products" && <Icon name="arrow-right" size={12} />}
							{diff.after}
						</b>
						{diff.field === "cover" && coverUrl(changeSet) && <span className="ech-ag-change-pic" style={bg(coverUrl(changeSet))} />}
					</span>
				</div>
			))}
			{more > 0 && <div className="ech-ag-change-more">{fill(labels.moreChanges, { n: more })}</div>}
			{notes.length > 0 && (
				<ul className="ech-ag-change-notes">
					{notes.map((note) => (
						<li key={note.rule + note.detail} data-ok={note.ok ? "" : undefined}>
							{note.detail}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** The new cover an edit sets (same-origin or http(s) only). */
function coverUrl(changeSet: ChangeSet): string | undefined {
	const url = (changeSet.action?.payload as { changes?: { cover?: { url?: unknown } } } | undefined)?.changes?.cover?.url;
	return typeof url === "string" && (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url)) ? url : undefined;
}

export function DraftCard({
	changeSet,
	open,
	onApprove,
	onUndo,
	undoState,
	onReview,
	onOpenEditor,
	onEditInSheet,
	onDismiss,
	onLocate,
	autoApprove = false,
	notice,
	labels: overrides,
}: DraftCardProps) {
	const labels = { ...DEFAULT_DRAFT_LABELS, ...overrides, productEdit: { ...DEFAULT_DRAFT_LABELS.productEdit, ...overrides?.productEdit } };
	const [busy, setBusy] = useState<"approve" | "open" | "undo" | "dismiss" | null>(null);
	// a change flagged `confirmText` asks Yes / No before it applies (no typing the name)
	const [asking, setAsking] = useState(false);
	const actionKind = changeSet.action?.kind ?? "";
	const isEdit = actionKind.endsWith(".update");
	const isStatus = actionKind.endsWith(".set_status");
	const firstDoc = changeSet.drafts?.[0];
	const inventory = firstDoc?.type === "inventory" ? firstDoc : undefined;
	const changesRecord = isEdit || isStatus || actionKind === "store.add_products" || Boolean(inventory);
	// the Product Store's categories and the discounts read like a site change: grouped lines, folded once approved
	const siteChange = actionKind.startsWith("site.") || STORE_PATCHES.has(actionKind);
	// in the site editor a site change is shown on the canvas, never opened (which would approve a pending one)
	const locateHere = siteChange && Boolean(onLocate);
	const confirmText = changeSet.confirmText;
	const undo = changeSet.result?.undo;
	// not the caller's to decide (a viewer's own draft, a teammate's): no Approve / Discard / Undo, one sentence says why
	const decides = canDecideDraft(changeSet);
	const blocked = decideBlockedLine(changeSet, labels);
	const askedBy = askedByLine(changeSet, labels);
	const canUndo = Boolean(decides && onUndo && changeSet.status === "applied" && undo && new Date(undo.until).getTime() > Date.now());
	const [error, setError] = useState<string | null>(null);
	const doc = changeSet.drafts?.[0];
	const pending = changeSet.status === "pending";
	const editorLink = changeSet.result?.links[0];
	// a site change opens only when it waits for a hand approval (always for a typed confirmation)
	const [expanded, setExpanded] = useState(() => pending && (!autoApprove || Boolean(confirmText) || changeSet.requiresClick === true));
	// approved by hand: it folds, the canvas now shows it
	const wasPending = useRef(pending);
	useEffect(() => {
		if (wasPending.current && !pending) setExpanded(false);
		wasPending.current = pending;
	}, [pending]);

	const run = (kind: "approve" | "open" | "undo" | "dismiss", action: (() => Promise<unknown> | void) | undefined) => async () => {
		if (!action) return;
		setBusy(kind);
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");
		} finally {
			setBusy(null);
		}
	};

	const product = doc?.type === "product" ? ProductBody({ doc, more: (changeSet.drafts?.length ?? 1) - 1, labels }) : null;
	const blog = doc?.type === "blog" ? BlogBody({ doc, labels }) : null;
	const edit = doc?.type === "product_edit" ? doc : undefined;
	// a store record (discount, category, order, customer…) or a shop product is not opened in "the editor": say what opens
	const shopProduct = doc?.type === "product" && doc.catalog === "shop";
	const openLabel = edit && !pending ? labels.openProduct : shopProduct ? labels.openProduct : STORE_PATCHES.has(actionKind) && editorLink ? editorLink.label : labels.openEditor;
	const kicker =
		doc?.type === "product"
			? labels.productDraft
			: doc?.type === "blog"
				? labels.blogDraft
				: inventory
					? labels.inventory
					: changeSet.action?.kind === "store.add_products"
					? labels.storeAdd
					: edit?.sections.some((section) => section.key === "publish")
						? (labels.productEdit.sections.publish ?? labels.edit)
						: isEdit
						? labels.edit
						: isStatus
							? labels.statusChange
							: labels.draft;
	const statusLabel =
		busy === "approve"
			? labels.approving
			: busy === "undo"
				? labels.undoing
				: changeSet.status === "applied" && changesRecord
					? labels.saved
					: labels.status[changeSet.status];
	const title = product?.title ?? blog?.title ?? inventory?.action ?? edit?.name ?? changeSet.title;
	// an inventory card carries its "why" in the body
	const sub = product?.sub ?? blog?.sub ?? (inventory ? undefined : changeSet.summary);

	return (
		<div className="ech-ag-draft" data-open={open ? "" : undefined} data-status={changeSet.status}>
			{blog?.cover && <div className="ech-ag-cover" style={bg(blog.cover)} />}
			<div className={`ech-ag-draft-top${product || edit ? "" : " no-thumb"}`} style={blog ? { padding: "12px 14px 6px" } : undefined}>
				{(product || edit) && (
					<span className="ech-ag-th" style={bg(product?.thumb ?? edit?.imageUrl)}>
						{!(product?.thumb ?? edit?.imageUrl) && <Icon name="package" size={22} />}
					</span>
				)}
				<div style={{ minWidth: 0 }}>
					<div className="ech-ag-kicker">
						{kicker}
						<span className="ech-ag-state" data-status={changeSet.status} data-risk={changeSet.risk}>
							{statusLabel}
						</span>
					</div>
					<h3 title={title}>{title}</h3>
					{sub && <div className="ech-ag-sub">{sub}</div>}
					{askedBy && <div className="ech-ag-asked-by">{askedBy}</div>}
				</div>
			</div>
			{changeSet.status !== "rejected" && product?.facts}
			{blog?.thumbs}
			{inventory && <InventoryBody doc={inventory} labels={labels} />}
			{changeSet.status !== "rejected" && !doc && changesRecord && <ChangeRows changeSet={changeSet} labels={labels} />}
			{changeSet.status !== "rejected" && !doc && siteChange && changeSet.diffs.length > 0 && (
				<SiteChangeRows
					changeSet={changeSet}
					labels={labels}
					fieldName={(field) => fieldLabel(field, labels)}
					notes={changeSet.guardrails.filter((g) => (g.ok && NOTE_RULES.has(g.rule)) || !g.ok)}
					expanded={expanded}
					onExpandedChange={setExpanded}
					onLocate={onLocate}
				/>
			)}
			{edit && changeSet.status !== "rejected" && <ProductEditBody doc={edit} changeSet={changeSet} labels={labels.productEdit} />}
			{error && (
				<p className="ech-ag-draft-error" role="alert">
					{error}
				</p>
			)}
			{!error && pending && notice && (
				<p className={notice.error ? "ech-ag-draft-error" : "ech-ag-pe-note"} role={notice.error ? "alert" : "status"}>
					{notice.text}
				</p>
			)}
			{edit && changeSet.status === "reverted" && (
				<div className="ech-ag-draft-foot">
					<span className="ech-ag-pe-note">
						{labels.revertedNote}
						{edit.undo?.archivesVariants?.length ? ` ${fill(labels.productEdit.undoneArchived, { names: edit.undo.archivesVariants.slice(0, 4).join(", ") })}` : ""}
					</span>
				</div>
			)}
			{!(edit && changeSet.status === "reverted") && (pending || editorLink || canUndo) && (
				<div className="ech-ag-draft-foot">
					{pending && blocked && (
						<span className="ech-ag-pe-note ech-ag-decide-note" role="note">
							{blocked}
						</span>
					)}
					{pending && decides && confirmText && asking && (
						<div className="ech-ag-confirm-ask" role="group" aria-label={fill(labels.confirmAsk, { name: confirmText })}>
							<span>{fill(labels.confirmAsk, { name: confirmText })}</span>
							<button
								type="button"
								className="ech-ag-button is-sm is-danger"
								disabled={busy !== null}
								onClick={run("approve", onApprove ? () => onApprove(confirmText) : undefined)}
							>
								{busy === "approve" && <Icon name="loader-circle" className="ech-ag-spin" size={14} />}
								{labels.confirmYes}
							</button>
							<button type="button" className="ech-ag-button is-ghost is-sm" disabled={busy !== null} onClick={() => setAsking(false)}>
								{labels.confirmNo}
							</button>
						</div>
					)}
					{pending && !(confirmText && asking) && (
						<>
							{decides && (
								<button
									type="button"
									className={`ech-ag-button is-sm ${confirmText ? "is-danger" : "is-primary"}`}
									disabled={busy !== null}
									onClick={confirmText ? () => setAsking(true) : run("approve", onApprove ? () => onApprove() : undefined)}
								>
									{busy === "approve" && <Icon name="loader-circle" className="ech-ag-spin" size={14} />}
									{inventory ? (inventory.capability.startsWith("transfer.send") ? labels.send : labels.save) : labels.approve}
								</button>
							)}
							{decides && inventory && onEditInSheet && inventory.prefill && (
								<button type="button" className="ech-ag-button is-sm" disabled={busy !== null} onClick={onEditInSheet}>
									{labels.openToEdit}
								</button>
							)}
							{decides && inventory && onDismiss && (
								<button type="button" className="ech-ag-button is-ghost is-sm ech-ag-dismiss" disabled={busy !== null} onClick={run("dismiss", onDismiss)}>
									{labels.dismiss}
								</button>
							)}
							{onReview && (
								<button type="button" className="ech-ag-button is-sm" disabled={busy !== null} onClick={onReview}>
									{doc?.type === "blog" ? labels.preview : labels.review}
								</button>
							)}
						</>
					)}
					{canUndo && (
						<button
							type="button"
							className="ech-ag-button is-sm"
							disabled={busy !== null || Boolean(undoState?.blocked)}
							title={undoState?.blocked}
							onClick={run("undo", onUndo)}
						>
							{busy === "undo" ? <Icon name="loader-circle" className="ech-ag-spin" size={14} /> : <Icon name="rotate-ccw" size={14} />}
							{undoState?.label ?? labels.undo}
						</button>
					)}
					{/* a sentence, not a label: its own line under the buttons (beside them it is squeezed into a column) */}
					{canUndo && (undoState?.blocked || undoState?.note) && <span className="ech-ag-pe-note ech-ag-undo-note">{undoState.blocked ?? undoState.note}</span>}
					{canUndo && edit && undo && <span className="ech-ag-pe-note">{fill(labels.daysLeft, { n: Math.max(1, Math.ceil((new Date(undo.until).getTime() - Date.now()) / 86_400_000)) })}</span>}
					{onOpenEditor && !inventory && !locateHere && (pending ? decides : editorLink) && !(pending && confirmText) && !(pending && STORE_PATCHES.has(actionKind)) && (
						<button
							type="button"
							className="ech-ag-link"
							disabled={busy !== null}
							onClick={run("open", onOpenEditor)}
							title={pending && !edit ? "Creates the draft, then opens it in the editor" : undefined}
						>
							{openLabel}
							<Icon name="arrow-up-right" size={14} />
						</button>
					)}
					{/* any waiting change can be dropped from its card (inventory keeps its worded Dismiss) */}
					{pending && decides && !inventory && onDismiss && (
						<button
							type="button"
							className="ech-ag-ib ech-ag-discard"
							aria-label={labels.discard}
							title={labels.discardHint}
							disabled={busy !== null}
							onClick={run("dismiss", onDismiss)}
						>
							{busy === "dismiss" ? <Icon name="loader-circle" className="ech-ag-spin" size={15} /> : <Icon name="trash" size={15} />}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
