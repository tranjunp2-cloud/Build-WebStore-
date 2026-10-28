import { type CSSProperties, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AgentOrb } from "./primitives";

export interface AgentBeacon {
	/** CSS selector of the element to point at (e.g. [data-agent-spot="returns"]) */
	selector: string;
	label?: string;
	tone?: "blocking" | "risk" | "opportunity" | "hygiene";
	onSelect?: () => void;
}

interface Positioned {
	beacon: AgentBeacon;
	top: number;
	left: number;
}

const GAP = 6;

/**
 * Point-highlights — pulsing markers anchored to live DOM elements so an
 * insight lands exactly where the work is. Resolves selectors against the
 * document, follows scroll/resize, and drops markers whose target is gone.
 */
export function AgentBeaconLayer({ beacons }: { beacons: AgentBeacon[] }) {
	const [positioned, setPositioned] = useState<Positioned[]>([]);

	useEffect(() => {
		let frame = 0;
		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const next: Positioned[] = [];
				for (const beacon of beacons) {
					const el = document.querySelector(beacon.selector);
					if (!el) continue;
					const rect = el.getBoundingClientRect();
					if (rect.width === 0 || rect.height === 0) continue;
					next.push({ beacon, top: rect.top - GAP, left: rect.right - 10 });
				}
				setPositioned(next);
			});
		};
		update();
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [beacons]);

	if (positioned.length === 0) return null;

	return createPortal(
		<div className="ech-ag-beacon-layer" aria-hidden="false">
			{positioned.map(({ beacon, top, left }) => (
				<button
					key={`${beacon.selector}`}
					type="button"
					className={`ech-ag-beacon${beacon.tone ? ` ${beacon.tone}` : ""}`}
					style={{ top, left } as CSSProperties}
					onClick={beacon.onSelect}
					aria-label={beacon.label ?? "Agent highlight"}
					title={beacon.label}
				>
					<span className="ech-ag-beacon-ping" aria-hidden="true" />
					<span className="ech-ag-beacon-dot" aria-hidden="true">
						<AgentOrb size={9} />
					</span>
				</button>
			))}
		</div>,
		document.body,
	);
}
