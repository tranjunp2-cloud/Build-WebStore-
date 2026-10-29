import type {
	AgentEvent,
	AgentRun,
	AutonomyLevel,
	AutonomyPolicy,
	ChangeSet,
	Conversation,
	ConversationMessage,
	Insight,
	ReconcileResult,
	StartRunInput,
} from "@ech/agent-core";
import type { ChangeSetDecision, ChangeSetQuery, ConversationQuery, DecideOptions, InsightQuery } from "@ech/agent-transport";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { useGateway } from "./context";

export interface Resource<T> {
	data: T | undefined;
	loading: boolean;
	error: Error | null;
	refresh: () => void;
}

/**
 * Read resource with auto-refresh on matching gateway events.
 * e.g. changeSets refetch when a "changeset.*" event arrives.
 */
function useResource<T>(
	loader: () => Promise<T>,
	deps: readonly unknown[],
	invalidateOn?: ReadonlyArray<AgentEvent["type"]>,
): Resource<T> {
	const gateway = useGateway();
	const [data, setData] = useState<T | undefined>(undefined);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const loaderRef = useRef(loader);
	loaderRef.current = loader;

	const refresh = useCallback(() => {
		setLoading(true);
		loaderRef
			.current()
			.then((value) => {
				setData(value);
				setError(null);
			})
			.catch((err: unknown) => setError(err instanceof Error ? err : new Error(String(err))))
			.finally(() => setLoading(false));
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps are caller-controlled inputs
	useEffect(refresh, deps);

	useEffect(() => {
		if (!invalidateOn || invalidateOn.length === 0) return;
		const watched = new Set<string>(invalidateOn);
		return gateway.subscribe((event) => {
			if (watched.has(event.type)) refresh();
		});
	}, [gateway, invalidateOn, refresh]);

	return { data, loading, error, refresh };
}

export function useInsights(query?: InsightQuery): Resource<Insight[]> {
	const gateway = useGateway();
	return useResource(() => gateway.listInsights(query), [query?.kind, query?.limit]);
}

export function useChangeSets(query?: ChangeSetQuery): Resource<ChangeSet[]> {
	const gateway = useGateway();
	return useResource(
		() => gateway.listChangeSets(query),
		[query?.status, query?.limit],
		["changeset.staged", "changeset.decided", "thread.deleted"],
	);
}

export function useConversations(query?: ConversationQuery): Resource<Conversation[]> {
	const gateway = useGateway();
	return useResource(() => gateway.listConversations(query), [query?.status, query?.limit], ["conversation.message"]);
}

export function useRuns(limit = 20): Resource<AgentRun[]> {
	const gateway = useGateway();
	return useResource(() => gateway.listRuns(limit), [limit], ["run.status"]);
}

export function useAutonomy(): Resource<AutonomyPolicy> & {
	setLevel: (domain: string, level: AutonomyLevel) => Promise<void>;
} {
	const gateway = useGateway();
	const resource = useResource(() => gateway.getAutonomyPolicy(), []);
	const setLevel = useCallback(
		async (domain: string, level: AutonomyLevel) => {
			await gateway.setDomainAutonomy(domain, level);
			resource.refresh();
		},
		[gateway, resource.refresh],
	);
	return { ...resource, setLevel };
}

export interface ActiveRun {
	run: AgentRun | undefined;
	events: AgentEvent[];
	start: (input: StartRunInput) => Promise<AgentRun>;
	busy: boolean;
}

/** Start a run and track its live event stream. */
export function useAgentRun(): ActiveRun {
	const gateway = useGateway();
	const [run, setRun] = useState<AgentRun | undefined>(undefined);
	const [events, setEvents] = useState<AgentEvent[]>([]);
	const [busy, setBusy] = useState(false);

	const start = useCallback(
		async (input: StartRunInput) => {
			setBusy(true);
			setEvents([]);
			try {
				const created = await gateway.startRun(input);
				setRun(created);
				return created;
			} finally {
				setBusy(false);
			}
		},
		[gateway],
	);

	useEffect(() => {
		if (!run) return;
		const id = run.id;
		return gateway.subscribe((event) => {
			if ("runId" in event && event.runId === id) setEvents((prev) => [...prev, event]);
		});
	}, [gateway, run]);

	return { run, events, start, busy };
}

export function useDecideChangeSet(): (
	id: string,
	decision: ChangeSetDecision,
	actor: string,
	note?: string,
	options?: DecideOptions,
) => Promise<ChangeSet> {
	const gateway = useGateway();
	return useCallback(
		(id, decision, actor, note, options) => gateway.decideChangeSet(id, decision, actor, note, options),
		[gateway],
	);
}

/** Undo of an applied change; undefined when the gateway can't undo. */
export function useUndoChangeSet(): ((id: string) => Promise<ChangeSet>) | undefined {
	const gateway = useGateway();
	return useMemo(() => (gateway.undoChangeSet ? (id: string) => gateway.undoChangeSet!(id) : undefined), [gateway]);
}

/** The site editor's Undo / Redo (or opening) checks an applied change against the page; undefined when the gateway can't. */
export function useReconcileChangeSet(): ((id: string) => Promise<ReconcileResult>) | undefined {
	const gateway = useGateway();
	return useMemo(() => (gateway.reconcileChangeSet ? (id: string) => gateway.reconcileChangeSet!(id) : undefined), [gateway]);
}

export function useSendReply(): (input: {
	conversationId: string;
	body: string;
	fromDraftId?: string;
}) => Promise<ConversationMessage> {
	const gateway = useGateway();
	return useCallback((input) => gateway.sendReply(input), [gateway]);
}
