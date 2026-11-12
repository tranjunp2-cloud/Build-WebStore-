import type { WorkItem } from "@ech/agent-core";

/**
 * A short memory for the shop part of the work queue: the dock and the mascot
 * ask for it every 60 s while visible, so it is kept 3 minutes (a 60 s memory
 * expires right before each poll) per workspace + user + language.
 * In-memory per server instance, bounded (least recently read dropped first);
 * failed or partial results are not remembered (the next ask tries again);
 * concurrent asks share one load.
 */

export const SHOP_WORK_TTL_MS = 180_000;
const MAX_ENTRIES = 5_000;

export interface ShopWork {
	items: WorkItem[];
	partial: boolean;
}

type Entry = { at: number; value: Promise<ShopWork> };
const entries = new Map<string, Entry>();

export function shopWorkCacheKey(parts: { tenantId: string; userId: string; locale: string }): string {
	return `${parts.tenantId}|${parts.userId}|${parts.locale}`;
}

export function cachedShopWork(key: string, load: () => Promise<ShopWork>, now: number = Date.now()): Promise<ShopWork> {
	const hit = entries.get(key);
	if (hit && now - hit.at < SHOP_WORK_TTL_MS) {
		// LRU: a hit moves to the newest end
		entries.delete(key);
		entries.set(key, hit);
		return hit.value;
	}
	const value = load();
	const entry: Entry = { at: now, value };
	entries.set(key, entry);
	const forget = () => {
		if (entries.get(key) === entry) entries.delete(key);
	};
	value.then((result) => result.partial && forget(), forget);
	while (entries.size > MAX_ENTRIES) {
		const oldest = entries.keys().next().value;
		if (oldest === undefined) break;
		entries.delete(oldest);
	}
	return value;
}

/** Tests only. */
export function clearShopWorkCache(): void {
	entries.clear();
}
