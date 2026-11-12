import type { FieldDiff, GuardrailResult } from "@ech/agent-core";

const PROV_LABEL: Record<FieldDiff["provenance"], string> = {
	generated: "gen",
	tool_output: "tool",
	user_input: "user",
	inferred: "inferred",
};

export function FieldDiffRow({ diff }: { diff: FieldDiff }) {
	const fieldLabel = [diff.entity.label ?? diff.entity.id, diff.field, diff.locale].filter(Boolean).join(" · ");
	return (
		<div className="ech-ag-diff">
			<div className="ech-ag-diff-field">
				{fieldLabel} <span className="prov">{PROV_LABEL[diff.provenance]}</span>
			</div>
			{diff.before !== null && (
				<div className="ech-ag-diff-old">
					<span className="sign">−</span>
					<span>{diff.before}</span>
				</div>
			)}
			<div className="ech-ag-diff-new">
				<span className="sign">+</span>
				<span>{diff.after}</span>
			</div>
		</div>
	);
}

export function GuardrailChip({ result }: { result: GuardrailResult }) {
	return (
		<span className={`ech-ag-guard${result.ok ? "" : " fail"}`} title={result.detail}>
			{result.rule} {result.ok ? "✓" : "✕"}
		</span>
	);
}
