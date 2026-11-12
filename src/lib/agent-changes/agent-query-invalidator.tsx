"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { queryKeys, type QueryScope } from "@/hooks/queries/query-keys";
import { refreshQueries } from "@/hooks/queries/refresh-queries";
import { useQueryScope } from "@/providers/query-provider";
import { ANY_ENTITY, type AgentChangeBatch } from "./types";
import { useAgentChanges } from "./use-agent-changes";

/**
 * What an assistant-changed entity makes stale in the dashboard's React Query cache. A detail screen refetches only
 * when the change names its record (or names none: id "*").
 */
export const AGENT_KIND_QUERY_KEYS: Record<string, (scope: QueryScope, id: string) => QueryKey[]> = {
	product: (s) => [queryKeys.products.lists(s)],
	// categories feed the filters and the product rows' category labels
	store_category: (s) => [queryKeys.products.all(s)],
	// lists + awaiting chip (orders.lists), tab counts, every customer's orders tab, this order's detail; the customer
	// rows carry order stats
	store_order: (s, id) => [
		queryKeys.orders.lists(s),
		queryKeys.orders.metrics(s),
		queryKeys.customers.ordersAll(s),
		id === ANY_ENTITY ? queryKeys.orders.details(s) : queryKeys.orders.detail(s, id),
		queryKeys.customers.lists(s),
	],
	store_customer: (s) => [queryKeys.customers.all(s)],
	// lists and the tab counts
	store_discount: (s) => [queryKeys.discounts.all(s)],
	blog_post: (s) => [queryKeys.blog.lists(s)],
};

const KINDS = Object.keys(AGENT_KIND_QUERY_KEYS);

/** The query keys one burst of assistant changes makes stale (deduplicated). */
export function queryKeysForAgentBatch(batch: AgentChangeBatch, scope: QueryScope): QueryKey[] {
	const seen = new Map<string, QueryKey>();
	for (const entity of batch.entities) {
		for (const key of AGENT_KIND_QUERY_KEYS[entity.kind]?.(scope, String(entity.id)) ?? []) seen.set(JSON.stringify(key), key);
	}
	return [...seen.values()];
}

/**
 * Mounted once inside the dashboard's QueryProvider: when the assistant applies or undoes a change, every cached
 * list it touches is marked stale (on-screen ones refetch, off-screen ones on next open). `router.refresh()`
 * (AgentRefresh) only reaches server-rendered data, never this cache.
 */
export function AgentQueryInvalidator() {
	const queryClient = useQueryClient();
	const scope = useQueryScope();
	useAgentChanges({ kinds: KINDS }, (batch) => {
		for (const key of queryKeysForAgentBatch(batch, scope)) void refreshQueries(queryClient, key);
	});
	return null;
}
