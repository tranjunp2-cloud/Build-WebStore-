import type { Insight } from "@ech/agent-core";
import type { ReactNode } from "react";
import { AgentOrb, Button } from "./primitives";

const KIND_TONE: Record<Insight["kind"], "red" | "amber" | "indigo" | "green"> = {
	blocking: "red",
	risk: "amber",
	opportunity: "indigo",
	hygiene: "green",
};

export interface InsightCardProps {
	insight: Insight;
	ctaLabel?: string;
	onAction?: (insight: Insight) => void;
	icon?: ReactNode;
}

/** Full card for things needing a decision. */
export function InsightCard({ insight, ctaLabel = "Open run", onAction, icon }: InsightCardProps) {
	return (
		<article className={`ech-ag-insight ${insight.kind}`}>
			<div className="ech-ag-insight-head">
				<span className={`ech-ag-ico ${KIND_TONE[insight.kind]}`}>{icon ?? <AgentOrb size={13} />}</span>
				<span className="ech-ag-insight-kind">
					{insight.kind} · {insight.domain}
				</span>
				<span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ech-ag-ink-3)" }}>
					conf {insight.confidence.toFixed(2)}
				</span>
			</div>
			<h4>{insight.title}</h4>
			<div className="ev">{insight.evidence}</div>
			<div className="ech-ag-insight-foot">
				{insight.impact && <span className="ech-ag-insight-impact">{insight.impact}</span>}
				<Button variant="agent" size="sm" onClick={() => onAction?.(insight)}>
					<AgentOrb size={13} />
					{ctaLabel}
				</Button>
			</div>
		</article>
	);
}

/** Compact single-line row for "worth exploring" lists. */
export function InsightRow({ insight, ctaLabel = "Open", onAction, icon }: InsightCardProps) {
	return (
		<button type="button" className="ech-ag-opp-row" onClick={() => onAction?.(insight)}>
			<span className={`ech-ag-ico ${KIND_TONE[insight.kind]}`}>{icon ?? <AgentOrb size={13} />}</span>
			<span>
				<span className="ech-ag-opp-title">{insight.title}</span>
				<span className="ech-ag-opp-sub">{insight.evidence}</span>
			</span>
			{insight.impact && (
				<span className="ech-ag-opp-impact">
					<b>{insight.impact}</b>
				</span>
			)}
			<span className="ech-ag-btn agent sm" style={{ pointerEvents: "none" }}>
				<AgentOrb size={13} />
				{ctaLabel}
			</span>
		</button>
	);
}
