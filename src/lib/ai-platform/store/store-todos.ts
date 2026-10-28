import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { areasOf } from "@/lib/insights/area-access";
import { computeShopTodos } from "@/lib/insights/shop-todo";
import { shopDayKey } from "@/lib/reports/shop-time";
import type { AgentActor } from "../context";

/**
 * The shop's To do list for the copilot (`store.todos`, read-only): the same tasks as the dashboard's
 * To do card (orders waiting, payment proofs, unshipped orders, stock, product info, discounts about to end,
 * website problems, unanswered messages), limited to the areas this member can open. Each task carries a
 * `prompt` the copilot can offer or act on.
 */

export const StoreTodosInputSchema = z.object({
	limit: z.number().int().min(1).max(20).nullish(),
	/** check this website for links / SEO / unpublished changes (default: the first one) */
	siteId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[1-9]\d{0,9}$/)).nullish(),
});

export async function readStoreTodos(actor: AgentActor, raw: unknown, now: Date = new Date()) {
	const input = StoreTodosInputSchema.parse(raw ?? {});
	const cms = await getPayload({ config });
	const items = await computeShopTodos(cms, {
		tenantId: actor.tenantId,
		siteId: input.siteId ?? null,
		now,
		locale: actor.locale === "ms" ? "ms" : "en",
		areas: areasOf(actor.user, actor.tenantId),
	});
	const shown = items.slice(0, input.limit ?? 10);
	return {
		note: "What needs the merchant's attention right now, most urgent first (only parts their role can open). Say what is waiting with the exact counts; offer to start on the first one. `prompt` is what the merchant would ask to fix it.",
		today: shopDayKey(now),
		total: items.length,
		items: shown.map(({ kind, severity, title, detail, count, href, prompt }) => ({ kind, severity, title, detail, count, page: href, prompt })),
		...(items.length > shown.length ? { more: items.length - shown.length } : {}),
		...(items.length === 0 ? { allClear: true } : {}),
	};
}
