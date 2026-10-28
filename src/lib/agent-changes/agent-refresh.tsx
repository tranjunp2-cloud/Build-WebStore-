"use client";

import { useRouter } from "next/navigation";
import type { AgentChangeBatch } from "./types";
import { useAgentChanges } from "./use-agent-changes";

let scheduled = false;

/** One refresh however many `AgentRefresh` on the page (layout + page) hear the same burst. */
export function refreshOnce(refresh: () => void): void {
	if (scheduled) return;
	scheduled = true;
	setTimeout(() => {
		scheduled = false;
		refresh();
	}, 50);
}

/**
 * For a server-rendered page: when the assistant changes one of `kinds`, render the page's server data again
 * (client state, scroll and open forms stay). `when` narrows it further (e.g. only changes that can alter a count).
 * Pages that load on the client use `useAgentChanges` and fetch instead.
 */
export function AgentRefresh({ kinds, ids, when }: { kinds: readonly string[]; ids?: readonly string[]; when?: (batch: AgentChangeBatch) => boolean }) {
	const router = useRouter();
	useAgentChanges({ kinds, ids }, (batch) => {
		if (!when || when(batch)) refreshOnce(() => router.refresh());
	});
	return null;
}
