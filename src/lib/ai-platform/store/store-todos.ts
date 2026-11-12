import "server-only";

import config from "@payload-config";
import { getPayload } from "payload";
import { z } from "zod";
import { areasOf } from "@/lib/insights/area-access";
import { readShopSetup } from "@/lib/insights/shop-setup";
import { computeShopTodos } from "@/lib/insights/shop-todo";
import { shopDayKey } from "@/lib/reports/shop-time";
import type { AgentActor } from "../context";

/**
 * The shop's To do list for the copilot (`store.todos`, read-only): the same tasks as the dashboard's
 * To do card (orders waiting, payment proofs, unshipped orders, stock, product info, discounts about to end,
 * website problems, unanswered messages), limited to the areas this member can open. Each task carries a
 * `prompt` the copilot can offer or act on.
 *
 * `setup` is a separate list for the copilot only (payments, business details, domain, products with no stock / price
 * or with stock pictures): what keeps the shop from being ready to sell. The dashboard To do card, the mascot badge and
 * the scheduled automations never see it.
 */

export const StoreTodosInputSchema = z.object({
	limit: z.number().int().min(1).max(20).nullish(),
	/** check this website for links / SEO / unpublished changes (default: the first one) */
	siteId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^[1-9]\d{0,9}$/)).nullish(),
});

export async function readStoreTodos(actor: AgentActor, raw: unknown, now: Date = new Date()) {
	const input = StoreTodosInputSchema.parse(raw ?? {});
	const cms = await getPayload({ config });
	const locale = actor.locale === "ms" ? "ms" : "en";
	const areas = areasOf(actor.user, actor.tenantId);
	const [items, setup] = await Promise.all([
		computeShopTodos(cms, { tenantId: actor.tenantId, siteId: input.siteId ?? null, now, locale, areas }),
		// a setup read that fails must not take the To do list down with it
		readShopSetup(cms, { tenantId: actor.tenantId, siteId: input.siteId ?? null, locale, areas }).catch((error) => {
			console.error("[store-todos] setup unavailable", error instanceof Error ? error.message : error);
			return [];
		}),
	]);
	const shown = items.slice(0, input.limit ?? 10);
	return {
		note: "What needs the merchant's attention right now, most urgent first (only parts their role can open). Say what is waiting with the exact counts; offer to start on the first one. `prompt` is what the merchant would ask to fix it. `setup` lists what keeps the shop from being ready to sell (payments, business details, domain, products with no stock / price or with stock pictures): include it when they ask whether the shop is ready to sell or what is missing.",
		today: shopDayKey(now),
		total: items.length,
		items: shown.map(({ kind, severity, title, detail, count, href, prompt }) => ({ kind, severity, title, detail, count, page: href, prompt })),
		// what is missing before the shop can sell (separate from the To do list); empty = nothing missing in the parts they can open
		setup: setup.map(({ kind, severity, title, detail, count, href, prompt }) => ({ kind, severity, title, detail, count, page: href, prompt })),
		...(items.length > shown.length ? { more: items.length - shown.length } : {}),
		...(items.length === 0 && setup.length === 0 ? { allClear: true } : {}),
	};
}
