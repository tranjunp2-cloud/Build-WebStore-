"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { isShopTodoKind, type TodoLocale, todoLinkPrompt } from "@/lib/insights/shop-todo-text";

/**
 * Reminder links (notification, digest email) that lead into a fix:
 *
 *  - `?todo=<kind>`: a To do task. The link carries only the kind; the message comes from `todoLinkPrompt` (fixed
 *    wording, the merchant's language). An unknown kind does nothing.
 *  - `?ask=<text>`: older links (notifications created before `todo` existed). Free text from the address bar.
 *
 * Either way the message is only PUT IN THE COMPOSER: nothing is sent until the merchant presses Send, so a crafted
 * link can neither start a run nor have it auto-approved. The parameter is removed from the address, so a reload or
 * a shared link does not prefill again. `ask` text is trimmed, stripped of control characters and capped.
 */
export const TODO_PARAM = "todo";
export const ASK_PARAM = "ask";
const ASK_MAX_LENGTH = 600;

export function cleanAskPrompt(raw: string | null): string | null {
	if (!raw) return null;
	const text = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, ASK_MAX_LENGTH);
	return text || null;
}

/** The message a link asks for, or null when it carries nothing usable. `todo` wins over `ask`. */
export function linkPrompt(params: URLSearchParams, locale: TodoLocale): string | null {
	const kind = params.get(TODO_PARAM);
	if (isShopTodoKind(kind)) return todoLinkPrompt(kind, locale);
	return cleanAskPrompt(params.get(ASK_PARAM));
}

export function useAskParam(locale: TodoLocale, onPrefill: (prompt: string) => void): void {
	const params = useSearchParams();
	const pathname = usePathname() ?? "/";
	const router = useRouter();
	// the prompt already handed over (a dev double-run, or the URL still holding it while the replace lands)
	const handled = useRef<string | null>(null);
	const latest = useRef(onPrefill);
	latest.current = onPrefill;

	useEffect(() => {
		if (!params || !(params.has(TODO_PARAM) || params.has(ASK_PARAM))) {
			handled.current = null;
			return;
		}
		const prompt = linkPrompt(params, locale);
		const rest = new URLSearchParams(params.toString());
		rest.delete(TODO_PARAM);
		rest.delete(ASK_PARAM);
		const query = rest.toString();
		router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
		if (!prompt || handled.current === prompt) return;
		handled.current = prompt;
		latest.current(prompt);
	}, [params, pathname, router, locale]);
}
