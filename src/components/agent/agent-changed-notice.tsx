"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";

type Subject = "product" | "post" | "discount" | "customer" | "template";

const action = "min-h-7 cursor-pointer rounded border-0 bg-transparent px-1 font-semibold underline-offset-2 hover:underline";

function Notice({ message, first, second }: { message: string; first: ReactNode; second: ReactNode }) {
	return (
		<div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] text-warning">
			<AlertTriangle className="h-4 w-4 shrink-0" />
			<span>{message}</span>
			<span className="ml-auto flex items-center gap-2">
				{first}
				{second}
			</span>
		</div>
	);
}

/** Shown over a form with unsaved edits when the assistant changed the same record: nothing is overwritten until the merchant picks. */
export function AgentChangedNotice({ record, onReload, onKeep }: { record: Subject; onReload: () => void; onKeep: () => void }) {
	const { t } = useI18n();
	const copy = t.dashboard.agentChanged;
	return (
		<Notice
			message={copy[record]}
			first={
				<button type="button" onClick={onReload} className={`${action} text-warning`}>
					{copy.reload}
				</button>
			}
			second={
				<button type="button" onClick={onKeep} className={`${action} text-warning/80`}>
					{copy.keepMine}
				</button>
			}
		/>
	);
}

/** Shown when a save was refused because the record changed after the form loaded: the merchant's edits stay until they pick. */
export function SaveConflictNotice({ record, onLoadLatest, onSaveAnyway }: { record: Subject; onLoadLatest: () => void; onSaveAnyway: () => void }) {
	const { t } = useI18n();
	const copy = t.dashboard.agentChanged;
	return (
		<Notice
			message={copy.conflict[record]}
			first={
				<button type="button" onClick={onLoadLatest} className={`${action} text-warning`}>
					{copy.loadLatest}
				</button>
			}
			second={
				<button type="button" onClick={onSaveAnyway} className={`${action} text-warning/80`}>
					{copy.saveAnyway}
				</button>
			}
		/>
	);
}
