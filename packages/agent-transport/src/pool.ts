/**
 * RequestPool — small concurrency limiter + in-flight GET coalescing.
 * Keeps the UI snappy: identical reads issued by several widgets share one
 * network request; close() aborts in-flight work (page unmount / teardown).
 * The pool reopens on the next request — React StrictMode remounts call
 * close() then keep using the same gateway.
 */

export interface PoolOptions {
	concurrency?: number;
	timeoutMs?: number;
}

interface QueuedTask {
	run: (signal: AbortSignal) => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
}

export class RequestPool {
	private readonly concurrency: number;
	private readonly timeoutMs: number;
	private active = 0;
	private queue: QueuedTask[] = [];
	private inflightGet = new Map<string, Promise<unknown>>();
	private controllers = new Set<AbortController>();

	constructor(options: PoolOptions = {}) {
		this.concurrency = options.concurrency ?? 6;
		this.timeoutMs = options.timeoutMs ?? 15_000;
	}

	/** Coalescing GET — one in-flight request per key. */
	async get<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>): Promise<T> {
		const existing = this.inflightGet.get(key);
		if (existing) return existing as Promise<T>;
		const promise = this.schedule(fetcher);
		this.inflightGet.set(key, promise);
		try {
			return await promise;
		} finally {
			// only our own entry — a newer request for the key may have replaced it
			if (this.inflightGet.get(key) === promise) this.inflightGet.delete(key);
		}
	}

	/** Writes never coalesce. */
	mutate<T>(fetcher: (signal: AbortSignal) => Promise<T>): Promise<T> {
		return this.schedule(fetcher);
	}

	private schedule<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push({
				run: run as (signal: AbortSignal) => Promise<unknown>,
				resolve: resolve as (value: unknown) => void,
				reject,
			});
			this.drain();
		});
	}

	private drain(): void {
		while (this.active < this.concurrency && this.queue.length > 0) {
			const task = this.queue.shift();
			if (!task) return;
			this.active += 1;
			const controller = new AbortController();
			this.controllers.add(controller);
			const timer = setTimeout(() => controller.abort(), this.timeoutMs);
			task
				.run(controller.signal)
				.then(task.resolve, task.reject)
				.finally(() => {
					clearTimeout(timer);
					this.controllers.delete(controller);
					this.active -= 1;
					this.drain();
				});
		}
	}

	get pendingCount(): number {
		return this.queue.length;
	}

	close(): void {
		for (const controller of this.controllers) controller.abort(new DOMException("The agent gateway was closed.", "AbortError"));
		this.controllers.clear();
		// a read aborted here must not be handed to the next caller (StrictMode remounts reuse the pool)
		this.inflightGet.clear();
		const error = new Error("pool is closed");
		for (const task of this.queue.splice(0)) task.reject(error);
	}
}
