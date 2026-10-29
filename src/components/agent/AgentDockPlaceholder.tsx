"use client";

import { useI18n } from "@/i18n";
import { AGENT_OPEN_EVENT } from "./agent-open-queue";

const LABEL = { en: "Open ECH Agent", ms: "Buka ECH Agent" } as const;

/**
 * The mascot button shown until the dock's code (chat panel, assistant-ui, its stylesheet) has loaded: same place
 * and look as the dock's FAB (agent-ui `.ech-ag-float-root` / `.ech-ag-fab`), a still copy of its mascot, and no
 * other code. Hovering or focusing it starts the download (`onWarm`); a click asks for the chat like any other
 * "open the copilot" button, and the loader hands that request to the dock once it listens.
 */
export function AgentDockPlaceholder({ onWarm }: { onWarm?: () => void }) {
	const { locale } = useI18n();
	const label = LABEL[locale === "ms" ? "ms" : "en"];
	const onOpen = () => window.dispatchEvent(new CustomEvent(AGENT_OPEN_EVENT));
	return (
		<div style={{ position: "fixed", right: "var(--ech-ag-dock-right, 20px)", bottom: "var(--ech-ag-dock-bottom, 20px)", zIndex: 90 }}>
			<button
				type="button"
				aria-label={label}
				data-agent-dock-placeholder=""
				onPointerEnter={onWarm}
				onFocus={onWarm}
				onClick={onOpen}
				style={{
					width: 48,
					height: 48,
					// compact on form screens (same variable as the dock's FAB)
					zoom: "var(--ech-ag-fab-zoom, 1)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "transparent",
					border: "none",
					padding: 0,
					cursor: "pointer",
				}}
			>
				<svg viewBox="0 0 64 64" width={44} height={44} aria-hidden="true" style={{ filter: "drop-shadow(0 6px 16px rgb(80 72 229 / 0.45))" }}>
					<defs>
						<linearGradient id="echAgDockPlaceholder" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stopColor="#7a6cff" />
							<stop offset="100%" stopColor="#4a41d8" />
						</linearGradient>
					</defs>
					<line x1="32" y1="6" x2="32" y2="14" stroke="#4a41d8" strokeWidth="2.4" strokeLinecap="round" />
					<circle cx="32" cy="5.5" r="3.4" fill="#a89fff" />
					<rect x="8" y="14" width="48" height="42" rx="19" fill="url(#echAgDockPlaceholder)" />
					<rect x="8" y="14" width="48" height="42" rx="19" fill="none" stroke="#3d33c4" strokeOpacity="0.35" />
					<ellipse cx="24" cy="21" rx="11" ry="4.5" fill="#ffffff" opacity="0.22" />
					<circle cx="23" cy="34" r="6.4" fill="#ffffff" />
					<circle cx="23.6" cy="34.6" r="3" fill="#241f5e" />
					<circle cx="22.2" cy="32.8" r="1.3" fill="#ffffff" />
					<circle cx="41" cy="34" r="6.4" fill="#ffffff" />
					<circle cx="41.6" cy="34.6" r="3" fill="#241f5e" />
					<circle cx="40.2" cy="32.8" r="1.3" fill="#ffffff" />
					<ellipse cx="16.5" cy="42" rx="3.4" ry="2" fill="#ff9ecd" opacity="0.45" />
					<ellipse cx="47.5" cy="42" rx="3.4" ry="2" fill="#ff9ecd" opacity="0.45" />
					<path d="M27.5 44.5 Q32 48 36.5 44.5" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" opacity="0.9" />
				</svg>
			</button>
		</div>
	);
}
