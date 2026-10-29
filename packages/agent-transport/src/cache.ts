/**
 * TtlCache — tiny stale-aware cache for gateway reads. Insights and threads
 * revalidate on gateway events; this just dedupes bursts of identical reads.
 */

interface Entry<T> {
	value: T;
	expiresAt: number;
}

export class TtlCache {
	private entries = new Map<string, Entry<unknown>>();

	constructor(private readonly ttlMs = 5_000) {}

	get<T>(key: string): T | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= Date.now()) {
			this.entries.delete(key);
			return undefined;
		}
		return entry.value as T;
	}

	set<T>(key: string, value: T, ttlMs?: number): void {
		this.entries.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.ttlMs) });
	}

	invalidate(prefix?: string): void {
		if (!prefix) {
			this.entries.clear();
			return;
		}
		for (const key of this.entries.keys()) {
			if (key.startsWith(prefix)) this.entries.delete(key);
		}
	}
}
