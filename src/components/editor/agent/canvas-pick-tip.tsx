"use client";

import { X } from "lucide-react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

/** Set once the merchant has added a second element (Shift + click) or closed the tip: they know. */
export const CANVAS_PICK_TIP_KEY = "ech-ai-canvas-pick-learned";
const SHOW_MS = 6000;

const TIP: Record<string, string> = {
	en: "Added to the chat. Shift + click to add more.",
	ms: "Ditambah ke sembang. Shift + klik untuk tambah lagi.",
	vi: "Đã thêm vào chat. Shift + bấm để chọn thêm.",
};

export const canvasPickTipText = (locale: string) => TIP[locale.slice(0, 2)] ?? TIP.en!;

function learned(): boolean {
	try {
		return window.localStorage.getItem(CANVAS_PICK_TIP_KEY) === "1";
	} catch {
		return true;
	}
}

function markLearned() {
	try {
		window.localStorage.setItem(CANVAS_PICK_TIP_KEY, "1");
	} catch {
		// storage blocked: the tip may show again next time, nothing else depends on it
	}
}

/**
 * Every single pick (canvas click or Ask AI) shows a short tip above the chip in the message box
 * until the merchant has used Shift + click once or closed the tip; a Shift + click hides one on screen.
 */
export function useCanvasPickTip(container: RefObject<HTMLElement | null>) {
	const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const hide = useCallback(() => {
		clearTimeout(timer.current);
		setPlace(null);
	}, []);

	const close = useCallback(() => {
		markLearned();
		hide();
	}, [hide]);

	const onPicked = useCallback(
		(add: boolean) => {
			if (add) {
				markLearned();
				return hide();
			}
			if (learned()) return;
			// two frames: the chip is in the box before the tip measures it
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					const root = container.current;
					const chips = root?.querySelector(".ech-ag-els") ?? root?.querySelector(".ech-ag-cmp");
					if (!root || !chips) return;
					const box = root.getBoundingClientRect();
					const at = chips.getBoundingClientRect();
					setPlace({ left: Math.max(8, at.left - box.left), bottom: Math.max(8, box.bottom - at.top + 8) });
					clearTimeout(timer.current);
					timer.current = setTimeout(() => setPlace(null), SHOW_MS);
				}),
			);
		},
		[container, hide],
	);

	useEffect(() => () => clearTimeout(timer.current), []);
	return { place, onPicked, hide, close };
}

export function CanvasPickTip({ place, text, closeLabel, onClose }: { place: { left: number; bottom: number }; text: string; closeLabel: string; onClose: () => void }) {
	return (
		<div
			role="status"
			className="absolute z-40 flex max-w-[260px] items-center gap-2 rounded-lg bg-slate-900 py-1.5 pl-3 pr-1.5 text-[12.5px] leading-snug text-white shadow-lg ring-1 ring-white/10"
			style={{ left: place.left, bottom: place.bottom }}
		>
			<span>{text}</span>
			<button type="button" aria-label={closeLabel} onClick={onClose} className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
				<X className="h-3.5 w-3.5" />
			</button>
			<span aria-hidden className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-slate-900" />
		</div>
	);
}
