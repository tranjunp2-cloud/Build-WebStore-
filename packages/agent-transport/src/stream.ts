import { type AgentEvent, AgentEventSchema } from "@ech/agent-core";

/**
 * StreamChannel — push channel for AgentEvents.
 *
 * Prefers WebSocket; falls back to SSE (EventSource) when WS is unavailable.
 * Auto-reconnects with exponential backoff + jitter; callers just subscribe.
 */

export interface StreamChannelOptions {
	url: string;
	maxRetries?: number;
	heartbeatMs?: number;
}

export type ChannelStatus = "connecting" | "open" | "closed";

interface SocketLike {
	readonly readyState: number;
	send(data: string): void;
	close(): void;
	onopen: (() => void) | null;
	onmessage: ((event: { data: string }) => void) | null;
	onclose: (() => void) | null;
	onerror: (() => void) | null;
}

interface EventSourceLike {
	close(): void;
	onmessage: ((event: { data: string }) => void) | null;
	onerror: (() => void) | null;
}

type SocketFactory = (url: string) => SocketLike;
type EventSourceFactory = (url: string) => EventSourceLike;

const defaultSocketFactory: SocketFactory | null =
	typeof WebSocket !== "undefined" ? (url) => new WebSocket(url) as unknown as SocketLike : null;

const defaultEventSourceFactory: EventSourceFactory | null =
	typeof EventSource !== "undefined" ? (url) => new EventSource(url) as unknown as EventSourceLike : null;

export class StreamChannel {
	private listeners = new Set<(event: AgentEvent) => void>();
	private statusListeners = new Set<(status: ChannelStatus) => void>();
	private socket: SocketLike | EventSourceLike | null = null;
	private retries = 0;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private manuallyClosed = false;

	constructor(
		private readonly options: StreamChannelOptions,
		private readonly socketFactory: SocketFactory | null = defaultSocketFactory,
		private readonly eventSourceFactory: EventSourceFactory | null = defaultEventSourceFactory,
	) {}

	get status(): ChannelStatus {
		if (this.manuallyClosed) return "closed";
		return this.socket ? "open" : "connecting";
	}

	connect(): void {
		this.manuallyClosed = false;
		this.open();
	}

	subscribe(listener: (event: AgentEvent) => void): () => void {
		this.listeners.add(listener);
		if (!this.socket && !this.manuallyClosed) this.open();
		return () => {
			this.listeners.delete(listener);
		};
	}

	onStatus(listener: (status: ChannelStatus) => void): () => void {
		this.statusListeners.add(listener);
		return () => {
			this.statusListeners.delete(listener);
		};
	}

	private open(): void {
		const { url, heartbeatMs = 25_000 } = this.options;
		if (this.socketFactory) {
			const ws = this.socketFactory(url);
			this.socket = ws;
			ws.onopen = () => {
				this.retries = 0;
				this.emitStatus();
				this.heartbeatTimer = setInterval(() => {
					try {
						ws.send(JSON.stringify({ type: "ping" }));
					} catch {
						// send on a closing socket — ignore, onclose drives retry
					}
				}, heartbeatMs);
			};
			ws.onmessage = (event) => this.dispatch(event.data);
			ws.onclose = () => this.scheduleRetry();
			ws.onerror = () => {
				// onclose follows onerror in every implementation
			};
			return;
		}
		if (this.eventSourceFactory) {
			const es = this.eventSourceFactory(url);
			this.socket = es;
			es.onmessage = (event) => this.dispatch(event.data);
			es.onerror = () => this.scheduleRetry();
			this.emitStatus();
			return;
		}
	}

	private dispatch(raw: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}
		const result = AgentEventSchema.safeParse(parsed);
		if (!result.success) return;
		for (const listener of this.listeners) listener(result.data);
	}

	private scheduleRetry(): void {
		this.teardownSocket();
		this.emitStatus();
		if (this.manuallyClosed) return;
		const maxRetries = this.options.maxRetries ?? 8;
		if (this.retries >= maxRetries) return;
		const backoff = Math.min(30_000, 500 * 2 ** this.retries) + Math.random() * 250;
		this.retries += 1;
		this.retryTimer = setTimeout(() => this.open(), backoff);
	}

	private teardownSocket(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		try {
			this.socket?.close();
		} catch {
			// already closed
		}
		this.socket = null;
	}

	private emitStatus(): void {
		const status = this.status;
		for (const listener of this.statusListeners) listener(status);
	}

	close(): void {
		this.manuallyClosed = true;
		if (this.retryTimer) clearTimeout(this.retryTimer);
		this.teardownSocket();
		this.emitStatus();
	}
}
