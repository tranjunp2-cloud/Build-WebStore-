import type { ChangeSet } from "@ech/agent-core";
import { canDecideDraft } from "./draft-access";
import { type ReactNode, useState } from "react";
import { FieldDiffRow, GuardrailChip } from "./diff";
import { AgentOrb, Button, StatusDot } from "./primitives";

const RISK_TONE = { low: "green", medium: "amber", high: "red", critical: "red" } as const;

function expiresLabel(expiresAt: string): string {
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return "expired";
	const h = Math.round(ms / 3_600_000);
	return h >= 1 ? `${h}h` : `${Math.round(ms / 60_000)}m`;
}

export interface ChangeSetCardProps {
	changeSet: ChangeSet;
	/**
	 * When provided, show approve/reject actions. Returning a promise keeps the
	 * card in an "applying" state until it settles and shows its error inline.
	 */
	onApprove?: (id: string) => void | Promise<unknown>;
	onReject?: (id: string) => void | Promise<unknown>;
	footer?: ReactNode;
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : "Could not apply this change.";
}

/**
 * The single source of truth for "the agent wants to write something".
 * Everything a human needs to decide is on the card: diff, blast radius,
 * risk, guardrails, expiry.
 */
export function ChangeSetCard({ changeSet: cs, onApprove, onReject, footer }: ChangeSetCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const applied = cs.status === "applied";
	const actionable = cs.status === "pending" && canDecideDraft(cs) && (onApprove || onReject);
	const links = applied ? (cs.result?.links ?? []) : [];

	const decide = (kind: "approve" | "reject") => {
		const handler = kind === "approve" ? onApprove : onReject;
		if (!handler || busy) return;
		setError(null);
		const outcome = handler(cs.id);
		if (!outcome || typeof (outcome as Promise<unknown>).then !== "function") return;
		setBusy(kind);
		(outcome as Promise<unknown>)
			.catch((err: unknown) => setError(errorMessage(err)))
			.finally(() => setBusy(null));
	};
	return (
		<div className={`ech-ag-cs${applied ? " applied" : ""}`}>
			<div className="ech-ag-cs-head">
				<span className="ech-ag-cs-glyph">
					<AgentOrb size={13} />
				</span>
				<div>
					<div className="t">{cs.title}</div>
					<div className="s">
						<span className="mono">{cs.id}</span> · {cs.domain}
					</div>
				</div>
				<span style={{ marginLeft: "auto" }}>
					<StatusDot tone={RISK_TONE[cs.risk]}>{cs.risk} risk</StatusDot>
				</span>
			</div>
			<div className="ech-ag-cs-meta">
				<span>{cs.blastRadius.label}</span>
				<span>·</span>
				<span>{cs.diffs.length} field(s)</span>
				<span>·</span>
				<span>expires in {expiresLabel(cs.expiresAt)}</span>
				<button
					type="button"
					className="muted"
					style={{ marginLeft: "auto", fontSize: "11px" }}
					onClick={() => setExpanded((v) => !v)}
				>
					{expanded ? "hide diff" : "show diff"}
				</button>
			</div>
			{expanded && (
				<div className="ech-ag-cs-diffs">
					{cs.diffs.map((d) => (
						<FieldDiffRow key={`${d.entity.id}:${d.field}:${d.locale ?? ""}:${d.after}`} diff={d} />
					))}
				</div>
			)}
			{cs.guardrails.length > 0 && (
				<div className="ech-ag-cs-guards">
					{cs.guardrails.map((g) => (
						<GuardrailChip key={g.rule} result={g} />
					))}
				</div>
			)}
			{links.length > 0 && (
				<div className="ech-ag-cs-links">
					{links.map((link) => (
						<a key={link.href} className="ech-ag-cs-link" href={link.href}>
							{link.label} →
						</a>
					))}
				</div>
			)}
			{error && (
				<p className="ech-ag-cs-error" role="alert">
					{error}
				</p>
			)}
			{(actionable || footer) && (
				<div className="ech-ag-cs-actions">
					{actionable && (
						<>
							<Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => decide("reject")}>
								{busy === "reject" ? "Rejecting…" : "Reject"}
							</Button>
							<Button variant="primary" size="sm" disabled={busy !== null} onClick={() => decide("approve")}>
								{busy === "approve" ? "Applying…" : "Approve & apply"}
							</Button>
						</>
					)}
					{footer}
				</div>
			)}
		</div>
	);
}
