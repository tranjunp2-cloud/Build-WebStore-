import type { AgentRun, QueueRunningItem } from "@ech/agent-core";

/** The words of the queue notice (hosts pass their language's as `labels.queue`). */
export interface QueueLabels {
	/** "Waiting for a free AI slot — {n} ahead." */
	waiting: string;
	/** the place is not known yet (the chat was reopened while it waits) */
	waitingPlain: string;
	/** a working request the merchant may stop: "Stop “{title}” and run mine" */
	stop: string;
	/** a teammate's request (owners / admins): the title shown as "{name}: {title}" */
	teammateTitle: string;
	/** leave the queue */
	cancel: string;
}

export const DEFAULT_QUEUE_LABELS: QueueLabels = {
	waiting: "Waiting for a free AI slot — {n} ahead.",
	waitingPlain: "Waiting for a free AI slot.",
	stop: "Stop “{title}” and run mine",
	teammateTitle: "{name}: {title}",
	cancel: "Cancel",
};

function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** The button's words for a working request: its title, with who asked when it is a teammate's. */
export function stopLabel(item: QueueRunningItem, labels: QueueLabels): string {
	const title = !item.mine && item.requestedBy.name ? fill(labels.teammateTitle, { name: item.requestedBy.name, title: item.title }) : item.title;
	return fill(labels.stop, { title });
}

export interface QueueNoticeProps {
	run: AgentRun;
	labels: QueueLabels;
	/** "Stop … and run mine" (absent: no buttons, e.g. an older reply or a backend that can't stop runs) */
	onStopRun?: (runId: string) => void;
	/** leave the queue */
	onCancel?: () => void;
}

/**
 * Shown instead of the spinner while the reply waits for a free AI slot: one short line with its place,
 * then one button per working request the merchant may stop for it, and Cancel.
 */
export function QueueNotice({ run, labels, onStopRun, onCancel }: QueueNoticeProps) {
	const queue = run.queue;
	const stoppable = onStopRun ? (queue?.running ?? []).filter((item) => item.canStop) : [];
	return (
		<div className="ech-ag-queue" role="status" aria-live="polite">
			<p>{queue ? fill(labels.waiting, { n: queue.ahead }) : labels.waitingPlain}</p>
			{(stoppable.length > 0 || onCancel) && (
				<div className="ech-ag-queue-actions">
					{stoppable.map((item) => (
						<button key={item.runId} type="button" className="ech-ag-button is-sm" onClick={() => onStopRun?.(item.runId)}>
							{stopLabel(item, labels)}
						</button>
					))}
					{onCancel && (
						<button type="button" className="ech-ag-button is-sm is-ghost" onClick={onCancel}>
							{labels.cancel}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
