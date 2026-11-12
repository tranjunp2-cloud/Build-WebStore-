import "server-only";

import { revalidateTag } from "next/cache";
import { invalidateTodoCache } from "@/lib/dashboard/todo-cache";

/**
 * What the dashboard remembers on the server about a workspace, forgotten after the copilot applied or undid a change
 * (also after a failed apply: it may have written part of it before putting it back):
 * - the shop's To do list (work queue, 3 min memory);
 * - the sidebar badge counts (`unstable_cache`, 60 s). Orders and products already bust it from their collection hooks;
 *   customers and discounts have no hook, and one change set may touch several kinds, so it is cleared once here.
 * Pages and storefront reads need nothing here: product and blog pages are `force-dynamic`, and site / page writes
 * revalidate `site-<id>` from their collection hooks.
 */
export function invalidateAfterAgentWrite(tenantId: string | number): void {
	invalidateTodoCache(tenantId);
	try {
		revalidateTag(`sidebar-badge-counts:${String(tenantId)}`, { expire: 0 });
	} catch {
		// outside a request scope (tests, scripts): the cache expires on its own TTL
	}
}
