import { type AgentEvent, isTerminalStatus, type WorkList, type WorkState, type WorkStateInput } from "@ech/agent-core";
import type { AgentGateway } from "@ech/agent-transport";

export interface WorkSnapshot {
	/** undefined until the first read, and always when the gateway has no work queue */
	data: WorkList | undefined;
	loading: boolean;
	error: Error | undefined;
}

type Listenable = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type BroadcastLike = Listenable & Pick<BroadcastChannel, "postMessage" | "close">;

/** Browser hooks the store listens to; tests pass fakes. Missing ones are skipped. */
export interface WorkStoreEnv {
	window?: Listenable;
	document?: Listenable & { visibilityState: string };
	BroadcastChannel?: new (name: string) => BroadcastLike;
}

export interface WorkStoreOptions {
	/** refetch cadence while the page is visible (default 60 s) */
	pollMs?: number;
	/** bursts of events / focus collapse into one read (default 500 ms) */
	debounceMs?: number;
	channelName?: string;
	env?: WorkStoreEnv;
}

/** What tabs tell each other: "the queue changed at `at`" (the others refetch). */
interface WorkPing {
	at: number;
	from: string;
}

export const WORK_CHANNEL = "ech-agent-work";

function browserEnv(): WorkStoreEnv {
	const g = globalThis as { window?: Listenable; document?: WorkStoreEnv["document"]; BroadcastChannel?: WorkStoreEnv["BroadcastChannel"] };
	return { window: g.window, document: g.document, BroadcastChannel: g.BroadcastChannel };
}

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** The merchant's choice applied locally: state merged, an item dismissed at its fingerprint leaves the list. */
function applyState(list: WorkList, key: string, input: WorkStateInput, updatedAt: string): WorkList {
	const prev = list.states.find((s) => s.key === key);
	const pick = (next: string | null | undefined, old: string | undefined) => (next === undefined ? old : (next ?? undefined));
	const state: WorkState = {
		key,
		snoozedUntil: pick(input.snoozedUntil, prev?.snoozedUntil),
		dismissedFingerprint: pick(input.dismissedFingerprint, prev?.dismissedFingerprint),
		lastRaisedAt: input.lastRaisedAt ?? prev?.lastRaisedAt,
		updatedAt,
	};
	return {
		...list,
		items: list.items.filter((item) => item.key !== key || item.fingerprint !== state.dismissedFingerprint),
		states: [...list.states.filter((s) => s.key !== key), state],
	};
}

/**
 * The work queue for one gateway, independent of React (`useWork` mirrors it).
 * Reads on start, on focus / the tab becoming visible, every minute while
 * visible, and after gateway events that change what waits on the merchant;
 * tells other tabs over a BroadcastChannel when it read or wrote something new.
 */
export class WorkStore {
	private snapshot: WorkSnapshot = { data: undefined, loading: false, error: undefined };
	private readonly listeners = new Set<() => void>();
	private readonly pollMs: number;
	private readonly debounceMs: number;
	private readonly channelName: string;
	private readonly env: WorkStoreEnv;
	private readonly tabId = Math.random().toString(36).slice(2, 10);
	private users = 0;
	private seq = 0;
	/** when the newest applied read was sent: a ping older than that is already covered */
	private readAt = 0;
	/** choices still being saved: re-applied over reads that started before them */
	private saving = new Map<string, WorkStateInput>();
	private teardown: (() => void) | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private channel: BroadcastLike | null = null;

	constructor(
		private readonly gateway: AgentGateway,
		options: WorkStoreOptions = {},
	) {
		this.pollMs = options.pollMs ?? 60_000;
		this.debounceMs = options.debounceMs ?? 500;
		this.channelName = options.channelName ?? WORK_CHANNEL;
		this.env = options.env ?? browserEnv();
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	getSnapshot = (): WorkSnapshot => this.snapshot;

	private set(patch: Partial<WorkSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...patch };
		for (const listener of this.listeners) listener();
	}

	/** One more surface shows the queue; the first starts the reads. */
	start(): void {
		this.users += 1;
		if (this.users > 1 || !this.gateway.listWork) return;
		const offs: Array<() => void> = [];
		const visible = () => !this.env.document || this.env.document.visibilityState === "visible";
		const soon = () => this.schedule();
		offs.push(this.gateway.subscribe((event) => this.onEvent(event)));
		const { window, document } = this.env;
		if (window) {
			window.addEventListener("focus", soon);
			offs.push(() => window.removeEventListener("focus", soon));
		}
		if (document) {
			const onVisibility = () => {
				if (visible()) this.schedule();
			};
			document.addEventListener("visibilitychange", onVisibility);
			offs.push(() => document.removeEventListener("visibilitychange", onVisibility));
		}
		const poll = setInterval(() => {
			if (visible()) void this.refresh();
		}, this.pollMs);
		offs.push(() => clearInterval(poll));
		if (this.env.BroadcastChannel) {
			try {
				const channel = new this.env.BroadcastChannel(this.channelName);
				const onMessage = (event: Event) => this.onPing((event as MessageEvent<WorkPing | undefined>).data);
				channel.addEventListener("message", onMessage);
				this.channel = channel;
				offs.push(() => {
					channel.removeEventListener("message", onMessage);
					channel.close();
					this.channel = null;
				});
			} catch {
				// no cross-tab updates: each tab still refetches on its own
			}
		}
		this.teardown = () => {
			for (const off of offs) off();
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		};
		void this.refresh();
	}

	/** A surface went away; the last one stops the reads (data stays for the next mount). */
	stop(): void {
		this.users = Math.max(0, this.users - 1);
		if (this.users > 0) return;
		this.teardown?.();
		this.teardown = null;
		this.seq += 1;
		if (this.snapshot.loading) this.set({ loading: false });
	}

	private onEvent(event: AgentEvent): void {
		const ends = event.type === "run.status" && (isTerminalStatus(event.status) || event.status === "awaiting_input");
		if (ends || event.type === "changeset.staged" || event.type === "changeset.decided" || event.type === "thread.deleted") {
			this.schedule();
		}
	}

	private onPing(ping: WorkPing | undefined): void {
		if (!ping || ping.from === this.tabId) return;
		// our newest read started after the other tab's change: nothing new to fetch
		if (this.readAt >= ping.at) return;
		this.schedule(false);
	}

	private schedule(announce = true): void {
		if (!this.teardown) return;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.read(announce);
		}, this.debounceMs);
	}

	private announce(): void {
		try {
			this.channel?.postMessage({ at: Date.now(), from: this.tabId } satisfies WorkPing);
		} catch {
			// the channel closed under us (tab unloading)
		}
	}

	/** Reads the queue now (the other tabs are told when it worked). */
	refresh = (): Promise<void> => this.read(true);

	private async read(announce: boolean): Promise<void> {
		if (!this.gateway.listWork) return;
		const seq = ++this.seq;
		const startedAt = Date.now();
		this.set({ loading: true });
		try {
			let data = await this.gateway.listWork();
			if (seq !== this.seq) return;
			for (const [key, input] of this.saving) data = applyState(data, key, input, new Date().toISOString());
			this.readAt = startedAt;
			this.set({ data, loading: false, error: undefined });
			if (announce) this.announce();
		} catch (error) {
			if (seq === this.seq) this.set({ loading: false, error: asError(error) });
		}
	}

	/** Saves the merchant's choice on an item; shown at once, undone if the save fails (and rethrown). */
	setState = async (key: string, input: WorkStateInput): Promise<void> => {
		if (!this.gateway.setWorkState) return;
		const before = this.snapshot.data;
		const readAt = this.readAt;
		this.saving.set(key, input);
		if (before) this.set({ data: applyState(before, key, input, new Date().toISOString()) });
		try {
			const saved = await this.gateway.setWorkState(key, input);
			this.saving.delete(key);
			const data = this.snapshot.data;
			if (data) this.set({ data: { ...data, states: [...data.states.filter((s) => s.key !== key), saved] }, error: undefined });
			this.announce();
		} catch (error) {
			this.saving.delete(key);
			// undone: back to the list as it was, or to the server's word when a read landed meanwhile
			if (this.readAt === readAt) this.set({ data: before, error: asError(error) });
			else {
				this.set({ error: asError(error) });
				void this.read(false);
			}
			throw error;
		}
	};
}

const stores = new WeakMap<AgentGateway, WorkStore>();

/** One queue per gateway: the mascot, the dock and the page card share reads and choices. */
export function workStoreFor(gateway: AgentGateway): WorkStore {
	let store = stores.get(gateway);
	if (!store) {
		store = new WorkStore(gateway);
		stores.set(gateway, store);
	}
	return store;
}
