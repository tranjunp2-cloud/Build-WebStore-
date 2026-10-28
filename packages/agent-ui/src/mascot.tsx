import { createContext, type ReactNode, useContext, useId } from "react";

/**
 * What the assistant is doing right now. The SVG draws idle / thinking / alert; a richer renderer
 * (MascotRendererProvider) also shows speaking (answer streaming), happy (just finished) and error.
 */
export type MascotMood = "idle" | "thinking" | "alert" | "speaking" | "happy" | "error";

/** Renders the character in place of the built-in SVG; `fallback` is the SVG, for while it loads. */
export type MascotRenderer = (props: { size: number; mood: MascotMood; fallback: ReactNode }) => ReactNode;

const MascotRendererContext = createContext<MascotRenderer | null>(null);

/** The host app plugs its own (e.g. 3D) mascot into every surface of the agent UI. */
export function MascotRendererProvider({ render, children }: { render: MascotRenderer; children: ReactNode }) {
	return <MascotRendererContext.Provider value={render}>{children}</MascotRendererContext.Provider>;
}

/**
 * The ECH Agent character — a small creature, not a button glyph. Eyes blink
 * on a loop, the body bobs; `mood` switches the animation so it feels alive:
 * thinking = eyes dart, alert = attention ring. Swap this single component
 * for a richer animated mascot via <MascotRendererProvider> — every surface uses it.
 */
export function AgentMascot({ size = 48, mood = "idle" }: { size?: number; mood?: MascotMood }) {
	const render = useContext(MascotRendererContext);
	if (render) return <>{render({ size, mood, fallback: <SvgMascot size={size} mood={mood} /> })}</>;
	return <SvgMascot size={size} mood={mood} />;
}

function SvgMascot({ size, mood }: { size: number; mood: MascotMood }) {
	const id = useId().replace(/[^a-zA-Z0-9]/g, "");
	const gradId = `echAgMascot-${id}`;
	return (
		<span className={`ech-ag-mascot ${mood}`} style={{ width: size, height: size }} aria-hidden="true">
			<svg viewBox="0 0 64 64" width={size} height={size}>
				<title>ECH Agent mascot</title>
				<defs>
					<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="#7a6cff" />
						<stop offset="100%" stopColor="#4a41d8" />
					</linearGradient>
				</defs>
				{/* antenna */}
				<line x1="32" y1="6" x2="32" y2="14" stroke="#4a41d8" strokeWidth="2.4" strokeLinecap="round" />
				<circle className="ech-ag-mascot-antenna-tip" cx="32" cy="5.5" r="3.4" fill="#a89fff" />
				{/* head */}
				<rect x="8" y="14" width="48" height="42" rx="19" fill={`url(#${gradId})`} />
				<rect x="8" y="14" width="48" height="42" rx="19" fill="none" stroke="#3d33c4" strokeOpacity="0.35" />
				{/* top sheen */}
				<ellipse cx="24" cy="21" rx="11" ry="4.5" fill="#ffffff" opacity="0.22" />
				{/* eyes */}
				<g className="ech-ag-mascot-eye left">
					<circle cx="23" cy="34" r="6.4" fill="#ffffff" />
					<circle cx="23.6" cy="34.6" r="3" fill="#241f5e" />
					<circle cx="22.2" cy="32.8" r="1.3" fill="#ffffff" />
				</g>
				<g className="ech-ag-mascot-eye right">
					<circle cx="41" cy="34" r="6.4" fill="#ffffff" />
					<circle cx="41.6" cy="34.6" r="3" fill="#241f5e" />
					<circle cx="40.2" cy="32.8" r="1.3" fill="#ffffff" />
				</g>
				{/* blush */}
				<ellipse cx="16.5" cy="42" rx="3.4" ry="2" fill="#ff9ecd" opacity="0.45" />
				<ellipse cx="47.5" cy="42" rx="3.4" ry="2" fill="#ff9ecd" opacity="0.45" />
				{/* smile */}
				<path
					className="ech-ag-mascot-mouth"
					d="M27.5 44.5 Q32 48 36.5 44.5"
					fill="none"
					stroke="#ffffff"
					strokeWidth="2.1"
					strokeLinecap="round"
					opacity="0.9"
				/>
			</svg>
		</span>
	);
}
