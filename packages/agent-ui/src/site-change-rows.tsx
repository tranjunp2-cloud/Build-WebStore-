import type { ChangeSet, FieldDiff } from "@ech/agent-core";
import { useState } from "react";
import { fill } from "./fill";
import { Icon } from "./icons";

export interface SiteChangeLabels {
	empty: string;
	locate: string;
	locateShort: string;
	/** "1 change in {places}" */
	siteSummaryOne: string;
	/** "{n} changes in {places}" */
	siteSummaryMany: string;
	/** "+{n}" after the first places */
	morePlaces: string;
	showChanges: string;
	hideChanges: string;
	/** a text edit that only changed its formatting (bold, size): the words before and after read the same */
	formattingChanged: string;
	/** "Show all {n} changes" */
	showAllChanges: string;
}

/** Where a site change can point on the editor canvas: a section, the menu / footer, a page. */
const LOCATABLE = new Set(["site_block", "site_navigation", "site_page"]);
const SITE_ROWS = 3;
const SITE_GROUPS = 4;
const SUMMARY_PLACES = 3;

/**
 * The words read the same before and after (the card shows text without markup): the edit changed only the
 * formatting. Cut text (600 chars, ending in …) may differ further on, so it never counts.
 */
export function formattingOnly(diff: FieldDiff): boolean {
	return Boolean(diff.before) && diff.before === diff.after && !diff.after.endsWith("…");
}

type Group = { key: string; name: string; kind: string; diffs: FieldDiff[] };

function groupsOf(diffs: readonly FieldDiff[]): Group[] {
	const groups = new Map<string, Group>();
	for (const diff of diffs) {
		const key = `${diff.entity.kind}:${diff.entity.id}:${diff.entity.label ?? ""}`;
		const name = diff.entity.label ?? diff.entity.id;
		const group = groups.get(key) ?? { key, name, kind: diff.entity.kind, diffs: [] };
		group.diffs.push(diff);
		groups.set(key, group);
	}
	return [...groups.values()];
}

/**
 * "Bahasa Melayu · headline", "Bahasa Melayu · body" → "headline", "body": a
 * part every line starts with (a translation's language) is said once, by the title.
 */
export function sharedFieldPrefix(fields: readonly string[]): string {
	if (fields.length < 2) return "";
	const first = fields[0]!.split(" · ");
	if (first.length < 2) return "";
	const prefix = `${first[0]} · `;
	return fields.every((field) => field.startsWith(prefix) && field.length > prefix.length) ? prefix : "";
}

/** "12 changes in Hero, About, Testimonials +3" */
export function siteChangeSummary(diffs: readonly FieldDiff[], labels: SiteChangeLabels): string {
	// "Hero · Home" → "Hero": the place, short
	const names = [...new Set(groupsOf(diffs).map((group) => group.name.split(" · ")[0] ?? group.name))];
	const places = names.slice(0, SUMMARY_PLACES).join(", ") + (names.length > SUMMARY_PLACES ? ` ${fill(labels.morePlaces, { n: names.length - SUMMARY_PLACES })}` : "");
	return diffs.length === 1 ? fill(labels.siteSummaryOne, { places }) : fill(labels.siteSummaryMany, { n: diffs.length, places });
}

export interface SiteChangeRowsProps {
	changeSet: ChangeSet;
	labels: SiteChangeLabels;
	/** a field's words ("ctaButtons.0.label" → "Button 1") */
	fieldName: (field: string) => string;
	/** safety notes; the ones that are not ok stay visible while folded */
	notes: ReadonlyArray<{ rule: string; detail?: string; ok: boolean }>;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	onLocate?: (diff: FieldDiff) => void;
}

/**
 * A web builder change in the chat: one line — how many changes, where — that
 * opens to the changes grouped by section. Each change is the new text first
 * (two lines at most), the old one struck through under it (one line), and its
 * own "Show" on the canvas. Long changes show the first sections, then "Show all".
 */
export function SiteChangeRows({ changeSet, labels, fieldName, notes, expanded, onExpandedChange, onLocate }: SiteChangeRowsProps) {
	const [all, setAll] = useState(false);
	const groups = groupsOf(changeSet.diffs);
	const prefix = sharedFieldPrefix(changeSet.diffs.map((diff) => fieldName(diff.field)));
	const shown = all ? groups : groups.slice(0, SITE_GROUPS).map((group) => ({ ...group, diffs: group.diffs.slice(0, SITE_ROWS) }));
	const hidden = changeSet.diffs.length - shown.reduce((n, group) => n + group.diffs.length, 0);
	const visibleNotes = expanded ? notes : notes.filter((note) => !note.ok);
	return (
		<div className="ech-ag-sc" data-expanded={expanded ? "" : undefined}>
			<button type="button" className="ech-ag-sc-sum" aria-expanded={expanded} onClick={() => onExpandedChange(!expanded)}>
				<span>{siteChangeSummary(changeSet.diffs, labels)}</span>
				<small>
					{expanded ? labels.hideChanges : labels.showChanges}
					<Icon name="chevron-down" size={14} />
				</small>
			</button>
			{expanded &&
				shown.map((group) => {
					const locatable = Boolean(onLocate) && LOCATABLE.has(group.kind);
					return (
						<div key={group.key} className="ech-ag-sc-group">
							<div className="ech-ag-sc-place">{group.name}</div>
							{group.diffs.map((diff) => {
								const name = fieldName(diff.field).slice(prefix.length);
								return (
									<div key={`${diff.field}:${diff.locale ?? ""}`} className="ech-ag-sc-row">
										<div className="ech-ag-sc-field">
											<span>{name}</span>
											{locatable && (
												<button
													type="button"
													className="ech-ag-change-go"
													title={labels.locate}
													aria-label={`${labels.locate}: ${name}`}
													onClick={() => onLocate?.(diff)}
												>
													<Icon name="locate-fixed" size={13} />
													<span>{labels.locateShort}</span>
												</button>
											)}
										</div>
										{/* an email the shop will send (a lead reply) or text the buyer is emailed as written (an order's cancel reason / rejection message): the merchant reads all of it, line breaks kept */}
										<b title={group.kind === "lead_reply" || group.kind === "store_order" ? undefined : diff.after} data-full={group.kind === "lead_reply" ? "" : group.kind === "store_order" ? "order" : undefined}>
											{formattingOnly(diff) ? labels.formattingChanged : diff.after}
										</b>
										{/* nothing before (a new category, a field filled for the first time): no struck "empty" line; same words before and after = only the formatting changed, said once above */}
										{diff.before && !formattingOnly(diff) ? <s title={diff.before}>{diff.before}</s> : null}
									</div>
								);
							})}
						</div>
					);
				})}
			{expanded && hidden > 0 && (
				<button type="button" className="ech-ag-sc-all" onClick={() => setAll(true)}>
					{fill(labels.showAllChanges, { n: changeSet.diffs.length })}
				</button>
			)}
			{visibleNotes.length > 0 && (
				<ul className="ech-ag-change-notes">
					{visibleNotes.map((note) => (
						<li key={note.rule + note.detail} data-ok={note.ok ? "" : undefined}>
							{note.detail}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
