import { ANY_ENTITY, type AgentChange, type AgentChangeEntity } from "./types";

export const AGENT_CHANGE_EVENT = "ech-agent:change";
const CHANNEL = "ech-agent-changes";

let channel: BroadcastChannel | null | undefined;

const isEntity = (v: unknown): v is AgentChangeEntity =>
	typeof v === "object" && v !== null && typeof (v as AgentChangeEntity).kind === "string" && typeof (v as AgentChangeEntity).id === "string";

/** A message from another tab is data from outside this page: only a well-formed change gets through. */
function isAgentChange(v: unknown): v is AgentChange {
	if (typeof v !== "object" || v === null) return false;
	const c = v as Partial<AgentChange>;
	return (c.action === "applied" || c.action === "undone") && typeof c.kind === "string" && typeof c.changeSetId === "string" && typeof c.at === "number" && Array.isArray(c.entities) && c.entities.every(isEntity);
}

const deliver = (change: AgentChange) => window.dispatchEvent(new CustomEvent<AgentChange>(AGENT_CHANGE_EVENT, { detail: change }));

/** The page's tab-to-tab line, opened once and only where the browser has it. */
function tabChannel(): BroadcastChannel | null {
	if (channel !== undefined) return channel;
	channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
	channel?.addEventListener("message", (e: MessageEvent) => {
		if (isAgentChange(e.data)) deliver(e.data);
	});
	return channel;
}

/** The assistant applied or undid a change: tell every screen in this tab, and the other open tabs. */
export function announceAgentChange(change: AgentChange): void {
	if (typeof window === "undefined") return;
	deliver(change);
	try {
		tabChannel()?.postMessage(change);
	} catch {
		// a closed channel or an unclonable value must never break the approve that just worked
	}
}

/** Start hearing other tabs. Called by the hook; a tab that never listens never opens the channel. */
export function listenToOtherTabs(): void {
	if (typeof window !== "undefined") tabChannel();
}

/** Is this one of these entity kinds (and, when given, one of these ids)? A "*" id (kind only known) always matches. */
export function entityMatches(e: AgentChangeEntity, kinds?: readonly string[], ids?: readonly string[]): boolean {
	return (!kinds || kinds.includes(e.kind)) && (!ids || e.id === ANY_ENTITY || ids.includes(e.id));
}

/** Tests only: forget the channel so the next call opens a fresh one. */
export function resetAgentChangeBus(): void {
	channel?.close();
	channel = undefined;
}
