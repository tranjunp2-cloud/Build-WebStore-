import type { BlogDraftDoc, ChangeSet, DraftField, FieldSource, ProductDraftDoc } from "@ech/agent-core";
import { useMemo, useRef, useState } from "react";
import { askedByLine, canDecideDraft, decideBlockedLine, isTeammateDraft } from "./draft-access";
import { attributeCounts, DEFAULT_DRAFT_LABELS, DraftCard, type DraftLabelOverrides, fill, originSummary } from "./draft-card";
import { Icon } from "./icons";
import { ProductEditBody } from "./product-edit-body";

export interface ReviewLabels {
	region: string;
	sections: { product: string; attributes: string; variants: string; media: string; seo: string; article: string; images: string };
	productSection: string;
	required: string;
	optional: string;
	seo: string;
	/** "{n} optional missing" / "{n} required missing" */
	optionalMissing: string;
	requiredMissing: string;
	/** "{n} optional not set" — the folded line */
	optionalUnset: string;
	showUnset: string;
	hideUnset: string;
	notSet: string;
	source: Record<FieldSource, string>;
	variantCols: [string, string, string, string];
	/** "+ {n} more" */
	moreRows: string;
	stockZero: string;
	media: string;
	main: string;
	noImages: string;
	nothingSaved: string;
	askChanges: string;
	approveProduct: string;
	approveBlog: string;
	/** a Product Master edit */
	approveEdit: string;
	previewTitle: string;
	swapCover: string;
	/** "SEO: “{title}” · {n} chars" */
	seoLine: string;
	empty: string;
	decided: string;
}

export const DEFAULT_REVIEW_LABELS: ReviewLabels = {
	region: "Draft review",
	sections: {
		product: "Product",
		attributes: "Attributes",
		variants: "Variants",
		media: "Media",
		seo: "SEO",
		article: "Article",
		images: "Images",
	},
	productSection: "Product",
	required: "Required attributes",
	optional: "Optional attributes",
	seo: "SEO",
	optionalMissing: "{n} optional missing",
	requiredMissing: "{n} required missing",
	optionalUnset: "{n} optional not set",
	showUnset: "Show",
	hideUnset: "Hide",
	notSet: "Not set",
	source: { you: "From you", ai: "AI", auto: "Picked for you", family: "Family default", missing: "Missing" },
	variantCols: ["Variant", "SKU", "Price", "Stock"],
	moreRows: "+ {n} more",
	stockZero: "stock stays 0 until you receive goods",
	media: "Media",
	main: "Main",
	noImages: "No images yet. Attach photos in the chat and ask for changes.",
	nothingSaved: "Nothing is saved until you approve.",
	askChanges: "Ask for changes",
	approveProduct: "Approve and create draft",
	approveBlog: "Approve",
	approveEdit: "Approve changes",
	previewTitle: "Preview · {title}",
	swapCover: "Swap cover",
	seoLine: "SEO: “{title}” · {n} chars",
	empty: "Drafts open here for review. Ask for a product or a blog post to start.",
	decided: "This draft was {status}.",
};

function bg(url: string | undefined) {
	return url ? { backgroundImage: `url("${url.replace(/"/g, "%22")}")` } : undefined;
}

function originLine(images: ProductDraftDoc["images"]): string {
	const text = originSummary(images, DEFAULT_DRAFT_LABELS);
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function Row({ field, labels }: { field: DraftField; labels: ReviewLabels }) {
	const missing = field.source === "missing" || !field.value;
	return (
		<div className="ech-ag-kv">
			<dt>{field.label}</dt>
			<dd className={missing ? "is-empty" : field.value.length > 60 ? "is-long" : undefined} title={missing ? undefined : field.value}>
				{missing ? labels.notSet : field.value}
			</dd>
			<span className={`ech-ag-src is-${field.source}`}>{labels.source[field.source]}</span>
		</div>
	);
}

type SectionKey = keyof ReviewLabels["sections"];

function Outline({
	items,
	current,
	onJump,
}: {
	items: Array<{ key: SectionKey; label: string; count?: string }>;
	current: SectionKey;
	onJump: (key: SectionKey) => void;
}) {
	return (
		<nav className="ech-ag-outline" aria-label="Sections">
			{items.map((item) => (
				<button
					key={item.key}
					type="button"
					aria-current={current === item.key ? "true" : undefined}
					onClick={() => onJump(item.key)}
				>
					{item.label}
					{item.count && <span className="ech-ag-n">{item.count}</span>}
				</button>
			))}
		</nav>
	);
}

function useSections() {
	const refs = useRef(new Map<SectionKey, HTMLElement>());
	const [current, setCurrent] = useState<SectionKey>("product");
	const bind = (key: SectionKey) => (el: HTMLElement | null) => {
		if (el) refs.current.set(key, el);
		else refs.current.delete(key);
	};
	const jump = (key: SectionKey) => {
		setCurrent(key);
		refs.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
	};
	return { bind, jump, current, setCurrent };
}

function ProductReview({ doc, labels }: { doc: ProductDraftDoc; labels: ReviewLabels }) {
	const { bind, jump, current } = useSections();
	const counts = attributeCounts(doc);
	const product = doc.fields.filter((f) => f.group === "product");
	const required = doc.fields.filter((f) => f.group === "required");
	const optional = doc.fields.filter((f) => f.group === "optional");
	// optional fields nobody filled stay folded into one line until asked for
	const optionalFilled = optional.filter((f) => f.source !== "missing" && f.value);
	const optionalUnset = optional.filter((f) => f.source === "missing" || !f.value);
	const [showUnset, setShowUnset] = useState(false);
	const seo = doc.fields.filter((f) => f.group === "seo");
	const filledAttrs = counts.required.done + counts.optional.done;
	const allAttrs = counts.required.all + counts.optional.all;
	const rows = doc.variants?.rows ?? [];
	const shownRows = rows.slice(0, 4);
	const allZero = rows.length > 0 && rows.every((r) => (r.stock ?? 0) === 0);
	const items: Array<{ key: SectionKey; label: string; count?: string }> = [
		{ key: "product", label: labels.sections.product },
		...(allAttrs > 0 ? [{ key: "attributes" as const, label: labels.sections.attributes, count: `${filledAttrs}/${allAttrs}` }] : []),
		...(rows.length > 0 ? [{ key: "variants" as const, label: labels.sections.variants, count: String(rows.length) }] : []),
		{ key: "media", label: labels.sections.media, count: String(doc.images.length) },
		...(seo.length > 0 ? [{ key: "seo" as const, label: labels.sections.seo }] : []),
	];
	return (
		<>
			<Outline items={items} current={current} onJump={jump} />
			<section className="ech-ag-sec" ref={bind("product")}>
				<h4>
					{labels.productSection}
					{doc.family && <span>{doc.family.label}</span>}
				</h4>
				<dl>
					{product.map((f) => (
						<Row key={f.key} field={f} labels={labels} />
					))}
				</dl>
			</section>
			{required.length > 0 && (
				<section className="ech-ag-sec" ref={bind("attributes")}>
					<h4>
						{labels.required}
						<span>{fill("{done} of {all}", counts.required)}</span>
					</h4>
					<dl>
						{required.map((f) => (
							<Row key={f.key} field={f} labels={labels} />
						))}
					</dl>
				</section>
			)}
			{optional.length > 0 && (
				<section className="ech-ag-sec" ref={required.length === 0 ? bind("attributes") : undefined}>
					<h4>
						{labels.optional}
						<span>{fill("{done} of {all}", counts.optional)}</span>
					</h4>
					<dl>
						{optionalFilled.map((f) => (
							<Row key={f.key} field={f} labels={labels} />
						))}
						{showUnset &&
							optionalUnset.map((f) => <Row key={f.key} field={f} labels={labels} />)}
					</dl>
					{optionalUnset.length > 0 && (
						<button
							type="button"
							className="ech-ag-unset"
							aria-expanded={showUnset}
							onClick={() => setShowUnset((v) => !v)}
						>
							<span>
								{fill(labels.optionalUnset, { n: optionalUnset.length })}
								{!showUnset && <small> · {optionalUnset.slice(0, 3).map((f) => f.label).join(", ")}{optionalUnset.length > 3 ? "…" : ""}</small>}
							</span>
							<b>{showUnset ? labels.hideUnset : labels.showUnset}</b>
						</button>
					)}
				</section>
			)}
			{rows.length > 0 && doc.variants && (
				<section className="ech-ag-sec" ref={bind("variants")}>
					<h4>
						{labels.sections.variants}
						<span>{`${doc.variants.axes.map((a) => a.label).join(" × ")} · ${rows.length} SKUs`}</span>
					</h4>
					<div className="ech-ag-vgrid" role="table">
						{labels.variantCols.map((col) => (
							<span key={col} className="ech-ag-h" role="columnheader">
								{col}
							</span>
						))}
						{shownRows.map((row) => [
							<span key={`${row.sku}-l`}>{row.label}</span>,
							<span key={`${row.sku}-s`} className="ech-ag-sku">
								{row.sku}
							</span>,
							<span key={`${row.sku}-p`}>{row.price ?? doc.price ?? "—"}</span>,
							<span key={`${row.sku}-q`} style={{ color: "var(--ech-ag-ink-3)" }}>
								{row.stock ?? 0}
							</span>,
						])}
						{(rows.length > shownRows.length || allZero) && (
							<span className="ech-ag-more">
								{[rows.length > shownRows.length ? fill(labels.moreRows, { n: rows.length - shownRows.length }) : "", allZero ? labels.stockZero : ""]
									.filter(Boolean)
									.join(" · ")}
							</span>
						)}
					</div>
				</section>
			)}
			<section className="ech-ag-sec" ref={bind("media")}>
				<h4>
					{labels.media}
					{doc.images.length > 0 && <span>{originLine(doc.images)}</span>}
				</h4>
				{doc.images.length > 0 ? (
					<div className="ech-ag-media">
						{doc.images.map((image, i) => (
							<span key={`${image.url}-${i}`} style={bg(image.url)} title={image.credit ?? image.alt}>
								{(image.role === "main" || (i === 0 && !doc.images.some((x) => x.role === "main"))) && <em>{labels.main}</em>}
							</span>
						))}
					</div>
				) : (
					<p className="ech-ag-q-empty" style={{ margin: 0, padding: "12px 14px" }}>
						{labels.noImages}
					</p>
				)}
			</section>
			{seo.length > 0 && (
				<section className="ech-ag-sec" ref={bind("seo")}>
					<h4>{labels.seo}</h4>
					<dl>
						{seo.map((f) => (
							<Row key={f.key} field={f} labels={labels} />
						))}
					</dl>
				</section>
			)}
		</>
	);
}

const ALLOWED_TAGS = new Set(["H2", "H3", "P", "UL", "OL", "LI", "STRONG", "EM", "BR", "FIGURE", "IMG", "FIGCAPTION"]);

/** Allowlist sanitizer for the AI's article HTML — tags above, `src`/`alt` on images (https or same-origin only). */
export function sanitizeArticleHtml(html: string): string {
	if (typeof DOMParser === "undefined") return "";
	const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
	const root = doc.body.firstElementChild;
	if (!root) return "";
	const walk = (node: Element) => {
		for (const child of [...node.children]) {
			if (!ALLOWED_TAGS.has(child.tagName)) {
				child.replaceWith(...child.childNodes);
				continue;
			}
			for (const attr of [...child.attributes]) {
				const keep =
					child.tagName === "IMG" &&
					(attr.name === "alt" || (attr.name === "src" && /^(https:\/\/|\/(?!\/))/.test(attr.value)));
				if (!keep) child.removeAttribute(attr.name);
			}
			if (child.tagName === "IMG") child.setAttribute("loading", "lazy");
			walk(child);
		}
	};
	walk(root);
	// unwrapped children may have surfaced new disallowed nodes
	walk(root);
	return root.innerHTML;
}

function BlogReview({ doc, labels }: { doc: BlogDraftDoc; labels: ReviewLabels }) {
	const { bind, jump, current } = useSections();
	const html = useMemo(() => sanitizeArticleHtml(doc.html), [doc.html]);
	const images = doc.images.length + (doc.cover ? 1 : 0);
	return (
		<>
			<Outline
				items={[
					{ key: "product", label: labels.sections.article },
					{ key: "images", label: labels.sections.images, count: String(images) },
					...(doc.seo ? [{ key: "seo" as const, label: labels.sections.seo }] : []),
				]}
				current={current}
				onJump={jump}
			/>
			<article className="ech-ag-article" ref={bind("product")}>
				{doc.cover && <div className="ech-ag-cover" style={bg(doc.cover.url)} title={doc.cover.credit} />}
				<div className="ech-ag-body">
					<h1>{doc.title}</h1>
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by allowlist above */}
					<div style={{ display: "grid", gap: 10 }} dangerouslySetInnerHTML={{ __html: html }} />
				</div>
			</article>
			<section className="ech-ag-sec" ref={bind("images")}>
				<h4>{labels.sections.images}</h4>
				<div className="ech-ag-media">
					{[...(doc.cover ? [doc.cover] : []), ...doc.images].map((image, i) => (
						<span key={`${image.url}-${i}`} style={bg(image.url)} title={image.credit ?? image.alt}>
							{i === 0 && doc.cover && <em>{DEFAULT_DRAFT_LABELS.cover}</em>}
						</span>
					))}
				</div>
			</section>
			{doc.seo && (
				<section className="ech-ag-sec" ref={bind("seo")}>
					<h4>{labels.seo}</h4>
					<dl>
						<Row field={{ key: "seo_title", label: "Meta title", value: doc.seo.title, source: "ai", group: "seo" }} labels={labels} />
						<Row
							field={{ key: "seo_description", label: "Meta description", value: doc.seo.description, source: "ai", group: "seo" }}
							labels={labels}
						/>
					</dl>
				</section>
			)}
		</>
	);
}

export interface ReviewSheetProps {
	changeSet: ChangeSet | undefined;
	/** `confirm`: echoes `changeSet.confirmText` once the approver said Yes to a destructive change */
	onApprove?: (confirm?: string) => Promise<unknown> | void;
	onAskChanges?: () => void;
	/** turn the change down (nothing is applied); the sheet closes with it */
	onDiscard?: () => Promise<unknown> | void;
	/** blog only — opens the picture picker to choose another cover */
	onSwapCover?: () => void;
	labels?: Partial<ReviewLabels>;
	draftLabels?: DraftLabelOverrides;
	/** this draft is one of a campaign's linked cards: its other waiting cards can be approved with it, in order */
	campaign?: { tag: string; approveAll: string; onApproveAll: () => Promise<unknown> | void };
}

/** The wide review on the right: every field with where its value came from, approve or ask for changes. */
export function ReviewSheet({ changeSet, onApprove, onAskChanges, onDiscard, onSwapCover, labels: overrides, draftLabels, campaign }: ReviewSheetProps) {
	const labels = { ...DEFAULT_REVIEW_LABELS, ...overrides };
	const statusLabels = { ...DEFAULT_DRAFT_LABELS, ...draftLabels }.status;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// the wide review is for product / blog drafts; inventory proposals live in their card
	const first = changeSet?.drafts?.[0];
	const doc = first && first.type !== "inventory" ? first : undefined;
	// a change flagged `confirmText` asks Yes / No before it applies
	const [asking, setAsking] = useState(false);

	// a change with nothing to preview (a teammate's site / store change opened from the review list): its card, here
	if (changeSet && !doc) {
		return (
			<section className="ech-ag-sheet" aria-label={labels.region}>
				<div className="ech-ag-article">
					<DraftCard changeSet={changeSet} onApprove={onApprove} onDismiss={onDiscard} labels={draftLabels} />
				</div>
			</section>
		);
	}
	if (!changeSet || !doc) {
		return (
			<section className="ech-ag-sheet" aria-label={labels.region}>
				<div style={{ display: "grid", placeItems: "center", height: "100%", padding: 32, textAlign: "center", color: "var(--ech-ag-ink-3)" }}>
					<div>
						<Icon name="square-pen" size={20} />
						<p style={{ margin: "8px 0 0", maxWidth: "34ch" }}>{labels.empty}</p>
					</div>
				</div>
			</section>
		);
	}

	const approve = async (all = false) => {
		const action = all ? campaign?.onApproveAll : onApprove && (() => onApprove(changeSet?.confirmText));
		if (!action) return;
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch (e) {
			setError(e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");
		} finally {
			setBusy(false);
		}
	};

	const discard = async () => {
		if (!onDiscard) return;
		setBusy(true);
		setError(null);
		try {
			await onDiscard();
		} catch (e) {
			setError(e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");
		} finally {
			setBusy(false);
		}
	};
	const discardLabel = { ...DEFAULT_DRAFT_LABELS, ...draftLabels };
	const discardButton = onDiscard && (
		<button type="button" className="ech-ag-ib ech-ag-discard" aria-label={discardLabel.discard} title={discardLabel.discardHint} disabled={busy} onClick={() => void discard()}>
			<Icon name="trash" size={15} />
		</button>
	);

	// the platform's word for this caller: who asked (a teammate's draft), and whether they may approve / discard it
	const accessLabels = { ...DEFAULT_DRAFT_LABELS, ...draftLabels };
	const askedBy = askedByLine(changeSet, accessLabels);
	const blocked = decideBlockedLine(changeSet, accessLabels);
	const pending = changeSet.status === "pending";
	const decidable = pending && canDecideDraft(changeSet);
	let badge: { text: string; tone: FieldSource } | null = null;
	if (doc.type === "product") {
		const counts = attributeCounts(doc);
		const req = counts.required.all - counts.required.done;
		const opt = counts.optional.all - counts.optional.done;
		if (req > 0) badge = { text: fill(labels.requiredMissing, { n: req }), tone: "missing" };
		else if (opt > 0) badge = { text: fill(labels.optionalMissing, { n: opt }), tone: "missing" };
	}

	if (doc.type === "product_edit") {
		const draft = { ...DEFAULT_DRAFT_LABELS, ...draftLabels, productEdit: { ...DEFAULT_DRAFT_LABELS.productEdit, ...draftLabels?.productEdit } };
		const confirmText = changeSet.confirmText;
		return (
			<section className="ech-ag-sheet" aria-label={labels.region}>
				<div className="ech-ag-sheet-head">
					<h2>{doc.name}</h2>
					{doc.sku && <span className="ech-ag-pe-sku">{doc.sku}</span>}
					{askedBy && <span className="ech-ag-asked-by">{askedBy}</span>}
				</div>
				<div className="ech-ag-article ech-ag-pe-sheet">
					<ProductEditBody doc={doc} changeSet={changeSet} labels={draft.productEdit} folded={false} />
				</div>
				<div className="ech-ag-sheet-foot">
					<span className="ech-ag-note" role={error ? "alert" : undefined} style={error ? { color: "var(--ech-ag-red)" } : undefined}>
						{error ?? (!pending ? fill(labels.decided, { status: (changeSet.status === "applied" ? draft.saved : statusLabels[changeSet.status]).toLowerCase() }) : (blocked ?? labels.nothingSaved))}
					</span>
					{decidable && (
						<>
							{discardButton}
							{onAskChanges && !isTeammateDraft(changeSet) && (
								<button type="button" className="ech-ag-button" disabled={busy} onClick={onAskChanges}>
									{labels.askChanges}
								</button>
							)}
							{confirmText && asking ? (
								<span className="ech-ag-confirm-ask" role="group" aria-label={fill(draft.confirmAsk, { name: confirmText })}>
									<span>{fill(draft.confirmAsk, { name: confirmText })}</span>
									<button type="button" className="ech-ag-button is-danger" disabled={busy} onClick={() => void approve()}>
										{busy && <Icon name="loader-circle" className="ech-ag-spin" size={14} />}
										{draft.confirmYes}
									</button>
									<button type="button" className="ech-ag-button is-ghost" disabled={busy} onClick={() => setAsking(false)}>
										{draft.confirmNo}
									</button>
								</span>
							) : (
								<button
									type="button"
									className={`ech-ag-button ${confirmText ? "is-danger" : "is-primary"}`}
									disabled={busy}
									onClick={confirmText ? () => setAsking(true) : () => void approve()}
								>
									{busy && <Icon name="loader-circle" className="ech-ag-spin" size={14} />}
									{labels.approveEdit}
								</button>
							)}
						</>
					)}
				</div>
			</section>
		);
	}

	return (
		<section className="ech-ag-sheet" aria-label={labels.region}>
			<div className="ech-ag-sheet-head">
				<h2>{doc.type === "product" ? doc.name : fill(labels.previewTitle, { title: doc.title })}</h2>
				{badge && <span className={`ech-ag-src is-${badge.tone}`}>{badge.text}</span>}
				{askedBy && <span className="ech-ag-asked-by">{askedBy}</span>}
				{doc.type === "blog" && decidable && !isTeammateDraft(changeSet) && onSwapCover && (
					<button type="button" className="ech-ag-button is-sm" onClick={onSwapCover}>
						<Icon name="image" />
						{labels.swapCover}
					</button>
				)}
			</div>
			{doc.type === "product" ? <ProductReview doc={doc} labels={labels} /> : <BlogReview doc={doc} labels={labels} />}
			<div className="ech-ag-sheet-foot">
				<span className="ech-ag-note" role={error ? "alert" : undefined} style={error ? { color: "var(--ech-ag-red)" } : undefined}>
					{error ??
						(!pending
							? fill(labels.decided, { status: statusLabels[changeSet.status].toLowerCase() })
							: blocked
								? blocked
								: doc.type === "blog" && doc.seo
								? fill(labels.seoLine, { title: doc.seo.title, n: doc.seo.description.length })
								: labels.nothingSaved)}
				</span>
				{decidable && (
					<>
						{discardButton}
						{onAskChanges && !isTeammateDraft(changeSet) && (
							<button type="button" className="ech-ag-button" disabled={busy} onClick={onAskChanges}>
								{labels.askChanges}
							</button>
						)}
						{campaign && !changeSet.confirmText && (
							<button type="button" className="ech-ag-button" title={campaign.tag} disabled={busy} onClick={() => void approve(true)}>
								{campaign.approveAll}
							</button>
						)}
						<button type="button" className="ech-ag-button is-primary" disabled={busy} onClick={() => void approve()}>
							{busy && <Icon name="loader-circle" className="ech-ag-spin" size={14} />}
							{doc.type === "product" ? labels.approveProduct : labels.approveBlog}
						</button>
					</>
				)}
			</div>
		</section>
	);
}
