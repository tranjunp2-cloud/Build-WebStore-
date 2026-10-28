import type { ContextElement } from "@ech/agent-core";
import type { Box } from "./summon";

/**
 * A thing on the page flies into the chat: a copy of its chip lifts off the
 * element, arcs over to the message box and lands where the real chip appears
 * — the merchant sees what went to the assistant. DOM-only, like
 * `summonMascot`, so any host can call it with the element's rect.
 * Reduced motion, no composer on screen or no WAAPI → resolves at once.
 */
const FLY_MS = 720;

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

export function flyToComposer(from: Box, chip: FlyChip, root: ParentNode = document): Promise<void> {
	if (typeof document === "undefined" || reducedMotion()) return Promise.resolve();
	const composer = root.querySelector<HTMLElement>(".ech-ag-cmp");
	const box = composer?.getBoundingClientRect();
	if (!box || box.width === 0) return Promise.resolve();
	const node = chipNode(chip);
	if (typeof node.animate !== "function") return Promise.resolve();
	document.body.appendChild(node);
	const { width, height } = node.getBoundingClientRect();
	const x0 = from.x + from.width / 2 - width / 2;
	const y0 = from.y + from.height / 2 - height / 2;
	// lands where the chips row starts (top-left of the box)
	const x1 = box.left + 12;
	const y1 = box.top + 10;
	// an arc over both points, not a slide
	const apexX = (x0 + x1) / 2;
	const apexY = Math.max(8, Math.min(y0, y1) - 90);
	const flight = node.animate(
		[
			{ transform: `translate(${x0}px, ${y0}px) scale(1.15)`, opacity: 0 },
			{ transform: `translate(${x0}px, ${y0 - 6}px) scale(1.1)`, opacity: 1, offset: 0.12 },
			{ transform: `translate(${apexX}px, ${apexY}px) scale(1)`, opacity: 1, offset: 0.55 },
			{ transform: `translate(${x1}px, ${y1}px) scale(0.92)`, opacity: 1 },
		],
		{ duration: FLY_MS, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" },
	);
	return new Promise((resolve) => {
		const done = () => {
			node.remove();
			resolve();
		};
		flight.onfinish = done;
		flight.oncancel = done;
	});
}
