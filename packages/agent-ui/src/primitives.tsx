import type { ReactNode } from "react";

/** Orb — the agent's mark. Ring + core, inherits currentColor. */
export function AgentOrb({ size = 14, className = "" }: { size?: number; className?: string }) {
	return (
		<span className={`ech-ag-orb ${className}`} style={{ width: size, height: size }} aria-hidden>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle
					cx="12"
					cy="12"
					r="9.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.4"
					strokeDasharray="14 46"
					strokeLinecap="round"
					opacity=".85"
				/>
				<circle cx="12" cy="12" r="5" fill="currentColor" />
				<circle cx="12" cy="12" r="2" fill="#fff" opacity=".95" />
			</svg>
		</span>
	);
}

export type Tone = "default" | "indigo" | "green" | "amber" | "red";

export function Tag({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
	return <span className={`ech-ag-tag ${tone === "default" ? "" : tone}`}>{children}</span>;
}

export function StatusDot({ tone, children }: { tone: Exclude<Tone, "default">; children: ReactNode }) {
	return <span className={`ech-ag-st ${tone}`}>{children}</span>;
}

export function ConfidenceBar({ value }: { value: number }) {
	const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
	return (
		<span className="ech-ag-conf">
			<span className="track">
				<span className={`fill${value < 0.8 ? " amber" : ""}`} style={{ width: `${pct}%` }} />
			</span>
			<b className="num">{value.toFixed(2)}</b>
		</span>
	);
}

export function PolicyPill({ status, note }: { status: "ok" | "hold" | "blocked"; note?: string }) {
	const tone = status === "ok" ? "green" : status === "hold" ? "amber" : "red";
	const label = note ?? (status === "ok" ? "within policy" : status === "hold" ? "needs human" : "blocked");
	return <Tag tone={tone}>{label}</Tag>;
}

export function Button({
	variant = "outline",
	size,
	onClick,
	disabled,
	children,
}: {
	variant?: "primary" | "outline" | "ghost" | "agent";
	size?: "sm";
	onClick?: () => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			className={`ech-ag-btn ${variant}${size === "sm" ? " sm" : ""}`}
			onClick={onClick}
			disabled={disabled}
		>
			{children}
		</button>
	);
}
