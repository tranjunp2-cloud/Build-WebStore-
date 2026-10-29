import type { ContextElement } from "@ech/agent-core";
import type { Box } from "./summon";

/**
 * A thing on the page flies into the chat: a copy of its chip lifts off the
 * element, arcs over to the message box and lands where the real chip appears
 * — the merchant sees what went to the assistant. DOM-only, like
 * `summonMascot`, so any host can call it with the element's rect.
 * Reduced motion, no composer on screen or no WAAPI → resolves at once.
 */
export const FLY_MS = 720;

function reducedMotion(): boolean {
	return typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export interface FlyChip {
	element: ContextElement;
	/** "Button", "Picture" */
	kindLabel: string;
	/** the chip's icon as markup (the host's own icon, or the chat's) */
	iconSvg?: string;
}

function chipNode({ element, kindLabel, iconSvg }: FlyChip): HTMLElement {
	const chip = document.createElement("span");
	// inside .ech-ag so the chat's tokens and fonts apply
	chip.className = "ech-ag ech-ag-el is-flying";
	chip.setAttribute("aria-hidden", "true");
	if (iconSvg) chip.insertAdjacentHTML("beforeend", iconSvg);
	const kind = document.createElement("b");
	kind.textContent = kindLabel;
	const label = document.createElement("span");
	label.textContent = element.label;
	chip.append(kind, label);
	return chip;
}

export interface FlyOptions {
	/**
	 * Adds the real chip to the message box. Called first and exactly once (also when there is nothing to fly):
	 * the copy then lands on that chip, which stays hidden until the copy arrives.
	 */
	attach?: () => void;
}

/** The newest chip in the box's chips row. */
const landingChip = (root: ParentNode): HTMLElement | null => {
	const chips = root.querySelectorAll<HTMLElement>(".ech-ag-cmp [data-agent-elements] .ech-ag-el");
	return chips.item(chips.length - 1);
};

/** How many 16 ms ticks the flight waits for the real chip to render before landing on the box's corner. */
const CHIP_WAIT_TICKS = 4;

export function flyToComposer(from: Box, chip: FlyChip, root: ParentNode = document, options: FlyOptions = {}): Promise<void> {
	const composer = typeof document === "undefined" || reducedMotion() ? null : root.querySelector<HTMLElement>(".ech-ag-cmp");
	const box = composer?.getBoundingClientRect();
	const node = box && box.width > 0 ? chipNode(chip) : null;
	if (!box || !node || typeof node.animate !== "function") {
		options.attach?.();
		return Promise.resolve();
	}
	document.body.appendChild(node);
	const { width, height } = node.getBoundingClientRect();
	options.attach?.();
	return new Promise<void>((resolve) => {
		let real: HTMLElement | null = null;
		let finished = false;
		let safety: ReturnType<typeof setTimeout> | undefined;
		const done = () => {
			if (finished) return;
			finished = true;
			clearTimeout(safety);
			node.remove();
			// the real chip appears where the copy landed (its own landing pulse plays now)
			if (real) {
				real.style.visibility = "";
				real.style.animation = "none";
				void real.offsetWidth;
				real.style.animation = "";
			}
			resolve();
		};
		const launch = () => {
			// the copy lands on the real chip's place; before it exists, where the chips row starts
			const target = real?.getBoundingClientRect();
			const x0 = from.x + from.width / 2 - width / 2;
			const y0 = from.y + from.height / 2 - height / 2;
			const x1 = target && target.width > 0 ? target.left : box.left + 12;
			const y1 = target && target.width > 0 ? target.top : box.top + 10;
			// an arc over both points, not a slide
			const apexX = (x0 + x1) / 2;
			const apexY = Math.max(8, Math.min(y0, y1) - 90);
			// a clone that never reports its end (a hidden tab, a cancelled animation) must not stay on the page
			safety = setTimeout(done, FLY_MS + 150);
			const flight = node.animate(
				[
					{ transform: `translate(${x0}px, ${y0}px) scale(1.15)`, opacity: 0 },
					{ transform: `translate(${x0}px, ${y0 - 6}px) scale(1.1)`, opacity: 1, offset: 0.12 },
					{ transform: `translate(${apexX}px, ${apexY}px) scale(1)`, opacity: 1, offset: 0.55 },
					{ transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: 1 },
				],
				{ duration: FLY_MS, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" },
			);
			flight.onfinish = done;
			flight.oncancel = done;
		};
		// wait (briefly) for the chip the host just attached, hide it, then fly to its place
		let ticks = 0;
		const look = () => {
			real = landingChip(root);
			if (real) real.style.visibility = "hidden";
			if (real || ticks++ >= CHIP_WAIT_TICKS) launch();
			else setTimeout(look, 16);
		};
		setTimeout(look, 0);
	});
}
