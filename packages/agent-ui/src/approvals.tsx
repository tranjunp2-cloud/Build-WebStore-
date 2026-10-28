import type { ChangeSet } from "@ech/agent-core";
import { canDecideDraft } from "./draft-access";
import { useState } from "react";
import { FieldDiffRow, GuardrailChip } from "./diff";
import { Button, StatusDot } from "./primitives";

const RISK_TONE = { low: "green", medium: "amber", high: "red", critical: "red" } as const;

function expiresLabel(expiresAt: string): string {
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return "expired";
	const h = Math.round(ms / 3_600_000);
	return h >= 1 ? `${h}h` : `${Math.round(ms / 60_000)}m`;
}

export interface ApprovalItemProps {
	changeSet: ChangeSet;
	selected?: boolean;
	onSelect?: (id: string, selected: boolean) => void;
	onApprove?: (id: string) => void;
	onReject?: (id: string) => void;
}

/**
 * Approvals row — one row = one decision. Risk-tiered action: low/medium get
 * quick Approve; high/critical must open the diff first.
 */
export function ApprovalItem({ changeSet: cs, selected, onSelect, onApprove, onReject }: ApprovalItemProps) {
	const [open, setOpen] = useState(false);
	const decides = canDecideDraft(cs);
	const quickApprove = decides && (cs.risk === "low" || cs.risk === "medium") && onApprove;
	return (
		<div className={`ech-ag-appr-item${open ? " open" : ""}`}>
			<div className="ech-ag-appr-sum">
				<button
					type="button"
					style={{ textAlign: "left", minWidth: 0 }}
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
				>
					<div className="ech-ag-appr-title">{cs.title}</div>
					<div className="ech-ag-appr-sub">
						{cs.id} · {cs.runId} · {cs.blastRadius.label}
					</div>
				</button>
				<StatusDot tone={RISK_TONE[cs.risk]}>{cs.risk}</StatusDot>
				<span className="muted" style={{ fontSize: 11.5 }}>
					{expiresLabel(cs.expiresAt)}
				</span>
				<span style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
					{onSelect && (
						<input
							type="checkbox"
							checked={selected ?? false}
							onChange={(e) => onSelect(cs.id, e.target.checked)}
							aria-label={`Select ${cs.title}`}
						/>
					)}
					{quickApprove && !open && (
						<Button variant="primary" size="sm" onClick={() => onApprove(cs.id)}>
							Approve
						</Button>
					)}
					{!quickApprove && !open && (
						<Button variant="outline" size="sm" onClick={() => setOpen(true)}>
							Review
						</Button>
					)}
					{open && (
						<Button variant="outline" size="sm" onClick={() => setOpen(false)}>
							Close
						</Button>
					)}
				</span>
			</div>
			{open && (
				<div className="ech-ag-appr-detail">
					{cs.diffs.map((d) => (
						<FieldDiffRow key={`${d.entity.id}:${d.field}:${d.locale ?? ""}:${d.after}`} diff={d} />
					))}
					<div className="ech-ag-cs-guards" style={{ padding: "8px 0 0" }}>
						{cs.guardrails.map((g) => (
							<GuardrailChip key={g.rule} result={g} />
						))}
					</div>
					<div className="ech-ag-appr-foot">
						<span className="muted" style={{ fontSize: 11.5 }}>
							{cs.summary}
						</span>
						<span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
							{decides && onReject && (
								<Button variant="ghost" size="sm" onClick={() => onReject(cs.id)}>
									Reject
								</Button>
							)}
							{decides && onApprove && (
								<Button variant="primary" size="sm" onClick={() => onApprove(cs.id)}>
									Approve &amp; apply
								</Button>
							)}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}

export function ApprovalList({ items, ...rest }: { items: ChangeSet[] } & Omit<ApprovalItemProps, "changeSet">) {
	return (
		<div className="ech-ag-appr">
			{items.map((cs) => (
				<ApprovalItem key={cs.id} changeSet={cs} {...rest} />
			))}
		</div>
	);
}
