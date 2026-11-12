/**
 * The mascot comes to where the merchant asked: a copy of the docked mascot
 * flies from its corner to the field (an arc, not a slide), dips once to
 * "pick up" the request, then flies home while the chat opens — one character
 * the merchant talks to, wherever they typed.
 *
 * DOM-only on purpose: any surface (inventory header, a chip, a page) can call
 * it with the rect it was asked from; the dock keeps owning the real mascot.
 * Reduced motion, a hidden dock or no WAAPI → the hooks run at once, no flight.
 */
export interface SummonHooks {
	/** the mascot reached the field — the field can hand its text over */
	onPickup?: () => void;
	/** the mascot is on its way back — open the chat now */
	onReturn?: () => void;
}

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

const OUT_MS = 520;
const DIP_MS = 300;
const BACK_MS = 440;

function reducedMotion(): boolean {
	return typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export async function summonMascot(target: Box, hooks: SummonHooks = {}): Promise<void> {
	const fab = typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".ech-ag-fab");
	const mascot = fab?.querySelector<HTMLElement>(".ech-ag-mascot");
	if (!fab || !mascot || reducedMotion() || typeof mascot.animate !== "function") {
		hooks.onPickup?.();
		hooks.onReturn?.();
		return;
	}
	// each hook runs once, even if an animation is interrupted midway
	let picked = false;
	let returned = false;
	const pickup = () => {
		if (picked) return;
		picked = true;
		hooks.onPickup?.();
	};
	const back = () => {
		if (returned) return;
		returned = true;
		hooks.onReturn?.();
	};
	const home = mascot.getBoundingClientRect();
	const size = home.width;
	// land just left of the field, vertically centred on it, kept on screen
	const landX = Math.max(8, target.x - size - 6);
	const landY = Math.min(window.innerHeight - size - 8, Math.max(8, target.y + target.height / 2 - size / 2));
	const dx = landX - home.left;
	const dy = landY - home.top;
	// the arc peaks above the higher end of the trip
	const lift = Math.min(160, Math.max(60, Math.abs(dx) * 0.18));

	const flyer = document.createElement("div");
	flyer.className = "ech-ag-flyer";
	flyer.setAttribute("aria-hidden", "true");
	flyer.style.left = `${home.left}px`;
	flyer.style.top = `${home.top}px`;
	flyer.style.width = `${size}px`;
	flyer.style.height = `${size}px`;
	const copy = mascot.cloneNode(true) as HTMLElement;
	copy.classList.remove("idle", "alert");
	copy.classList.add("thinking");
	flyer.appendChild(copy);
	document.body.appendChild(flyer);
	fab.classList.add("is-away");

	const at = (x: number, y: number, extra = "") => `translate(${x}px, ${y}px) ${extra}`.trim();
	try {
		await flyer.animate(
			[
				{ transform: at(0, 0, "scale(1) rotate(0deg)") },
				{ transform: at(dx * 0.5, dy * 0.5 - lift, "scale(1.08) rotate(-10deg)"), offset: 0.5 },
				{ transform: at(dx, dy, "scale(0.92) rotate(0deg)") },
			],
			{ duration: OUT_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
		).finished;
		pickup();
		await flyer.animate(
			[
				{ transform: at(dx, dy, "scale(0.92)") },
				{ transform: at(dx + 4, dy + 6, "scale(1.02, 0.86)"), offset: 0.35 },
				{ transform: at(dx, dy - 4, "scale(0.96, 1.06)"), offset: 0.7 },
				{ transform: at(dx, dy, "scale(0.92)") },
			],
			{ duration: DIP_MS, easing: "ease-out", fill: "forwards" },
		).finished;
		back();
		await flyer.animate(
			[
				{ transform: at(dx, dy, "scale(0.92) rotate(0deg)") },
				{ transform: at(dx * 0.5, dy * 0.5 - lift * 0.6, "scale(1.04) rotate(8deg)"), offset: 0.5 },
				{ transform: at(0, 0, "scale(1) rotate(0deg)") },
			],
			{ duration: BACK_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
		).finished;
	} catch {
		// an interrupted animation must never leave the request unsent
		pickup();
		back();
	} finally {
		flyer.remove();
		fab.classList.remove("is-away");
	}
}

/** The rect of an element, as a plain box for `summonMascot` / event details. */
export function boxOf(element: Element): Box {
	const rect = element.getBoundingClientRect();
	return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}
