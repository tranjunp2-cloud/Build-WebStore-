import type { AutonomyPolicy } from "@ech/agent-core";

const LEVEL_LABEL = { observe: "Obs", recommend: "Rec", stage: "Stage", auto: "Auto" } as const;

/**
 * AutonomyStrip — glanceable per-domain autonomy levels. The only place the
 * ladder is shown on Home; details live behind the policy screen.
 */
export function AutonomyStrip({ policy, note }: { policy: AutonomyPolicy; note?: string }) {
	return (
		<div className="ech-ag-autonomy">
			<span className="ech-ag-autonomy-label">Autonomy</span>
			{Object.entries(policy.domains).map(([domain, entry]) => (
				<span key={domain} className="ech-ag-aut-chip">
					{domain}
					<span className={`ech-ag-lvl ${entry.level}`}>{LEVEL_LABEL[entry.level]}</span>
				</span>
			))}
			{note && (
				<span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
					{note}
				</span>
			)}
		</div>
	);
}
