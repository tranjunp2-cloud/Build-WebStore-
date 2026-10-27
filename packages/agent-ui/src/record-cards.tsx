import type { AgentRun, ContextElement, ReceiptRecord } from "@ech/agent-core";
import { useState } from "react";
import { fill } from "./fill";
import { Icon } from "./icons";

export interface RecordCardLabels {
	product: string;
	post: string;
	open: string;
	/** pick it for the next message (a chip in the message box) */
	use: string;
	/** picked: pressing again takes it back */
	chosen: string;
	/** "Show {n} more" */
	more: string;
}

export const DEFAULT_RECORD_CARD_LABELS: RecordCardLabels = { product: "Product", post: "Blog post", open: "Open", use: "Use", chosen: "Selected", more: "Show {n} more" };

/** Cards shown before "Show N more". */
export const RECORDS_SHOWN = 3;

const appPath = (url: string | undefined) => (url && /^\/(?!\/)/.test(url) ? url : undefined);
const picture = (url: string | undefined) => (url && (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url)) ? url : undefined);

/**
 * The products and posts a reply read or found, each once (the latest read wins). None when
 * the reply staged a change: its draft card already shows the record.
 */
export function runRecords(run: AgentRun | undefined): ReceiptRecord[] {
	if (!run || run.changeSetIds.length > 0) return [];
	const byKey = new Map<string, ReceiptRecord>();
	for (const receipt of run.receipts) {
		for (const record of receipt.records ?? []) {
			const key = `${record.kind}:${record.id}`;
			// a read (with its picture) completes what a search listed
			byKey.set(key, { ...byKey.get(key), ...record });
		}
	}
	return [...byKey.values()].slice(0, 10);
}

export const recordKey = (record: Pick<ReceiptRecord, "kind" | "id">) => `${record.kind}:${record.id}`;

/** The chip a picked record makes in the message box (same key: contextElementKey = kind:recordId). */
export function recordElement(record: ReceiptRecord): ContextElement {
	return { kind: record.kind, label: (record.title || record.id).slice(0, 80), recordId: record.id };
}

/** recordKey of the records already in the message box. */
export function chosenRecords(elements: readonly ContextElement[] | undefined): Set<string> {
	return new Set((elements ?? []).flatMap((e) => (e.recordId && (e.kind === "product" || e.kind === "post") ? [`${e.kind}:${e.recordId}`] : [])));
}

/**
 * One small card per record: picture, name, kind · status · price, Open — and Use, which puts it in
 * the message box as a chip (like a picture's "Use this"). Three show; the rest behind "Show N more".
 */
export function RecordCards({
	records,
	labels: overrides,
	chosen,
	onUse,
}: {
	records: readonly ReceiptRecord[];
	labels?: Partial<RecordCardLabels>;
	/** recordKey of the records picked for the next message */
	chosen?: ReadonlySet<string>;
	onUse?: (record: ReceiptRecord) => void;
}) {
	const [all, setAll] = useState(false);
	if (records.length === 0) return null;
	const labels = { ...DEFAULT_RECORD_CARD_LABELS, ...overrides };
	const shown = all ? records : records.slice(0, RECORDS_SHOWN);
	return (
		<ul className="ech-ag-records">
			{shown.map((record) => {
				const isChosen = Boolean(chosen?.has(recordKey(record)));
				const href = appPath(record.href);
				const thumb = picture(record.thumb);
				const sub = [record.kind === "product" ? labels.product : labels.post, record.status, record.meta].filter(Boolean).join(" · ");
				const use = onUse && (
					<button type="button" className="ech-ag-record-use" aria-pressed={isChosen} onClick={() => onUse(record)}>
						{isChosen ? <Icon name="check" size={13} /> : null}
						{isChosen ? labels.chosen : labels.use}
					</button>
				);
				const body = (
					<>
						<span className="ech-ag-record-thumb" style={thumb ? { backgroundImage: `url("${thumb.replace(/"/g, "%22")}")` } : undefined}>
							{!thumb && <Icon name={record.kind === "product" ? "package" : "file-text"} size={16} />}
						</span>
						<span className="ech-ag-record-text">
							<b title={record.title}>{record.title}</b>
							<small title={sub}>{sub}</small>
						</span>
					</>
				);
				// the card is not one big link any more: Use sits beside Open
				return (
					<li key={recordKey(record)} className="ech-ag-record" data-chosen={isChosen ? "" : undefined}>
						{body}
						{use}
						{href && (
							<a className="ech-ag-record-open" href={href} title={`${labels.open}: ${record.title}`} aria-label={`${labels.open}: ${record.title}`}>
								<Icon name="arrow-up-right" size={15} />
							</a>
						)}
					</li>
				);
			})}
			{!all && records.length > RECORDS_SHOWN && (
				<li>
					<button type="button" className="ech-ag-records-more" onClick={() => setAll(true)}>
						{fill(labels.more, { n: records.length - RECORDS_SHOWN })}
					</button>
				</li>
			)}
		</ul>
	);
}
