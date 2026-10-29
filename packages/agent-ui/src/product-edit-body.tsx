import type { ChangeSet, EditPhoto, ProductEditDoc } from "@ech/agent-core";
import { type ReactNode, useState } from "react";
import { fill } from "./fill";
import { Icon } from "./icons";

/** Words of the Product Master edit card (defaults in DEFAULT_DRAFT_LABELS.productEdit). */
export interface ProductEditLabels {
	/** "Sửa {n}" … one template per part of the summary line */
	summary: Record<"changed" | "filled" | "photosAdded" | "photosRemoved" | "variantsAdded" | "variantsChanged" | "variantsArchived", string>;
	/** "Sửa giá trị đang có" / with removals "Sửa hoặc gỡ thứ đang có" */
	changedTitle: string;
	changedRemovedTitle: string;
	filledTitle: string;
	/** sub-heading per editor section: basics, attributes, price, shipping, seo, codes */
	sections: Record<string, string>;
	photosTitle: string;
	variantsTitle: string;
	variantColumn: string;
	priceColumn: string;
	photoTag: Record<"main" | "added" | "removed", string>;
	variantChange: Record<"added" | "changed" | "archived" | "paused", string>;
	/** "Ảnh {n}" — a photo the change takes off */
	removedPhoto: string;
	removedPhotoNote: string;
	/** "Biến thể {name}" */
	archivedVariant: string;
	archivedVariantNote: string;
	/** a value the change clears */
	cleared: string;
	/** variant table second line: SKU, Barcode, Photo, Status */
	cells: Record<string, string>;
	draftNote: string;
	/** "Hoàn tác sẽ lưu trữ {names} — biến thể không xoá được." */
	undoArchives: string;
	sharedAlt: string;
	/** after Undo: "{names} đã được lưu trữ." */
	undoneArchived: string;
	/** "+{n} trường nữa" */
	moreFilled: string;
	showAll: string;
	showLess: string;
}

/** Filled values shown before the rest fold behind "show all". */
const FILLED_FOLDED = 12;


/** Same-origin or http(s) pictures only. */
function bg(url: string | undefined) {
	return url && (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url)) ? { backgroundImage: `url("${url.replace(/"/g, "%22")}")` } : undefined;
}

function photoTag(photo: EditPhoto, labels: ProductEditLabels): string | null {
	if (photo.removed) return labels.photoTag.removed;
	if (photo.cover) return labels.photoTag.main;
	return photo.added ? labels.photoTag.added : null;
}

/**
 * A Product Master edit, ordered by risk: what it overwrites or takes off
 * first, the empty fields it fills grouped by editor section, the photos
 * after the change and the variants that change. Nothing here decides; the
 * card's footer approves.
 */
export function ProductEditBody({
	doc,
	changeSet,
	labels,
	folded = true,
}: {
	doc: ProductEditDoc;
	changeSet: ChangeSet;
	labels: ProductEditLabels;
	/** the chat card folds long fills; the wide review shows everything */
	folded?: boolean;
}) {
	const [open, setOpen] = useState(!folded);
	const rows = doc.sections.flatMap((section) => section.rows.map((row) => ({ ...row, section: section.key })));
	const changed = rows.filter((row) => row.before !== null);
	const filled = rows.filter((row) => row.before === null);
	const photos = doc.photos?.items ?? [];
	const removedPhotos = photos.flatMap((photo, index) => (photo.removed ? [{ photo, n: index + 1 }] : []));
	const variants = doc.variants?.rows ?? [];
	const archived = variants.filter((row) => row.change === "archived");
	const removals = removedPhotos.length + archived.length;
	const added = photos.filter((photo) => photo.added).length;
	const parts = [
		changed.length > 0 && fill(labels.summary.changed, { n: changed.length }),
		filled.length > 0 && fill(labels.summary.filled, { n: filled.length }),
		added > 0 && fill(labels.summary.photosAdded, { n: added }),
		variants.some((v) => v.change === "added") && fill(labels.summary.variantsAdded, { n: variants.filter((v) => v.change === "added").length }),
		variants.some((v) => v.change === "changed") && fill(labels.summary.variantsChanged, { n: variants.filter((v) => v.change === "changed").length }),
		removedPhotos.length > 0 && fill(labels.summary.photosRemoved, { n: removedPhotos.length }),
		archived.length > 0 && fill(labels.summary.variantsArchived, { n: archived.length }),
	].filter((part): part is string => Boolean(part));
	const shownFilled = open ? filled : filled.slice(0, FILLED_FOLDED);
	const pending = changeSet.status === "pending";
	const skipped = changeSet.guardrails.filter((g) => !g.ok && g.detail);
	// what reaches a marketplace right away comes first, in amber
	const live = changeSet.guardrails.filter((g) => g.ok && g.rule === "live" && g.detail);
	const publishing = doc.sections.some((section) => section.key === "publish");
	// a change that reaches a channel or the web store now: "only when you publish" would be wrong
	const instant = live.length > 0;
	const archives = doc.undo?.archivesVariants ?? [];

	return (
		<div className="ech-ag-pe">
			{parts.length > 0 && (
				<p className="ech-ag-pe-sum">
					{parts.map((part, i) => (
						<span key={part}>
							{i > 0 && " · "}
							<Counted text={part} />
						</span>
					))}
				</p>
			)}

			{(changed.length > 0 || removals > 0) && (
				<div className="ech-ag-pe-group">
					<p className="ech-ag-pe-h" data-tone={removals > 0 ? "danger" : undefined}>
						{removals > 0 ? labels.changedRemovedTitle : labels.changedTitle}
						<small>{changed.length + removals}</small>
					</p>
					<dl className="ech-ag-pe-dl">
						{changed.map((row) => (
							<Pair key={`${row.section}:${row.label}`} label={row.label}>
								<s>{row.before}</s>
								<span className="ech-ag-pe-arrow">
									<Icon name="arrow-right" size={12} />
								</span>
								{row.after ?? <em className="ech-ag-pe-cleared">{labels.cleared}</em>}
							</Pair>
						))}
						{removedPhotos.map(({ photo, n }) => (
							<Pair key={`photo:${n}`} label={fill(labels.removedPhoto, { n })}>
								<span className="ech-ag-pe-photo ech-ag-pe-photo-sm" style={bg(photo.url)} />
								{labels.removedPhotoNote}
							</Pair>
						))}
						{archived.map((row) => (
							<Pair key={`variant:${row.label}`} label={fill(labels.archivedVariant, { name: row.label })}>
								{labels.archivedVariantNote}
							</Pair>
						))}
					</dl>
				</div>
			)}

			{filled.length > 0 && (
				<div className="ech-ag-pe-group">
					<p className="ech-ag-pe-h">
						{labels.filledTitle}
						<small>{filled.length}</small>
					</p>
					<dl className="ech-ag-pe-dl">
						{shownFilled.map((row, i) => (
							<FilledRow key={`${row.section}:${row.label}`} row={row} heading={i === 0 || shownFilled[i - 1]?.section !== row.section ? (labels.sections[row.section] ?? row.section) : null} />
						))}
					</dl>
					{folded && filled.length > FILLED_FOLDED && (
						<button type="button" className="ech-ag-link ech-ag-pe-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
							{open ? labels.showLess : `${fill(labels.moreFilled, { n: filled.length - FILLED_FOLDED })} · ${labels.showAll}`}
						</button>
					)}
				</div>
			)}

			{photos.length > 0 && (
				<div className="ech-ag-pe-group">
					<p className="ech-ag-pe-h" data-tone={removedPhotos.length > 0 ? "danger" : undefined}>
						{labels.photosTitle}
						<small>
							{doc.photos?.before ?? 0} → {photos.filter((p) => !p.removed).length}
						</small>
					</p>
					<div className="ech-ag-pe-photos" role="list">
						{photos.map((photo, i) => {
							const tag = photoTag(photo, labels);
							return (
								<span
									key={`${photo.url}:${i}`}
									role="listitem"
									className="ech-ag-pe-photo"
									style={bg(photo.url)}
									title={photo.alt}
									data-added={photo.added ? "" : undefined}
									data-removed={photo.removed ? "" : undefined}
								>
									{tag && <em>{tag}</em>}
								</span>
							);
						})}
					</div>
				</div>
			)}

			{variants.length > 0 && (
				<div className="ech-ag-pe-group">
					<p className="ech-ag-pe-h">
						{labels.variantsTitle}
						<small>{variants.length + (doc.variants?.more ?? 0)}</small>
					</p>
					<table className="ech-ag-pe-vt">
						<thead>
							<tr>
								<th scope="col">{labels.variantColumn}</th>
								<th scope="col" />
								<th scope="col">{labels.priceColumn}</th>
							</tr>
						</thead>
						<tbody>
							{variants.map((row) => {
								const price = row.cells.find((c) => c.field === "Price");
								// a variant that only stops selling reads as paused, not "changed"
								const paused = row.change === "changed" && row.cells.find((c) => c.field === "Status")?.after === "Paused";
								const other = row.cells.filter((c) => c.field !== "Price" && c.field !== "Status");
								return (
									<tr key={`${row.label}:${row.change}`}>
										<td>
											{row.label}
											{other.length > 0 && (
												<span className="ech-ag-pe-vt-more">
													{other.map((cell) => `${labels.cells[cell.field] ?? cell.field} ${cell.field === "Photo" ? "" : (cell.after ?? "—")}`.trim()).join(" · ")}
												</span>
											)}
										</td>
										<td>
											<span className="ech-ag-pe-tag" data-tone={row.change === "archived" ? "danger" : row.change === "changed" ? "muted" : undefined}>
												{paused ? labels.variantChange.paused : labels.variantChange[row.change]}
											</span>
										</td>
										<td>
											{row.change === "archived" ? (
												"—"
											) : (
												<>
													{price?.before && price.before !== price.after && <s>{price.before}</s>}
													{price?.after ?? ""}
												</>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{pending && (
				<div className="ech-ag-pe-notes">
					{live.map((g) => (
						<p key={g.detail} className="ech-ag-pe-note" data-tone="warn">
							{g.detail}
						</p>
					))}
					{!publishing && !instant && <p className="ech-ag-pe-note">{labels.draftNote}</p>}
					{(doc.undo?.notes ?? []).map((note) => (
						<p key={note} className="ech-ag-pe-note">
							{note}
						</p>
					))}
					{archives.length > 0 && <p className="ech-ag-pe-note">{fill(labels.undoArchives, { names: archives.slice(0, 4).join(", ") + (archives.length > 4 ? "…" : "") })}</p>}
					{doc.undo?.sharedAlt && <p className="ech-ag-pe-note">{labels.sharedAlt}</p>}
					{skipped.map((g) => (
						<p key={g.rule + g.detail} className="ech-ag-pe-note" data-tone="warn">
							{g.detail}
						</p>
					))}
				</div>
			)}
		</div>
	);
}

/** "Sửa 2" → the count in bold. */
function Counted({ text }: { text: string }) {
	const match = /^(\D*)(\d+)(.*)$/.exec(text);
	if (!match) return <>{text}</>;
	return (
		<>
			{match[1]}
			<b>{match[2]}</b>
			{match[3]}
		</>
	);
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<dt>{label}</dt>
			<dd>{children}</dd>
		</>
	);
}

function FilledRow({ row, heading }: { row: { label: string; after: string | null }; heading: string | null }) {
	return (
		<>
			{heading && <span className="ech-ag-pe-sub">{heading}</span>}
			<dt>{row.label}</dt>
			<dd>{row.after}</dd>
		</>
	);
}
