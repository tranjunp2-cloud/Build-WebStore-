import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export interface StartOverLabels {
	startOver: string;
	/** the button while the chat is empty */
	nothingToClear: string;
	title: string;
	body: string;
	keeps: string;
	/** drafts of this chat that clearing deletes */
	discardOne: string;
	discardMany: string;
	/** applied changes of this chat whose Undo goes with the chat */
	noUndoOne: string;
	noUndoMany: string;
	cancel: string;
	failed: string;
	tryAgain: string;
}

export const DEFAULT_START_OVER_LABELS: StartOverLabels = {
	startOver: "Start over",
	nothingToClear: "Nothing to clear yet",
	title: "Start a new chat?",
	body: "This chat will be cleared. Your page stays as it is.",
	keeps: "Changes already made stay on the page.",
	discardOne: "1 change waiting for review in this chat will be discarded.",
	discardMany: "{n} changes waiting for review in this chat will be discarded.",
	noUndoOne: "You won’t be able to undo 1 change made in this chat from here.",
	noUndoMany: "You won’t be able to undo {n} changes made in this chat from here.",
	cancel: "Cancel",
	failed: "Couldn’t clear the chat. Check your connection and try again.",
	tryAgain: "Try again",
};

export interface StartOverProps {
	/** the chat is empty: nothing to clear */
	disabled?: boolean;
	/** drafts waiting for review that clearing this chat deletes */
	discarding?: number;
	/** applied changes of this chat that can still be undone — Undo lives on the chat's cards, so it goes with the chat */
	undoLost?: number;
	/** clears the chat; a rejection keeps the confirm open with its message */
	onConfirm: () => Promise<void>;
	labels?: Partial<StartOverLabels>;
}

/** What clearing the chat keeps, discards and can no longer undo — one line each. */
export function StartOverNotes({ labels, discarding, undoLost }: { labels: StartOverLabels; discarding: number; undoLost: number }) {
	return (
		<ul>
			<li>
				<Icon name="check" />
				<span>{labels.keeps}</span>
			</li>
			{discarding > 0 && (
				<li data-tone="warn">
					<Icon name="list-checks" />
					<span>{discarding === 1 ? labels.discardOne : labels.discardMany.replace("{n}", String(discarding))}</span>
				</li>
			)}
			{undoLost > 0 && (
				<li data-tone="warn">
					<Icon name="rotate-ccw" />
					<span>{undoLost === 1 ? labels.noUndoOne : labels.noUndoMany.replace("{n}", String(undoLost))}</span>
				</li>
			)}
		</ul>
	);
}

/**
 * One chat per surface (the web editor): the header's "Start over" clears it
 * after a short confirm that says what stays and what goes.
 */
export function StartOver({ disabled, discarding = 0, undoLost = 0, onConfirm, labels: overrides }: StartOverProps) {
	const labels = { ...DEFAULT_START_OVER_LABELS, ...overrides };
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const rootRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const confirmRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		confirmRef.current?.focus();
		const onDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("pointerdown", onDown, true);
		return () => document.removeEventListener("pointerdown", onDown, true);
	}, [open]);

	const close = () => {
		setOpen(false);
		buttonRef.current?.focus();
	};
	const confirm = async () => {
		setBusy(true);
		setError(undefined);
		try {
			await onConfirm();
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error && err.message ? err.message : labels.failed);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="ech-ag-start-over" ref={rootRef}>
			<button
				ref={buttonRef}
				type="button"
				className="ech-ag-start-over-btn"
				disabled={disabled}
				title={disabled ? labels.nothingToClear : undefined}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => {
					setError(undefined);
					setOpen((v) => !v);
				}}
			>
				<Icon name="rotate-ccw" />
				{labels.startOver}
			</button>
			{open && (
				<div
					className="ech-ag-start-over-pop"
					role="dialog"
					aria-label={labels.title}
					onKeyDown={(e) => {
						if (e.key !== "Escape") return;
						e.preventDefault();
						e.stopPropagation();
						close();
					}}
				>
					<h3>{labels.title}</h3>
					<p>{labels.body}</p>
					<StartOverNotes labels={labels} discarding={discarding} undoLost={undoLost} />
					{error && (
						<p className="ech-ag-start-over-err" role="alert">
							<Icon name="circle-alert" />
							<span>{error}</span>
						</p>
					)}
					<div className="ech-ag-start-over-acts">
						<button type="button" className="ech-ag-btn sm outline" onClick={close}>
							{labels.cancel}
						</button>
						<button ref={confirmRef} type="button" className="ech-ag-btn sm primary" disabled={busy} onClick={() => void confirm()}>
							{error ? labels.tryAgain : labels.startOver}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
