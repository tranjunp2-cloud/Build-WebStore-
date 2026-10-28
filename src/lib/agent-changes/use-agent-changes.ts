"use client";

import { useEffect, useRef } from "react";
import { AGENT_CHANGE_EVENT, entityMatches, listenToOtherTabs } from "./bus";
import type { AgentChange, AgentChangeBatch } from "./types";

export const COALESCE_MS = 150;

export type AgentChangeFilter = {
	/** entity kinds this screen shows; omitted = any change */
	kinds?: readonly string[];
	/** record ids this screen shows (a detail page); changes that only name a kind match too */
	ids?: readonly string[];
	enabled?: boolean;
};

/**
 * Runs `handler` once per burst of assistant changes that touch what this screen shows. Changes landing within
 * ~150 ms (an "Approve all", the steps of one card, a change heard from another tab) arrive as one batch, so a
 * screen fetches at most once per burst. The handler may change on every render; the latest one runs.
 */
export function useAgentChanges(filter: AgentChangeFilter, handler: (batch: AgentChangeBatch) => void): void {
	const handlerRef = useRef(handler);
	handlerRef.current = handler;
	const { enabled = true } = filter;
	const kindsKey = filter.kinds?.join("|");
	const idsKey = filter.ids?.join("|");

	useEffect(() => {
		if (!enabled) return;
		const kinds = kindsKey === undefined ? undefined : kindsKey.split("|");
		const ids = idsKey === undefined ? undefined : idsKey.split("|");
		let queued: AgentChange[] = [];
		let timer: ReturnType<typeof setTimeout> | undefined;

		const flush = () => {
			timer = undefined;
			const changes = queued;
			queued = [];
			handlerRef.current({ changes, entities: changes.flatMap((c) => c.entities).filter((e) => entityMatches(e, kinds, ids)) });
		};
		const onChange = (e: Event) => {
			const change = (e as CustomEvent<AgentChange>).detail;
			if (!change?.entities.some((e) => entityMatches(e, kinds, ids))) return;
			queued.push(change);
			timer ??= setTimeout(flush, COALESCE_MS);
		};

		listenToOtherTabs();
		window.addEventListener(AGENT_CHANGE_EVENT, onChange);
		return () => {
			window.removeEventListener(AGENT_CHANGE_EVENT, onChange);
			if (timer) clearTimeout(timer);
		};
	}, [enabled, kindsKey, idsKey]);
}
