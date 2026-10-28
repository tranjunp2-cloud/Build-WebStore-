import type { AgentRun, PlanStep, ToolReceipt } from "@ech/agent-core";

/** Receipt of one grounded tool call — provenance for the run's claims. */
export function ReceiptRow({ receipt }: { receipt: ToolReceipt }) {
	return (
		<div className={`ech-ag-receipt${receipt.status === "error" ? " err" : ""}`}>
			<span className="tool">{receipt.tool}</span>
			<span>{receipt.summary}</span>
			<span className="ms">{receipt.durationMs}ms</span>
		</div>
	);
}

export function StepRow({ step }: { step: PlanStep }) {
	return (
		<div className={`ech-ag-step ${step.status}`}>
			<span className="ech-ag-step-dot" />
			<div>
				<div className="l">{step.label}</div>
				{step.detail && <div className="d">{step.detail}</div>}
			</div>
		</div>
	);
}

/** Plan steps + tool receipts — the auditable trail of a run. */
export function RunTimeline({ run }: { run: AgentRun }) {
	return (
		<div>
			<div className="ech-ag-steps">
				{run.steps.map((step) => (
					<StepRow key={step.id} step={step} />
				))}
			</div>
			{run.receipts.length > 0 && (
				<div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
					{run.receipts.map((r) => (
						<ReceiptRow key={r.id} receipt={r} />
					))}
				</div>
			)}
			{run.answer && (
				<p style={{ fontSize: 13, lineHeight: 1.55, margin: "10px 0 0", color: "var(--ech-ag-ink-2)" }}>{run.answer}</p>
			)}
			{run.error && (
				<p style={{ fontSize: 12, lineHeight: 1.5, margin: "10px 0 0", color: "var(--ech-ag-red)" }}>{run.error}</p>
			)}
		</div>
	);
}
