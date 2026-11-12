import type { WorkItem, WorkList, WorkStateInput } from "@ech/agent-core";
import { type AgentGateway, AgentGatewayError } from "@ech/agent-transport";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useGateway } from "./context";
import { workStoreFor } from "./work-store";

export { WORK_CHANNEL, WorkStore, type WorkSnapshot, type WorkStoreEnv, type WorkStoreOptions, workStoreFor } from "./work-store";

export interface WorkResource {
	/** the ranked queue; undefined until read, and always when the gateway has no work queue */
	data: WorkList | undefined;
	loading: boolean;
	error: Error | undefined;
	/** read now (other tabs follow) */
	refresh: () => Promise<void>;
	/** "Later" / "Don't remind me" / "raised now" on one item: shown at once, rolled back (and rejected) when the save fails */
	setState: (key: string, input: WorkStateInput) => Promise<void>;
	/**
	 * Takes an issue off the list at once: a shop issue is hidden until it changes (restore() brings it back);
	 * the assistant's drafts waiting in that chat are discarded; a question it waits on is skipped (the run stops).
	 */
	discard: (item: WorkItem) => Promise<void>;
	/** undoes discard() of a shop issue (the assistant's discarded drafts / skipped question stay as they are) */
	restore: (item: WorkItem) => Promise<void>;
}

/** What discarding does on the assistant's side; the list itself already hid the item. */
export async function discardOnPlatform(gateway: AgentGateway, item: WorkItem): Promise<void> {
	if (item.source !== "ai" || !item.threadId) return;
	if (item.kind === "question") {
		const runId = item.key.startsWith("ai:ask:") ? item.key.slice("ai:ask:".length) : undefined;
		if (runId && gateway.cancelRun) await gateway.cancelRun(runId);
		return;
	}
	if (item.kind !== "review") return;
	const detail = await gateway.getThread(item.threadId);
	const waiting = (detail?.changeSets ?? []).filter((changeSet) => changeSet.status === "pending");
	// one card refused (409: it was applied or decided meanwhile) does not keep the others waiting
	let failure: unknown;
	for (const changeSet of waiting) {
		try {
			await gateway.decideChangeSet(changeSet.id, "reject", "self", "Discarded from Issues");
		} catch (error) {
			if (!(error instanceof AgentGatewayError && error.status === 409)) failure ??= error;
		}
	}
	if (failure !== undefined) throw failure;
}

/**
 * The merchant's work queue (one number for the mascot, the dock and the To do
 * card). Every surface shares one store per gateway; it stays fresh on its own
 * (focus, visibility, every minute, agent events, other tabs).
 */
export function useWork(): WorkResource {
	const gateway = useGateway();
	const store = useMemo(() => workStoreFor(gateway), [gateway]);
	useEffect(() => {
		store.start();
		return () => store.stop();
	}, [store]);
	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
	return useMemo(
		() => ({
			...snapshot,
			refresh: store.refresh,
			setState: store.setState,
			discard: async (item: WorkItem) => {
				// hidden at once and remembered (a new draft or order changes the fingerprint: it comes back)
				await store.setState(item.key, { dismissedFingerprint: item.fingerprint });
				try {
					await discardOnPlatform(gateway, item);
				} finally {
					void store.refresh();
				}
			},
			restore: async (item: WorkItem) => {
				await store.setState(item.key, { dismissedFingerprint: null });
				await store.refresh();
			},
		}),
		[snapshot, store, gateway],
	);
}
