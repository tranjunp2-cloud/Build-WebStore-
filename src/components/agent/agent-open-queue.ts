/**
 * `ech-agent:open` requests (the products ask bar, the mascot placeholder) can come before the dock's code has
 * loaded. The loader holds them here; the dock takes them, in order, as soon as it listens. Once the dock listens,
 * nothing is held: it receives the events itself.
 */
export const AGENT_OPEN_EVENT = "ech-agent:open";

let dockListening = false;
const held: unknown[] = [];

/** Loader: an open request arrived; keep it unless the dock already heard it. */
export function holdAgentOpen(detail: unknown): void {
	if (!dockListening) held.push(detail);
}

/** Dock: it listens now; returns the requests made before it did. */
export function takeHeldAgentOpens(): unknown[] {
	dockListening = true;
	return held.splice(0);
}

/** Dock: it stopped listening (unmount, or re-subscribing). */
export function dockStoppedListening(): void {
	dockListening = false;
}
